import assert from 'node:assert/strict';
import test from 'node:test';
import { createContactBench } from '../src/physics/contactBench.ts';

async function run(config = {}) {
  const bench = await createContactBench(config);
  const trace = [bench.step(0)];
  try { while (!trace.at(-1).completed) trace.push(bench.step(trace[0].config.timeStepMs)); }
  finally { bench.dispose(); }
  return trace;
}
const close = (a, b, tolerance, message = '') => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} != ${b}`);

test('step zero reads the actual initial body without advancing, and disposal prevents further use', async () => {
  const bench = await createContactBench({ massKg: 3 });
  const first = bench.step(0), second = bench.step(0);
  assert.deepEqual(first, second);
  assert.equal(first.steps, 0);
  assert.deepEqual(first.body.positionMm, [0, 0, 20]);
  assert.equal(first.body.massKg, 3);
  assert.equal(first.reference.valid, false, 'do not fabricate a contact before the first narrow-phase step');
  assert.deepEqual(first.geometry.blockSizeMm, [100, 60, 40]);
  bench.dispose(); bench.dispose();
  assert.throws(() => bench.step(0), /disposed/);
});

test('resting cuboid has measured contact support equal to weight, without horizontal force', async () => {
  const trace = await run({ initialVelocityMmPerSec: 0, frictionCoefficient: 0.5 });
  for (const snapshot of trace.slice(6)) {
    assert.equal(snapshot.contact.active, true);
    assert.equal(snapshot.reference.valid, true);
    close(snapshot.contact.normalForceN, 19.62, 0.0001);
    close(snapshot.contact.frictionForceN, 0, 1e-7);
    close(snapshot.body.positionMm[0], 0, 1e-8);
    assert.ok(snapshot.contact.penetrationMm < 0.025);
  }
});

test('frictionless contact preserves horizontal velocity and kinetic energy while supporting weight', async () => {
  const trace = await run({ frictionCoefficient: 0 });
  for (const snapshot of trace.slice(1)) {
    close(snapshot.body.linearVelocityMmPerSec[0], 1000, 1e-5);
    close(snapshot.body.positionMm[0], snapshot.simulatedTimeMs, 0.01);
    close(snapshot.energy.kineticJ, 1, 1e-7);
    close(snapshot.contact.frictionForceN, 0, 1e-7);
  }
});

test('Coulomb sliding stops within the fixed-step integration bound and contact impulses match momentum', async () => {
  const trace = await run();
  const stepSeconds = trace[0].config.timeStepMs / 1000;
  let maxBalanceError = 0;
  for (let i = 1; i < trace.length; i++) {
    const snapshot = trace[i], previous = trace[i - 1];
    assert.equal(snapshot.reference.valid, true);
    close(snapshot.body.linearVelocityMmPerSec[0], snapshot.reference.velocityXMmPerSec, 0.5);
    close(snapshot.body.positionMm[0], snapshot.reference.positionXMm, 1000 * stepSeconds / 2 + 0.5);
    close(snapshot.contact.penetrationMm, snapshot.contact.geometricPenetrationMm, 1e-5);
    maxBalanceError = Math.max(maxBalanceError,
      Math.abs(snapshot.contact.normalForceN - snapshot.contact.normalForceFromMomentumN),
      Math.abs(snapshot.contact.frictionForceN - Math.abs(snapshot.contact.frictionForceXFromMomentumN)));
    assert.ok(snapshot.energy.mechanicalJ <= previous.energy.mechanicalJ + 1e-7, 'passive contact must not add energy');
    assert.ok(snapshot.body.linearVelocityMmPerSec[0] >= -1e-5, 'friction must not reverse the block');
    if (i > 5 && snapshot.body.linearVelocityMmPerSec[0] > 1) close(snapshot.contact.frictionForceN, 4.905, 0.001);
  }
  assert.ok(maxBalanceError < 0.0005, `contact impulse calibration error ${maxBalanceError}`);
  close(trace.at(-1).energy.frictionWorkJ, 1, 1e-7);
  close(trace.at(-1).body.linearVelocityMmPerSec[0], 0, 1e-7);
});

test('halving the timestep converges in stopping distance and penetration at 60, 120 and 240 Hz', async () => {
  const results = [];
  for (const hz of [60, 120, 240]) {
    const trace = await run({ timeStepMs: 1000 / hz });
    results.push({ error: Math.abs(trace.at(-1).body.positionMm[0] - 1000 ** 2 / (2 * 0.25 * 9810)),
      penetration: Math.max(...trace.map((s) => s.contact.penetrationMm)) });
  }
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].error < results[i - 1].error * 0.55);
    assert.ok(results[i].penetration < results[i - 1].penetration * 0.4);
  }
});

test('material mass changes support force but not Coulomb deceleration; increasing friction shortens travel', async () => {
  const light = await run({ massKg: 2 }), heavy = await run({ massKg: 10 }), rough = await run({ frictionCoefficient: 0.5 });
  close(light.at(-1).body.positionMm[0], heavy.at(-1).body.positionMm[0], 0.01);
  close(heavy.at(-1).contact.normalForceN / light.at(-1).contact.normalForceN, 5, 1e-5);
  assert.ok(rough.at(-1).body.positionMm[0] < light.at(-1).body.positionMm[0] * 0.52);
});

test('accumulated frame partitions produce the same body state as a single elapsed-time request', async () => {
  const a = await createContactBench(), b = await createContactBench();
  try {
    const expected = a.step(2000);
    let elapsed = 0, actual;
    while (elapsed < 2000) { const n = Math.min([7, 23, 11, 39][elapsed % 4], 2000 - elapsed); actual = b.step(n); elapsed += n; }
    assert.equal(actual.steps, expected.steps);
    assert.deepEqual(actual.body, expected.body);
    assert.deepEqual(actual.contact, expected.contact);
    assert.deepEqual(actual.energy, expected.energy);
  } finally { a.dispose(); b.dispose(); }
});

test('airborne and impact phases disable the continuous-support reference', async () => {
  const trace = await run({ initialGapMm: 20 });
  assert.ok(trace.some((s) => !s.contact.active && s.body.linearVelocityMmPerSec[2] < 0));
  assert.ok(trace.some((s) => s.contact.active && s.contact.normalForceN > 19.62 * 2));
  for (const snapshot of trace) {
    assert.equal(snapshot.reference.valid, false);
    assert.equal(snapshot.reference.positionXMm, null);
    assert.ok(snapshot.contact.geometricPenetrationMm < 0.1, 'predictive contact must catch the diagnostic impact');
  }
});

test('invalid physical inputs and elapsed time are rejected', async () => {
  for (const config of [{ frictionCoefficient: -1 }, { massKg: 0 }, { initialVelocityMmPerSec: Infinity }, { timeStepMs: 20 }, { durationMs: 1001 }]) await assert.rejects(createContactBench(config));
  const bench = await createContactBench();
  try { assert.throws(() => bench.step(-1)); assert.throws(() => bench.step(NaN)); }
  finally { bench.dispose(); }
});
