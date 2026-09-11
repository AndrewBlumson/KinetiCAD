// Actual shipped worker + Rapier. Analytical cuboids isolate force conversion,
// COM application and fixed-step timing from CAD geometry/browser acceptance.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';

let worker, physics;
before(async () => {
  worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
  physics = Comlink.wrap(nodeEndpoint(worker));
  assert.equal((await physics.init()).version, '0.12.0');
});
after(async () => { if (physics) await physics.destroy(); if (worker) await worker.terminate(); });

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);
const box = (id, massKg = 0.01, x = 0, isGround = false, comLocal = [0, 0, 0]) => ({
  id, massKg, isGround, comLocal,
  transform: { positionMm: [x, 0, 0], rotationDeg: [0, 0, 0] },
  meshPositions: new Float32Array([[-5,-5,-5],[5,-5,-5],[5,5,-5],[-5,5,-5],[-5,-5,5],[5,-5,5],[5,5,5],[-5,5,5]].flatMap(v => v.map((n,i) => n + comLocal[i]))),
  meshIndices: new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]),
  principalInertiaKgMm2: Array(3).fill(massKg * 200 / 12), principalInertiaLocalFrame: [0,0,0,1],
});
const pivot = (localPoint) => ({ kind: 'edge', edgeId: 'analytical-pivot', localPoint });
const slide = (part) => ({ id: `slide-${part.id}`, type: 'prismatic', partA: 'ground', partB: part.id, pivotA: pivot(part.transform.positionMm), pivotB: pivot([0,0,0]), axisLocal: [0,1,0] });
async function build({ parts, mates = [], gravity = [0,0,0], timeStepMs = 1000/60, appliedForces, durationMs }) {
  const result = await physics.buildWorld({ parts, mates, gravity, timeStepMs, appliedForces, durationMs });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.warnings, []);
}

test('equal newton forces yield measured inverse-mass acceleration on unpowered prismatic sliders', async (t) => {
  const dt = 1000/60;
  const parts = [box('light', 0.01, -30), box('medium', 0.02), box('heavy', 0.08, 30)];
  await build({ parts: [box('ground', 1, 0, true), ...parts], mates: parts.map(slide), appliedForces: parts.map(part => ({ partId: part.id, forceN: [0,0.001,0] })), durationMs: 2000 });
  let previous = await physics.step(0);
  let result, maximumAccelerationRelativeError = 0;
  assert.equal(previous.bodyMeasurements.length, 3);
  for (let step = 1; step <= 120; step++) {
    result = await physics.step(dt);
    const seconds = (result.simulatedTimeMs - previous.simulatedTimeMs) / 1000;
    assert(seconds > 0);
    for (const current of result.bodyMeasurements) {
      const before = previous.bodyMeasurements.find(body => body.partId === current.partId);
      const measured = (current.linearVelocityMmPerSec[1] - before.linearVelocityMmPerSec[1]) / seconds;
      const analytical = 0.001 * 1000 / current.massKg;
      maximumAccelerationRelativeError = Math.max(maximumAccelerationRelativeError, Math.abs(measured / analytical - 1));
      close(current.linearVelocityMmPerSec[0], 0, 1e-5, 'no transverse X velocity');
      close(current.linearVelocityMmPerSec[2], 0, 1e-5, 'no transverse Z velocity');
    }
    assert.equal(result.completed, step === 120);
    previous = result;
  }
  close(result.simulatedTimeMs, 2000, 1e-9, 'two-second cap handles 60 Hz quotient roundoff');
  for (const current of result.bodyMeasurements) {
    const acceleration = 1 / current.massKg;
    close(current.linearVelocityMmPerSec[1], acceleration * 2, acceleration * 1e-4, 'velocity F t/m');
    // A first-order fixed-step bound: a*T*dt/2. This does not relabel the
    // discrete integrator's displacement as an exact continuum solution.
    close(current.positionMm[1], 0.5 * acceleration * 4, acceleration * 2 * (dt/1000) / 2 + 1e-3, 'displacement 1/2 a t² within integration bound');
  }
  const stopped = await physics.step(10000);
  assert.equal(stopped.dtMs, 0);
  assert.equal(stopped.completed, true);
  assert.deepEqual(stopped.bodyMeasurements, result.bodyMeasurements);
  assert.deepEqual(stopped.transforms, result.transforms);
  t.diagnostic(`Maximum measured acceleration relative error ${maximumAccelerationRelativeError}; masses ${result.bodyMeasurements.map(p=>p.massKg).join(', ')} kg.`);
  // Differencing consecutive float32 velocities amplifies roundoff, and the
  // prismatic constraint is solved iteratively. This explicit 0.02% bound is
  // separate from the tighter whole-run velocity check and motor canary.
  close(maximumAccelerationRelativeError, 0, 2e-4, 'maximum relative acceleration error from consecutive velocity/time readouts');
});

