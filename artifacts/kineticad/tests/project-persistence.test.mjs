import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import { createProjectPersistence } from '../src/project/projectPersistence.ts';
import { parseProjectDocument, parseProjectState, encodeBytes, sha256, shapeIdForAsset } from '../src/project/projectDocument.ts';
import { makeSnapshot } from '../src/project/projectRepository.ts';
import { createDemoSession } from '../src/demos/demoSession.ts';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { computeBooleanHash } from '../src/features/assemblyRegen.ts';
import { planAssemblySimulation } from '../src/physics/assemblySimulation.ts';

const fixture = () => JSON.parse(readFileSync(new URL('../public/demos/windmill.json', import.meta.url))).state;
const document = (state = fixture()) => parseProjectDocument({ format: 'kineticad-project', version: 1, stateVersion: 9, state, assets: [] });
function harness(initial = {}) {
  const saved = structuredClone(initial), reports = [], restores = [];
  const repository = { read: async () => structuredClone(saved), commit: async (next, previous) => {
    if (repository.fail) throw new Error('QuotaExceededError');
    saved.current = structuredClone(next); if (previous) saved.previous = structuredClone(previous);
  } };
  const persistence = createProjectPersistence({ repository, packageState: async (state) => document(state), restoreAssets: async (doc) => restores.push(doc), report: (state) => reports.push(state) });
  return { saved, repository, persistence, restores, reports };
}
const name = (snapshot) => JSON.parse(snapshot.payload).state.assembly.name;

function booleanProjectState() {
  const state = fixture();
  const witness = structuredClone(state.assembly.parts[0]); witness.id = 'witness'; witness.name = 'External base';
  const result = {id:'finished-housing',type:'boolean',resultPartName:'Housing',hideInputs:false,materialId:'titanium-grade5',
    inputPartIds:state.assembly.parts.map(p=>p.id),operation:{type:'union'}};
  state.assembly.parts.push(witness);state.assembly.booleanFeatures=[result];state.assembly.groundPartId='boolean:finished-housing';
  state.assembly.mates=[{id:'finished-joint',name:'Finished attachment',type:'fixed',partA:'boolean:finished-housing',partB:'witness',
    booleanGeometryHashes:{'boolean:finished-housing':computeBooleanHash(result,state.assembly.parts)}}];
  return state;
}

test('complete project downloads and both recovery generations retain Boolean material, result ground and joint revisions',async()=>{
  const state=booleanProjectState();
  const packaged=await createProjectDocument({...state,setMode(){}},async()=>{throw new Error('Native histories need no STEP packaging');});
  const loaded=parseProjectDocument(JSON.parse(JSON.stringify(packaged)));
  assert.deepEqual(loaded.state.assembly,state.assembly);assert.equal(planAssemblySimulation(loaded.state.assembly).booleans[0].materialId,'titanium-grade5');
  const h=harness();await h.persistence.storage.getItem('project');
  h.persistence.storage.setItem('project',{state,version:9});await h.persistence.flush();
  const next=structuredClone(state);next.assembly.booleanFeatures[0].materialId='brass-c36000';next.assembly.groundPartId='';
  h.persistence.storage.setItem('project',{state:next,version:9});await h.persistence.flush();
  assert.equal(JSON.parse(h.saved.current.payload).state.assembly.booleanFeatures[0].materialId,'brass-c36000');
  assert.equal(JSON.parse(h.saved.previous.payload).state.assembly.groundPartId,'boolean:finished-housing');
  const restarted=harness(h.saved);const recovered=await restarted.persistence.storage.getItem('project');
  assert.deepEqual(recovered.state.assembly,next.assembly);
  const previous=await restarted.persistence.recoverPrevious();
  assert.deepEqual(previous.state.assembly,state.assembly);
});

