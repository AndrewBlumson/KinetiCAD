import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { regeneratePart, regeneratePartTip, previewFeature, computeFeatureHash } from '../src/features/featureRegen.ts';
import { clearCache, getCachedMesh, cacheSize } from '../src/features/featureCache.ts';
import { clearVolumeCache, getVolumeData, massPropertiesForMaterial } from '../src/features/volumeCache.ts';
import { clearImportedShapeCache, setImportedShapeMesh } from '../src/cad/importedShapeCache.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function controlledKernel() {
  const calls = [];
  const dispatch = (args) => {
    const pending = deferred();
    calls.push({ args, ...pending });
    return pending.promise;
  };
  return { calls, kernel: { extrude: dispatch, buildPartMesh: dispatch } };
}
const mesh = (value) => ({ positions: new Float32Array([value, 0, 0]), normals: new Float32Array([0, 0, 1]), indices: new Uint32Array([0, 0, 0]), edges: [], faces: [] });
const feature = (id = 'solid', depthMm = 10) => ({ id, type: 'extrude', sketchId: 'profile', depthMm, direction: 'forward', extrudeMode: 'new-body' });
const part = (features = [feature()]) => ({
  id: 'part', name: 'Part', visible: true, materialId: 'steel-mild',
  transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
  sketches: [{ id: 'profile', name: 'Profile', plane: 'XY', primitives: [{ type: 'circle', centre: [0, 0], radius: 5 }] }],
  features,
});
const flush = () => new Promise(setImmediate);
beforeEach(() => { clearCache(); clearVolumeCache(); clearImportedShapeCache(); });

test('concurrent scene regenerations dispatch one operation per matching cold feature', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part();
  const pending = Array.from({ length: 20 }, () => regeneratePart(p, kernel));
  assert.equal(calls.length, 1);
  const output = mesh(1);
  calls[0].resolve(output);
  const results = await Promise.all(pending);
  for (const result of results) {
    assert.equal(result.mesh, output);
    assert.equal(result.perFeature[0].ok, true);
  }
  assert.equal((await regeneratePart(p, kernel)).mesh, output);
  assert.equal(calls.length, 1, 'a completed operation remains available through the mesh cache');
});

test('pending operations on different kernel instances remain independent', async () => {
  const a = controlledKernel();
  const b = controlledKernel();
  const p = part();
  const first = regeneratePart(p, a.kernel);
  const second = regeneratePart(p, b.kernel);
  assert.equal(a.calls.length, 1);
  assert.equal(b.calls.length, 1);
  const outputA = mesh(1);
  const outputB = mesh(2);
  a.calls[0].resolve(outputA);
  b.calls[0].resolve(outputB);
  assert.equal((await first).mesh, outputA);
  assert.equal((await second).mesh, outputB);
});

test('changed feature parameters do not join an older in-flight operation', async () => {
  const { kernel, calls } = controlledKernel();
  const first = regeneratePart(part([feature('solid', 10)]), kernel);
  const second = regeneratePart(part([feature('solid', 25)]), kernel);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.args.depthMm), [10, 25]);
  const outputA = mesh(10);
  const outputB = mesh(25);
  calls[0].resolve(outputA);
  calls[1].resolve(outputB);
  assert.equal((await first).mesh, outputA);
  assert.equal((await second).mesh, outputB);
});

test('shared failures reach every caller and a later request retries the worker', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part();
  const regens = [regeneratePart(p, kernel), regeneratePart(p, kernel)];
  const preview = previewFeature(p.features[0], p.sketches, [], kernel);
  const rejectedPreview = assert.rejects(preview, /kernel failed/);
  assert.equal(calls.length, 1);
  calls[0].reject(new Error('kernel failed'));
  for (const result of await Promise.all(regens)) {
    assert.equal(result.mesh, null);
    assert.deepEqual(result.perFeature.map((entry) => [entry.ok, entry.error]), [[false, 'kernel failed']]);
  }
  await rejectedPreview;
  assert.equal(cacheSize(), 0);
  const retry = regeneratePart(p, kernel);
  assert.equal(calls.length, 2);
  const recovered = mesh(7);
  calls[1].resolve(recovered);
  assert.equal((await retry).mesh, recovered);
});

