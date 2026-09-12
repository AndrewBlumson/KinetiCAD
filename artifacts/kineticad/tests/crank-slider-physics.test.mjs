import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Vector3, Quaternion } from 'three';
import { loadCrankSliderCad, crankSliderCadCases, crankSliderCadSourceSha256 } from './helpers/crank-slider-cad.mjs';
import { buildCrankSliderAssembly, CRANK_SLIDER_IDS as ids } from '../src/mechanisms/crankSlider.ts';
import { CRANK_SLIDER_SOLVER_SETTINGS } from '../src/mechanisms/crankSliderSolver.ts';

// Independent reference from the circle/link constraint. This deliberately
// does not import the application's reference function.
function reference(p, theta, omega) {
  const r = p.radiusMm, l = p.rodLengthMm, y = r * Math.sin(theta), projection = Math.sqrt(l * l - y * y);
  return { x: r * Math.cos(theta) + projection,
    v: (-r * Math.sin(theta) - y * r * Math.cos(theta) / projection) * omega };
}
const q = values => new Quaternion(...values).normalize();
const anchor = (pose, pivot) => new Vector3(...pivot.localPoint).applyQuaternion(q(pose.rotationQuat)).add(new Vector3(...pose.positionMm));

test('actual CAD crank-slider follows independent closed-loop kinematics with forward, reverse, zero and extreme settings', async () => {
  const worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
  const physics = Comlink.wrap(nodeEndpoint(worker));
  const thresholds = { nominalPositionMm: 0.1, nominalVelocityMmPerSec: 0.5, nominalIntervalAccelerationMmPerSec2: 5, nominalAcceleration33msMmPerSec2: 5,
    positionAtMeasuredAngleMm: 0.05, velocityAtMeasuredAngleMmPerSec: 0.5, revoluteClosureMm: 0.05, guideLateralMm: 0.01, motorSpeedRadPerSec: 0.005,
    outOfPlaneTiltRad: 1e-5, sliderRotationRad: 1e-5, groundDriftMm: 1e-7 };
  const report = { sourceSha256: crankSliderCadSourceSha256, generatedAt: new Date().toISOString(), thresholds, solverSettings: CRANK_SLIDER_SOLVER_SETTINGS,
    physicsWorkerSha256: createHash('sha256').update(readFileSync(new URL('../src/physics/physicsWorker.ts', import.meta.url))).digest('hex'),
    solverProfileSha256: createHash('sha256').update(readFileSync(new URL('../src/mechanisms/crankSliderSolver.ts', import.meta.url))).digest('hex'),
    measurement: 'Every fixed solver step except declared render-packet case; nominal velocity/interval-acceleration and motor speed after 0.25 s startup. Position, geometry and closure include startup. Acceleration is actual velocity difference over the stated actual time interval.',
    acceptanceScope: 'The product uses 120 Hz and reports actual velocity-change means over at least 1/30 s. The unchanged 5 mm/s² acceleration gate applies to that reported quantity; position, velocity, closure and motor gates are also unchanged. Raw 1/120 s and 1/240 s velocity derivatives are retained against the original 5 mm/s² comparison as nongating diagnostics, including every exceedance. No single-step derivative accuracy guarantee is claimed.',
    nongatingMetricNames: ['nominalIntervalAccelerationMmPerSec2'],
    cases: [], failures: [], nongatingDiagnostics: [] };
  const scenarios = [
    ...crankSliderCadCases.map((p, index) => ({ p, index, name: `cad-${index}`, dt: 1000 / 120 })),
    { p: { ...crankSliderCadCases[0], rpm: -15 }, index: 0, name: 'reverse', dt: 1000 / 120 },
    ...crankSliderCadCases.slice(1).map((p, i) => ({ p: { ...p, rpm: -30 }, index: i + 1, name: `reverse-cad-${i + 1}`, dt: 1000 / 120 })),
    { p: { radiusMm: 40, rodLengthMm: 150, rpm: -30 }, name: 'interior-reverse', dt: 1000 / 120 },
    { p: { ...crankSliderCadCases[0], rpm: 0 }, index: 0, name: 'zero', dt: 1000 / 120 },
    { p: crankSliderCadCases[0], index: 0, name: 'default-240Hz', dt: 1000 / 240 },
    { p: crankSliderCadCases[0], index: 0, name: 'render-partitions', dt: 1000 / 120, partition: [5, 21, 13, 2, 31] },
  ];
  try {
    await physics.init();
    for (const { p, index, name, dt, partition } of scenarios) {
      const cad = await loadCrankSliderCad(index === undefined ? p : crankSliderCadCases[index]);
      const assembly = buildCrankSliderAssembly(p);
      const parts = cad.descriptors.map(part => ({ ...part, meshPositions: new Float32Array(part.meshPositions), meshIndices: new Uint32Array(part.meshIndices) }));
      const built = await physics.buildWorld({ parts, mates: assembly.mates, gravity: [0, 0, 0], timeStepMs: dt, durationMs: 8000, measurementPartIds: [ids.crank, ids.slider], solverSettings: CRANK_SLIDER_SOLVER_SETTINGS });
      assert.equal(built.ok, true, JSON.stringify(built)); assert.equal(built.bodyCount, 4); assert.equal(built.jointCount, 4);
      const result = { name, params: p, timeStepMs: dt, solverSteps: 0, measurementCadence: partition ? 'returned batch endpoints' : 'every fixed solver step',
        scope: dt < 1000 / 120 - 1e-9 ? '240Hz convergence diagnostic; not an exposed product setting' : '120Hz product acceptance',
        solids: cad.solids, metrics: Object.fromEntries(Object.keys(thresholds).map(key => [key, 0])) };
      let previousVelocity = 0, previousTime = 0, previousReferenceVelocity = 0, final;
      const history = [{ t: 0, v: 0, expectedV: 0 }];
      const omega = p.rpm * Math.PI / 30;
      for (let i = 0; previousTime < 8 - 1e-9; i++) {
        assert(i < 10000, 'bounded packet schedule must complete');
        const step = await physics.step(partition ? partition[i % partition.length] : dt); final = step;
        result.solverSteps += Math.round(step.dtMs / dt);
        if (step.dtMs === 0) continue;
        const poses = new Map(step.transforms.map(pose => [pose.partId, pose]));
        const measured = new Map(step.bodyMeasurements.map(body => [body.partId, body]));
        const slider = measured.get(ids.slider), crank = measured.get(ids.crank), pose = poses.get(ids.crank);
        const angle = Math.atan2(2 * (pose.rotationQuat[3] * pose.rotationQuat[2] + pose.rotationQuat[0] * pose.rotationQuat[1]), 1 - 2 * (pose.rotationQuat[1] ** 2 + pose.rotationQuat[2] ** 2));
        const t = step.simulatedTimeMs / 1000, expected = reference(p, omega * t, omega);
        const measuredOmega = crank.angularVelocityRadPerSec[2], geometric = reference(p, angle, measuredOmega);
        const record = (key, error) => { assert(Number.isFinite(error), `${name}: nonfinite ${key}`); result.metrics[key] = Math.max(result.metrics[key], Math.abs(error)); };
        record('nominalPositionMm', slider.positionMm[0] - expected.x);
        record('positionAtMeasuredAngleMm', slider.positionMm[0] - geometric.x);
        for (const bodyPose of poses.values()) {
          const norm = Math.hypot(...bodyPose.rotationQuat);
          record('outOfPlaneTiltRad', 2 * Math.asin(Math.min(1, Math.hypot(...bodyPose.rotationQuat.slice(0, 2)) / norm)));
        }
        const sliderRotation = poses.get(ids.slider).rotationQuat;
        record('sliderRotationRad', 2 * Math.atan2(Math.hypot(...sliderRotation.slice(0, 3)), Math.abs(sliderRotation[3])));
        record('groundDriftMm', Math.hypot(...poses.get(ids.ground).positionMm));
        for (const mate of assembly.mates) {
          const difference = anchor(poses.get(mate.partB), mate.pivotB).sub(anchor(poses.get(mate.partA), mate.pivotA));
          if (mate.type === 'prismatic') record('guideLateralMm', Math.hypot(difference.y, difference.z));
          else record('revoluteClosureMm', difference.length());
        }
        if (t > 0.25) {
          record('nominalVelocityMmPerSec', slider.linearVelocityMmPerSec[0] - expected.v);
          record('velocityAtMeasuredAngleMmPerSec', slider.linearVelocityMmPerSec[0] - geometric.v);
          record('nominalIntervalAccelerationMmPerSec2', ((slider.linearVelocityMmPerSec[0] - previousVelocity) - (expected.v - previousReferenceVelocity)) / (t - previousTime));
          const earlier = history.findLast(sample => t - sample.t >= 1 / 30 - 1e-9);
          if (earlier) record('nominalAcceleration33msMmPerSec2', ((slider.linearVelocityMmPerSec[0] - earlier.v) - (expected.v - earlier.expectedV)) / (t - earlier.t));
          record('motorSpeedRadPerSec', measuredOmega - omega);
        }
        previousVelocity = slider.linearVelocityMmPerSec[0]; previousReferenceVelocity = expected.v; previousTime = t;
        history.push({ t, v: previousVelocity, expectedV: expected.v });
      }
      assert.equal(final.completed, true); assert(Math.abs(final.simulatedTimeMs - 8000) < 1e-7);
      assert.deepEqual(final.solverSettings, CRANK_SLIDER_SOLVER_SETTINGS);
      assert.equal((await physics.step(1000)).dtMs, 0);
      result.finalTransforms = final.transforms;
      if (partition) assert.deepEqual(final.transforms, report.cases.find(item => item.name === 'cad-0').finalTransforms, 'packet partitioning preserves the exact final fixed-step state');
      for (const [key, limit] of Object.entries(thresholds)) {
        if (key === 'nominalIntervalAccelerationMmPerSec2') {
          report.nongatingDiagnostics.push({ case: name, metric: key, measured: result.metrics[key], comparisonLimit: limit,
            exceedsComparisonLimit: result.metrics[key] > limit,
            reason: 'Small-step differences of float32 solver velocities include numerical integration/constraint jitter. The product displays measured interval means over at least 1/30 s; no single-step acceleration accuracy guarantee is claimed.' });
        } else if (result.metrics[key] > limit) report.failures.push(`${name}/${key}: ${result.metrics[key]} > ${limit}`);
      }
      report.cases.push(result);
      console.log(JSON.stringify({ name, params: p, metrics: result.metrics }));
    }
  } finally { await worker.terminate(); }
  report.passed = report.failures.length === 0;
  writeFileSync(join(tmpdir(), 'kineticad-crank-slider-physics-results.json'), JSON.stringify(report, null, 2) + '\n');
  assert.deepEqual(report.failures, []);
});

