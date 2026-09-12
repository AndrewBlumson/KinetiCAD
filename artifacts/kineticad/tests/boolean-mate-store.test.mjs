// Actual Zustand actions and portable-project parsing. Geometry revision capture
// is supplied by the same ref helper as the inspectors; CAD is tested separately.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useKinetiCADStore as store } from '../src/state/store.ts';
import { booleanBodyId, getAssemblyBodyName, getEffectiveGroundBodyId } from '../src/state/assemblyBodies.ts';
import { computeBooleanHash } from '../src/features/assemblyRegen.ts';
import { captureBooleanGeometryHash, setBooleanResultLayer } from '../src/three/booleanResultLayerRef.ts';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';

const makePart=id=>({id,name:id,visible:true,materialId:'steel-1018',transform:{positionMm:[0,0,0],rotationDeg:[0,0,0]},
  sketches:[{id:`s-${id}`,name:'Profile',plane:'XY',primitives:[{type:'rectangle',corner:[0,0],width:20,height:10}]}],
  features:[{id:`f-${id}`,type:'extrude',sketchId:`s-${id}`,depthMm:10,direction:'forward',extrudeMode:'new-body'}]});
const resultId=booleanBodyId('union');
const currentHash=()=>computeBooleanHash(store.getState().assembly.booleanFeatures[0],store.getState().assembly.parts);
function pickHashes() {
  const pickedHash=currentHash();
  setBooleanResultLayer({getGeometryHash:id=>id===resultId?pickedHash:null,getPartTopology:id=>id===resultId?{}:null});
  return captureBooleanGeometryHash(resultId,undefined);
}
function begin(type='fixed') {
  store.getState().beginCreateMate(type);
  const state=store.getState();
  state.setMateEditorParams({...state.mateEditor.params,name:'Result attachment',partA:resultId,partB:'support',
    pivotA:{kind:'face',faceId:'result-face',localPoint:[1,2,3]},pivotB:{kind:'face',faceId:'support-face',localPoint:[1,2,3]},
    axisLocal:[0,0,1],motorSpeedRpm:15,booleanGeometryHashes:pickHashes()});
  store.getState().setMateEditorStage('ready');
}
function changeGeometry() {
  store.setState(state=>({assembly:{...state.assembly,parts:state.assembly.parts.map(part=>part.id==='a'
    ? {...part,features:part.features.map(feature=>({...feature,depthMm:12}))}:part)}}));
}
beforeEach(()=>{
  store.persist.setOptions({storage:{getItem:()=>null,setItem(){},removeItem(){}}});
  store.setState({...store.getInitialState(),mode:'modeller',assembly:{id:'boolean-mates',name:'Boolean mates',groundPartId:'support',
    parts:[makePart('a'),makePart('b'),makePart('support')],mates:[],booleanFeatures:[{id:'union',type:'boolean',operation:{type:'union'},
      inputPartIds:['a','b'],resultPartName:'Finished result',hideInputs:true}]}});
});
afterEach(()=>setBooleanResultLayer(null));

test('ground badges match explicit Boolean anchoring while preserving native-only first-part defaults',()=>{
  const model=structuredClone(store.getState().assembly);
  model.groundPartId='';assert.equal(getEffectiveGroundBodyId(model),'','a free Boolean result does not ground its first input');
  model.groundPartId=resultId;assert.equal(getEffectiveGroundBodyId(model),resultId);
  model.groundPartId='support';assert.equal(getEffectiveGroundBodyId(model),'support');
  model.groundPartId='';model.booleanFeatures=[];assert.equal(getEffectiveGroundBodyId(model),'a');
  model.parts=[];assert.equal(getEffectiveGroundBodyId(model),'');
});

test('creating or importing a part preserves an explicitly free Boolean assembly',()=>{
  const original=structuredClone(store.getState().assembly);
  for(const create of [()=>store.getState().createPart(),()=>store.getState().addImportedStepPart('Imported free part','test-registered-step')]) {
    store.setState({assembly:{...structuredClone(original),groundPartId:''}});
    const id=create(),assembly=store.getState().assembly;
    assert.ok(assembly.parts.some(part=>part.id===id),'the new part was committed');
    assert.equal(assembly.groundPartId,'','adding geometry does not silently fix a body');
    assert.equal(getEffectiveGroundBodyId(assembly),'');
  }
});

test('native creation/import retain default promotion and preserve an already selected ground',()=>{
  const original=structuredClone(store.getState().assembly);
  for(const create of [()=>store.getState().createPart(),()=>store.getState().addImportedStepPart('Imported native part','test-registered-step')]) {
    store.setState({assembly:{...structuredClone(original),parts:[],booleanFeatures:[],groundPartId:''}});
    const first=create();
    assert.equal(store.getState().assembly.groundPartId,first,'first native part retains existing auto-ground behavior');
    const second=create();
    assert.notEqual(first,second);
    assert.equal(store.getState().assembly.groundPartId,first,'later native parts cannot replace the chosen ground');
    store.setState({assembly:{...structuredClone(original),groundPartId:resultId}});
    create();
    assert.equal(store.getState().assembly.groundPartId,resultId,'explicit Boolean ground is retained');
  }
});

