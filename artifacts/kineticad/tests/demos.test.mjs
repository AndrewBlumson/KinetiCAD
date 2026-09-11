import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import { parseDemoDocument, demoAssetUrl } from '../src/demos/demoDocument.ts';
import { createDemoSession } from '../src/demos/demoSession.ts';

const ids = ['windmill', 'orrery', 'gyroscope', 'kinetic-mobile', 'material-studio', 'stewart-platform'];
const fixture = (id) => JSON.parse(readFileSync(new URL(`../public/demos/${id}.json`, import.meta.url), 'utf8'));

test('all bundled examples load and reference existing parts', () => {
  for (const id of ids) assert.ok(parseDemoDocument(fixture(id)).state.assembly.parts.length > 0);
});

test('asset paths work at the Replit /app base and a local root', () => {
  assert.equal(demoAssetUrl('windmill', '/app'), '/app/demos/windmill.json');
  assert.equal(demoAssetUrl('windmill', '/app/'), '/app/demos/windmill.json');
  assert.equal(demoAssetUrl('windmill', '/'), '/demos/windmill.json');
});

test('force experiment survives document parsing and rejects invalid target references', () => {
  const value = fixture('material-studio');
  assert.deepEqual(parseDemoDocument(value).state.simulation.forceExperiment, value.state.simulation.forceExperiment);
  value.state.simulation.forceExperiment.partIds.push('missing');
  assert.throws(() => parseDemoDocument(value), /invalid force experiment/);
});

test('invalid and unsupported documents fail before entering a workspace', () => {
  const value = fixture('windmill');
  value.version = 10;
  assert.throws(() => parseDemoDocument(value));
  value.version = 9;
  value.state.assembly.mates[0].partB = 'missing';
  assert.throws(() => parseDemoDocument(value), /invalid joint/);
  value.state.assembly.parts[0].transform.positionMm[0] = Infinity;
  assert.throws(() => parseDemoDocument(value));
});

function workspace() {
  const stored = new Map();
  const original = structuredClone(fixture('windmill').state);
  original.assembly.id = 'my-project';
  original.assembly.name = 'My original model';
  // Imported shape references must retain the same live worker/cache identity.
  original.assembly.parts[0].features = [{ id: 'import-1', type: 'imported-step', shapeId: 'live-wasm-shape' }];
  const storage = createJSONStorage(() => ({
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  }));
  const store = createStore(persist(() => ({ ...original, selection: null }), { name: 'kineticad-state', version: 9, storage }));
  store.setState({ selection: 'original-selection' });
  const session = createDemoSession({
    read: store.getState, initial: store.getInitialState, write: store.setState,
    isolatePersistence: () => {
      const previous = store.persist.getOptions().storage;
      store.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
      return () => store.persist.setOptions({ storage: previous });
    },
  });
  return { stored, original, store, session };
}

test('editing and playing multiple demos never overwrite the original project', () => {
  const { stored, original, store, session } = workspace();
  const before = stored.get('kineticad-state');
  for (const id of ids) {
    session.enter(parseDemoDocument(fixture(id)));
    store.setState({ assembly: { ...store.getState().assembly, name: `Edited ${id}` } });
    store.setState({ simulation: { ...store.getState().simulation, running: true, simulationTimeMs: 4000 } });
    assert.equal(stored.get('kineticad-state'), before);
  }
  session.leave();
  assert.equal(store.getState().assembly, original.assembly);
  assert.equal(store.getState().assembly.parts[0].features[0].shapeId, 'live-wasm-shape');
  assert.equal(store.getState().selection, 'original-selection');
  assert.equal(store.getState().simulation.running, false);
  assert.equal(stored.get('kineticad-state'), before);
  store.setState({ assembly: { ...store.getState().assembly, name: 'Next original edit' } });
  assert.equal(JSON.parse(stored.get('kineticad-state')).state.assembly.name, 'Next original edit');
});

test('a second visit captures the newly edited original and begins stopped', () => {
  const { store, session } = workspace();
  const doc = parseDemoDocument(fixture('gyroscope'));
  doc.state.simulation.running = true;
  session.enter(doc);
  assert.equal(store.getState().simulation.running, false);
  session.leave();
  store.setState({ assembly: { ...store.getState().assembly, name: 'Revised project' } });
  session.enter(parseDemoDocument(fixture('orrery')));
  session.leave();
  session.leave();
  assert.equal(store.getState().assembly.name, 'Revised project');
});
