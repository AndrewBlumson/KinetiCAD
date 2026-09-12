import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fourBarReferenceAtAngle, fourBarMargins, validateFourBarParams, sampleFourBarPath } from '../src/mechanisms/fourBarKinematics.ts';

const base = { groundLengthMm: 100, crankLengthMm: 25, couplerLengthMm: 95, rockerLengthMm: 80, couplerPointLocalMm: [55, 30], branch: 1, originMm: [0, 0], rotationDeg: 0, initialCrankAngleDeg: 0, rpm: 10 };
const close = (actual, expected, tolerance, name = '') => assert(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} versus ${expected}, tolerance ${tolerance}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('four-bar circle intersection has an independent exact coordinate fixture and both branches', () => {
  for (const branch of [1, -1]) {
    const r = fourBarReferenceAtAngle({ ...base, branch }, 0), h = branch * Math.sqrt(6000);
    close(r.crankPinMm[0], 25, 1e-12); close(r.crankPinMm[1], 0, 1e-12);
    close(r.rockerPinMm[0], 80, 1e-12); close(r.rockerPinMm[1], h, 1e-12);
    close(r.tracePointMm[0], 25 + (3025 - 30 * h) / 95, 1e-12);
    close(r.tracePointMm[1], (55 * h + 1650) / 95, 1e-12);
  }
});

test('complete rotations preserve all link lengths, branch sign and continuous clearance bounds', () => {
  for (const geometry of [base, { ...base, groundLengthMm: 120, crankLengthMm: 40, couplerLengthMm: 110, rockerLengthMm: 90, couplerPointLocalMm: [70, -25] }]) {
    for (const branch of [1, -1]) for (let i = 0; i <= 720; i++) {
      const p = { ...geometry, branch }, r = fourBarReferenceAtAngle(p, i * Math.PI / 360), A = r.crankPinMm, B = r.rockerPinMm, D = r.outputPivotMm;
      close(distance(A, [0, 0]), p.crankLengthMm, 1e-10);
      close(distance(A, B), p.couplerLengthMm, 1e-10); close(distance(D, B), p.rockerLengthMm, 1e-10);
      assert.equal(Math.sign((D[0] - A[0]) * (B[1] - A[1]) - (D[1] - A[1]) * (B[0] - A[0])), branch);
      const lineDistance = Math.abs((B[0] - D[0]) * (A[1] - D[1]) - (B[1] - D[1]) * (A[0] - D[0])) / p.rockerLengthMm;
      assert(lineDistance - 10 >= r.margins.pinRockerClearanceLowerBoundMm - 1e-9);
      assert(r.margins.pinRockerClearanceLowerBoundMm > 1.97); assert(r.margins.pedestalCrankClearanceLowerBoundMm >= 6);
    }
  }
});

test('implicit velocity and acceleration agree with independent finite differences and chain rule', () => {
  const p = { ...base, originMm: [42, -31], rotationDeg: 37, branch: -1 };
  for (const theta of [0, 0.7, 1.8, 3.2, 5.9]) for (const omega of [-2.1, 0, 1.7]) {
    const alpha = 0.4, r = fourBarReferenceAtAngle(p, theta, omega, alpha);
    const at = t => fourBarReferenceAtAngle(p, theta + omega * t + 0.5 * alpha * t * t, 0, 0).tracePointMm;
    const h = 0.0001, before = at(-h), after = at(h), centre = at(0);
    for (let axis = 0; axis < 2; axis++) {
      close(r.traceVelocityMmPerSec[axis], (after[axis] - before[axis]) / (2 * h), 2e-6);
      close(r.traceAccelerationMmPerSec2[axis], (after[axis] - 2 * centre[axis] + before[axis]) / (h * h), 2e-5);
    }
  }
  assert.deepEqual(fourBarReferenceAtAngle(base, 0.4, 0, 0).traceVelocityMmPerSec, [0, 0, 0]);
});

test('placement transforms once and a complete cycle returns the same geometry', () => {
  const r = fourBarReferenceAtAngle(base, 0.7), p = { ...base, originMm: [-100, 27], rotationDeg: 90 }, transformed = fourBarReferenceAtAngle(p, 0.7);
  close(transformed.tracePointMm[0], -100 - r.tracePointMm[1], 1e-10); close(transformed.tracePointMm[1], 27 + r.tracePointMm[0], 1e-10);
  close(transformed.couplerAngleRad, r.couplerAngleRad + Math.PI / 2, 1e-12);
  const path = sampleFourBarPath(p, 360); assert.deepEqual(path[0], path.at(-1));
  for (let axis = 0; axis < 2; axis++) close(fourBarReferenceAtAngle(p, 0.7 + 2 * Math.PI).tracePointMm[axis], transformed.tracePointMm[axis], 1e-10);
});

test('Grashof equality, lost closure, small transmission angle, markers and invalid fields reject', () => {
  const cases = [null, { ...base, branch: 0 }, { ...base, rpm: Infinity }, { ...base, originMm: [NaN, 0] },
    { ...base, crankLengthMm: 50, couplerLengthMm: 80, rockerLengthMm: 70 },
    { ...base, rockerLengthMm: 180 }, { ...base, rockerLengthMm: 160 }, { ...base, couplerLengthMm: 70, rockerLengthMm: 56 },
    { ...base, couplerPointLocalMm: [1, 1] }, { ...base, couplerPointLocalMm: [1000, 0] }];
  for (const value of cases) assert.throws(() => validateFourBarParams(value));
  assert.throws(() => fourBarReferenceAtAngle(base, NaN)); assert.throws(() => sampleFourBarPath(base, 15));
  assert(fourBarMargins(base).grashofMarginMm > 2);
});
