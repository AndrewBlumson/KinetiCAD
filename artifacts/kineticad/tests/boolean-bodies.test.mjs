import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { regenerateBooleanBody } from '../src/features/booleanBodies.ts';
import { computeBooleanHash, createBooleanOpArgs, regenerateBoolean } from '../src/features/assemblyRegen.ts';
import { clearCache } from '../src/features/featureCache.ts';
import { massPropertiesForMaterial, volumeDataFromMassProperties } from '../src/features/volumeCache.ts';

const part = id => ({ id, name: id, visible: true, materialId: 'steel-1018',
  transform: { positionMm: [0,0,0], rotationDeg: [0,0,0] },
  sketches: [{ id: `${id}-sketch`, name: 'Rectangle', plane: 'XY', primitives: [{type:'rectangle',corner:[0,0],width:20,height:10}] }],
  features: [{ id:`${id}-feature`,type:'extrude',sketchId:`${id}-sketch`,depthMm:5,direction:'forward',extrudeMode:'new-body' }],
});
const inputs = () => [part('body'),part('tool')];
const feature = (operation={type:'union'}, name='Finished housing') => ({id:'boolean-result',type:'boolean',resultPartName:name,hideInputs:true,inputPartIds:['tool','body'],operation});
const mesh = x => ({positions:new Float32Array([x,0,0,x+1,0,0,x,1,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1]),indices:new Uint32Array([0,1,2]),edges:[],faces:[]});
const output = (x=0) => ({mesh:{...mesh(x),solidCount:1},massProperties:{volumeMm3:1000,massKg:0.001,comLocal:[x,2,3],principalInertiaKgMm2:[1,2,3],principalInertiaLocalFrame:[0,0,0,1]}});
function deferred() { let resolve,reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject}; }
function controlled() {
  const calls=[],previews=[];
  const dispatch=target=>args=>{const d=deferred();target.push({args,...d});return d.promise;};
  return{calls,previews,kernel:{buildBooleanBody:dispatch(calls),booleanOp:dispatch(previews)}};
}
beforeEach(clearCache);

test('concurrent physical preparations dispatch one exact ordered, immutable full-chain snapshot',async()=>{
  const c=controlled(),p=inputs(),f=feature({type:'subtract',toolPartId:'tool'}),hash=computeBooleanHash(f,p);
  const requests=Array.from({length:12},()=>regenerateBooleanBody(f,p,c.kernel));
  assert.equal(c.calls.length,1);
  assert.deepEqual(c.calls[0].args.inputs.map(p=>p.partId),['body','tool']);
  assert.deepEqual(c.calls[0].args.inputs[0].features,p[0].features);
  assert.deepEqual(c.calls[0].args.inputs[0].sketches,p[0].sketches);
  p[0].sketches[0].primitives[0].width=99;p[0].transform.rotationDeg[1]=13;f.operation.toolPartId='changed';
  assert.equal(c.calls[0].args.inputs[0].sketches[0].primitives[0].width,20);
  assert.equal(c.calls[0].args.inputs[0].transform.rotationDeg[1],0);
  assert.equal(c.calls[0].args.operation.toolPartId,'tool');
  const body=output(45);c.calls[0].resolve(body);
  for(const result of await Promise.all(requests)){
    assert.equal(result.mesh,body.mesh);assert.equal(result.mesh.solidCount,1);assert.equal(result.massProperties,body.massProperties);assert.equal(result.hash,hash);
  }
});

