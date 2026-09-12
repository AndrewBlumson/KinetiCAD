// Verify the actual UI-exported machined block + plate benchmark. The block's
// second, disjoint through-hole was edited from diameter 2 to 4 in Chrome.
// node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-exports.mjs <STEP> <STL>
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Euler, Quaternion, Vector3 } from 'three';

const repoRoot = resolve(import.meta.dirname, '../../..');
const stepPath = resolve(process.argv[2] ?? fileURLToPath(new URL('./fixtures/browser-edited-export.step', import.meta.url)));
const stlPath = resolve(process.argv[3] ?? fileURLToPath(new URL('./fixtures/browser-edited-export.stl', import.meta.url)));
const stepBytes = readFileSync(stepPath), stlBytes = readFileSync(stlPath);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const close = (actual, expected, tolerance) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
const position = [31, -17, 23], rotation = [19, -37, 61];
const q = new Quaternion().setFromEuler(new Euler(...rotation.map((v) => v * Math.PI / 180), 'XYZ'));
const place = (v) => new Vector3(...v).applyQuaternion(q).add(new Vector3(...position)).toArray();
const blockVolume = 4000 - 130 * Math.PI;
const blockLocalCom = [0, 1, 2].map((axis) => (4000 * [10, 10, 5][axis] - 90 * Math.PI * [10, 10, 5][axis] - 40 * Math.PI * [5, 5, 5][axis]) / blockVolume);
const blockCom = place(blockLocalCom);
const corners = [0, 20].flatMap((x) => [0, 20].flatMap((y) => [0, 10].map((z) => place([x, y, z]))));
const blockBounds = { min: [0, 1, 2].map((i) => Math.min(...corners.map((p) => p[i]))), max: [0, 1, 2].map((i) => Math.max(...corners.map((p) => p[i]))) };
const expected = [
  { name: 'native plate', volumeMm3: 10800, comWorldMm: [0, 0, 1.5], bounds: { min: [-30, -30, 0], max: [30, 30, 3] } },
  { name: 'edited imported block', volumeMm3: blockVolume, comWorldMm: blockCom, bounds: blockBounds },
];
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), passed: false,
  sources: { step: { path: relative(repoRoot, stepPath), sha256: sha256(stepBytes) }, stl: { path: relative(repoRoot, stlPath), sha256: sha256(stlBytes) }, workerSha256: sha256(readFileSync(new URL('../src/cad/cadWorker.ts', import.meta.url))) },
  benchmark: { blockSizeMm: [20, 20, 10], bores: [{ centreMm: [10, 10, 5], radiusMm: 3, throughLengthMm: 10 }, { centreMm: [5, 5, 5], radiusMm: 2, throughLengthMm: 10 }], blockPositionMm: position, blockRotationDegXYZ: rotation, reference: expected },
  tolerances: { stepVolumeMm3: 1e-5, stepComMm: 1e-6, stepBoundsMm: 1e-5, stlBoundsMm: 1e-4, stlVolumeRelative: 0.001 },
  scope: 'Actual browser downloads; STEP exact B-rep volume/centroid and mesh bounds in assembly world coordinates. STL bounds and total oriented triangle volume. STL is a tessellated approximation, not an exact surface or CAD history. This benchmark contains per-part features and a fixed mate, not an assembly-level Boolean.' };

const worker = new Worker(new URL('./helpers/cad-worker-node.mjs', import.meta.url));
const api = Comlink.wrap(nodeEndpoint(worker));
try {
  await api.init();
  const imported = await api.importStep(new Uint8Array(stepBytes), 'browser-export.step', { preserveCoordinates: true });
  assert.equal(imported.length, 2, 'both native and imported bodies must be exported');
  const measurements = [];
  for (const part of imported) {
    const props = await api.getMassProperties({ features: [{ id: 'verification-import', type: 'imported-step', shapeId: part.shapeId }], sketches: [], density: 1 });
    const reference = expected.reduce((a, b) => Math.abs(a.volumeMm3 - props.volumeMm3) < Math.abs(b.volumeMm3 - props.volumeMm3) ? a : b);
    assert.ok(!measurements.some((m) => m.name === reference.name), 'each expected body appears once');
    close(props.volumeMm3, reference.volumeMm3, report.tolerances.stepVolumeMm3);
    props.comLocal.forEach((v, i) => close(v, reference.comWorldMm[i], report.tolerances.stepComMm));
    for (const side of ['min', 'max']) part.boundingBox[side].forEach((v, i) => close(v, reference.bounds[side][i], report.tolerances.stepBoundsMm));
    measurements.push({ name: reference.name, volumeMm3: props.volumeMm3, comWorldMm: props.comLocal, boundsMm: part.boundingBox });
  }
  report.step = { bodyCount: imported.length, measurements };
} finally { await worker.terminate(); }

const triangles = stlBytes.readUInt32LE(80);
assert.equal(stlBytes.length, 84 + 50 * triangles, 'STL must be a complete binary triangle stream');
const stlBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
let signedVolume = 0;
for (let i = 0; i < triangles; i++) {
  const points = [0, 1, 2].map((p) => [0, 1, 2].map((axis) => stlBytes.readFloatLE(84 + 50 * i + 12 + p * 12 + axis * 4)));
  for (const point of points) point.forEach((v, axis) => {
    assert.ok(Number.isFinite(v)); stlBounds.min[axis] = Math.min(stlBounds.min[axis], v); stlBounds.max[axis] = Math.max(stlBounds.max[axis], v);
  });
  const [a, b, c] = points;
  signedVolume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
}
const totalVolume = expected.reduce((sum, part) => sum + part.volumeMm3, 0);
const relativeVolumeError = Math.abs(signedVolume - totalVolume) / totalVolume;
assert.ok(signedVolume > 0 && relativeVolumeError <= report.tolerances.stlVolumeRelative, `STL relative volume error ${relativeVolumeError}`);
for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) {
  const fn = side === 'min' ? Math.min : Math.max;
  close(stlBounds[side][axis], fn(...expected.map((part) => part.bounds[side][axis])), report.tolerances.stlBoundsMm);
}
report.stl = { triangleCount: triangles, orientedVolumeMm3: signedVolume, exactReferenceVolumeMm3: totalVolume, relativeVolumeError, boundsMm: stlBounds };
report.passed = true;
writeFileSync(new URL('../../../docs/browser-export-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, step: report.step, stl: report.stl }, null, 2));
