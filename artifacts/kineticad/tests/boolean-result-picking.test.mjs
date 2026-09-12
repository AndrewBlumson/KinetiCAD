import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStore } from 'zustand/vanilla';
import { createBooleanResultLayer } from '../src/three/BooleanResultLayer.ts';
import { createTopologyPicker, topologyPositionsInWorld } from '../src/three/TopologyPicker.ts';
import { booleanBodyId, getAssemblyBody, getAssemblyBodyName, resolveBooleanMaterialId } from '../src/state/assemblyBodies.ts';
import { clearCache } from '../src/features/featureCache.ts';
import { computeBooleanHash } from '../src/features/assemblyRegen.ts';
import { captureBooleanGeometryHash, setBooleanResultLayer } from '../src/three/booleanResultLayerRef.ts';

const flush = () => new Promise(setImmediate);
const close = (a,b,tolerance=1e-5) => assert.ok(Number.isFinite(a)&&Math.abs(a-b)<tolerance,`${a} != ${b}`);
const near = (a,b) => a.forEach((value,i)=>close(value,b[i]));
const part = (id, materialId='steel-1018') => ({ id,name:id,materialId,visible:true,transform:{positionMm:[0,0,0],rotationDeg:[0,0,0]},
  sketches:[{id:`sketch-${id}`,name:'Sketch',plane:'XY',primitives:[{type:'rectangle',corner:[0,0],width:10,height:10}]}],
  features:[{id:`extrude-${id}`,type:'extrude',sketchId:`sketch-${id}`,depthMm:10,direction:'forward',extrudeMode:'new-body'}] });
const assembly = () => ({id:'assembly',name:'Test',groundPartId:null,mates:[],parts:[part('a'),part('b')],
  booleanFeatures:[{id:'fuse',type:'boolean',resultPartName:'Finished body',operation:{type:'union'},inputPartIds:['a','b'],hideInputs:true}]});
const output = (x=0,z=0) => ({
  solidCount:1,
  positions:new Float32Array([x-5,-5,z,x+5,-5,z,x+5,5,z,x-5,5,z]),
  normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),indices:new Uint32Array([0,1,2,0,2,3]),
  edges:[{id:'edge:0',type:'line',midpoint:[x, -5,z],polyline:new Float32Array([x-5,-5,z,x+5,-5,z])}],
  faces:[{id:'face:0',type:'plane',centroid:[x,0,z],normalAtCentroid:[0,0,1],triangles:new Uint32Array([0,1]),boundaryEdgeIds:['edge:0'],
    planeBasis:{origin:[x,0,z],u:[1,0,0],v:[0,1,0],normal:[0,0,1]}}],
});
const topology = data => ({edges:data.edges,faces:data.faces,faceForTriangle:new Uint32Array([0,0])});
function controlledKernel() {
  const calls=[];
  return {calls,kernel:{booleanOp(args){return new Promise((resolve,reject)=>calls.push({args,resolve,reject}));}}};
}
const sync = (layer,model,kernel,hidden=new Set(),dimmed=new Set()) => layer.sync(model,hidden,dimmed,kernel);
beforeEach(()=>clearCache());

test('result body IDs and material inference preserve native frames without remapping inputs',()=>{
  const model=assembly(),feature=model.booleanFeatures[0];
  assert.equal(booleanBodyId('fuse'),'boolean:fuse');
  assert.equal(getAssemblyBody(model,'a'),model.parts[0]);
  const body=getAssemblyBody(model,'boolean:fuse');
  assert.equal(body.id,'boolean:fuse'); assert.equal(body.name,'Finished body');
  assert.deepEqual(body.transform,{positionMm:[0,0,0],rotationDeg:[0,0,0]});
  assert.deepEqual(body.features,[]);assert.deepEqual(body.sketches,[]);
  assert.equal(getAssemblyBodyName(model,'boolean:fuse'),'Finished body');
  assert.equal(getAssemblyBody(model,null),undefined);assert.equal(getAssemblyBody(model,'missing'),undefined);
  assert.equal(resolveBooleanMaterialId(feature,model.parts),'steel-1018');
  model.parts[1].materialId='brass-c36000';
  assert.equal(resolveBooleanMaterialId(feature,model.parts),undefined);
  assert.equal(getAssemblyBody(model,'boolean:fuse').materialId,'');
  feature.operation={type:'subtract',toolPartId:'b'};
  assert.equal(resolveBooleanMaterialId(feature,model.parts),'steel-1018','cutter material is not retained');
  feature.materialId='nylon-6';assert.equal(resolveBooleanMaterialId(feature,model.parts),'nylon-6');
  feature.materialId='unknown';assert.equal(resolveBooleanMaterialId(feature,model.parts),undefined);
  delete feature.materialId;feature.inputPartIds=['b','b'];
  assert.equal(resolveBooleanMaterialId(feature,model.parts),undefined,'a malformed cutter-only input list has no retained material');
});

