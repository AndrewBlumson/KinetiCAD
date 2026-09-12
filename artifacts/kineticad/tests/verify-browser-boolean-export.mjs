// Actual Chrome downloads from assembly-boolean-subtract.kineticad.json.
// node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-boolean-export.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { planAssemblyExport } from '../src/cad/assemblyExport.ts';

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const stepBytes = readFileSync(fixture('browser-boolean-subtract.step'));
const unionBytes = readFileSync(fixture('browser-boolean-union.step'));
const intersectBytes = readFileSync(fixture('browser-boolean-intersect.step'));
const stlBytes = readFileSync(fixture('browser-boolean-subtract.stl'));
const projectBytes = readFileSync(fixture('assembly-boolean-subtract.kineticad.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expected = { volumeMm3: 2000, centroidMm: [5, 10, 5], boundsMm: { min: [0, 0, 0], max: [10, 20, 10] } };
const stepCases = [
  { operation: 'subtract', bytes: stepBytes, expected },
  { operation: 'union', bytes: unionBytes, expected: { volumeMm3: 6000, centroidMm: [15, 10, 5], boundsMm: { min: [0, 0, 0], max: [30, 20, 10] } } },
  { operation: 'intersect', bytes: intersectBytes, expected: { volumeMm3: 2000, centroidMm: [15, 10, 5], boundsMm: { min: [10, 0, 0], max: [20, 20, 10] } } },
];
const close = (actual, reference, tolerance = 1e-5) => assert.ok(Number.isFinite(actual) && Math.abs(actual - reference) <= tolerance, `${actual} != ${reference} (tolerance ${tolerance})`);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), passed: false,
  sources: { step: { path: 'artifacts/kineticad/tests/fixtures/browser-boolean-subtract.step', sha256: hash(stepBytes), originalDownload: 'kineticad-export-20260912-111613.step' },
    unionStep: { path: 'artifacts/kineticad/tests/fixtures/browser-boolean-union.step', sha256: hash(unionBytes), originalDownload: 'kineticad-export-20260912-111658.step' },
    intersectStep: { path: 'artifacts/kineticad/tests/fixtures/browser-boolean-intersect.step', sha256: hash(intersectBytes), originalDownload: 'kineticad-export-20260912-111715.step' },
    stl: { path: 'artifacts/kineticad/tests/fixtures/browser-boolean-subtract.stl', sha256: hash(stlBytes), originalDownload: 'kineticad-export-20260912-111619.stl' },
    project: { path: 'artifacts/kineticad/tests/fixtures/assembly-boolean-subtract.kineticad.json', sha256: hash(projectBytes) },
    cadWorkerSha256: hash(readFileSync(new URL('../src/cad/cadWorker.ts', import.meta.url))) },
  expected, tolerance: { volumeMm3: 1e-5, centroidMm: 1e-5, boundsMm: 1e-5 },
  scope: 'Actual Chrome files exported from the committed Subtract fixture, then edited/applied as Union and Intersect. Two overlapping 20×20×10 mm boxes offset 10 mm in X; source parts hidden by Boolean hideInputs; unrelated hidden 10 mm cube must be absent. STEP re-import uses the shipped CAD worker with preserved world coordinates. Subtract STL is checked directly as oriented triangles. Scope excludes general curved-surface tessellation and Boolean result nesting.' };

const worker = new Worker(new URL('./helpers/cad-worker-node.mjs', import.meta.url));
try {
  const api = Comlink.wrap(nodeEndpoint(worker)); await api.init();
  report.step = [];
  for (const scenario of stepCases) {
    const parts = await api.importStep(new Uint8Array(scenario.bytes), `browser-${scenario.operation}.step`, { preserveCoordinates: true });
    assert.equal(parts.length, 1, `${scenario.operation}: only the final Boolean solid may appear`);
    const part = parts[0];
    const props = await api.getMassProperties({ features: [{ id: 'verification', type: 'imported-step', shapeId: part.shapeId }], sketches: [], density: 1 });
    close(props.volumeMm3, scenario.expected.volumeMm3);
    props.comLocal.forEach((v, axis) => close(v, scenario.expected.centroidMm[axis]));
    for (const side of ['min', 'max']) part.boundingBox[side].forEach((v, axis) => close(v, scenario.expected.boundsMm[side][axis]));
    report.step.push({ operation: scenario.operation, expected: scenario.expected, solidCount: parts.length, volumeMm3: props.volumeMm3, centroidMm: props.comLocal, boundsMm: part.boundingBox });
  }
} finally { await worker.terminate(); }

const triangleCount = stlBytes.readUInt32LE(80);
assert.equal(stlBytes.length, 84 + triangleCount * 50);
let volume = 0; const moment = [0, 0, 0];
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (let i = 0; i < triangleCount; i++) {
  const vertices = [0, 1, 2].map((v) => [0, 1, 2].map((axis) => stlBytes.readFloatLE(84 + i * 50 + 12 + v * 12 + axis * 4)));
  for (const vertex of vertices) vertex.forEach((v, axis) => { assert.ok(Number.isFinite(v)); bounds.min[axis] = Math.min(bounds.min[axis], v); bounds.max[axis] = Math.max(bounds.max[axis], v); });
  const [a, b, c] = vertices;
  const tetra = (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  volume += tetra;
  for (let axis = 0; axis < 3; axis++) moment[axis] += tetra * (a[axis] + b[axis] + c[axis]) / 4;
}
const centroid = moment.map((m) => m / volume);
close(volume, expected.volumeMm3);
centroid.forEach((v, axis) => close(v, expected.centroidMm[axis]));
for (const side of ['min', 'max']) bounds[side].forEach((v, axis) => close(v, expected.boundsMm[side][axis]));
report.stl = { triangleCount, orientedVolumeMm3: volume, centroidMm: centroid, boundsMm: bounds };

// Nested Boolean references are deliberately unsupported, and fail explicitly.
// Multiple results may independently use the same original part descriptors.
const assembly = JSON.parse(projectBytes).state.assembly;
const args = { parts: assembly.parts.map((p) => ({ ...p, partId: p.id })), booleanFeatures: assembly.booleanFeatures };
const nested = structuredClone(args);
nested.booleanFeatures.push({ ...nested.booleanFeatures[0], id: 'nested', resultPartName: 'Unsupported nested result', inputPartIds: ['boolean-result', 'tool'] });
assert.throws(() => planAssemblyExport(nested), /missing or empty part boolean-result/);
report.nestedResults = { supported: false, missingResultReferenceRejected: true };
report.passed = true;
writeFileSync(new URL('../../../docs/browser-boolean-export-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, step: report.step, stl: report.stl, nestedResults: report.nestedResults }, null, 2));
