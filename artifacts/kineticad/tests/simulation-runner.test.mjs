// Exercise the shipped runner; substitute only external worker/render adapters.
// Deferred RPCs make lifecycle order deterministic without relying on sleep.
import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createStore } from 'zustand/vanilla';

const key = '__kineticadRunnerTest';
let harness;
let generation = 0;
const adapterModules = {
  '@/cad/cadClient': `export const getCadKernel=()=>globalThis.${key}.cad();`,
  '@/cad/materials': 'export const getMaterial=()=>({densityGcm3:1});',
  '@/state/store': `export const useKinetiCADStore={getState:()=>globalThis.${key}.store.getState(),subscribe:(fn)=>globalThis.${key}.store.subscribe(fn)};`,
  '@/features/featureRegen': 'export const computeFeatureHash=()=>"test-shape";',
  '@/features/volumeCache': `export const getVolumeData=()=>({}); export const setVolumeData=()=>{}; export const massPropertiesForMaterial=()=>globalThis.${key}.mass(); export const volumeDataFromMassProperties=(p)=>p;`,
  '@/three/partMeshLayerRef': `export const getPartMeshLayer=()=>globalThis.${key}.partLayer;`,
  '@/three/simulationLayerRef': `export const getSimulationLayer=()=>globalThis.${key}.simLayer;`,
  './physicsClient': `export const getPhysicsKernel=()=>Promise.resolve(globalThis.${key}.physics);`,
  './stewartFixture': `export const verifyBundledStewartGeometry=(assembly,base)=>globalThis.${key}.verifyStewart(assembly,base);`,
  sonner: `export const toast={error:(...args)=>globalThis.${key}.toasts.push(args)};`,
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['./forceMeasurements', './poseMeasurements'].includes(specifier) && context.parentURL?.includes('/src/physics/simulationRunner.ts')) {
      return { url: new URL(`../src/physics/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    if (context.parentURL?.includes('/src/physics/simulationRunner.ts') && adapterModules[specifier]) {
      return { url: `data:text/javascript,${encodeURIComponent(adapterModules[specifier])}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const stepResult = (dtMs = 10) => ({ dtMs, transforms: [{ partId: 'part', positionMm: [1, 2, 3], rotationQuat: [0, 0, 0, 1] }] });
function layers() {
  return {
    partLayer: { group: { visible: true }, forEachVisible(callback) {
      callback('part', { geometry: { getAttribute: () => ({ array: new Float32Array([0, 0, 0, 1, 1, 1]) }), getIndex: () => ({ array: new Uint32Array([0, 1, 0]) }) } });
    } },
    simLayer: { visible: false, sync() {}, clear() {}, setVisible(value) { this.visible = value; }, setTransform(...pose) { harness.poses.push(pose); } },
  };
}
beforeEach(async () => {
  harness = {
    ...layers(), frames: new Map(), calls: [], pending: [], toasts: [], poses: [], simultaneousSteps: 0, maxSimultaneousSteps: 0,
    cad: async () => ({}),
    verifyStewart: async () => {},
    mass: () => ({ massKg: 1, comLocal: [0, 0, 0], principalInertiaKgMm2: [1, 1, 1], principalInertiaLocalFrame: [0, 0, 0, 1] }),
  };
  let frameId = 0;
  globalThis.requestAnimationFrame = (callback) => { const id = ++frameId; harness.frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = (id) => harness.frames.delete(id);
  harness.frame = (time) => { const callbacks = [...harness.frames.values()]; harness.frames.clear(); callbacks.forEach((callback) => callback(time)); };
  harness.store = createStore((set) => ({
    mode: 'simulator',
    assembly: { id: 'assembly', parts: [{ id: 'part', name: 'Test part', visible: true, materialId: 'test', features: [{ id: 'feature' }], sketches: [], transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] } }], mates: [], groundPartId: 'part' },
    simulation: { running: false, paused: false, simulationTimeMs: 0, speedMultiplier: 1, gravity: [0, 0, 0], timeStepMs: 10 },
    setSimulationRunning: (running) => set((state) => ({ simulation: { ...state.simulation, running, paused: false, simulationTimeMs: running ? state.simulation.simulationTimeMs : 0 } })),
    setSimulationPaused: (paused) => set((state) => ({ simulation: { ...state.simulation, paused } })),
    tickSimulationTime: (dt) => set((state) => ({ simulation: { ...state.simulation, simulationTimeMs: state.simulation.simulationTimeMs + dt } })),
  }));
  harness.physics = {
    buildWorld: async () => { harness.calls.push('build'); return { ok: true, bodyCount: 1, jointCount: 0, warnings: [] }; },
    destroy: async () => { harness.calls.push('destroy'); },
    step: (dt) => {
      harness.calls.push(['step', dt]);
      harness.simultaneousSteps++;
      harness.maxSimultaneousSteps = Math.max(harness.maxSimultaneousSteps, harness.simultaneousSteps);
      const request = deferred();
      harness.pending.push(request);
      return request.promise.finally(() => { harness.simultaneousSteps--; });
    },
    updateJointMotor: async () => ({ ok: true }),
  };
  globalThis[key] = harness;
  const module = await import(`../src/physics/simulationRunner.ts?case=${++generation}`);
  harness.start = module.startSimulationRunner;
  harness.runner = harness.start();
});
afterEach(async () => {
  harness.runner.dispose();
  for (const pending of harness.pending) pending.resolve(stepResult(0));
  await flush();
});
after(() => { hooks.deregister(); delete globalThis[key]; });

async function runningStep() {
  harness.store.getState().setSimulationRunning(true);
  await flush();
  harness.frame(1000);
  harness.frame(1010);
  await flush();
  assert.equal(harness.pending.length, 1);
}

test('assembly Boolean geometry cannot silently simulate its original uncut inputs', async () => {
  harness.store.setState({ assembly: { ...harness.store.getState().assembly,
    booleanFeatures: [{ id: 'cut', type: 'subtract', inputPartIds: ['part'], hideInputs: true }] } });
  harness.store.getState().setSimulationRunning(true);
  await flush();
  assert.equal(harness.store.getState().simulation.running, false);
  assert.equal(harness.calls.includes('build'), false);
  assert.equal(harness.poses.length, 0);
  assert.match(harness.toasts[0][1].description, /Export.*STEP/);
});

test('runner permits one in-flight step, retains elapsed time, and counts actual worker time', async () => {
  await runningStep();
  harness.frame(1020);
  harness.frame(1030);
  await flush();
  assert.equal(harness.pending.length, 1);
  harness.pending[0].resolve(stepResult(10));
  await flush();
  harness.frame(1040);
  await flush();
  assert.deepEqual(harness.calls.filter(Array.isArray), [['step', 10], ['step', 30]]);
  harness.pending[1].resolve(stepResult(20));
  await flush();
  assert.equal(harness.maxSimultaneousSteps, 1);
  assert.equal(harness.store.getState().simulation.simulationTimeMs, 30);
});

test('finite experiments hold the final solver pose and clock instead of resetting the model', async () => {
  await runningStep();
  harness.pending[0].resolve({ ...stepResult(10), simulatedTimeMs:10, completed:true });
  await flush();
  assert.equal(harness.store.getState().simulation.running,true);
  assert.equal(harness.store.getState().simulation.paused,true);
  assert.equal(harness.store.getState().simulation.simulationTimeMs,10);
  assert.equal(harness.poses.length,1);
  harness.frame(3000);
  await flush();
  assert.equal(harness.pending.length,1);
});

test('late RPC response cannot move the paused pose or clock; resume preserves its actual time', async () => {
  await runningStep();
  harness.store.getState().setSimulationPaused(true);
  harness.pending[0].resolve(stepResult(10));
  await flush();
  harness.frame(2000);
  await flush();
  assert.equal(harness.pending.length, 1);
  assert.equal(harness.store.getState().simulation.simulationTimeMs, 0);
  assert.equal(harness.poses.length, 0);
  harness.store.getState().setSimulationPaused(false);
  assert.equal(harness.store.getState().simulation.simulationTimeMs, 10);
  assert.equal(harness.poses.length, 1);
  harness.frame(3000);
  harness.frame(3010);
  await flush();
  assert.deepEqual(harness.calls.filter(Array.isArray), [['step', 10], ['step', 10]]);
});

test('stopped or replaced assembly ignores a late step response', async () => {
  await runningStep();
  harness.store.getState().setSimulationRunning(false);
  harness.store.setState({ assembly: { ...harness.store.getState().assembly, id: 'restored-project' } });
  harness.pending[0].resolve(stepResult(10));
  await flush();
  assert.equal(harness.poses.length, 0);
  assert.equal(harness.store.getState().simulation.simulationTimeMs, 0);
  assert.equal(harness.partLayer.group.visible, true);
  assert.equal(harness.calls.at(-1), 'destroy');
});

test('old build reply and teardown cannot destroy the replacement scene world', async () => {
  const first = deferred();
  harness.pending.push(first);
  let builds = 0;
  harness.physics.buildWorld = () => {
    const count = ++builds;
    harness.calls.push(`build-${count}`);
    return count === 1 ? first.promise : Promise.resolve({ ok: true, bodyCount: 1, jointCount: 0, warnings: [] });
  };
  harness.store.getState().setSimulationRunning(true);
  await flush();
  harness.runner.dispose();
  Object.assign(harness, layers());
  harness.runner = harness.start();
  await flush();
  first.resolve({ ok: false, error: 'stale old-scene failure' });
  await flush();
  assert.deepEqual(harness.calls, ['build-1', 'destroy', 'build-2']);
  assert.equal(harness.simLayer.visible, true);
  assert.equal(harness.store.getState().simulation.running, true);
  assert.equal(harness.toasts.length, 0);
});

test('invalid cached mass stops the current run and restores modelling layers', async () => {
  harness.mass = () => { throw new Error('Invalid mass tensor'); };
  harness.store.getState().setSimulationRunning(true);
  await flush();
  assert.equal(harness.store.getState().simulation.running, false);
  assert.equal(harness.partLayer.group.visible, true);
  assert.equal(harness.simLayer.visible, false);
  assert.equal(harness.toasts.length, 1);
  assert.match(harness.toasts[0][1].description, /Invalid mass tensor/);
  assert.equal(harness.frames.size, 0);
});

test('rejected build RPC is caught and does not poison the next successful build', async () => {
  let builds = 0;
  harness.physics.buildWorld = async () => {
    if (++builds === 1) throw new Error('Worker build rejected');
    return { ok: true, bodyCount: 1, jointCount: 0, warnings: [] };
  };
  harness.store.getState().setSimulationRunning(true);
  await flush();
  assert.equal(harness.store.getState().simulation.running, false);
  assert.equal(harness.toasts.length, 1);
  harness.store.getState().setSimulationRunning(true);
  await flush();
  assert.equal(builds, 2);
  assert.equal(harness.store.getState().simulation.running, true);
  assert.equal(harness.simLayer.visible, true);
});

test('motor edits during pending CAD work reach the world that is eventually built', async () => {
  const ready = deferred();
  harness.pending.push(ready);
  harness.cad = () => ready.promise;
  const part = harness.store.getState().assembly.parts[0];
  const mate = { id: 'motor', type: 'revolute', partA: 'base', partB: 'part', axisLocal: [0, 0, 1], motorSpeedRpm: 30 };
  harness.store.setState({ assembly: { ...harness.store.getState().assembly, parts: [{ ...part, id: 'base' }, part], groundPartId: 'base', mates: [mate] } });
  const visit = harness.partLayer.forEachVisible;
  harness.partLayer.forEachVisible = (callback) => { visit((_id, mesh) => { callback('base', mesh); callback('part', mesh); }); };
  let builtRpm;
  let prematureUpdates = 0;
  harness.physics.buildWorld = async (args) => { builtRpm = args.mates[0].motorSpeedRpm; return { ok: true, bodyCount: 2, jointCount: 1, warnings: [] }; };
  harness.physics.updateJointMotor = async () => { prematureUpdates++; return { ok: true }; };
  harness.store.getState().setSimulationRunning(true);
  await flush();
  harness.store.setState({ assembly: { ...harness.store.getState().assembly, mates: [{ ...mate, motorSpeedRpm: 60 }] } });
  await flush();
  ready.resolve({});
  await flush();
  assert.equal(builtRpm, 60);
  assert.equal(prematureUpdates, 0);
  assert.equal(harness.store.getState().simulation.running, true);
});

test('motor edits during an in-flight build replay before the first solver step', async () => {
  const built = deferred();
  harness.pending.push(built);
  const mate = { id: 'motor', type: 'revolute', partA: 'base', partB: 'part', axisLocal: [0, 0, 1], motorSpeedRpm: 30 };
  harness.store.setState({ assembly: { ...harness.store.getState().assembly, mates: [mate] } });
  harness.physics.buildWorld = (args) => { harness.calls.push(['build-rpm', args.mates[0].motorSpeedRpm]); return built.promise; };
  harness.physics.updateJointMotor = async (args) => { harness.calls.push(['update-rpm', args.motorSpeedRpm]); return { ok: true }; };
  harness.store.getState().setSimulationRunning(true);
  await flush();
  harness.store.setState({ assembly: { ...harness.store.getState().assembly, mates: [{ ...mate, motorSpeedRpm: 90 }] } });
  await flush();
  assert.deepEqual(harness.calls, [['build-rpm', 30]]);
  built.resolve({ ok: true, bodyCount: 2, jointCount: 1, warnings: [] });
  await flush();
  harness.frame(1000);
  harness.frame(1010);
  await flush();
  assert.deepEqual(harness.calls, [['build-rpm', 30], ['update-rpm', 90], ['step', 10]]);
});

test('six-axis build validates source solids and uses its own full movement duration', async () => {
  const motion = { kind: 'six-axis', target: {translationMm: [4,-3,4], rotationDeg: [1.5,-1,2]}, moveDurationMs: 5000, settleDurationMs: 2000 };
  harness.store.setState(s => ({simulation: {...s.simulation, stewartMotion: motion, durationMs: 1000}}));
  const order = []; let args;
  harness.verifyStewart = async (assembly) => { assert.equal(assembly, harness.store.getState().assembly); order.push('source guard'); };
  harness.physics.buildWorld = async value => { args = value; order.push('build'); return {ok:true, bodyCount:1, jointCount:0, warnings:[]}; };
  harness.store.getState().setSimulationRunning(true); await flush();
  assert.deepEqual(order, ['source guard', 'build']);
  assert.deepEqual(args.stewartMotion, motion); assert.equal(args.durationMs, 7000);
});

test('six-axis source rejection never creates a physics world', async () => {
  harness.store.setState(s => ({simulation: {...s.simulation, stewartMotion: {kind:'six-axis'}}}));
  harness.verifyStewart = async () => { throw new Error('Edited solids are outside the verified workspace'); };
  harness.store.getState().setSimulationRunning(true); await flush();
  assert.equal(harness.store.getState().simulation.running, false);
  assert.equal(harness.calls.includes('build'), false);
  assert.match(harness.toasts[0][1].description, /Edited solids/);
});