test('Boolean layer exposes identity mesh/topology/current hash and changes material without geometry regeneration',async()=>{
  const model=assembly(),layer=createBooleanResultLayer(),{kernel,calls}=controlledKernel();
  try {
    sync(layer,model,kernel);sync(layer,model,kernel);
    assert.equal(calls.length,1,'identical pending syncs share one operation');
    assert.equal(layer.getPartTopology('boolean:fuse'),null);
    calls[0].resolve(output(20,10));await flush();
    const mesh=layer.getPartMesh('boolean:fuse');assert.ok(mesh);
    near(mesh.position.toArray(),[0,0,0]);near(mesh.rotation.toArray().slice(0,3),[0,0,0]);
    assert.equal(mesh.userData.partId,'boolean:fuse');
    assert.deepEqual([...layer.getPartTopology('boolean:fuse').faceForTriangle],[0,0]);
    assert.equal(layer.getGeometryHash('boolean:fuse'),computeBooleanHash(model.booleanFeatures[0],model.parts));
    assert.deepEqual(layer.getVisiblePartMeshes().map(e=>e.partId),['boolean:fuse']);
    const geometry=mesh.geometry,hash=layer.getGeometryHash('boolean:fuse');
    model.booleanFeatures[0].materialId='brass-c36000';sync(layer,model,kernel);
    assert.equal(mesh.material.color.getHex(),0xC8A84B);assert.equal(mesh.geometry,geometry);assert.equal(calls.length,1);
    assert.equal(layer.getGeometryHash('boolean:fuse'),hash);
    sync(layer,model,kernel,new Set(),new Set(['fuse']));assert.equal(mesh.material.opacity,.4);
    sync(layer,model,kernel,new Set(['fuse']));assert.equal(layer.getPartMesh('boolean:fuse'),null);assert.equal(layer.getGeometryHash('boolean:fuse'),null);
    sync(layer,model,kernel);assert.equal(layer.getPartMesh('boolean:fuse'),mesh);
    layer.group.visible=false;assert.deepEqual(layer.getVisiblePartMeshes(),[]);
  } finally {layer.dispose();}
});

test('source edits invalidate result picking immediately and older async geometry cannot replace the current revision',async()=>{
  const model=assembly(),layer=createBooleanResultLayer(),{kernel,calls}=controlledKernel();
  try {
    sync(layer,model,kernel);calls[0].resolve(output(0));await flush();
    model.parts[0].features[0].depthMm=11;sync(layer,model,kernel);
    assert.equal(layer.getPartMesh('boolean:fuse'),null);assert.equal(layer.getPartTopology('boolean:fuse'),null);
    model.parts[0].features[0].depthMm=12;sync(layer,model,kernel);
    calls[2].resolve(output(12));await flush();
    const newest=layer.getPartMesh('boolean:fuse');
    calls[1].resolve(output(11));await flush();
    assert.equal(layer.getPartMesh('boolean:fuse'),newest);
    assert.equal(newest.geometry.getAttribute('position').getX(0),7);
    assert.equal(layer.getGeometryHash('boolean:fuse'),computeBooleanHash(model.booleanFeatures[0],model.parts));
    model.parts[0].features[0].depthMm=13;sync(layer,model,kernel);model.booleanFeatures=[];sync(layer,model,kernel);
    calls[3].resolve(output(13));await flush();assert.equal(layer.size(),0);assert.equal(layer.getPartMesh('boolean:fuse'),null);
  } finally {layer.dispose();}
});

test('reverting an in-flight result edit restores complete cached topology; late failure and disposed results stay unavailable',async()=>{
  const model=assembly(),layer=createBooleanResultLayer(),{kernel,calls}=controlledKernel();
  sync(layer,model,kernel);calls[0].resolve(output(10));await flush();
  model.parts[0].features[0].depthMm=11;sync(layer,model,kernel);
  model.parts[0].features[0].depthMm=10;sync(layer,model,kernel);await flush();
  assert.ok(layer.getPartTopology('boolean:fuse'));assert.ok(layer.getPartMesh('boolean:fuse'));
  calls[1].reject(new Error('stale failure'));await flush();assert.ok(layer.getPartTopology('boolean:fuse'));
  model.parts[0].features[0].depthMm=12;sync(layer,model,kernel);layer.dispose();
  calls[2].resolve(output(12));await flush();assert.equal(layer.getPartMesh('boolean:fuse'),null);assert.deepEqual(layer.getVisiblePartMeshes(),[]);
});