test('clearing the cache separates pending work and rejects late cache repopulation', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part();
  const hash = computeFeatureHash(p.features[0], p.sketches, []);
  const older = regeneratePart(p, kernel);
  clearCache();
  const newer = regeneratePart(p, kernel);
  assert.equal(calls.length, 2, 'post-clear callers must not join pre-clear operations');
  const fresh = mesh(2);
  calls[1].resolve(fresh);
  assert.equal((await newer).mesh, fresh);
  assert.equal(getCachedMesh(hash), fresh);
  calls[0].resolve(mesh(1));
  await older;
  assert.equal(getCachedMesh(hash), fresh, 'late pre-clear results must not overwrite the new cache');

  clearCache();
  const staleOnly = regeneratePart(p, kernel);
  clearCache();
  calls[2].resolve(mesh(3));
  await staleOnly;
  assert.equal(cacheSize(), 0, 'a cleared cache stays empty when only old work completes');
});

test('concurrent chains share each stage and preview uses the same full upstream hash', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part([feature('base', 10), feature('boss', 4), feature('cap', 2)]);
  const pending = Array.from({ length: 12 }, () => regeneratePart(p, kernel));
  assert.equal(calls.length, 1);
  calls[0].resolve(mesh(10));
  await flush();
  assert.equal(calls.length, 2);
  calls[1].resolve(mesh(14));
  await flush();
  assert.equal(calls.length, 3);
  assert.equal(calls[2].args.upstreamFeatures.length, 2);
  const preview = previewFeature(p.features[2], p.sketches, p.features.slice(0, 2), kernel);
  assert.equal(calls.length, 3, 'preview and regeneration must share the full chained key');
  const output = mesh(16);
  calls[2].resolve(output);
  for (const result of await Promise.all(pending)) assert.equal(result.mesh, output);
  assert.equal(await preview, output);
});

test('display regeneration sends one complete chain and caches its exact final-feature hash', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part([feature('base', 10), feature('boss', 4), feature('cap', 2)]);
  const pending = Array.from({ length: 20 }, () => regeneratePartTip(p, kernel));
  assert.equal(calls.length, 1, 'one full-chain RPC replaces all prefix display meshes');
  assert.deepEqual(calls[0].args, { features: p.features, sketches: p.sketches });
  assert.notEqual(calls[0].args.features, p.features);
  const hashes = [];
  for (const item of p.features) hashes.push(computeFeatureHash(item, p.sketches, hashes));
  const output = mesh(16);
  calls[0].resolve({ mesh: output });
  for (const result of await Promise.all(pending)) {
    assert.equal(result.mesh, output);
    assert.equal(result.hash, hashes.at(-1));
    assert.equal(result.error, null);
  }
  assert.equal(getCachedMesh(`part:${hashes.at(-1)}`), output);
  assert.equal(getCachedMesh(hashes[0]), undefined, 'intermediate display meshes were not generated');
});

test('display cache invalidates when an upstream feature or source sketch changes', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part([feature('base', 10), feature('cap', 2)]);
  const changedDepth = structuredClone(p);
  changedDepth.features[0].depthMm = 20;
  const changedSketch = structuredClone(p);
  changedSketch.sketches[0].primitives[0].radius = 7;
  const pending = [p, changedDepth, changedSketch].map((item) => regeneratePartTip(item, kernel));
  assert.equal(calls.length, 3);
  calls.forEach((call, i) => call.resolve({ mesh: mesh(i) }));
  const results = await Promise.all(pending);
  assert.equal(new Set(results.map((result) => result.hash)).size, 3);
});

test('full-chain rejection reaches all display callers and retries without a poisoned cache', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part([feature('base', 10), feature('replacement', 2)]);
  const first = regeneratePartTip(p, kernel);
  const second = regeneratePartTip(p, kernel);
  assert.equal(calls.length, 1);
  calls[0].reject(new Error('Earlier feature has an invalid sketch'));
  for (const result of await Promise.all([first, second])) {
    assert.equal(result.mesh, null);
    assert.equal(result.error, 'Earlier feature has an invalid sketch');
  }
  assert.equal(cacheSize(), 0);
  const retry = regeneratePartTip(p, kernel);
  assert.equal(calls.length, 2);
  calls[1].resolve({ mesh: mesh(2) });
  assert.equal((await retry).error, null);
});