test('doubling force and mass preserves measured acceleration and motion', async () => {
  const parts = [box('one', 0.01, -20), box('two', 0.02, 20)];
  await build({ parts, durationMs: 1000, appliedForces: [{ partId:'one', forceN:[0,0.001,0] }, { partId:'two', forceN:[0,0.002,0] }] });
  const start = await physics.step(0);
  const end = await physics.step(1000);
  const [a,b] = end.bodyMeasurements;
  const measuredA = (a.linearVelocityMmPerSec[1] - start.bodyMeasurements[0].linearVelocityMmPerSec[1]) / (end.simulatedTimeMs/1000);
  const measuredB = (b.linearVelocityMmPerSec[1] - start.bodyMeasurements[1].linearVelocityMmPerSec[1]) / (end.simulatedTimeMs/1000);
  close(measuredA, 100, 0.005, 'first acceleration');
  close(measuredB, measuredA, 1e-6, 'doubled F/m acceleration');
  close(a.positionMm[1], b.positionMm[1], 1e-6, 'equal travel');
});

test('world-space COM force adds to gravity without creating torque on an offset, rotated body', async () => {
  const part = box('offset', 0.01, 50, false, [7,-4,3]);
  part.transform.rotationDeg = [20,30,40];
  await build({ parts:[part], gravity:[0,0,-9810], appliedForces:[{partId:part.id,forceN:[0,0.001,0.02]}], durationMs:1000 });
  const start = await physics.step(0);
  const end = await physics.step(1000);
  const measurement = end.bodyMeasurements[0];
  const seconds = end.simulatedTimeMs/1000;
  close(measurement.linearVelocityMmPerSec[1]/seconds, 100, 0.005, 'newtons convert to mm acceleration');
  close(measurement.linearVelocityMmPerSec[2]/seconds, -7810, 0.4, 'gravity plus applied upward force');
  close(measurement.linearVelocityMmPerSec[0], 0, 1e-5, 'force stays world-aligned despite body rotation');
  end.transforms[0].rotationQuat.forEach((value,i)=>close(value,start.transforms[0].rotationQuat[i],1e-6,'COM force adds no torque'));
  close(measurement.positionMm[2], -3905, 7810/120 + 0.01, 'gravity+force displacement integration bound');
});

test('duration cap and force motion are invariant to elapsed-time partitions, including capped catch-up', async () => {
  const schedules = [Array(210).fill(10), Array(90).fill(1000/30), Array(432).fill(1000/144), [3000,1]];
  const results = [];
  for (const schedule of schedules) {
    await build({ parts:[box('target')], timeStepMs:10, durationMs:2057, appliedForces:[{partId:'target',forceN:[0,0.001,0]}] });
    let result, actualAdvanced = 0;
    for (const elapsed of schedule) {
      result = await physics.step(elapsed);
      actualAdvanced += result.dtMs;
      assert(result.simulatedTimeMs <= 2057);
    }
    assert.equal(result.completed, true);
    assert.equal(result.simulatedTimeMs, 2050);
    assert.equal(actualAdvanced, 2050);
    results.push(result);
  }
  for (const result of results.slice(1)) {
    assert.deepEqual(result.transforms, results[0].transforms);
    assert.deepEqual(result.bodyMeasurements, results[0].bodyMeasurements);
  }
});

test('zero requests pause a forced run and rebuilding removes its cap and persistent forces', async () => {
  await build({ parts:[box('target')], timeStepMs:10, durationMs:2000, appliedForces:[{partId:'target',forceN:[0,0.001,0]}] });
  const initial = await physics.step(0);
  assert.equal(initial.completed, false);
  assert.equal(initial.simulatedTimeMs, 0);
  assert.equal((await physics.step(4)).dtMs, 0);
  const advanced = await physics.step(100);
  const paused = await physics.step(0);
  assert.equal(paused.dtMs, 0);
  assert.equal(paused.simulatedTimeMs, advanced.simulatedTimeMs);
  assert.deepEqual(paused.bodyMeasurements, advanced.bodyMeasurements);
  await build({ parts:[box('target')], timeStepMs:10 });
  await physics.step(1200);
  const unforced = await physics.step(1200);
  assert.equal(unforced.simulatedTimeMs, 2400);
  assert.equal(unforced.completed, false);
  assert.deepEqual(unforced.bodyMeasurements, []);
  assert.deepEqual(unforced.transforms[0].positionMm, [0,0,0]);
});

test('invalid force vectors, duplicate/fixed/missing targets and invalid caps reject the whole world', async () => {
  const base = { parts:[box('target'),box('ground',1,0,true)], mates:[], gravity:[0,0,0], timeStepMs:10 };
  const cases = [
    {appliedForces:[{partId:'missing',forceN:[0,1,0]}]},
    {appliedForces:[{partId:'ground',forceN:[0,1,0]}]},
    {appliedForces:[{partId:'target',forceN:[0,1,0]},{partId:'target',forceN:[1,0,0]}]},
    ...[[0,NaN,0],[0,Infinity,0],[0,1e300,0],[0,1]].map(forceN=>({appliedForces:[{partId:'target',forceN}]})),
    ...[0,-1,NaN,Infinity,9,1e300].map(durationMs=>({durationMs})),
  ];
  for(const invalid of cases) {
    const built = await physics.buildWorld({...base,...invalid});
    assert.equal(built.ok,false,JSON.stringify(invalid));
    const empty = await physics.step(0);
    assert.deepEqual(empty.transforms,[]);
    assert.deepEqual(empty.bodyMeasurements,[]);
    assert.equal(empty.simulatedTimeMs,0);
  }
});