test('disconnected or unverified Boolean meshes remain visible but cannot supply mate topology or attachment hashes',async()=>{
  for(const count of [2,0,undefined]) {
    clearCache();const model=assembly(),layer=createBooleanResultLayer(),{kernel,calls}=controlledKernel();setBooleanResultLayer(layer);
    try {
      sync(layer,model,kernel);calls[0].resolve({...output(),solidCount:count});await flush();
      assert.ok(layer.getPartMesh('boolean:fuse'),'rendering remains available');
      assert.equal(layer.getPartTopology('boolean:fuse'),null);
      const candidates=[];layer.forEachVisible(id=>candidates.push(id));assert.deepEqual(candidates,[]);
      assert.throws(()=>captureBooleanGeometryHash('boolean:fuse',undefined),/one connected solid/);
    } finally {setBooleanResultLayer(null);layer.dispose();}
  }
});

test('attachment hashes capture only the actual picked revision and preserve the opposite body snapshot',async()=>{
  const model=assembly(),layer=createBooleanResultLayer(),{kernel,calls}=controlledKernel();setBooleanResultLayer(layer);
  try {
    sync(layer,model,kernel);calls[0].resolve(output());await flush();
    const prior={'boolean:other':'other-picked-revision'};
    const picked=captureBooleanGeometryHash('boolean:fuse',prior),oldHash=picked['boolean:fuse'];
    assert.notEqual(picked,prior);assert.deepEqual(prior,{'boolean:other':'other-picked-revision'});
    assert.equal(captureBooleanGeometryHash('native',picked),picked,'a native pick cannot refresh result anchors');
    model.parts[0].features[0].depthMm=15;sync(layer,model,kernel);
    assert.throws(()=>captureBooleanGeometryHash('boolean:fuse',picked),/ready Boolean/);
    calls[1].resolve(output(5));await flush();
    assert.equal(picked['boolean:fuse'],oldHash,'retained parameters still identify their original picked geometry');
    const repicked=captureBooleanGeometryHash('boolean:fuse',picked);
    assert.notEqual(repicked['boolean:fuse'],oldHash);assert.equal(repicked['boolean:other'],prior['boolean:other']);
  } finally {setBooleanResultLayer(null);layer.dispose();}
});

class Surface extends EventTarget {
  clientWidth=800;clientHeight=800;
  getBoundingClientRect(){return {left:0,top:0,width:800,height:800};}
}
function meshOf(data) {
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
}
function staticLayer(id,mesh,data) {
  const group=new THREE.Group();if(mesh)group.add(mesh);
  const topo=data?topology(data):null;
  return {group,getPartMesh:bodyId=>bodyId===id&&mesh?.visible?mesh:null,getPartTopology:bodyId=>bodyId===id&&mesh?.visible?topo:null,
    forEachVisible(fn){if(group.visible&&mesh?.visible)fn(id,mesh,topo);}};
}
function setupPicker(native,results,mode='faces',mateOpen=true) {
  const previousWindow=globalThis.window,windowSurface=new Surface();globalThis.window=windowSurface;
  const dom=new Surface(),camera=new THREE.OrthographicCamera(-50,50,50,-50,.1,200);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const store=createStore((set)=>({mateEditor:{open:mateOpen},pickingMode:mode,pickFilter:null,selection:null,
    clearSelection:()=>set({selection:null}),selectEdges:(partId,edgeIds)=>set({selection:{kind:'edges',partId,edgeIds}}),
    selectFace:(partId,faceId)=>set({selection:{kind:'face',partId,faceId}}),selectPointOnFace:(partId,faceId,uv)=>set({selection:{kind:'point-on-face',partId,faceId,uv}})}));
  const hover={edge:null,face:null};
  const picker=createTopologyPicker({domElement:dom,camera,partMeshLayer:native,booleanResultLayer:results,store,
    edgeLayer:{setHover:value=>{hover.edge=value;}},faceLayer:{setHover:value=>{hover.face=value;}}});
  const dispatch=(surface,type,point)=>surface.dispatchEvent(Object.assign(new Event(type),{clientX:400+point[0]*8,clientY:400-point[1]*8,button:0,shiftKey:false}));
  return {store,hover,move:p=>dispatch(dom,'mousemove',p),click:p=>{dispatch(dom,'mousedown',p);dispatch(windowSurface,'mouseup',p);},
    dispose(){picker.dispose();globalThis.window=previousWindow;}};
}
// Independent intrinsic XYZ scalar rotation reference, deliberately not Three.
function placed(point,rotation,translation) {
  const [a,b,c]=rotation.map(v=>v*Math.PI/180),[x,y,z]=point;
  const x1=Math.cos(c)*x-Math.sin(c)*y,y1=Math.sin(c)*x+Math.cos(c)*y;
  const x2=Math.cos(b)*x1+Math.sin(b)*z,z2=-Math.sin(b)*x1+Math.cos(b)*z;
  return [x2,Math.cos(a)*y1-Math.sin(a)*z2,Math.sin(a)*y1+Math.cos(a)*z2].map((v,i)=>v+translation[i]);
}

