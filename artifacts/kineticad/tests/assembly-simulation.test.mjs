import test from 'node:test';
import assert from 'node:assert/strict';
import { planAssemblySimulation, assemblyPhysicsSignature } from '../src/physics/assemblySimulation.ts';
import { booleanBodyId, getAssemblyBody, resolveBooleanMaterialId } from '../src/state/assemblyBodies.ts';
import { computeBooleanHash } from '../src/features/assemblyRegen.ts';

const part=(id,materialId='steel-1018')=>({id,name:id,visible:true,materialId,
  transform:{positionMm:[0,0,0],rotationDeg:[0,0,0]},
  sketches:[{id:`${id}-sketch`,name:'Profile',plane:'XY',primitives:[{type:'rectangle',corner:[0,0],width:10,height:10}]}],
  features:[{id:`${id}-extrude`,type:'extrude',sketchId:`${id}-sketch`,depthMm:10,direction:'forward',extrudeMode:'new-body'}]});
const boolean=(operation={type:'union'},hideInputs=true)=>({id:'result',type:'boolean',resultPartName:'Finished result',inputPartIds:['tool','body'],operation,hideInputs});
function assembly(){return{id:'assembly',name:'Assembly',parts:[part('body'),part('tool'),part('witness')],booleanFeatures:[boolean()],mates:[],groundPartId:'witness'};}

test('Boolean source parts never become duplicate physical bodies for either Hide inputs setting',()=>{
  for(const hideInputs of[false,true]){
    const a=assembly();a.booleanFeatures[0].hideInputs=hideInputs;
    const before=structuredClone(a),plan=planAssemblySimulation(a);
    assert.deepEqual(plan.parts.map(p=>p.id),['witness']);assert.deepEqual(plan.booleans.map(b=>b.id),['boolean:result']);
    assert.deepEqual([...plan.consumed],['tool','body']);assert.deepEqual(a,before);
  }
});

test('material inheritance uses the retained subtract body and requires uniform union/intersection inputs',()=>{
  for(const type of['union','intersect']){
    const a=assembly();a.booleanFeatures[0].operation={type};assert.equal(planAssemblySimulation(a).booleans[0].materialId,'steel-1018');
    a.parts[1].materialId='brass-c36000';assert.throws(()=>planAssemblySimulation(a),/choose a finished solid material.*cannot be averaged/);
    a.booleanFeatures[0].materialId='titanium-grade5';assert.equal(planAssemblySimulation(a).booleans[0].materialId,'titanium-grade5');
  }
  const a=assembly();a.booleanFeatures[0].operation={type:'subtract',toolPartId:'tool'};a.parts[1].materialId='brass-c36000';
  assert.equal(planAssemblySimulation(a).booleans[0].materialId,'steel-1018','input order never makes the cutter supply density');
});

test('unknown explicit result material fails instead of silently falling back to a default',()=>{
  const a=assembly();a.booleanFeatures[0].materialId='unknown-alloy';
  assert.equal(resolveBooleanMaterialId(a.booleanFeatures[0],a.parts),undefined);
  assert.throws(()=>planAssemblySimulation(a),/choose a finished solid material/);
});

test('result grounding is explicit; consumed/hidden input ground is not inherited or silently reassigned',()=>{
  const a=assembly();
  for(const id of['body','tool']){a.groundPartId=id;assert.throws(()=>planAssemblySimulation(a),/fixed base.*hidden or consumed/);}
  a.groundPartId='';assert.equal(planAssemblySimulation(a).groundId,undefined,'empty ground allows a free result');
  a.groundPartId=booleanBodyId('result');assert.equal(planAssemblySimulation(a).groundId,'boolean:result');
  a.groundPartId='witness';a.parts[2].visible=false;assert.throws(()=>planAssemblySimulation(a),/fixed base/);
});

test('an input reused by two finished Boolean bodies rejects ambiguous physical duplication',()=>{
  const a=assembly();a.booleanFeatures.push({...boolean(),id:'other',resultPartName:'Second result',inputPartIds:['body','witness']});
  assert.throws(()=>planAssemblySimulation(a),/Second result.*another Boolean result/);
});

