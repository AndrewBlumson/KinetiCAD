import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useKinetiCADStore as store } from '../src/state/store.ts';
import { applySketchDimensions } from '../src/sketch/sketchEdit.ts';
import { sketchEditAssemblySignature } from '../src/sketch/sketchEditSource.ts';
import { clearCache } from '../src/features/featureCache.ts';
import { clearVolumeCache } from '../src/features/volumeCache.ts';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';

const makePart = (id = 'part') => ({
  id, name: id, visible: true, materialId: 'steel-1018',
  transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
  sketches: [{ id: `${id}-sketch`, name: 'Rectangle', plane: 'XY', primitives: [{ type: 'rectangle', corner: [0, 0], width: 20, height: 10 }] }],
  features: [{ id: `${id}-extrude`, type: 'extrude', sketchId: `${id}-sketch`, depthMm: 5, direction: 'forward', extrudeMode: 'new-body' }],
  massKg: 0.00785, volumeCm3: 1, meshHash: 'old-derived-hash',
});
function setup({ features, mates = [], booleans = [] } = {}) {
  const first = makePart();
  if (features) first.features = features;
  store.setState({ ...store.getInitialState(), mode: 'modeller', sketchDimensionsEditing: true,
    assembly: { id: 'editable-project', name: 'Editable project', parts: [first, makePart('other')], groundPartId: 'other', mates, booleanFeatures: booleans },
  });
  return first.sketches[0];
}
const edited = width => [{ type: 'rectangle', corner: [0, 0], width, height: 10 }];
const mesh = (width = 30, faceId = 'retained-face') => ({
  positions: new Float32Array([0,0,0, width,0,0, 0,10,0]), normals: new Float32Array([0,0,1, 0,0,1, 0,0,1]), indices: new Uint32Array([0,1,2]),
  edges: [{ id: 'retained-edge', type: 'line', lengthMm: 10, midpoint: [0,5,0], polyline: new Float32Array([0,0,0, 0,10,0]) }],
  faces: [{ id: faceId, type: 'plane', areaMm2: width * 5, centroid: [width / 3, 10 / 3, 0], normalAtCentroid: [0,0,1], triangles: new Uint32Array([0]), planeBasis: { origin:[0,0,0],u:[1,0,0],v:[0,1,0] } }],
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function controlled() {
  const parts = [], booleans = [];
  return { parts, booleans, kernel: {
    buildPartMesh(args) { const d = deferred(); parts.push({ args, ...d }); return d.promise; },
    booleanOp(args) { const d = deferred(); booleans.push({ args, ...d }); return d.promise; },
  } };
}
const flush = () => new Promise(setImmediate);
const apply = (source, kernel, width = 30, signal) => applySketchDimensions('part', 'part-sketch', edited(width), source, kernel, signal);
const union = { id:'union',type:'boolean',resultPartName:'Joined parts',hideInputs:true,inputPartIds:['part','other'],operation:{type:'union'} };
const joint = (kind = 'edge', id = 'retained-edge') => ({ id:'joint',name:'Pinned reference',type:'spherical',partA:'part',partB:'other',
  pivotA: kind === 'edge' ? {kind,edgeId:id,localPoint:[0,5,0]} : {kind,faceId:id,localPoint:[5,2,0]},
  pivotB:{kind:'edge',edgeId:'other-edge',localPoint:[0,5,0]},
});
beforeEach(() => {
  clearCache(); clearVolumeCache();
  store.persist.setOptions({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
});

test('successful edit commits only after full-chain validation, preserving identities and clearing derived state', async () => {
  const source = setup();
  store.setState(s => ({ simulation:{...s.simulation,paused:true,simulationTimeMs:350} }));
  const before = store.getState(), c = controlled(), input = edited(30);
  const pending = applySketchDimensions('part','part-sketch',input,source,c.kernel);
  assert.equal(c.parts.length, 1);
  assert.deepEqual(c.parts[0].args.features, before.assembly.parts[0].features);
  assert.equal(store.getState(), before);
  input[0].width = 999;
  assert.equal(c.parts[0].args.sketches[0].primitives[0].width, 30);
  c.parts[0].resolve({mesh:mesh(30)});
  await pending;
  const after = store.getState(), part = after.assembly.parts[0];
  assert.equal(part.sketches[0].primitives[0].width, 30);
  assert.equal(source.primitives[0].width, 20);
  assert.equal(part.sketches[0].id, source.id);
  assert.equal(part.sketches[0].plane, source.plane);
  assert.equal(part.features, before.assembly.parts[0].features);
  assert.equal(after.assembly.parts[1], before.assembly.parts[1]);
  for (const key of ['meshHash','massKg','volumeCm3']) assert.equal(part[key], undefined);
  assert.equal(after.simulation.running, false); assert.equal(after.simulation.paused, false); assert.equal(after.simulation.simulationTimeMs, 0);
  assert.deepEqual(after.selection, {kind:'sketch',partId:'part',sketchId:'part-sketch'});
  assert.equal(after.pickingMode,'idle'); assert.equal(after.pickFilter,null);
  assert.equal(after.sketchDimensionsEditing,false);
});

test('CAD history failure retains the committed sketch and can be retried', async () => {
  const source = setup(), before = store.getState(), c = controlled();
  const first = apply(source,c.kernel);
  c.parts[0].reject(new Error('edge-not-found: downstream fillet edge no longer exists'));
  await assert.rejects(first,/downstream fillet/);
  assert.equal(store.getState(),before);
  const retry = apply(source,c.kernel);
  assert.equal(c.parts.length,2);
  c.parts[1].resolve({mesh:mesh()});
  await retry;
  assert.equal(store.getState().assembly.parts[0].sketches[0].primitives[0].width,30);
});

test('dependent assembly Boolean receives updated geometry and must succeed before commit', async () => {
  const source = setup({booleans:[union]}), before = store.getState(), c = controlled();
  const pending = apply(source,c.kernel);
  c.parts[0].resolve({mesh:mesh()}); await flush();
  assert.equal(c.booleans.length,1);
  assert.equal(c.booleans[0].args.inputs[0].sketches[0].primitives[0].width,30);
  assert.deepEqual(c.booleans[0].args.inputs[1].features,before.assembly.parts[1].features);
  assert.equal(store.getState(),before);
  c.booleans[0].reject(new Error('Intersection became empty'));
  await assert.rejects(pending,/Joined parts.*Intersection became empty/);
  assert.equal(store.getState(),before);
  const retry = apply(source,c.kernel); await flush();
  assert.equal(c.parts.length,1,'validated candidate part uses its warm cache on retry');
  c.booleans[1].resolve(mesh(50)); await retry;
  assert.equal(store.getState().assembly.booleanFeatures[0],union);
});

test('a later geometry or Boolean-consumer edit invalidates a pending transaction', async () => {
  for (const change of [
    s => ({assembly:{...s.assembly,parts:s.assembly.parts.map(p=>p.id==='other'?{...p,transform:{...p.transform,positionMm:[10,0,0]}}:p)}}),
    s => ({assembly:{...s.assembly,booleanFeatures:[union]}}),
  ]) {
    clearCache(); const source=setup(),c=controlled(),pending=apply(source,c.kernel);
    store.setState(change); const newer=store.getState();
    c.parts[0].resolve({mesh:mesh()});
    await assert.rejects(pending,/model changed/);
    assert.equal(store.getState(),newer);
    assert.equal(source.primitives[0].width,20);
  }
});

test('mass-cache churn and cosmetic part naming do not reject or overwrite newer display state', async () => {
  const source=setup(),c=controlled(),pending=apply(source,c.kernel);
  store.setState(s=>({assembly:{...s.assembly,name:'My renamed project',parts:s.assembly.parts.map(p=>({...p,name:`Renamed ${p.id}`,massKg:123,volumeCm3:456,meshHash:'new-cache'}))}}));
  c.parts[0].resolve({mesh:mesh()}); await pending;
  assert.equal(store.getState().assembly.name,'My renamed project');
  assert.equal(store.getState().assembly.parts[0].name,'Renamed part');
  assert.equal(store.getState().assembly.parts[1].massKg,123);
});

test('loading an identical-looking project during validation rejects its old Sketch identity', async () => {
  const source=setup(),c=controlled(),pending=apply(source,c.kernel);
  store.setState(s=>({assembly:structuredClone(s.assembly)}));
  const loaded=store.getState();
  c.parts[0].resolve({mesh:mesh()});
  await assert.rejects(pending,/model changed/);
  assert.equal(store.getState(),loaded);
});

test('cancelled or closed editors cannot commit a late CAD result', async () => {
  for (const abortSignal of [true,false]) {
    clearCache(); const source=setup(),c=controlled(),abort=new AbortController();
    const pending=apply(source,c.kernel,30,abort.signal);
    if(abortSignal) abort.abort(); else store.getState().setSketchDimensionsEditing(false);
    const cancelled=store.getState(); c.parts[0].resolve({mesh:mesh()});
    await assert.rejects(pending,abortSignal?/cancelled/:/Finish other edits/);
    assert.equal(store.getState(),cancelled);
    assert.equal(source.primitives[0].width,20);
  }
});

test('two pending edits cannot commit out of order', async () => {
  const source=setup(),c=controlled(),first=apply(source,c.kernel,30),second=apply(source,c.kernel,40);
  c.parts[1].resolve({mesh:mesh(40)}); await second;
  const committed=store.getState();
  c.parts[0].resolve({mesh:mesh(30)}); await assert.rejects(first,/Finish other edits|model changed/);
  assert.equal(store.getState(),committed);
  assert.equal(committed.assembly.parts[0].sketches[0].primitives[0].width,40);
});

test('unchanged referenced edge geometry retains the exact joint and its local anchor', async () => {
  const mate=joint(),source=setup({mates:[mate]}),c=controlled(),pending=apply(source,c.kernel);
  c.parts[0].resolve({mesh:mesh(30)}); await flush();
  c.parts[1].resolve({mesh:mesh(20)}); await pending;
  assert.equal(store.getState().assembly.mates[0],mate);
  assert.deepEqual(mate.pivotA.localPoint,[0,5,0]);
});

test('missing geometry IDs or a changed referenced face reject without guessing new pivots', async () => {
  for(const mate of [joint('edge','missing-edge'),joint('face','retained-face')]) {
    clearCache(); const source=setup({mates:[mate]}),before=store.getState(),c=controlled(),pending=apply(source,c.kernel);
    c.parts[0].resolve({mesh:mesh(30)}); await flush();
    c.parts[1].resolve({mesh:mesh(20)});
    await assert.rejects(pending,/Pinned reference.*anchor has not been moved/);
    assert.equal(store.getState(),before);
    assert.equal(store.getState().assembly.mates[0],mate);
  }
});

test('fixed mates and unused sketches need no geometric-pivot remapping', async () => {
  const fixed={id:'fixed',type:'fixed',partA:'part',partB:'other'};
  const source=setup({features:[],mates:[fixed]}); let calls=0;
  await apply(source,{buildPartMesh(){calls++;throw new Error('No solid history');}});
  assert.equal(calls,0); assert.equal(store.getState().assembly.mates[0],fixed);
});

test('meaningful edits clear canonical controllers and save the manual-geometry marker; no-op preserves them', async () => {
  const source=setup();
  const force={kind:'equal-force',partIds:['part'],forceN:1,direction:[1,0,0],durationMs:1000};
  const controllers={crankSlider:{radiusMm:25,rodLengthMm:100,rpm:15},stewartMotion:{kind:'six-axis'}};
  store.setState(s=>({simulation:{...s.simulation,...controllers,forceExperiment:force}}));
  const original=store.getState();
  await apply(source,{buildPartMesh(){throw new Error('A no-op must not rebuild CAD');}},20);
  assert.equal(store.getState().assembly,original.assembly);
  assert.equal(store.getState().simulation,original.simulation);
  assert.equal(store.getState().simulation.sketchGeometryEdited,undefined);
  store.getState().setSketchDimensionsEditing(true);
  const c=controlled(),pending=apply(source,c.kernel);
  c.parts[0].resolve({mesh:mesh()}); await pending;
  const updated=store.getState();
  assert.equal(updated.simulation.crankSlider,undefined); assert.equal(updated.simulation.stewartMotion,undefined);
  assert.equal(updated.simulation.sketchGeometryEdited,true); assert.equal(updated.simulation.forceExperiment,force);
  const saved=await createProjectDocument(updated,async()=>{throw new Error('Native save cannot need OCCT');});
  const loaded=parseProjectDocument(JSON.parse(JSON.stringify(saved)));
  assert.equal(loaded.state.simulation.sketchGeometryEdited,true);
  assert.equal(loaded.state.assembly.parts[0].sketches[0].primitives[0].width,30);
  assert.equal(loaded.state.sketchDimensionsEditing,undefined);
  assert.equal(store.persist.getOptions().partialize(updated).sketchDimensionsEditing,undefined);
});

test('invalid dimensions, stale editor source and active editors reject before CAD dispatch', async () => {
  for(const change of [
    ()=>{},
    ()=>store.getState().setSketchDimensionsEditing(false),
    ()=>store.setState(s=>({simulation:{...s.simulation,running:true}})),
    ()=>store.setState(s=>({sketchSession:{...s.sketchSession,active:true}})),
  ]) {
    const source=setup(); change(); let calls=0;
    const width=store.getState().sketchDimensionsEditing && !store.getState().simulation.running && !store.getState().sketchSession.active ? -10 : 30;
    await assert.rejects(apply(source,{buildPartMesh(){calls++;}},width));
    assert.equal(calls,0); assert.equal(source.primitives[0].width,20);
  }
  const source=setup();
  await assert.rejects(apply(structuredClone(source),{buildPartMesh(){throw new Error('Not reached');}}),/model changed/);
});

test('the store commit independently rejects a stale source signature', () => {
  const source=setup(),before=store.getState();
  const signature=sketchEditAssemblySignature(before.assembly);
  store.setState(s=>({assembly:{...s.assembly,groundPartId:'part'}}));
  const newer=store.getState();
  assert.throws(()=>store.getState().updateSketch('part','part-sketch',edited(30),source,signature),/model changed/);
  assert.equal(store.getState(),newer);
});
