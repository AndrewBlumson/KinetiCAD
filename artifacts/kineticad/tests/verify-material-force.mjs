// Actual CAD material experiment through the shipped Comlink/Rapier worker.
// node artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Euler, Quaternion } from 'three';
import { getMaterial } from '../src/cad/materials.ts';

const root = new URL('../../../', import.meta.url);
const descriptorPath = process.argv[2] ?? '/tmp/kineticad-demo-descriptors.json';
const fixturePath = 'artifacts/kineticad/public/demos/material-studio.json';
const sourceText = readFileSync(new URL(fixturePath, root), 'utf8');
const source = JSON.parse(sourceText).state;
const experiment = source.simulation.forceExperiment;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exported = JSON.parse(readFileSync(descriptorPath, 'utf8'));
assert.equal(exported.schemaVersion, 1);
const fixture = exported.fixtures['material-studio'];
assert.equal(fixture.fixturePath, fixturePath);
assert.equal(fixture.fixtureSha256, sha256(sourceText), 'Stale material descriptors: regenerate them with the actual OCCT exporter.');
assert.deepEqual(fixture.mates, source.assembly.mates);
assert.deepEqual(fixture.gravity, [0, 0, 0]);
assert.equal(experiment.kind, 'equal-force');
assert.equal(experiment.forceN, 0.001);
assert.equal(experiment.durationMs, 2000);
assert.deepEqual(experiment.direction, [0, 1, 0]);
const sampleIds = Array.from({ length: 8 }, (_,i) => `material-sample-${i + 1}`);
assert.deepEqual(experiment.partIds, sampleIds);
const samples = sampleIds.map((id) => {
  const descriptor = fixture.parts.find((part) => part.id === id);
  const part = source.assembly.parts.find((candidate) => candidate.id === id);
  assert.ok(descriptor && part && !descriptor.isGround);
  assert.deepEqual(descriptor.transform, part.transform);
  const material = getMaterial(part.materialId);
  return { id, descriptor, material, volumeMm3: descriptor.massKg / (material.densityGcm3 * 1e-6) };
});
for (const sample of samples) {
  assert.ok(sample.descriptor.massKg > 0 && Number.isFinite(sample.volumeMm3));
  assert.ok(Math.abs(sample.volumeMm3 / samples[0].volumeMm3 - 1) < 1e-10, `${sample.id}: samples must have equal CAD volume`);
  assert.deepEqual(sample.descriptor.meshPositions, samples[0].descriptor.meshPositions, `${sample.id}: local CAD sample geometry differs`);
  assert.deepEqual(sample.descriptor.meshIndices, samples[0].descriptor.meshIndices, `${sample.id}: local CAD topology differs`);
  const guide = fixture.mates.find((mate) => mate.partB === sample.id);
  assert.equal(guide?.type, 'prismatic');
  assert.equal(guide.partA, source.assembly.groundPartId);
  assert.deepEqual(guide.axisLocal, [0, 1, 0]);
  assert.ok(guide.motorVelocityMmPerSec == null || guide.motorVelocityMmPerSec === 0, 'A velocity motor would hide mass-dependent acceleration.');
}
assert.equal(fixture.mates.length, 8);
const norm = (v) => Math.hypot(...v);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const quaternion = (degrees) => new Quaternion().setFromEuler(new Euler(...degrees.map((value) => value * Math.PI / 180), 'XYZ')).toArray();
const failures = [];
const check = (condition, description) => { if (!condition) failures.push(description); };
const tolerances = {
  velocityAndAccelerationRelative: 1e-4,
  positionRoundoffMm: 0.002,
  offAxisPositionMm: 0.001,
  offAxisVelocityMmPerSec: 0.001,
  quaternionDifference: 1e-5,
  clockMs: 1e-6,
};
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  method: 'Real OCCT-rebuilt equal-volume samples and exact CAD mass tensors; shipped Comlink/Rapier worker. Forces at each centre of mass, ideal unpowered Y guides, zero gravity. Readouts are measured worker positions and COM velocities; analytical predictions are computed independently from exported CAD mass.',
  fixturePath, fixtureSha256: fixture.fixtureSha256,
  physicsWorkerSha256: sha256(readFileSync(new URL('artifacts/kineticad/src/physics/physicsWorker.ts', root))),
  massPropertiesSha256: sha256(readFileSync(new URL('artifacts/kineticad/src/cad/operations/massProperties.ts', root))),
  equalSampleVolumeMm3: samples[0].volumeMm3,
  experiment, tolerances,
  analyticalReference: {
    accelerationMmPerSec2: '1000 * forceN / CAD_massKg',
    velocityMmPerSec: 'acceleration * simulatedTimeSeconds',
    displacementMm: '0.5 * acceleration * simulatedTimeSeconds^2',
    firstOrderPositionErrorBoundMm: '0.5 * acceleration * simulatedTimeSeconds * configuredStepSeconds + positionRoundoffMm',
    note: 'The first-order bound uses the outer configured step and is conservative for Rapier internal solver substeps. A separate tighter observed convergence comparison is reported.',
  },
  runs: [],
};
const worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
const physics = Comlink.wrap(nodeEndpoint(worker));
try {
  report.rapierVersion = (await physics.init()).version;
  assert.equal(report.rapierVersion, '0.12.0');
  for (const settings of [
    { name: 'configured-force-60Hz', forceN: experiment.forceN, timeStepMs: 1000 / 60 },
    { name: 'configured-force-120Hz', forceN: experiment.forceN, timeStepMs: 1000 / 120 },
    { name: 'half-force-60Hz', forceN: experiment.forceN / 2, timeStepMs: 1000 / 60 },
  ]) {
    const parts = fixture.parts.map((part) => ({ ...part, meshPositions: new Float32Array(part.meshPositions), meshIndices: new Uint32Array(part.meshIndices) }));
    const built = await physics.buildWorld({
      parts, mates: fixture.mates, gravity: fixture.gravity, timeStepMs: settings.timeStepMs,
      appliedForces: sampleIds.map((partId) => ({ partId, forceN: [0, settings.forceN, 0] })),
      durationMs: experiment.durationMs,
    });
    assert.equal(built.ok, true, JSON.stringify(built));
    assert.equal(built.bodyCount, parts.length);
    assert.equal(built.jointCount, fixture.mates.length);
    assert.deepEqual(built.warnings, []);
    const initial = await physics.step(0);
    assert.equal(initial.simulatedTimeMs, 0);
    assert.equal(initial.dtMs, 0);
    assert.equal(initial.completed, false);
    assert.equal(initial.bodyMeasurements.length, 8);
    for (const measurement of initial.bodyMeasurements) assert.equal(norm(measurement.linearVelocityMmPerSec), 0);
    const stepCount = Math.round(experiment.durationMs / settings.timeStepMs);
    const perSample = new Map(samples.map((sample) => [sample.id, {
      partId: sample.id, material: sample.material.name, cadMassKg: sample.descriptor.massKg,
      expectedAccelerationMmPerSec2: 1000 * settings.forceN / sample.descriptor.massKg,
      maxVelocityRelativeError: 0, maxPositionErrorMm: 0, maxPositionBoundRatio: 0,
      maxOffAxisPositionMm: 0, maxOffAxisVelocityMmPerSec: 0, maxQuaternionDifference: 0,
      snapshots: [],
    }]));
    let totalAdvancedMs = 0;
    let last = initial;
    let maxGroundPositionDriftMm = 0;
    for (let step = 1; step <= stepCount; step++) {
      last = await physics.step(settings.timeStepMs);
      totalAdvancedMs += last.dtMs;
      const t = last.simulatedTimeMs / 1000;
      assert.equal(last.bodyMeasurements.length, 8);
      const poses = new Map(last.transforms.map((pose) => [pose.partId, pose]));
      const ground = parts.find((part) => part.isGround);
      maxGroundPositionDriftMm = Math.max(maxGroundPositionDriftMm, norm(subtract(poses.get(ground.id).positionMm, ground.transform.positionMm)));
      for (const measurement of last.bodyMeasurements) {
        const sample = samples.find((candidate) => candidate.id === measurement.partId);
        const observed = perSample.get(sample.id);
        const pose = poses.get(sample.id);
        assert.ok([...measurement.positionMm, ...measurement.linearVelocityMmPerSec, ...pose.rotationQuat, measurement.massKg].every(Number.isFinite));
        assert.ok(Math.abs(measurement.massKg / sample.descriptor.massKg - 1) < 1e-6, 'Actual body mass must equal the CAD mass.');
        const a = observed.expectedAccelerationMmPerSec2;
        const displacement = measurement.positionMm[1] - sample.descriptor.transform.positionMm[1];
        const expectedVelocity = a * t;
        const expectedDisplacement = 0.5 * a * t * t;
        const velocityError = Math.abs(measurement.linearVelocityMmPerSec[1] - expectedVelocity) / expectedVelocity;
        const positionError = Math.abs(displacement - expectedDisplacement);
        const positionBound = 0.5 * a * t * settings.timeStepMs / 1000 + tolerances.positionRoundoffMm;
        observed.maxVelocityRelativeError = Math.max(observed.maxVelocityRelativeError, velocityError);
        observed.maxPositionErrorMm = Math.max(observed.maxPositionErrorMm, positionError);
        observed.maxPositionBoundRatio = Math.max(observed.maxPositionBoundRatio, positionError / positionBound);
        observed.maxOffAxisPositionMm = Math.max(observed.maxOffAxisPositionMm, Math.hypot(measurement.positionMm[0] - sample.descriptor.transform.positionMm[0], measurement.positionMm[2] - sample.descriptor.transform.positionMm[2]));
        observed.maxOffAxisVelocityMmPerSec = Math.max(observed.maxOffAxisVelocityMmPerSec, Math.hypot(measurement.linearVelocityMmPerSec[0], measurement.linearVelocityMmPerSec[2]));
        const q = quaternion(sample.descriptor.transform.rotationDeg);
        observed.maxQuaternionDifference = Math.max(observed.maxQuaternionDifference, Math.min(norm(subtract(pose.rotationQuat, q)), norm(subtract(pose.rotationQuat, q.map((v) => -v)))));
        if (step % (stepCount / 4) === 0) observed.snapshots.push({ timeMs: last.simulatedTimeMs, measuredVelocityMmPerSec: measurement.linearVelocityMmPerSec[1], measuredAccelerationMmPerSec2: measurement.linearVelocityMmPerSec[1] / t, expectedVelocityMmPerSec: expectedVelocity, measuredDisplacementMm: displacement, expectedDisplacementMm: expectedDisplacement, positionErrorBoundMm: positionBound });
      }
      if (step === stepCount / 2) {
        const paused = await physics.step(0);
        assert.deepEqual(paused.transforms, last.transforms, 'Zero duration must hold visible poses.');
        assert.deepEqual(paused.bodyMeasurements, last.bodyMeasurements, 'Zero duration must hold velocities.');
        assert.equal(paused.simulatedTimeMs, last.simulatedTimeMs);
        assert.equal(paused.dtMs, 0);
      }
      assert.equal(last.completed, step === stepCount);
    }
    check(Math.abs(totalAdvancedMs - experiment.durationMs) < tolerances.clockMs, `${settings.name}: accumulated clock error`);
    check(Math.abs(last.simulatedTimeMs - experiment.durationMs) < tolerances.clockMs, `${settings.name}: cap clock error`);
    const afterCap = await physics.step(60000);
    assert.equal(afterCap.dtMs, 0);
    assert.equal(afterCap.completed, true);
    assert.equal(afterCap.simulatedTimeMs, last.simulatedTimeMs);
    assert.deepEqual(afterCap.transforms, last.transforms, 'Duration cap must hold poses.');
    assert.deepEqual(afterCap.bodyMeasurements, last.bodyMeasurements, 'Duration cap must hold measurements.');
    for (const [id, observed] of perSample) {
      check(observed.maxVelocityRelativeError <= tolerances.velocityAndAccelerationRelative, `${settings.name}/${id}: v/t disagrees with F/m (${observed.maxVelocityRelativeError} relative)`);
      check(observed.maxPositionBoundRatio <= 1, `${settings.name}/${id}: displacement exceeds first-order integration error bound`);
      check(observed.maxOffAxisPositionMm <= tolerances.offAxisPositionMm, `${settings.name}/${id}: guide position drift`);
      check(observed.maxOffAxisVelocityMmPerSec <= tolerances.offAxisVelocityMmPerSec, `${settings.name}/${id}: guide velocity drift`);
      check(observed.maxQuaternionDifference <= tolerances.quaternionDifference, `${settings.name}/${id}: guide rotation drift`);
    }
    check(maxGroundPositionDriftMm < tolerances.offAxisPositionMm, `${settings.name}: ground moved`);
    report.runs.push({ ...settings, actualDurationMs: last.simulatedTimeMs, solverSteps: stepCount, checkedZeroDurationPause: true, checkedCompletedRunHoldsState: true, maxGroundPositionDriftMm, samples: Object.fromEntries(perSample) });
    console.log(`${settings.name}: ${stepCount} fixed steps, ${sampleIds.length} actual CAD mass/force comparisons`);
  }
} finally {
  await physics.destroy();
  await worker.terminate();
}
report.forceScaling = [];
report.timestepConvergence = [];
for (const id of sampleIds) {
  const coarse = report.runs[0].samples[id];
  const fine = report.runs[1].samples[id];
  const half = report.runs[2].samples[id];
  const c = coarse.snapshots.at(-1), f = fine.snapshots.at(-1), h = half.snapshots.at(-1);
  const velocityRatio = h.measuredVelocityMmPerSec / c.measuredVelocityMmPerSec;
  const displacementRatio = h.measuredDisplacementMm / c.measuredDisplacementMm;
  check(Math.abs(velocityRatio - 0.5) < 2 * tolerances.velocityAndAccelerationRelative, `${id}: half force must halve velocity`);
  check(Math.abs(displacementRatio - 0.5) < 0.001, `${id}: half force must halve displacement`);
  const coarseError = Math.abs(c.measuredDisplacementMm - c.expectedDisplacementMm);
  const fineError = Math.abs(f.measuredDisplacementMm - f.expectedDisplacementMm);
  check(fineError <= coarseError + tolerances.positionRoundoffMm, `${id}: halving timestep should not increase error beyond float32 roundoff allowance`);
  report.forceScaling.push({ partId: id, halfForceVelocityRatio: velocityRatio, halfForceDisplacementRatio: displacementRatio });
  report.timestepConvergence.push({ partId: id, coarsePositionErrorMm: coarseError, finePositionErrorMm: fineError, fineToCoarseErrorRatio: fineError / coarseError, allowedFloat32RoundoffMm: tolerances.positionRoundoffMm });
}
const measuredAccelerationOrder = [...samples].sort((a,b) => report.runs[0].samples[b.id].snapshots.at(-1).measuredAccelerationMmPerSec2 - report.runs[0].samples[a.id].snapshots.at(-1).measuredAccelerationMmPerSec2).map((sample) => sample.id);
const inverseMassOrder = [...samples].sort((a,b) => a.descriptor.massKg - b.descriptor.massKg).map((sample) => sample.id);
check(JSON.stringify(measuredAccelerationOrder) === JSON.stringify(inverseMassOrder), 'Acceleration ordering must be the inverse of actual mass ordering.');
report.measuredAccelerationOrderFastestFirst = measuredAccelerationOrder;
report.failures = failures;
report.passed = failures.length === 0;
writeFileSync(new URL('docs/material-force-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failures, report: 'docs/material-force-results.json' }, null, 2));
if (failures.length) process.exitCode = 1;