test('per-world solver settings reject invalid worlds, govern live motors and reset to legacy defaults', async () => {
  const fixture = await loadCrankSliderCad(crankSliderCadCases[0]);
  const worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
  const physics = Comlink.wrap(nodeEndpoint(worker));
  const motorLogs = [];
  worker.on('message', event => { if (event.__log && event.args?.[0] === '[motor-apply]') motorLogs.push(event.args[1]); });
  const args = { parts: fixture.descriptors.map(p => ({ ...p, meshPositions: new Float32Array(p.meshPositions), meshIndices: new Uint32Array(p.meshIndices) })),
    mates: fixture.assembly.mates, gravity: [0, 0, 0], timeStepMs: 1000 / 120 };
  try {
    assert.equal((await physics.buildWorld({ ...args, solverSettings: CRANK_SLIDER_SOLVER_SETTINGS })).ok, true);
    assert.deepEqual((await physics.step(0)).solverSettings, CRANK_SLIDER_SOLVER_SETTINGS);
    assert.equal((await physics.updateJointMotor({ mateId: ids.drive, motorSpeedRpm: 20 })).ok, true);
    assert.equal(motorLogs.at(-1).gain, CRANK_SLIDER_SOLVER_SETTINGS.motorVelocityGain);
    assert.equal(motorLogs.at(-1).rpm, 20);
    const invalid = [{ numSolverIterations: 0 }, { numSolverIterations: 129 }, { numSolverIterations: 1.5 },
      { numInternalPgsIterations: 0 }, { numInternalPgsIterations: 33 }, { numInternalPgsIterations: NaN },
      { motorVelocityGain: 999 }, { motorVelocityGain: 1000001 }, { motorVelocityGain: Infinity }];
    for (const patch of invalid) {
      const built = await physics.buildWorld({ ...args, solverSettings: { ...CRANK_SLIDER_SOLVER_SETTINGS, ...patch } });
      assert.equal(built.ok, false); assert.match(built.error, /Solver settings/);
      assert.deepEqual((await physics.step(1000)).transforms, []);
    }
    await physics.destroy();
    assert.equal((await physics.buildWorld(args)).ok, true);
    assert.deepEqual((await physics.step(0)).solverSettings, { numSolverIterations: 32, numInternalPgsIterations: 1, motorVelocityGain: 10000 });
    assert.equal((await physics.updateJointMotor({ mateId: ids.drive, motorSpeedRpm: -20 })).ok, true);
    assert.equal(motorLogs.at(-1).gain, 10000);
    const filename = join(tmpdir(), 'kineticad-crank-slider-physics-results.json');
    const report = JSON.parse(readFileSync(filename, 'utf8'));
    report.solverConfigurationChecks = { invalidWorldsRejected: invalid.length, liveMotorUsesWorldGain: true, legacyDefaultsRestored: true };
    writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
  } finally { await worker.terminate(); }
});