test('Boolean project parsing rejects invalid materials/body references and retains stale revisions for explicit repicking',()=>{
  for(const mutate of[
    s=>{s.assembly.booleanFeatures[0].materialId='unknown-alloy';},
    s=>{s.assembly.groundPartId='boolean:missing';},
    s=>{s.assembly.mates[0].partA='boolean:missing';},
    s=>{s.assembly.mates[0].booleanGeometryHashes={'boolean:finished-housing':123};},
  ]){const state=booleanProjectState();mutate(state);assert.throws(()=>document(state));}
  const state=booleanProjectState();state.assembly.parts[0].transform.positionMm[0]+=1;
  const loaded=document(state);assert.deepEqual(loaded.state.assembly.mates[0].booleanGeometryHashes,state.assembly.mates[0].booleanGeometryHashes);
  assert.throws(()=>planAssemblySimulation(loaded.state.assembly),/Finished attachment.*changed since/);
});

test('native history, transforms, materials and mates survive with runtime stopped', () => {
  const state = fixture(); state.assembly.parts[1].transform = { positionMm: [17, -9, 11], rotationDeg: [13, 29, -41] };
  state.simulation.running = true; state.simulation.simulationTimeMs = 900;
  const doc = document(state), loaded = parseProjectDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(loaded.state.assembly, state.assembly);
  assert.equal(loaded.state.simulation.running, false); assert.equal(loaded.state.simulation.simulationTimeMs, 0);
});

test('Save accepts the live Zustand object without cloning actions or editor state', async () => {
  const state = { ...fixture(), setMode() {}, selection: { kind: 'part' }, featureEditor: { open: true } };
  const saved = await createProjectDocument(state, async () => { throw new Error('Native project must not need a CAD round-trip.'); });
  assert.equal(saved.state.assembly.name, state.assembly.name);
  assert.equal('setMode' in saved.state, false); assert.equal('selection' in saved.state, false);
});

test('malformed references, dimensions, transforms and unknown features reject', () => {
  for (const mutate of [
    (s) => s.assembly.mates[0].partB = 'missing',
    (s) => s.assembly.parts[1].features[0].sketchId = 'missing',
    (s) => s.assembly.parts[0].transform.positionMm[0] = Infinity,
    (s) => s.assembly.parts[0].features[0].depthMm = -1,
    (s) => s.assembly.parts[0].features[0].type = 'surprise',
    (s) => s.assembly.parts.push(structuredClone(s.assembly.parts[0])),
  ]) { const state = fixture(); mutate(state); assert.throws(() => parseProjectState(state)); }
});

test('six-axis configuration persists and invalid target rejects', () => {
  const state = fixture();
  state.simulation.stewartMotion = { kind: 'six-axis', target: { translationMm: [2, -1, 4], rotationDeg: [1, 0, -1] }, moveDurationMs: 4000, settleDurationMs: 2000 };
  assert.deepEqual(document(state).state.simulation.stewartMotion, state.simulation.stewartMotion);
  state.simulation.stewartMotion.target.translationMm[0] = Infinity;
  assert.throws(() => document(state));
});

test('corrupt embedded bytes reject before asset reconstruction or storage changes', async () => {
  const h = harness(); await h.persistence.storage.getItem('project');
  const bytes = new Uint8Array([1, 2, 3]); const digest = await sha256(bytes);
  const asset = { id: `${digest}-ground`, sha256: digest, data: encodeBytes(new Uint8Array([4, 5, 6])), fileName: 'sample.step', preserveCoordinates: false, bodies: [{ meshSha256: '0'.repeat(64), min: [0, 0, 0], max: [1, 1, 1] }] };
  const state = fixture(); state.assembly.parts[1].features = [{ id: 'import', type: 'imported-step', shapeId: shapeIdForAsset(asset, 0) }];
  const doc = { ...document(), state, assets: [asset] };
  await assert.rejects(h.persistence.load(JSON.stringify(doc)), /checksum failed/);
  assert.equal(h.restores.length, 0); assert.deepEqual(h.saved, {});
});

test('invalid downloaded project does not replace the current or previous snapshots', async () => {
  const first = document(); first.state.assembly.name = 'Keep me';
  const h = harness({ current: await makeSnapshot(JSON.stringify(first)) });
  await h.persistence.storage.getItem('project');
  const before = structuredClone(h.saved);
  await assert.rejects(h.persistence.load('{broken'));
  const invalid = document(); invalid.state.assembly.parts[0].features = [{ id: 'legacy', type: 'imported-step', shapeId: 'missing-asset' }];
  await assert.rejects(h.persistence.load(JSON.stringify(invalid)), /embedded STEP/);
  assert.deepEqual(h.saved, before);
});