test('material/display-only changes reuse unit-density properties without changing the geometric result',async()=>{
  const c=controlled(),p=inputs(),f=feature(),request=regenerateBooleanBody(f,p,c.kernel),body=output(42);
  c.calls[0].resolve(body);await request;
  for(const value of p){value.materialId='brass-c36000';value.name='Renamed';value.visible=false;value.massKg=123;value.meshHash='derived';value.sketches[0].name='Renamed sketch';}
  const renamed={...f,id:'another-result-id',resultPartName:'Another name',hideInputs:false,materialId:'brass-c36000'};
  const result=await regenerateBooleanBody(renamed,p,c.kernel);
  assert.equal(c.calls.length,1);assert.equal(result.mesh,body.mesh);
  const scaled=massPropertiesForMaterial(volumeDataFromMassProperties(result.massProperties,1),8.5);
  assert.equal(scaled.massKg,0.0085);assert.deepEqual(scaled.principalInertiaKgMm2,[8.5,17,25.5]);
  assert.deepEqual(scaled.comLocal,[42,2,3]);assert.equal(result.massProperties.massKg,0.001);
});

test('settled and pending body caches remain independent across CAD worker instances',async()=>{
  const a=controlled(),b=controlled(),f=feature(),p=inputs();
  const first=regenerateBooleanBody(f,p,a.kernel);a.calls[0].resolve(output(1));await first;
  const second=regenerateBooleanBody(f,p,b.kernel);assert.equal(b.calls.length,1);
  const third=regenerateBooleanBody(f,p,b.kernel);assert.equal(b.calls.length,1);
  b.calls[0].resolve(output(2));assert.equal((await second).mesh.positions[0],2);assert.equal((await third).mesh.positions[0],2);
  assert.equal((await regenerateBooleanBody(f,p,a.kernel)).mesh.positions[0],1);
});

test('native edits, imported asset identity, Boolean operation and exact sub-0.0001 transforms invalidate geometry',async()=>{
  const mutations=[
    p=>{p[0].sketches[0].primitives[0].width+=0.00001;},
    p=>{p[0].features[0].depthMm+=1;},
    p=>{p[0].transform.positionMm[0]=0.00001;},
    p=>{p[0].transform.rotationDeg[2]=0.00001;},
    p=>{p[0].features.push({id:'new-cut',type:'extrude',sketchId:'body-sketch',depthMm:2,direction:'forward',extrudeMode:'subtract'});},
    p=>{p[0].features=[{id:'import',type:'imported-step',shapeId:'updated-asset-body'}];},
  ];
  for(const mutate of mutations){
    const c=controlled(),p=inputs(),f=feature(),original=regenerateBooleanBody(f,p,c.kernel),edited=structuredClone(p);mutate(edited);
    assert.notEqual(computeBooleanHash(f,p),computeBooleanHash(f,edited));
    const next=regenerateBooleanBody(f,edited,c.kernel);assert.equal(c.calls.length,2);
    c.calls[1].resolve(output(2));c.calls[0].resolve(output(1));
    assert.equal((await original).mesh.positions[0],1);assert.equal((await next).mesh.positions[0],2);
  }
  const p=inputs();
  assert.notEqual(computeBooleanHash(feature(),p),computeBooleanHash(feature({type:'intersect'}),p));
  p[0].features=[{id:'import',type:'imported-step',shapeId:'asset-original'}];
  const hash=computeBooleanHash(feature(),p);p[0].features[0].shapeId='asset-replacement';
  assert.notEqual(hash,computeBooleanHash(feature(),p));
});

test('display cache and its valid compound mesh cannot certify a physical single-solid body',async()=>{
  const c=controlled(),f=feature(),p=inputs(),preview=regenerateBoolean(f,p,c.kernel);
  c.previews[0].resolve({...mesh(12),solidCount:2});await preview;
  const request=regenerateBooleanBody(f,p,c.kernel);assert.equal(c.calls.length,1);
  c.calls[0].reject(new Error('finished result contains 2 disconnected solids'));
  await assert.rejects(request,/Finished housing.*2 disconnected solids/);
  assert.equal((await regenerateBoolean(f,p,c.kernel)).mesh.positions[0],12);
  assert.equal((await regenerateBoolean(f,p,c.kernel)).mesh.solidCount,2);
});

