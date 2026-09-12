// Actual Three.js intersections, transforms and TransformControls; pointer
// delivery is controlled here. These tests do not claim browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStore } from 'zustand/vanilla';
import { canSelectObjects, createObjectPicker, objectOutlineInWorld, pickObjectAtNdc,
  selectedObjectBody, visibleObjectBodies } from '../src/three/ObjectPicker.ts';
import { createTransformGizmo } from '../src/three/TransformGizmo.ts';
import { useKinetiCADStore as actualStore } from '../src/state/store.ts';

const close = (actual, expected, tolerance=1e-5) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} != ${expected}`);
const near = (actual, expected) => actual.forEach((value,i)=>close(value,expected[i]));
const part = id => ({id,name:id,visible:true,materialId:'steel-1018',sketches:[],features:[],transform:{positionMm:[0,0,0],rotationDeg:[0,0,0]}});
const model = (ids=['front','back']) => ({id:'objects',name:'Objects',parts:ids.map(part),mates:[],groundPartId:'',booleanFeatures:[]});
const camera = () => {
  const camera=new THREE.PerspectiveCamera(45,1,0.1,1000);
  camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  return camera;
};
const topology = () => ({edges:[{id:'edge',polyline:new Float32Array([-5,-5,0,5,-5,0])}],faces:[],faceForTriangle:new Uint32Array()});
function mesh(z=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial({color:0x778899}));
  mesh.position.z=z;return mesh;
}
function layers(nativeEntries, booleanEntries=[]) {
  const group=new THREE.Group(), resultGroup=new THREE.Group();
  for(const entry of nativeEntries) group.add(entry.mesh);
  for(const entry of booleanEntries) resultGroup.add(entry.mesh);
  return {
    partMeshLayer:{group,forEachVisible(fn){for(const entry of nativeEntries) if(entry.mesh.visible) fn(entry.id,entry.mesh,entry.topology);}},
    booleanResultLayer:{group:resultGroup,getVisiblePartMeshes(){return resultGroup.visible?booleanEntries.filter(e=>e.mesh.visible).map(e=>({partId:`boolean:${e.id}`,mesh:e.mesh,topology:e.topology,solidCount:e.solidCount,hash:'display-current'})):[];}},
  };
}
function disposeLayers(value) {
  for(const group of [value.partMeshLayer.group,value.booleanResultLayer.group]) group.traverse(object=>{
    object.geometry?.dispose();object.material?.dispose();
  });
}
function state(assembly=model()) {
  return {assembly,mode:'modeller',simulation:{running:false},pickingMode:'idle',historyBusy:false,
    sketchSession:{active:false},sketchDimensionsEditing:false,featureEditor:{open:false},booleanEditor:{open:false},mateEditor:{open:false},selection:null};
}
const body = (id, object, kind='part') => ({selection:kind==='part'?{kind,partId:id}:{kind,booleanId:id},mesh:object,topology:topology()});

test('real raycast selects the nearest visible solid, ignores hidden ancestors and clears an empty ray',()=>{
  const front=mesh(20),back=mesh(0),group=new THREE.Group();group.add(front);
  const bodies=[body('back',back),body('front',front)],c=camera();
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(0,0),bodies).selection.partId,'front');
  group.visible=false;
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(0,0),bodies).selection.partId,'back');
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(.9,.9),bodies),null);
  for(const object of [front,back]) {object.geometry.dispose();object.material.dispose();}
});

test('actual mesh holes pass the ray through to the visible body behind them',()=>{
  const shape=new THREE.Shape().moveTo(-15,-15).lineTo(15,-15).lineTo(15,15).lineTo(-15,15).closePath();
  const hole=new THREE.Path().absarc(0,0,4,0,2*Math.PI,true);shape.holes.push(hole);
  const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:3,bevelEnabled:false}),new THREE.MeshBasicMaterial());
  plate.position.z=20;const rear=mesh();const c=camera();
  const bodies=[body('plate',plate),body('rear',rear)];
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(0,0),bodies).selection.partId,'rear');
  const onPlate=new THREE.Vector3(10,0,23).project(c);
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(onPlate.x,onPlate.y),bodies).selection.partId,'plate');
  for(const object of [plate,rear]) {object.geometry.dispose();object.material.dispose();}
});

test('hidden Boolean inputs are excluded even before the render layer catches up; compounds stay selectable',()=>{
  const assembly=model(['front','back']);assembly.booleanFeatures=[{id:'union',hideInputs:true,inputPartIds:['front','back']}];
  const compoundGeometry=new THREE.BufferGeometry();
  const first=new THREE.BoxGeometry(10,10,10).toNonIndexed(),second=new THREE.BoxGeometry(10,10,10).toNonIndexed();
  first.translate(-15,0,0);second.translate(15,0,0);
  const a=first.getAttribute('position').array,b=second.getAttribute('position').array,positions=new Float32Array(a.length+b.length);
  positions.set(a);positions.set(b,a.length);compoundGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  first.dispose();second.dispose();
  const compound=new THREE.Mesh(compoundGeometry,new THREE.MeshBasicMaterial());
  const value=layers([{id:'front',mesh:mesh(30),topology:topology()},{id:'back',mesh:mesh(),topology:topology()}],
    [{id:'union',mesh:compound,topology:topology(),solidCount:2}]);
  try {
    const bodies=visibleObjectBodies({assembly},value);assert.equal(bodies.length,1);
    for(const x of [-15,15]) {
      const p=new THREE.Vector3(x,0,5).project(camera());
      assert.deepEqual(pickObjectAtNdc(camera(),new THREE.Vector2(p.x,p.y),bodies).selection,{kind:'boolean',booleanId:'union'});
    }
    value.booleanResultLayer.group.visible=false;
    assert.equal(visibleObjectBodies({assembly},value).length,0);
    assembly.booleanFeatures[0].hideInputs=false;
    assert.equal(visibleObjectBodies({assembly},value).length,2);
    value.partMeshLayer.group.visible=false;
    assert.equal(visibleObjectBodies({assembly},value).length,0);
  } finally {disposeLayers(value);}
});

test('coincident visible source/result surfaces deterministically select the finished result',()=>{
  const source=mesh(),result=mesh(),c=camera();
  for(const bodies of [[body('source',source),body('result',result,'boolean')],[body('result',result,'boolean'),body('source',source)]]) {
    assert.deepEqual(pickObjectAtNdc(c,new THREE.Vector2(),bodies).selection,{kind:'boolean',booleanId:'result'});
  }
  source.position.z=1;
  assert.equal(pickObjectAtNdc(c,new THREE.Vector2(),[body('source',source),body('result',result,'boolean')]).selection.partId,'source');
  for(const object of [source,result]) {object.geometry.dispose();object.material.dispose();}
});

test('orange outline source points follow full XYZ placement without changing CAD arrays or shared materials',()=>{
  const object=mesh(),rotation=[23,-37,61].map(v=>v*Math.PI/180),translation=[17,-9,8];
  object.position.fromArray(translation);object.rotation.set(...rotation,'XYZ');
  const picked=body('placed',object),original=Array.from(picked.topology.edges[0].polyline),material=object.material,color=material.color.getHex();
  const placed=([x,y,z])=>{
    const [a,b,c]=rotation,x1=Math.cos(c)*x-Math.sin(c)*y,y1=Math.sin(c)*x+Math.cos(c)*y;
    const x2=Math.cos(b)*x1+Math.sin(b)*z,z2=-Math.sin(b)*x1+Math.cos(b)*z;
    return [x2,Math.cos(a)*y1-Math.sin(a)*z2,Math.sin(a)*y1+Math.cos(a)*z2].map((v,i)=>v+translation[i]);
  };
  const outline=objectOutlineInWorld(picked)[0];
  near([...outline.slice(0,3)],placed([-5,-5,0]));near([...outline.slice(3,6)],placed([5,-5,0]));
  assert.deepEqual(Array.from(picked.topology.edges[0].polyline),original);assert.equal(object.material,material);assert.equal(material.color.getHex(),color);
  assert.equal(selectedObjectBody({kind:'part',partId:'placed'},[picked]),picked);
  assert.equal(selectedObjectBody({kind:'boolean',booleanId:'placed'},[picked]),undefined);
  object.geometry.dispose();material.dispose();
});

class Surface {
  handlers=new Map();style={};
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(fn);}
  removeEventListener(name,fn){this.handlers.get(name)?.delete(fn);}
  emit(name,props={}){for(const fn of [...this.handlers.get(name)??[]])fn({clientX:110,clientY:120,pointerId:1,isPrimary:true,button:0,...props});}
  getBoundingClientRect(){return {left:10,top:20,width:200,height:200,right:210,bottom:220};}
}
function pickerFixture(useActualStore=false) {
  const value=layers([{id:'front',mesh:mesh(),topology:topology()}]);
  const canvas=new Surface(),events=new Surface();let gizmo=false;
  const store=useActualStore?actualStore:createStore(set=>({...state(model(['front'])),
    selectPart:partId=>set({selection:{kind:'part',partId}}),selectBoolean:booleanId=>set({selection:{kind:'boolean',booleanId}}),clearSelection:()=>set({selection:null})}));
  if(useActualStore) {
    store.persist.setOptions({storage:{getItem:()=>null,setItem(){},removeItem(){}}});
    store.setState({...store.getInitialState(),assembly:model(['front'])});
  }
  const picker=createObjectPicker({...value,domElement:canvas,eventTarget:events,camera:camera(),store,isGizmoActive:()=>gizmo});
  return {canvas,events,store,setGizmo:value=>{gizmo=value;},click(props={}){canvas.emit('pointerdown',props);events.emit('pointerup',props);},
    dispose(){picker.dispose();disposeLayers(value);}};
}

test('normal pointer click selects the actual body and an empty canvas click clears it without creating history',()=>{
  const context=pickerFixture(true);
  try {
    context.store.getState().renamePart('front','Renamed');
    const revision=context.store.getState().historyRevision;
    context.click();assert.deepEqual(context.store.getState().selection,{kind:'part',partId:'front'});
    context.click({clientX:195,clientY:205});assert.equal(context.store.getState().selection,null);
    assert.equal(context.store.getState().historyRevision,revision);assert.equal(context.store.getState().canUndo,true);
  } finally {context.dispose();}
});

test('orbit drags that return to their starting point cannot select; a fresh click can',()=>{
  const context=pickerFixture();
  try {
    context.canvas.emit('pointerdown');context.events.emit('pointermove',{clientX:160});
    context.events.emit('pointermove',{clientX:110});context.events.emit('pointerup');
    assert.equal(context.store.getState().selection,null);
    context.click();assert.equal(context.store.getState().selection.partId,'front');
  } finally {context.dispose();}
});

test('gizmo ownership is latched through release, including a handle click with no displacement',()=>{
  const context=pickerFixture();
  try {
    context.store.setState({selection:{kind:'part',partId:'existing'}});
    context.setGizmo(true);context.canvas.emit('pointerdown');context.setGizmo(false);context.events.emit('pointerup');
    assert.deepEqual(context.store.getState().selection,{kind:'part',partId:'existing'});
    context.click();assert.equal(context.store.getState().selection.partId,'front');
  } finally {context.dispose();}
});

test('right clicks, outside releases, pointer cancellation and leaving the canvas never select',()=>{
  const context=pickerFixture();
  try {
    context.click({button:2});
    context.canvas.emit('pointerdown');context.events.emit('pointerup',{clientX:300});
    context.canvas.emit('pointerdown');context.events.emit('pointercancel');context.events.emit('pointerup');
    context.canvas.emit('pointerdown');context.canvas.emit('pointerleave');context.events.emit('pointerup');
    assert.equal(context.store.getState().selection,null);
  } finally {context.dispose();}
});

test('every edit/physics mode suppresses object picking and a mid-click mode or document change cancels it',()=>{
  const context=pickerFixture();
  try {
    for(const patch of [{mode:'simulator'},{simulation:{running:true}},{pickingMode:'edges'},{historyBusy:true},
      {sketchSession:{active:true}},{sketchDimensionsEditing:true},{featureEditor:{open:true}},{booleanEditor:{open:true}},{mateEditor:{open:true}}]) {
      context.store.setState({...state(model(['front'])),...patch});assert.equal(canSelectObjects(context.store.getState()),false);
      context.click();assert.equal(context.store.getState().selection,null);
    }
    context.store.setState(state(model(['front'])));context.canvas.emit('pointerdown');context.store.setState({featureEditor:{open:true}});
    context.store.setState({featureEditor:{open:false}});context.events.emit('pointerup');assert.equal(context.store.getState().selection,null);
    context.canvas.emit('pointerdown');context.store.setState({assembly:model(['front'])});context.events.emit('pointerup');
    assert.equal(context.store.getState().selection,null);
  } finally {context.dispose();}
});

test('disposed pointer picker releases all listeners and cannot make a later selection',()=>{
  const context=pickerFixture();context.dispose();context.click();assert.equal(context.store.getState().selection,null);
  for(const surface of [context.canvas,context.events]) for(const listeners of surface.handlers.values()) assert.equal(listeners.size,0);
});

test('actual TransformControls uses the native part origin and flushes the last drag value before closing its transaction',()=>{
  const c=camera(),scene=new THREE.Scene(),object=mesh();scene.add(object);object.position.set(17,-9,8);
  const canvas=new Surface(),calls=[],previousRaf=globalThis.requestAnimationFrame,previousCancel=globalThis.cancelAnimationFrame;
  const scheduled=new Map();let id=0;
  globalThis.requestAnimationFrame=fn=>{scheduled.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>scheduled.delete(id);
  const gizmo=createTransformGizmo({camera:c,domElement:canvas,scene,
    onChange:position=>calls.push(['value',position.toArray()]),onDraggingChanged:dragging=>calls.push(['drag',dragging])});
  try {
    gizmo.attach(object);scene.updateMatrixWorld(true);
    const controls=scene.children.find(child=>child.isTransformControlsRoot).controls;
    near(controls.worldPosition.toArray(),[17,-9,8]);
    controls.axis='X';assert.equal(gizmo.hasActiveHandle(),true);
    controls.dragging=true;object.position.x=20;controls.dispatchEvent({type:'objectChange'});
    for(const [key,fn] of [...scheduled]) {scheduled.delete(key);fn();}
    object.position.x=23;controls.dispatchEvent({type:'objectChange'});
    controls.dragging=false;
    assert.deepEqual(calls,[['drag',true],['value',[20,-9,8]],['value',[23,-9,8]],['drag',false]]);
    assert.equal(scheduled.size,0);assert.equal(gizmo.attachedTo(),object);
    gizmo.detach();assert.equal(gizmo.hasActiveHandle(),false);
  } finally {gizmo.dispose();object.geometry.dispose();object.material.dispose();globalThis.requestAnimationFrame=previousRaf;globalThis.cancelAnimationFrame=previousCancel;}
});

test('detaching or hiding actual TransformControls mid-drag releases interaction and cancels stale deferred writes',()=>{
  const previousRaf=globalThis.requestAnimationFrame,previousCancel=globalThis.cancelAnimationFrame;
  const scheduled=new Map();let id=0;
  globalThis.requestAnimationFrame=fn=>{scheduled.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>scheduled.delete(id);
  try {
    for(const action of ['detach','hide','dispose']) {
      const scene=new THREE.Scene(),object=mesh(),canvas=new Surface(),calls=[];scene.add(object);
      const gizmo=createTransformGizmo({camera:camera(),domElement:canvas,scene,
        onChange:()=>calls.push('stale-write'),onDraggingChanged:value=>calls.push(value)});
      gizmo.attach(object);const controls=scene.children.find(child=>child.isTransformControlsRoot).controls;
      controls.dragging=true;controls.dispatchEvent({type:'objectChange'});
      if(action==='hide')gizmo.setMode('hidden');else gizmo[action]();
      assert.equal(controls.dragging,false);assert.equal(gizmo.hasActiveHandle(),false);
      assert.equal(scheduled.size,0);assert.deepEqual(calls,[true,false]);
      if(action!=='dispose')gizmo.dispose();object.geometry.dispose();object.material.dispose();
    }
  } finally {globalThis.requestAnimationFrame=previousRaf;globalThis.cancelAnimationFrame=previousCancel;}
});
