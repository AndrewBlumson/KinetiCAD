// Actual shipped worker + OCCT STEP/STL writers. Serialise with other WASM suites.
// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/assembly-export.test.mjs
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Euler, Quaternion, Vector3 } from 'three';
import { planAssemblyExport } from '../src/cad/assemblyExport.ts';

const identity = { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] };
const transform = { positionMm: [43, -27, 59], rotationDeg: [19, -37, 61] };
const quaternion = new Quaternion().setFromEuler(new Euler(...transform.rotationDeg.map((v) => v * Math.PI / 180), 'XYZ'));
const world = (p) => new Vector3(...p).applyQuaternion(quaternion).add(new Vector3(...transform.positionMm)).toArray();
const close = (a, b, tolerance = 1e-5) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} != ${b}, tolerance=${tolerance}`);
const sha = (url) => createHash('sha256').update(readFileSync(url)).digest('hex');
let worker, api, completed = 0;
const report = { schemaVersion: 1, passed: false, generatedAt: new Date().toISOString(),
  sources: { workerSha256: sha(new URL('../src/cad/cadWorker.ts', import.meta.url)), plannerSha256: sha(new URL('../src/cad/assemblyExport.ts', import.meta.url)) },
  tolerances: { stepVolumeMm3: 1e-5, stepCentroidMm: 1e-5, stlVolumeRelative: 1e-5, stlCentroidMm: 1e-4 },
  scope: 'Actual shipped worker and installed OCCT. Box faces are planar, so STL tessellation has only float32 coordinate roundoff; these STL tolerances do not apply to arbitrary curved surfaces. Files represent committed modeller geometry, excluding transient editor previews.', cases: [] };
before(async () => {
  worker = new Worker(new URL('./helpers/cad-worker-node.mjs', import.meta.url));
  api = Comlink.wrap(nodeEndpoint(worker)); await api.init();
});
after(async () => {
  await worker?.terminate(); report.passed = completed === 7;
  writeFileSync(new URL('../../../docs/assembly-export-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
});

function part(partId, corner = [0, 0], size = [10, 20, 30], tx = transform) {
  return { partId, visible: true, transform: structuredClone(tx),
    sketches: [{ id: `${partId}-profile`, name: 'Rectangle', plane: 'XY', primitives: [{ type: 'rectangle', corner, width: size[0], height: size[1] }] }],
    features: [{ id: `${partId}-extrude`, type: 'extrude', sketchId: `${partId}-profile`, depthMm: size[2], direction: 'forward', extrudeMode: 'new-body' }] };
}
function assembly(type, { hideInputs = true, gap = 5 } = {}) {
  const a = part('body'), b = part('tool', [gap, 0]);
  a.visible = false; // Hidden originals remain valid Boolean inputs.
  const hidden = part('hidden', [0, 0], [100, 100, 100]);
  hidden.visible = false;
  hidden.features = [{ id: 'invalid-hidden', type: 'unsupported-hidden-feature' }]; // Must not even rebuild.
  const witness = part('witness', [0, 0], [2, 3, 4], { positionMm: [100, 0, 0], rotationDeg: [0, 0, 0] });
  return { parts: [a, b, witness, hidden], booleanFeatures: [{ id: 'result', type: 'boolean', resultPartName: `Visible ${type}`, hideInputs,
    inputPartIds: ['tool', 'body'], operation: type === 'subtract' ? { type, toolPartId: 'tool' } : { type } }] };
}
function stlProperties(bytes) {
  const data = Buffer.from(bytes), count = data.readUInt32LE(80);
  assert.equal(data.length, 84 + count * 50);
  let volume = 0; const moment = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const p = [0, 1, 2].map((v) => [0, 1, 2].map((axis) => data.readFloatLE(84 + i * 50 + 12 + v * 12 + axis * 4)));
    const [a, b, c] = p;
    const tetra = (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    volume += tetra;
    for (let axis = 0; axis < 3; axis++) moment[axis] += tetra * (a[axis] + b[axis] + c[axis]) / 4;
  }
  return { triangleCount: count, volumeMm3: volume, centroidMm: moment.map((m) => m / volume) };
}
async function verify(args, references, label) {
  const original = structuredClone(args);
  const totalVolume = references.reduce((sum, r) => sum + r.volume, 0);
  const totalCentroid = [0, 1, 2].map((axis) => references.reduce((sum, r) => sum + r.volume * r.com[axis], 0) / totalVolume);
  const step = await api.exportAssemblyStep(args);
  const imported = await api.importStep(step, 'verification.step', { preserveCoordinates: true });
  assert.equal(imported.length, references.length, `${label}: exported solid count`);
  const remaining = [...references], bodies = [];
  for (const body of imported) {
    const props = await api.getMassProperties({ features: [{ id: 'import', type: 'imported-step', shapeId: body.shapeId }], sketches: [], density: 1 });
    const index = remaining.findIndex((r) => Math.abs(r.volume - props.volumeMm3) < 1e-5 && r.com.every((v, axis) => Math.abs(v - props.comLocal[axis]) < 1e-5));
    assert.ok(index >= 0, `${label}: unexpected solid ${JSON.stringify(props)}`);
    remaining.splice(index, 1); bodies.push({ volumeMm3: props.volumeMm3, centroidMm: props.comLocal });
  }
  const stl = stlProperties(await api.exportAssemblyStl(args));
  close(stl.volumeMm3, totalVolume, Math.max(1e-5, totalVolume * 1e-5));
  stl.centroidMm.forEach((v, axis) => close(v, totalCentroid[axis], 1e-4));
  assert.deepEqual(args, original, 'exports must not mutate feature history, visibility or transforms');
  report.cases.push({ label, expectedSolidCount: references.length, exactVolumeMm3: totalVolume, exactCentroidMm: totalCentroid, stepBodies: bodies, stl });
}
const witness = { volume: 24, com: [101, 1.5, 2] };

for (const [type, volume, x] of [['union', 9000, 7.5], ['subtract', 3000, 2.5], ['intersect', 3000, 7.5]]) {
  test(`${type} STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources`, async () => {
    await verify(assembly(type), [{ volume, com: world([x, 10, 15]) }, witness], type);
    completed++;
  });
}

test('Hide inputs off exports visible originals as well as result, preserving deliberate overlapping solids', async () => {
  const args = assembly('union', { hideInputs: false }); args.parts[0].visible = true;
  await verify(args, [{ volume: 6000, com: world([5, 10, 15]) }, { volume: 6000, com: world([10, 10, 15]) }, { volume: 9000, com: world([7.5, 10, 15]) }, witness], 'hideInputs=false');
  completed++;
});

test('disconnected Boolean compound exports every solid without restoring hidden originals', async () => {
  await verify(assembly('union', { gap: 30 }), [{ volume: 6000, com: world([5, 10, 15]) }, { volume: 6000, com: world([35, 10, 15]) }, witness], 'disconnected union compound');
  completed++;
});

test('multiple visible Boolean results share immutable source geometry safely', async () => {
  const args = assembly('union');
  args.booleanFeatures.push({ ...args.booleanFeatures[0], id: 'intersection', resultPartName: 'Visible intersection', operation: { type: 'intersect' } });
  await verify(args, [{ volume: 9000, com: world([7.5, 10, 15]) }, { volume: 3000, com: world([7.5, 10, 15]) }, witness], 'two results from shared sources');
  completed++;
});

test('invalid/empty output aborts; subsequent raw asset export and native feature chain remain intact', async () => {
  const missing = assembly('union'); missing.booleanFeatures[0].inputPartIds[0] = 'deleted';
  for (const method of ['exportAssemblyStep', 'exportAssemblyStl']) {
    await assert.rejects(api[method](missing), /missing or empty part deleted/);
    await assert.rejects(api[method]({ parts: [{ ...part('hidden'), visible: false }], booleanFeatures: [] }), /no visible committed solids/);
    await assert.rejects(api[method](assembly('intersect', { gap: 30 })), /Visible intersect.*empty-result/);
  }
  const native = part('asset', [0, 0], [2, 3, 4], identity);
  native.sketches.push({ id: 'cut-profile', name: 'Cut', plane: 'XY', primitives: [{ type: 'rectangle', corner: [0, 0], width: 1, height: 3 }] });
  native.features.push({ id: 'cut', type: 'extrude', sketchId: 'cut-profile', depthMm: 4, direction: 'forward', extrudeMode: 'subtract' });
  await verify([native], [{ volume: 12, com: [1.5, 1.5, 2] }], 'internal array export retains native subtract chain');
  assert.deepEqual(planAssemblyExport(assembly('subtract')).booleans[0].orderedInputIds, ['body', 'tool']);
  completed++;
});
