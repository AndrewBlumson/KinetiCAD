import test from 'node:test';
import assert from 'node:assert/strict';
import { readCrankSliderSample, selectCrankSliderIntervalSample } from '../src/mechanisms/crankSliderReadout.ts';
import { CRANK_SLIDER_IDS, DEFAULT_CRANK_SLIDER_PARAMS } from '../src/mechanisms/crankSlider.ts';
import { clearPoseMeasurements, publishPoseMeasurements, usePoseMeasurements } from '../src/physics/poseMeasurements.ts';

const params = { ...DEFAULT_CRANK_SLIDER_PARAMS };
const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Number.isFinite(actual), `Expected finite measurement, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};
function readbacks({ position = 123.125, speed = 17, angle = Math.PI / 3, rpm = -7.5 } = {}) {
  return {
    poses: [{ partId: CRANK_SLIDER_IDS.crank, positionMm: [0, 0, 30], rotationQuat: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] }],
    bodies: [
      { partId: CRANK_SLIDER_IDS.crank, massKg: 0.1, positionMm: [0, 0, 30], linearVelocityMmPerSec: [0, 0, 0], angularVelocityRadPerSec: [0, 0, rpm * Math.PI / 30] },
      { partId: CRANK_SLIDER_IDS.slider, massKg: 0.2, positionMm: [position, 0, 20], linearVelocityMmPerSec: [speed, 0, 0] },
    ],
  };
}
const sample = (timeMs, data = readbacks(), previous, p = params) => readCrankSliderSample(p, timeMs, data.poses, data.bodies, previous);

test('actual positions, velocities, angle and RPM remain independent from the nominal reference', () => {
  const actual = sample(1000);
  assert.equal(actual.positionMm, 123.125);
  assert.equal(actual.velocityMmPerSec, 17);
  close(actual.angleDeg, 60);
  close(actual.rpm, -7.5);
  // At 15 RPM and one second, the ideal crank has turned exactly 90 degrees.
  close(actual.referencePositionMm, Math.sqrt(100 ** 2 - 25 ** 2));
  close(actual.referenceVelocityMmPerSec, -25 * Math.PI / 2);
  assert.notEqual(actual.positionMm, actual.referencePositionMm);
  assert.notEqual(actual.velocityMmPerSec, actual.referenceVelocityMmPerSec);
  assert.equal(actual.averageAccelerationMmPerSec2, undefined);
});

test('mean acceleration uses independent measured speed samples and their actual interval', () => {
  const previous = sample(0, readbacks({ position: 80, speed: 17 }));
  const actual = sample(1000, readbacks({ position: 300, speed: -11 }), previous);
  // The measured positions deliberately disagree with this velocity history:
  // neither a position difference nor the analytical curve may replace it.
  assert.equal(actual.averageAccelerationMmPerSec2, -28);
  close(actual.referenceAverageAccelerationMmPerSec2, -25 * Math.PI / 2);
  const irregular = sample(1370, readbacks({ speed: 7 }), actual);
  close(irregular.averageAccelerationMmPerSec2, 18 / 0.37);
});

test('reference interval acceleration is the mean velocity change, not point acceleration', () => {
  const previous = sample(1000, readbacks({ speed: -50 }));
  const actual = sample(2000, readbacks({ speed: -20 }), previous);
  assert.equal(actual.averageAccelerationMmPerSec2, 30);
  // Quarter-turn -> half-turn: ideal slider velocity changes from -rω to 0.
  close(actual.referenceAverageAccelerationMmPerSec2, 25 * Math.PI / 2);
  const instantaneousAtHalfTurn = (25 - 25 ** 2 / 100) * (Math.PI / 2) ** 2;
  assert.ok(Math.abs(actual.referenceAverageAccelerationMmPerSec2 - instantaneousAtHalfTurn) > 1);
});

test('missing actual poses or body velocity readbacks never fabricate a sample', () => {
  for (const remove of [
    data => { data.poses = []; },
    data => { data.bodies = data.bodies.filter(body => body.partId !== CRANK_SLIDER_IDS.crank); },
    data => { data.bodies = data.bodies.filter(body => body.partId !== CRANK_SLIDER_IDS.slider); },
    data => { delete data.bodies[0].angularVelocityRadPerSec; },
    data => { delete data.bodies[1].linearVelocityMmPerSec; },
    data => { delete data.bodies[1].positionMm; },
  ]) {
    const data = readbacks();
    remove(data);
    assert.equal(sample(1000, data, sample(500)), undefined);
  }
});

test('nonfinite measurements, invalid clocks and degenerate quaternions are unavailable', () => {
  for (const time of [NaN, Infinity, -Infinity, -1]) assert.equal(sample(time), undefined);
  for (const corrupt of [
    data => { data.poses[0].rotationQuat = [0, 0, 0, 0]; },
    data => { data.poses[0].rotationQuat[3] = NaN; },
    data => { data.poses[0].rotationQuat = [0, 0, 1]; },
    data => { data.bodies[0].angularVelocityRadPerSec[2] = Infinity; },
    data => { data.bodies[1].positionMm[0] = NaN; },
    data => { data.bodies[1].linearVelocityMmPerSec[0] = Infinity; },
  ]) {
    const data = readbacks();
    corrupt(data);
    assert.equal(sample(1000, data), undefined);
  }
});

test('duplicate, backward and invalid previous clocks cannot create interval acceleration', () => {
  const previous = sample(1000);
  for (const time of [1000, 500, 0]) {
    const actual = sample(time, readbacks(), previous);
    assert.equal(actual.averageAccelerationMmPerSec2, undefined);
    assert.equal(actual.referenceAverageAccelerationMmPerSec2, undefined);
    assert.equal(actual.positionMm, 123.125);
  }
  for (const prior of [
    { ...previous, timeSeconds: NaN }, { ...previous, timeSeconds: -1 },
    { ...previous, velocityMmPerSec: Infinity },
  ]) {
    assert.equal(sample(2000, readbacks(), prior).averageAccelerationMmPerSec2, undefined);
  }
});

test('quaternion scale and sign do not change measured angle or mutate worker readbacks', () => {
  for (const scale of [1, -1, 1.00001, -3]) {
    const data = readbacks({ angle: -Math.PI / 4 });
    data.poses[0].rotationQuat = Object.freeze(data.poses[0].rotationQuat.map(v => v * scale));
    Object.freeze(data.poses[0]);
    const before = JSON.stringify(data);
    close(sample(0, data).angleDeg, -45);
    assert.equal(JSON.stringify(data), before);
  }
});

test('zero/reverse nominal RPM affects only the reference, never clamps measured motion', () => {
  const stopped = sample(1000, readbacks({ position: 115, speed: 12, rpm: 6 }), undefined, { ...params, rpm: 0 });
  assert.equal(stopped.referencePositionMm, 125);
  close(stopped.referenceVelocityMmPerSec, 0);
  assert.equal(stopped.positionMm, 115);
  assert.equal(stopped.velocityMmPerSec, 12);
  close(stopped.rpm, 6);
  const reverse = sample(1000, readbacks(), undefined, { ...params, rpm: -15 });
  close(reverse.referencePositionMm, Math.sqrt(100 ** 2 - 25 ** 2));
  close(reverse.referenceVelocityMmPerSec, -25 * Math.PI / 2);
});

test('a reset remains detectable even if React observes only the next nonempty run snapshot', () => {
  clearPoseMeasurements();
  const data = readbacks();
  publishPoseMeasurements({ dtMs: 8000, simulatedTimeMs: 8000, transforms: data.poses, bodyMeasurements: data.bodies });
  const before = usePoseMeasurements.getState();
  clearPoseMeasurements();
  publishPoseMeasurements({ dtMs: 1000 / 120, simulatedTimeMs: 1000 / 120, transforms: data.poses, bodyMeasurements: data.bodies });
  const after = usePoseMeasurements.getState();
  assert.ok(after.poses.length > 0);
  assert.ok(after.simulatedTimeMs < before.simulatedTimeMs);
  assert.equal(after.runGeneration, before.runGeneration + 1);
  // Same IDs and parameters are insufficient to identify a run; this token
  // survives a coalesced empty reset frame and invalidates the UI's history.
  assert.deepEqual(after.poses, before.poses);
  clearPoseMeasurements();
});

test('pose publication preserves actual readbacks and leaves zero-step or missing-body data unmeasured', () => {
  clearPoseMeasurements();
  const data = readbacks({ position: 116.25, speed: -8 });
  publishPoseMeasurements({ dtMs: 0, simulatedTimeMs: 0, transforms: data.poses, bodyMeasurements: data.bodies });
  assert.deepEqual(usePoseMeasurements.getState().poses, []);
  publishPoseMeasurements({ dtMs: 20, simulatedTimeMs: 20, transforms: data.poses, bodyMeasurements: data.bodies });
  const measured = usePoseMeasurements.getState();
  assert.equal(sample(measured.simulatedTimeMs, measured).positionMm, 116.25);
  publishPoseMeasurements({ dtMs: 20, simulatedTimeMs: 40, transforms: data.poses });
  const missing = usePoseMeasurements.getState();
  assert.deepEqual(missing.bodies, []);
  assert.equal(sample(missing.simulatedTimeMs, missing), undefined);
  clearPoseMeasurements();
});

test('interval selection includes the exact 1/30 s boundary and only its declared roundoff tolerance', () => {
  const previous = sample(0);
  assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30), previous);
  assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30 - 0.5e-8), previous);
  assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30 - 2e-8), undefined);
  assert.equal(selectCrankSliderIntervalSample([previous], 1 / 120), undefined);
  assert.equal(selectCrankSliderIntervalSample([previous], 0), undefined);
});

test('the final frame selects the latest sufficiently old actual sample, independent of array order', () => {
  const older = Object.freeze(sample(7930, readbacks({ speed: 2 })));
  const eligible = Object.freeze(sample(7960, readbacks({ speed: 4 })));
  const tooRecent = Object.freeze(sample(7990, readbacks({ speed: 9 })));
  const history = Object.freeze([tooRecent, older, eligible]);
  assert.equal(selectCrankSliderIntervalSample(history, 8), eligible);
  const final = sample(8000, readbacks({ speed: 12 }), selectCrankSliderIntervalSample(history, 8));
  close(final.averageAccelerationMmPerSec2, (12 - 4) / 0.04);
  assert.deepEqual(history, [tooRecent, older, eligible]);
});

test('empty or restarted histories and invalid/backward clocks yield no acceleration endpoint', () => {
  assert.equal(selectCrankSliderIntervalSample([], 0), undefined);
  assert.equal(selectCrankSliderIntervalSample([], 8), undefined);
  const history = [sample(0), sample(2000)];
  // Even though t=0 would fit, selecting it would cross the old run's clock.
  assert.equal(selectCrankSliderIntervalSample(history, 1), undefined);
  for (const time of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(selectCrankSliderIntervalSample(history, time), undefined);
  }
});

test('nonfinite sample values are skipped without substituting a theoretical or corrupt endpoint', () => {
  const eligible = sample(500, readbacks({ speed: 3 }));
  const later = sample(900, readbacks({ speed: 15 }));
  for (const field of ['timeSeconds', 'positionMm', 'referencePositionMm', 'velocityMmPerSec',
    'referenceVelocityMmPerSec', 'angleDeg', 'rpm', 'averageAccelerationMmPerSec2', 'referenceAverageAccelerationMmPerSec2']) {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      assert.equal(selectCrankSliderIntervalSample([eligible, { ...later, [field]: invalid }], 1), eligible, `${field}: ${invalid}`);
      assert.equal(selectCrankSliderIntervalSample([{ ...later, [field]: invalid }], 1), undefined);
    }
  }
  assert.equal(selectCrankSliderIntervalSample([{ ...later, timeSeconds: -1 }], 1), undefined);
});
