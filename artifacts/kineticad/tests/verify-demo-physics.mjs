// First export real OCCT descriptors with scripts/src/verify-demo-geometry.mjs.
// Then, from the repository root:
// node artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
// This exercises the shipped Comlink/Rapier worker, not browser rendering.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Euler, Quaternion } from 'three';

const root = new URL('../../../', import.meta.url);
const input = process.argv[2];
assert.ok(input, 'Pass the descriptor JSON exported from the actual OCCT demo verification.');
const descriptors = JSON.parse(readFileSync(input, 'utf8'));
assert.equal(descriptors.schemaVersion, 1);
const expectedIds = ['windmill', 'orrery', 'gyroscope', 'kinetic-mobile', 'material-studio'];
assert.deepEqual(Object.keys(descriptors.fixtures).sort(), [...expectedIds].sort());
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const norm = (v) => Math.hypot(...v);
const add = (a, b) => a.map((v, i) => v + b[i]);
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const scale = (v, s) => v.map((x) => x * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function rotate(q, v) {
  const [x, y, z, w] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return add(add(v, scale(t, w)), [y * t[2] - z * t[1], z * t[0] - x * t[2], x * t[1] - y * t[0]]);
}
const rotationQuat = (degrees) => new Quaternion().setFromEuler(new Euler(...degrees.map((v) => v * Math.PI / 180), 'XYZ')).toArray();
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  method: 'Actual OCCT-rebuilt meshes, exact CAD mass tensors and principal frames, shipped physicsWorker.ts through Comlink and Rapier WASM. No analytic proxy geometry. Independent pose/anchor and relative angular-velocity reconstruction. Browser rendering is a separate acceptance step.',
  physicsWorkerSha256: sha256(readFileSync(new URL('artifacts/kineticad/src/physics/physicsWorker.ts', root))),
  durationSeconds: 15,
  settledSampleWindowSeconds: [5, 15],
  measurementCadence: {
    angularVelocity: 'Production diagnostics every 60 solver steps: 11 samples per motor at 1-second intervals from 5 through 15 seconds for these 60 Hz fixtures. Reported velocity maxima are sampled maxima, not all-step peaks.',
    anchorSeparation: 'Every solver step, including startup: 900 samples per joint from the first step through 15 seconds.',
    fixedBodyDrift: 'Every solver step: 900 samples per fixed body.',
  },
  thresholds: { windmillAngularSpeedErrorRadPerSec: 5e-7, otherMotorAngularSpeedErrorRadPerSec: 0.02, offAxisRelativeAngvelRadPerSec: 0.03, jointAnchorSeparationMm: 0.1, fixedPositionDriftMm: 0.001 },
  fixtures: {},
};
const failures = [];
const requireThreshold = (actual, maximum, description) => {
  if (!Number.isFinite(actual) || actual > maximum) failures.push(`${description}: ${actual} exceeds ${maximum}`);
};
let diagnostics = [];
const worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
worker.on('message', (message) => {
  if (message.__log && message.args?.[0] === '[step-diag]') diagnostics.push(message.args[1]);
});
const physics = Comlink.wrap(nodeEndpoint(worker));
try {
  report.rapierVersion = (await physics.init()).version;
  assert.equal(report.rapierVersion, '0.12.0');
  for (const id of expectedIds) {
    const fixture = descriptors.fixtures[id];
    const expectedPath = `artifacts/kineticad/public/demos/${id}.json`;
    assert.equal(fixture.fixturePath, expectedPath);
    const sourceText = readFileSync(new URL(expectedPath, root), 'utf8');
    assert.equal(sha256(sourceText), fixture.fixtureSha256, `Stale OCCT descriptors for ${id}; rebuild them.`);
    const source = JSON.parse(sourceText).state;
    assert.deepEqual(fixture.mates, source.assembly.mates);
    assert.deepEqual(fixture.gravity, source.simulation.gravity);
    assert.equal(fixture.timeStepMs, source.simulation.timeStepMs);
    assert.deepEqual(fixture.parts.map((part) => part.id).sort(), source.assembly.parts.map((part) => part.id).sort());
    const parts = fixture.parts.map((part) => ({ ...part, meshPositions: new Float32Array(part.meshPositions), meshIndices: new Uint32Array(part.meshIndices) }));
    diagnostics = [];
    const built = await physics.buildWorld({ parts, mates: fixture.mates, gravity: fixture.gravity, timeStepMs: fixture.timeStepMs });
    assert.equal(built.ok, true, `${id}: ${JSON.stringify(built)}`);
    assert.equal(built.bodyCount, parts.length);
    assert.equal(built.jointCount, fixture.mates.length);
    assert.deepEqual(built.warnings, []);
    const revolutes = fixture.mates.filter((mate) => mate.type === 'revolute');
    const initial = new Map(parts.map((part) => [part.id, { positionMm: part.transform.positionMm, rotationQuat: rotationQuat(part.transform.rotationDeg) }]));
    const fixedParts = new Set(parts.filter((part) => part.isGround).map((part) => part.id));
    for (const mate of fixture.mates) if (mate.type === 'fixed') fixedParts.add(mate.partB);
    const summaries = new Map(revolutes.map((mate) => [mate.id, {
      name: mate.name ?? mate.id, targetRpm: mate.motorSpeedRpm, samples: 0,
      maxRelativeAngularSpeedErrorRadPerSec: 0, maxRelativeRpmError: 0,
      maxOffAxisRelativeAngvelRadPerSec: 0, maxAnchorSeparationMm: 0,
      maxDiagnosticReconstructionDifferenceRadPerSec: 0,
    }]));
    let actualTimeMs = 0;
    let maxFixedPositionDriftMm = 0;
    let maxFixedQuaternionDifference = 0;
    let maxWindmillAbsoluteSpeedErrorRadPerSec = 0;
    const stepRpcTimes = [];
    const runStartedAt = performance.now();
    const stepCount = Math.round(15000 / fixture.timeStepMs);
    for (let step = 1; step <= stepCount; step++) {
      const stepStartedAt = performance.now();
      const result = await physics.step(fixture.timeStepMs);
      stepRpcTimes.push(performance.now() - stepStartedAt);
      actualTimeMs += result.dtMs;
      assert.equal(result.transforms.length, parts.length);
      const poses = new Map(result.transforms.map((pose) => [pose.partId, pose]));
      for (const pose of result.transforms) {
        assert.ok([...pose.positionMm, ...pose.rotationQuat].every(Number.isFinite), `${id}: nonfinite pose`);
        assert.ok(Math.abs(norm(pose.rotationQuat) - 1) <= 2e-5, `${id}: non-unit quaternion`);
        if (fixedParts.has(pose.partId)) {
          const original = initial.get(pose.partId);
          maxFixedPositionDriftMm = Math.max(maxFixedPositionDriftMm, norm(subtract(pose.positionMm, original.positionMm)));
          maxFixedQuaternionDifference = Math.max(maxFixedQuaternionDifference, Math.min(norm(subtract(pose.rotationQuat, original.rotationQuat)), norm(add(pose.rotationQuat, original.rotationQuat))));
        }
      }
      for (const mate of revolutes) {
        const a = poses.get(mate.partA);
        const b = poses.get(mate.partB);
        const anchorA = add(a.positionMm, rotate(a.rotationQuat, mate.pivotA.localPoint));
        const anchorB = add(b.positionMm, rotate(b.rotationQuat, mate.pivotB.localPoint));
        const summary = summaries.get(mate.id);
        summary.maxAnchorSeparationMm = Math.max(summary.maxAnchorSeparationMm, norm(subtract(anchorB, anchorA)));
      }
      if (step % 60 !== 0 || actualTimeMs < 5000 - 1e-6 || !revolutes.length) continue;
      const measurements = diagnostics.filter((entry) => entry.stepCount === step);
      assert.equal(measurements.length, revolutes.length, `${id}: missing production diagnostic samples`);
      const omega = new Map(parts.filter((part) => part.isGround).map((part) => [part.id, [0, 0, 0]]));
      for (const measurement of measurements) {
        const mate = revolutes.find((candidate) => candidate.id === measurement.mateId);
        omega.set(mate.partB, [measurement.bodyBangvel.x, measurement.bodyBangvel.y, measurement.bodyBangvel.z]);
      }
      for (const measurement of measurements) {
        const mate = revolutes.find((candidate) => candidate.id === measurement.mateId);
        const axis = rotate(poses.get(mate.partA).rotationQuat, scale(mate.axisLocal, 1 / norm(mate.axisLocal)));
        const relative = subtract(omega.get(mate.partB), omega.get(mate.partA));
        const speed = dot(relative, axis);
        const target = mate.motorSpeedRpm * Math.PI / 30;
        const error = Math.abs(speed - target);
        const summary = summaries.get(mate.id);
        summary.samples++;
        summary.maxRelativeAngularSpeedErrorRadPerSec = Math.max(summary.maxRelativeAngularSpeedErrorRadPerSec, error);
        summary.maxRelativeRpmError = Math.max(summary.maxRelativeRpmError, error * 30 / Math.PI);
        summary.maxOffAxisRelativeAngvelRadPerSec = Math.max(summary.maxOffAxisRelativeAngvelRadPerSec, norm(subtract(relative, scale(axis, speed))));
        summary.maxDiagnosticReconstructionDifferenceRadPerSec = Math.max(summary.maxDiagnosticReconstructionDifferenceRadPerSec, Math.abs(speed - measurement.relativeAngularSpeedRadPerSec));
        assert.equal(measurement.motorEnabled, true);
        assert.equal(measurement.bodyBSleeping, false);
        if (id === 'windmill') maxWindmillAbsoluteSpeedErrorRadPerSec = Math.max(maxWindmillAbsoluteSpeedErrorRadPerSec, Math.abs(measurement.bodyBangvelMag - Math.PI));
      }
    }
    requireThreshold(Math.abs(actualTimeMs - 15000), 1e-6, `${id} actual clock error ms`);
    requireThreshold(maxFixedPositionDriftMm, report.thresholds.fixedPositionDriftMm, `${id} fixed part drift mm`);
    requireThreshold(maxFixedQuaternionDifference, 1e-5, `${id} fixed part quaternion difference`);
    for (const [mateId, summary] of summaries) {
      assert.ok(summary.samples >= 10, `${id}/${mateId}: insufficient settled samples`);
      requireThreshold(summary.maxRelativeAngularSpeedErrorRadPerSec, id === 'windmill' ? 5e-7 : 0.02, `${id}/${mateId} motor angular error rad/s`);
      requireThreshold(summary.maxOffAxisRelativeAngvelRadPerSec, 0.03, `${id}/${mateId} off-axis relative angular velocity rad/s`);
      requireThreshold(summary.maxAnchorSeparationMm, 0.1, `${id}/${mateId} anchor separation mm`);
      requireThreshold(summary.maxDiagnosticReconstructionDifferenceRadPerSec, 1e-6, `${id}/${mateId} diagnostic reconstruction error rad/s`);
    }
    if (id === 'windmill') requireThreshold(maxWindmillAbsoluteSpeedErrorRadPerSec, 5e-7, 'Original windmill pi-magnitude gate');
    const elapsedWallMs = performance.now() - runStartedAt;
    stepRpcTimes.sort((a, b) => a - b);
    report.fixtures[id] = {
      fixturePath: expectedPath, fixtureSha256: fixture.fixtureSha256,
      bodyCount: built.bodyCount, jointCount: built.jointCount,
      meshVertices: parts.reduce((sum, part) => sum + part.meshPositions.length / 3, 0),
      actualTimeMs, solverSteps: stepCount, maxFixedPositionDriftMm, maxFixedQuaternionDifference,
      solverIterations: diagnostics[0]?.solverIterations ?? report.fixtures.windmill?.solverIterations,
      nodePerformance: {
        note: 'Headless worker round-trip measurements include Comlink; exclude OCCT rebuild and browser rendering. Host load affects timing.',
        elapsedWallMs,
        meanStepRpcMs: stepRpcTimes.reduce((sum, value) => sum + value, 0) / stepRpcTimes.length,
        p95StepRpcMs: stepRpcTimes[Math.ceil(stepRpcTimes.length * 0.95) - 1],
        maxStepRpcMs: stepRpcTimes.at(-1),
      },
      ...(id === 'windmill' ? { maxWindmillAbsoluteSpeedErrorRadPerSec } : {}),
      joints: Object.fromEntries(summaries),
    };
    console.log(`${id}: ${parts.length} actual CAD bodies, ${stepCount} fixed solver steps, ${summaries.size} measured motors`);
  }
} finally {
  await physics.destroy();
  await worker.terminate();
}
report.passed = failures.length === 0;
report.failures = failures;
writeFileSync(new URL('docs/demo-physics-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failures, report: 'docs/demo-physics-results.json' }, null, 2));
if (failures.length) process.exitCode = 1;