test('edge proximity and hover follow the full native XYZ transform instead of its old local position',()=>{
  const data=output(),mesh=meshOf(data),rotation=[23,-37,61],translation=[17,-9,8];
  mesh.position.fromArray(translation);mesh.rotation.set(...rotation.map(v=>v*Math.PI/180),'XYZ');
  const native=staticLayer('native',mesh,data),ctx=setupPicker(native,undefined,'edges');
  try {
    const expected=placed([0,-5,0],rotation,translation);ctx.move(expected);ctx.click(expected);
    assert.equal(ctx.store.getState().selection.partId,'native');
    near([...ctx.hover.edge.slice(0,3)],placed([-5,-5,0],rotation,translation));
    near([...ctx.hover.edge.slice(3,6)],placed([5,-5,0],rotation,translation));
    ctx.click([0,-5,0]);assert.equal(ctx.store.getState().selection,null,'old local edge is not pickable');
  } finally {ctx.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});

test('native transformed face hover is world-correct and two-click point picking retains local face UV',()=>{
  const data=output(),mesh=meshOf(data),rotation=[23,-37,61],translation=[17,-9,8];
  mesh.position.fromArray(translation);mesh.rotation.set(...rotation.map(v=>v*Math.PI/180),'XYZ');
  const ctx=setupPicker(staticLayer('native',mesh,data),undefined,'point-on-face');
  try {
    const expected=placed([2,1,0],rotation,translation);ctx.move(expected);
    near([...ctx.hover.face.positions.slice(0,3)],placed([-5,-5,0],rotation,translation));
    ctx.click(expected);ctx.click(expected);const selection=ctx.store.getState().selection;
    assert.equal(selection.kind,'point-on-face');near(selection.uv,[2,1]);
    const direct=topologyPositionsInWorld(data.positions,mesh);
    near([...direct.slice(6,9)],placed([5,5,0],rotation,translation));
    assert.deepEqual([...data.positions.slice(0,3)],[-5,-5,0],'source CAD vertices remain local');
  } finally {ctx.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});

test('world-baked Boolean face picks use stable body IDs once and are excluded outside mate editing',async()=>{
  const model=assembly(),results=createBooleanResultLayer(),{kernel,calls}=controlledKernel();
  sync(results,model,kernel);calls[0].resolve(output(20,10));await flush();
  const nativeData=output(),mesh=meshOf(nativeData);mesh.position.set(20,0,0);
  const ctx=setupPicker(staticLayer('native',mesh,nativeData),results,'point-on-face');
  try {
    ctx.move([22,1,10]);near([...ctx.hover.face.positions.slice(0,3)],[15,-5,10]);
    ctx.click([22,1,10]);ctx.click([22,1,10]);
    assert.equal(ctx.store.getState().selection.partId,'boolean:fuse');near(ctx.store.getState().selection.uv,[2,1]);
    ctx.store.setState({mateEditor:{open:false},pickingMode:'faces',selection:null});ctx.click([22,1,0]);
    assert.equal(ctx.store.getState().selection.partId,'native','native feature editors cannot target result faces');
    ctx.store.setState({mateEditor:{open:true},selection:null});sync(results,model,kernel,new Set(['fuse']));ctx.click([22,1,0]);
    assert.equal(ctx.store.getState().selection.partId,'native','hidden result cannot occlude or intercept picking');
  } finally {ctx.dispose();results.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});