test('source joints are never migrated to new finished-body IDs or silently dropped',()=>{
  const a=assembly();a.mates=[{id:'retained',name:'Old bearing',type:'fixed',partA:'body',partB:'witness'}];
  assert.throws(()=>planAssemblySimulation(a),/Old bearing.*hidden or consumed input/);
  a.mates[0].partA='missing';assert.throws(()=>planAssemblySimulation(a),/Old bearing.*hidden or consumed input/);
});

test('new result joints require an exact geometry revision and become stale after native or transform edits',()=>{
  const a=assembly(),result=a.booleanFeatures[0],id=booleanBodyId(result.id),hash=computeBooleanHash(result,a.parts);
  a.mates=[{id:'new-joint',name:'Result bearing',type:'fixed',partA:id,partB:'witness'}];
  assert.throws(()=>planAssemblySimulation(a),/Result bearing.*changed since/);
  a.mates[0].booleanGeometryHashes={[id]:hash};assert.equal(planAssemblySimulation(a).booleans[0].hash,hash);
  a.parts[0].transform.positionMm[0]=0.00001;assert.throws(()=>planAssemblySimulation(a),/Result bearing.*changed since/);
  a.parts[0].transform.positionMm[0]=0;a.parts[0].sketches[0].primitives[0].width=11;
  assert.throws(()=>planAssemblySimulation(a),/Result bearing.*changed since/);
});

test('material/rename changes retain result joint geometry hashes and its stable synthetic identity',()=>{
  const a=assembly(),result=a.booleanFeatures[0],id=booleanBodyId(result.id);
  a.mates=[{id:'joint',type:'fixed',partA:id,partB:'witness',booleanGeometryHashes:{[id]:computeBooleanHash(result,a.parts)}}];
  result.resultPartName='Renamed result';result.materialId='brass-c36000';
  assert.equal(planAssemblySimulation(a).booleans[0].id,id);
  const body=getAssemblyBody(a,id);assert.equal(body.name,'Renamed result');assert.equal(body.materialId,'brass-c36000');
  assert.deepEqual(body.transform,{positionMm:[0,0,0],rotationDeg:[0,0,0]});
});

test('native/Boolean identity collisions reject rather than replacing a source body',()=>{
  const a=assembly();a.parts[2].id=booleanBodyId('result');a.groundPartId='';
  assert.throws(()=>planAssemblySimulation(a),/IDs collide/);
});

test('physical signatures exclude derived values and speed commands, while protecting geometry and joint structure',()=>{
  const a=assembly();a.mates=[{id:'motor',type:'revolute',partA:'body',partB:'tool',axisLocal:[0,0,1],motorSpeedRpm:30,
    pivotA:{kind:'edge',edgeId:'edge-a',localPoint:[0,0,0]},pivotB:{kind:'edge',edgeId:'edge-b',localPoint:[0,0,0]}}];
  const signature=assemblyPhysicsSignature(a);
  for(const p of a.parts){p.massKg=123;p.volumeCm3=456;p.meshHash='new-derived';p.name='Renamed';}a.name='Renamed project';
  a.mates[0].motorSpeedRpm=60;assert.equal(assemblyPhysicsSignature(a),signature);
  for(const mutate of[
    a=>{a.parts[0].features[0].depthMm=11;},a=>{a.parts[0].transform.rotationDeg[0]=0.00001;},
    a=>{a.parts[0].materialId='brass-c36000';},a=>{a.parts[2].visible=false;},a=>{a.groundPartId='';},
    a=>{a.booleanFeatures[0].materialId='brass-c36000';},a=>{a.mates[0].pivotA.localPoint[0]=1;},
    a=>{a.mates[0].booleanGeometryHashes={'boolean:result':'new-revision'};},
  ]){const changed=structuredClone(a);mutate(changed);assert.notEqual(assemblyPhysicsSignature(changed),signature);}
  const slider=structuredClone(a);slider.mates=[{id:'slider',type:'prismatic',partA:'a',partB:'b',motorVelocityMmPerSec:1}];
  const sliderSignature=assemblyPhysicsSignature(slider);slider.mates[0].motorVelocityMmPerSec=2;assert.equal(assemblyPhysicsSignature(slider),sliderSignature);
});