test('unit-density mass data warms the cache and material/pose changes need no CAD rebuild', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part();
  const pending = regeneratePartTip(p, kernel);
  const properties = {
    volumeMm3: 4000, massKg: 0.004, comLocal: [3, 4, 5],
    principalInertiaKgMm2: [0.2, 0.3, 0.4],
    principalInertiaLocalFrame: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
  };
  calls[0].resolve({ mesh: mesh(1), unitDensityMassProperties: properties });
  const result = await pending;
  const cached = getVolumeData(result.hash);
  assert.ok(cached);
  const steel = massPropertiesForMaterial(cached, 7.85);
  assert.ok(Math.abs(steel.massKg - 0.0314) < 1e-12);
  steel.principalInertiaKgMm2.forEach((value, i) => assert.ok(Math.abs(value - properties.principalInertiaKgMm2[i] * 7.85) < 1e-12));
  assert.deepEqual(steel.comLocal, properties.comLocal);
  assert.deepEqual(steel.principalInertiaLocalFrame, properties.principalInertiaLocalFrame);
  const edited = { ...p, materialId: 'aluminium-6061', transform: { positionMm: [20, 30, 40], rotationDeg: [10, 20, 30] } };
  const warm = await regeneratePartTip(edited, kernel);
  assert.equal(warm.mesh, result.mesh);
  assert.equal(warm.hash, result.hash);
  assert.equal(calls.length, 1);
});

test('unmodified STEP uses its live mesh; modified STEP dispatches its intact full history', async () => {
  const { kernel, calls } = controlledKernel();
  const imported = { id: 'import', type: 'imported-step', shapeId: 'live-worker-shape' };
  const p = part([imported]);
  const importedMesh = mesh(8);
  setImportedShapeMesh(imported.shapeId, importedMesh);
  const result = await regeneratePartTip(p, kernel);
  assert.equal(result.mesh, importedMesh);
  assert.equal(calls.length, 0);
  const modified = { ...p, features: [imported, feature('cut', 2)] };
  const pending = regeneratePartTip(modified, kernel);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.features, modified.features);
  const modifiedMesh = mesh(10);
  calls[0].resolve({ mesh: modifiedMesh });
  assert.equal((await pending).mesh, modifiedMesh);
  assert.equal((await regeneratePartTip(p, kernel)).mesh, importedMesh);
});

test('a late full-chain result cannot repopulate mesh or physical caches after clear', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part();
  const pending = regeneratePartTip(p, kernel);
  clearCache();
  clearVolumeCache();
  calls[0].resolve({ mesh: mesh(1), unitDensityMassProperties: {
    volumeMm3: 10, massKg: 0.00001, comLocal: [0, 0, 0],
    principalInertiaKgMm2: [1, 1, 1], principalInertiaLocalFrame: [0, 0, 0, 1],
  } });
  const result = await pending;
  assert.equal(getCachedMesh(`part:${result.hash}`), undefined);
  assert.equal(getVolumeData(result.hash), undefined);
});

test('a final-feature preview cannot hide an invalid earlier history from display regeneration', async () => {
  const { kernel, calls } = controlledKernel();
  const p = part([feature('invalid-earlier', 10), feature('replacement', 2)]);
  const preview = previewFeature(p.features[1], p.sketches, p.features.slice(0, 1), kernel);
  calls[0].resolve(mesh(2));
  await preview;
  const display = regeneratePartTip(p, kernel);
  assert.equal(calls.length, 2, 'a preview cache hit must not bypass full-chain validation');
  assert.deepEqual(calls[1].args.features, p.features);
  calls[1].reject(new Error('invalid-earlier failed'));
  const result = await display;
  assert.equal(result.mesh, null);
  assert.equal(result.error, 'invalid-earlier failed');
});