test('shared failures retain each caller name and later attempts retry instead of caching an error',async()=>{
  const c=controlled(),p=inputs(),a=regenerateBooleanBody(feature(),p,c.kernel),b=regenerateBooleanBody(feature({type:'union'},'Named cover'),p,c.kernel);
  const failures=[assert.rejects(a,/Finished housing.*empty-result/),assert.rejects(b,/Named cover.*empty-result/)];
  assert.equal(c.calls.length,1);c.calls[0].reject(new Error('empty-result: no geometry'));await Promise.all(failures);
  const retry=regenerateBooleanBody(feature(),p,c.kernel);assert.equal(c.calls.length,2);
  c.calls[1].resolve(output(3));assert.equal((await retry).mesh.positions[0],3);
});

test('explicit cache reset separates pending generations and prevents old completions overwriting fresh bodies',async()=>{
  const c=controlled(),f=feature(),p=inputs(),old=regenerateBooleanBody(f,p,c.kernel);
  clearCache();const fresh=regenerateBooleanBody(f,p,c.kernel);assert.equal(c.calls.length,2);
  c.calls[1].resolve(output(2));await fresh;c.calls[0].resolve(output(1));await old;
  assert.equal((await regenerateBooleanBody(f,p,c.kernel)).mesh.positions[0],2);assert.equal(c.calls.length,2);
  clearCache();const stale=regenerateBooleanBody(f,p,c.kernel);clearCache();c.calls[2].resolve(output(3));await stale;
  const current=regenerateBooleanBody(f,p,c.kernel);assert.equal(c.calls.length,4);
  c.calls[3].resolve(output(4));await current;
});

test('invalid input configuration fails with a named error before contacting CAD',async()=>{
  const bad=[
    (f,p)=>{f.inputPartIds=['missing','body'];},
    (f,p)=>{f.inputPartIds=['body','body'];},
    (f,p)=>{p[0].features=[];},
    (f,p)=>{p[0].transform.positionMm[0]=NaN;},
    (f,p)=>{f.operation={type:'subtract',toolPartId:'missing'};},
    (f,p)=>{f.operation={type:'unsupported'};},
  ];
  for(const mutate of bad){const c=controlled(),f=feature(),p=inputs();mutate(f,p);await assert.rejects(regenerateBooleanBody(f,p,c.kernel),/Cannot simulate Boolean "Finished housing"/);assert.equal(c.calls.length,0);}
});

test('preview regeneration shares pending operations, keeps worker-scoped settled results and retries failures',async()=>{
  const c=controlled(),f=feature(),p=inputs(),a=regenerateBoolean(f,p,c.kernel),b=regenerateBoolean(f,p,c.kernel);
  assert.equal(c.previews.length,1);c.previews[0].reject(new Error('preview build failed'));
  for(const result of await Promise.all([a,b]))assert.match(result.error,/preview build failed/);
  const retry=regenerateBoolean(f,p,c.kernel);assert.equal(c.previews.length,2);c.previews[1].resolve(mesh(2));await retry;
  const other=controlled(),independent=regenerateBoolean(f,p,other.kernel);assert.equal(other.previews.length,1);
  other.previews[0].resolve(mesh(3));assert.equal((await independent).mesh.positions[0],3);
  clearCache();const next=regenerateBoolean(f,p,c.kernel);assert.equal(c.previews.length,3);c.previews[2].resolve(mesh(4));await next;
});

test('the shared argument builder preserves source arrays and supports canonical object-key order',()=>{
  const p=inputs(),f=feature(),hash=computeBooleanHash(f,p),snapshot=createBooleanOpArgs(f,p);
  const reordered=p.map(value=>({...value,transform:{rotationDeg:[...value.transform.rotationDeg],positionMm:[...value.transform.positionMm]}}));
  assert.equal(computeBooleanHash(f,reordered),hash);
  snapshot.inputs[1].sketches[0].primitives[0].corner[0]=100;
  assert.equal(p[0].sketches[0].primitives[0].corner[0],0);
});