test('legacy v8/v9 migration preserves free Boolean worlds and the native-only ground default',async()=>{
  const source={mode:'modeller',assembly:structuredClone(store.getState().assembly),simulation:structuredClone(store.getState().simulation)};
  const migrate=store.persist.getOptions().migrate;
  for(const version of [8,9]) {
    const free=structuredClone(source);free.assembly.groundPartId='';
    const migratedFree=await migrate(free,version);
    assert.equal(migratedFree.assembly.groundPartId,'','a free result must not fix its consumed first input');
    assert.equal(getEffectiveGroundBodyId(migratedFree.assembly),'');
    const native=structuredClone(source);native.assembly.booleanFeatures=[];native.assembly.groundPartId='';
    const migratedNative=await migrate(native,version);
    assert.equal(migratedNative.assembly.groundPartId,native.assembly.parts[0].id,'native legacy default is preserved');
    const fixed=structuredClone(source);fixed.assembly.groundPartId=resultId;
    assert.equal((await migrate(fixed,version)).assembly.groundPartId,resultId,'explicit result ground survives migration');
  }
});

test('actual Apply persists picked result IDs and geometry revision through Save/parse and Edit',async()=>{
  begin();const hashes=store.getState().mateEditor.params.booleanGeometryHashes;
  store.getState().applyMateEditor();const mate=store.getState().assembly.mates[0];
  assert.ok(mate);assert.equal(mate.partA,resultId);assert.equal(mate.partB,'support');
  assert.deepEqual(mate.booleanGeometryHashes,hashes);assert.equal(store.getState().mateEditor.open,false);
  assert.equal(getAssemblyBodyName(store.getState().assembly,mate.partA),'Finished result');
  const saved=await createProjectDocument(store.getState(),async()=>{throw new Error('No CAD call for native Save.');});
  const loaded=parseProjectDocument(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.state.assembly.mates,[mate]);
  store.setState(loaded.state);store.getState().beginEditMate(mate.id);
  assert.deepEqual(store.getState().mateEditor.params.booleanGeometryHashes,hashes);
});

test('geometry changed between picking and Apply rejects creation without relabelling the old attachment',()=>{
  begin('spherical');const hashAtPick=store.getState().mateEditor.params.booleanGeometryHashes;
  changeGeometry();assert.notEqual(currentHash(),hashAtPick[resultId]);store.getState().applyMateEditor();
  assert.deepEqual(store.getState().assembly.mates,[]);assert.equal(store.getState().mateEditor.open,true);
  assert.match(store.getState().mateEditor.error,/changed after its attachment was picked/);
  assert.deepEqual(store.getState().mateEditor.params.booleanGeometryHashes,hashAtPick);
});

test('name-only or motor-only Apply cannot revive a stale saved mate without repicking its geometry',()=>{
  begin('revolute');store.getState().applyMateEditor();
  const original=store.getState().assembly.mates[0],before=structuredClone(original);
  changeGeometry();
  for(const patch of [{name:'Renamed stale joint'},{motorSpeedRpm:30}]) {
    store.getState().beginEditMate(original.id);
    const state=store.getState();assert.deepEqual(state.mateEditor.params.booleanGeometryHashes,before.booleanGeometryHashes);
    state.setMateEditorParams({...state.mateEditor.params,...patch});store.getState().applyMateEditor();
    assert.match(store.getState().mateEditor.error,/changed after its attachment was picked/);
    assert.deepEqual(store.getState().assembly.mates[0],before);
  }
});

test('an unchanged attachment permits normal edits while a missing geometry snapshot is rejected',()=>{
  begin();const state=store.getState();state.setMateEditorParams({...state.mateEditor.params,booleanGeometryHashes:undefined});
  store.getState().applyMateEditor();assert.equal(store.getState().assembly.mates.length,0);assert.match(store.getState().mateEditor.error,/Pick the attachment again/);
  begin();store.getState().applyMateEditor();const mate=store.getState().assembly.mates[0],pickedHash=mate.booleanGeometryHashes[resultId];
  store.getState().setPartMaterial('a','brass-c36000');
  store.getState().beginEditMate(mate.id);const editing=store.getState();
  editing.setMateEditorParams({...editing.mateEditor.params,name:'Edited valid joint'});store.getState().applyMateEditor();
  assert.equal(store.getState().mateEditor.open,false);assert.equal(store.getState().assembly.mates[0].name,'Edited valid joint');
  assert.equal(store.getState().assembly.mates[0].booleanGeometryHashes[resultId],pickedHash,'material does not change the attachment geometry');
});

test('deleting an input cascades through result joints while retaining unrelated native joints',()=>{
  begin();store.getState().applyMateEditor();const derivedMate=store.getState().assembly.mates[0];
  store.setState(state=>({assembly:{...state.assembly,groundPartId:resultId,mates:[...state.assembly.mates,
    {id:'direct',type:'fixed',partA:'a',partB:'support'}, {id:'retained',type:'fixed',partA:'b',partB:'support'}]}}));
  store.getState().beginEditMate(derivedMate.id);store.getState().deletePartCascade('a');
  assert.deepEqual(store.getState().assembly.booleanFeatures,[]);
  assert.deepEqual(store.getState().assembly.mates.map(mate=>mate.id),['retained']);
  assert.equal(store.getState().assembly.groundPartId,'');assert.equal(store.getState().mateEditor.open,false);
});
