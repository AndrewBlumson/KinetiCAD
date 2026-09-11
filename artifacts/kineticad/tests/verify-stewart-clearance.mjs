// First export the actual Stewart CAD descriptors and run verify-stewart-physics.mjs.
// Then: node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-clearance.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadGeometryKernel, rebuildPart, transformed, intersectionVolume, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';

const root = new URL('../../../', import.meta.url);
const fixturePath = 'artifacts/kineticad/public/demos/stewart-platform.json';
const measurementPath = 'docs/stewart-physics-results.json';
const fixtureBytes = readFileSync(new URL(fixturePath, root));
const measurementBytes = readFileSync(new URL(measurementPath, root));
const { assembly, simulation } = JSON.parse(fixtureBytes).state;
const measurements = JSON.parse(measurementBytes);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const workerSha = sha256(readFileSync(new URL('artifacts/kineticad/src/physics/physicsWorker.ts', root)));
assert.equal(measurements.passed, true, 'Run the actual-CAD Stewart physics verification first.');
assert.equal(measurements.completed, true);
assert.equal(measurements.fixtureSha256, sha256(fixtureBytes), 'Physics measurements are stale for the fixture.');
assert.equal(measurements.physicsWorkerSha256, workerSha, 'Physics measurements are stale for the worker.');
assert.equal(simulation.durationMs, 6000);
assert.ok(Math.abs(measurements.actualTimeMs - simulation.durationMs) < 1e-6);
assert.equal(assembly.parts.length, 14);
const poses = new Map(measurements.finalTransforms.map((pose) => [pose.partId, pose]));
assert.equal(poses.size, 14);
assert.deepEqual([...poses.keys()].sort(), assembly.parts.map((part) => part.id).sort());

// Independent row-major matrices: fixture XYZ Euler and measured Rapier quaternion.
const multiply = (a, b) => Array.from({ length: 9 }, (_, n) => {
  const r = Math.floor(n / 3), c = n % 3;
  return a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6];
});
function eulerMatrix(degrees) {
  const [x, y, z] = degrees.map((v) => v * Math.PI / 180);
  const rx = [1, 0, 0, 0, Math.cos(x), -Math.sin(x), 0, Math.sin(x), Math.cos(x)];
  const ry = [Math.cos(y), 0, Math.sin(y), 0, 1, 0, -Math.sin(y), 0, Math.cos(y)];
  const rz = [Math.cos(z), -Math.sin(z), 0, Math.sin(z), Math.cos(z), 0, 0, 0, 1];
  return multiply(multiply(rx, ry), rz);
}
function quaternionMatrix(quaternion) {
  assert.equal(quaternion.length, 4);
  assert.ok(quaternion.every(Number.isFinite));
  const norm = Math.hypot(...quaternion);
  assert.ok(Math.abs(norm - 1) < 2e-5, 'Measured body quaternion must be unit length.');
  const [x, y, z, w] = quaternion.map((v) => v / norm);
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  method: 'Every pair of the 14 actual OCCT B-rep solids is intersected at the initial fixture pose and at the measured six-second final physics pose. The final pose comes from the shipped Rapier worker, including its residual translations and rotations; no ideal pose is substituted.',
  limitations: 'These 182 endpoint pair checks establish sampled geometric noninterference only, not continuous collision detection or contact forces. Separate stewart-geometry.test.mjs checks conservative leg capsules at 61 intermediate analytic poses. Spherical bearings and actuator drives are ideal joints; bearing retention, seals, friction, load ratings and manufacturing tolerances are not modeled.',
  fixturePath, fixtureSha256: sha256(fixtureBytes), measurementPath,
  measurementReportSha256: sha256(measurementBytes), physicsWorkerSha256: workerSha,
  geometrySourceSha256: Object.fromEntries(['sketchToWire', 'extrude', 'revolve', 'boolean'].map((name) => [name,
    sha256(readFileSync(new URL(`artifacts/kineticad/src/cad/operations/${name}.ts`, root)))])),
  durationMs: simulation.durationMs, overlapToleranceMm3: 1e-5,
  solids: [], poses: [], totalPairChecks: 0, maxIntersectionVolumeMm3: 0, failures: [],
};
const oc = await loadGeometryKernel();
const shapes = [];
try {
  for (const part of assembly.parts) {
    const shape = rebuildPart(oc, part);
    shapes.push(shape);
    const validity = validateSolid(oc, shape);
    assert.ok(validity.valid && validity.solids === 1 && validity.volumeMm3 > 0, `${part.id}: invalid solid`);
    report.solids.push({ partId: part.id, ...validity });
    console.log(`Stewart clearance: rebuilt ${part.id}`);
  }
  for (const phase of ['initial', 'measured-final']) {
    const placed = [];
    const transforms = [];
    try {
      for (let i = 0; i < assembly.parts.length; i++) {
        const part = assembly.parts[i], measured = poses.get(part.id);
        const matrix = phase === 'initial' ? eulerMatrix(part.transform.rotationDeg) : quaternionMatrix(measured.rotationQuat);
        const positionMm = phase === 'initial' ? part.transform.positionMm : measured.positionMm;
        assert.equal(positionMm.length, 3);
        assert.ok(positionMm.every(Number.isFinite));
        transforms.push({ partId: part.id, positionMm, rotationMatrix: matrix });
        placed.push(transformed(oc, shapes[i], matrix, positionMm));
      }
      const checks = [];
      for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
        const volumeMm3 = intersectionVolume(oc, placed[a], placed[b]);
        assert.ok(Number.isFinite(volumeMm3));
        const partA = assembly.parts[a].id, partB = assembly.parts[b].id;
        checks.push({ partA, partB, intersectionVolumeMm3: volumeMm3 });
        report.totalPairChecks++;
        report.maxIntersectionVolumeMm3 = Math.max(report.maxIntersectionVolumeMm3, volumeMm3);
        if (volumeMm3 > report.overlapToleranceMm3) report.failures.push(`${phase}: ${partA}/${partB} intersects by ${volumeMm3} mm³`);
      }
      report.poses.push({ phase, transforms, checks });
      console.log(`Stewart clearance ${phase}: ${checks.length} exact B-rep pair checks`);
    } finally { placed.forEach((shape) => shape.delete()); }
  }
} finally { shapes.forEach((shape) => shape.delete()); }
assert.equal(report.totalPairChecks, 182);
report.passed = report.failures.length === 0;
writeFileSync(new URL('docs/stewart-clearance-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, pairChecks: report.totalPairChecks, maxIntersectionVolumeMm3: report.maxIntersectionVolumeMm3,
  failures: report.failures, report: 'docs/stewart-clearance-results.json' }, null, 2));
if (!report.passed) process.exitCode = 1;