test('autosave keeps two complete generations and quota failure retains both', async () => {
  const h = harness(); await h.persistence.storage.getItem('project');
  for (const title of ['First', 'Second']) {
    const state = fixture(); state.assembly.name = title;
    h.persistence.storage.setItem('project', { state, version: 9 }); await h.persistence.flush();
  }
  assert.equal(name(h.saved.current), 'Second'); assert.equal(name(h.saved.previous), 'First');
  const before = structuredClone(h.saved); h.repository.fail = true;
  const state = fixture(); state.assembly.name = 'Unsaved edit';
  h.persistence.storage.setItem('project', { state, version: 9 }); await h.persistence.flush();
  assert.deepEqual(h.saved, before); assert.match(h.reports.at(-1).message, /QuotaExceededError/);
  await assert.rejects(h.persistence.load(JSON.stringify(document(state))), /QuotaExceededError/);
  assert.deepEqual(h.saved, before);
});

test('corrupt newest recovery falls back to validated previous without overwriting either', async () => {
  const previous = await makeSnapshot(JSON.stringify(document()));
  const current = { ...previous, payload: 'corrupt' };
  const h = harness({ current, previous }); const before = structuredClone(h.saved);
  const restored = await h.persistence.storage.getItem('project');
  assert.deepEqual(restored.state, document().state);
  assert.equal(h.reports.at(-1).recovered, true); assert.deepEqual(h.saved, before);
});

test('newest state is captured before async work and load follows queued autosave', async () => {
  const h = harness(); await h.persistence.storage.getItem('project');
  const state = fixture(); state.assembly.name = 'Before load';
  h.persistence.storage.setItem('project', { state, version: 9 }); state.assembly.name = 'Mutated caller';
  const next = document(); next.state.assembly.name = 'Loaded';
  await h.persistence.load(JSON.stringify(next));
  assert.equal(name(h.saved.current), 'Loaded'); assert.equal(name(h.saved.previous), 'Before load');
});

test('real Zustand demo isolation preserves durable project and last-good copy', async () => {
  const h = harness();
  const initial = fixture(); initial.assembly.name = 'My project';
  const store = createStore(persist(() => initial, { name: 'project', version: 9, skipHydration: true, storage: h.persistence.storage }));
  await store.persist.rehydrate(); store.setState({ assembly: { ...initial.assembly, name: 'My revised project' } });
  const session = createDemoSession({ read: store.getState, initial: store.getInitialState, write: store.setState, isolatePersistence() {
    const storage = store.persist.getOptions().storage;
    store.persist.setOptions({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
    return () => store.persist.setOptions({ storage });
  } });
  session.enter({ version: 9, state: fixture() });
  store.setState({ assembly: { ...fixture().assembly, name: 'Edited demo' } });
  await h.persistence.flush(); assert.equal(name(h.saved.current), 'My revised project');
  session.leave(); assert.equal(store.getState().assembly.name, 'My revised project');
  await h.persistence.flush(); assert.equal(name(h.saved.current), 'My revised project');
});

test('version 8 migration runs before validation; old missing STEP files reject clearly', async () => {
  let migratedVersion;
  const persistence = createProjectPersistence({ repository: harness().repository, packageState: async (s) => document(s), restoreAssets: async () => {}, migrateLegacy: (state, version) => { migratedVersion = version; state.assembly.parts.forEach((p) => p.materialId = 'aluminium-6061'); return state; } });
  const old = { version: 8, state: fixture() }; old.state.assembly.parts.forEach((p) => delete p.materialId);
  const doc = await persistence.parseFile(JSON.stringify(old)); assert.equal(migratedVersion, 8); assert.equal(doc.state.assembly.parts[0].materialId, 'aluminium-6061');
  old.state.assembly.parts[1].features = [{ id: 'import', type: 'imported-step', shapeId: 'old-session-id' }];
  await assert.rejects(persistence.parseFile(JSON.stringify(old)), /does not contain its imported STEP/);
});
