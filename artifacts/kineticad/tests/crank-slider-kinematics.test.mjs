import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrankSliderAssembly, validateCrankSliderParams, crankSliderReferenceAtAngle, crankSliderReference, DEFAULT_CRANK_SLIDER_PARAMS, CRANK_SLIDER_IDS } from '../src/mechanisms/crankSlider.ts';

test('native crank-slider factory is deterministic, closed and has exactly one drive', () => {
  const a = buildCrankSliderAssembly();
  assert.deepEqual(a, buildCrankSliderAssembly(DEFAULT_CRANK_SLIDER_PARAMS));
  assert.equal(a.parts.length, 4); assert.equal(a.mates.length, 4); assert.deepEqual(a.booleanFeatures, []);
  assert.equal(a.mates.filter(m => m.motorSpeedRpm != null).length, 1);
  assert(a.mates.every(m => m.motorVelocityMmPerSec == null));
  const parts = new Map(a.parts.map(p => [p.id, p]));
  for (const mate of a.mates) {
    const anchor = (id, pivot) => pivot.localPoint.map((v, i) => v + parts.get(id).transform.positionMm[i]);
    const pa = anchor(mate.partA, mate.pivotA), pb = anchor(mate.partB, mate.pivotB);
    if (mate.type === 'prismatic') assert.deepEqual(pa.slice(1), pb.slice(1));
    else assert.deepEqual(pa, pb);
  }
  assert.equal(a.groundPartId, CRANK_SLIDER_IDS.ground);
  assert(a.parts.every(p => p.features.length > 0 && p.features.every(f => f.type === 'extrude')));
});

test('reference matches independent circle/link closure and numerical time derivatives throughout the admitted domain', () => {
  for (const radiusMm of [15, 25, 40]) for (const rodLengthMm of [Math.max(75, radiusMm * 3), 180]) {
    const p = { radiusMm, rodLengthMm, rpm: -30 };
    const x = t => { const a = p.rpm * Math.PI / 30 * t; return p.radiusMm * Math.cos(a) + Math.sqrt(p.rodLengthMm ** 2 - (p.radiusMm * Math.sin(a)) ** 2); };
    for (let i = 0; i < 48; i++) {
      const t = i / 24, h = 0.0001, ref = crankSliderReference(p, t);
      const pin = [p.radiusMm * Math.cos(ref.thetaRad), p.radiusMm * Math.sin(ref.thetaRad)];
      assert(Math.abs(Math.hypot(ref.sliderPositionMm - pin[0], pin[1]) - p.rodLengthMm) < 1e-10);
      assert(Math.abs(ref.sliderVelocityMmPerSec - (x(t + h) - x(t - h)) / (2 * h)) < 0.00001);
      assert(Math.abs(ref.sliderAccelerationMmPerSec2 - (x(t + h) - 2 * x(t) + x(t - h)) / h ** 2) < 0.0001);
    }
  }
});

test('zero/reverse RPM and nonconstant angular-speed chain rule have explicit reference semantics', () => {
  const p = DEFAULT_CRANK_SLIDER_PARAMS;
  assert.equal(crankSliderReference({ ...p, rpm: 0 }, 20).sliderPositionMm, 125);
  assert.equal(Math.abs(crankSliderReference({ ...p, rpm: 0 }, 20).sliderVelocityMmPerSec), 0);
  const forward = crankSliderReferenceAtAngle(p, 0.7, 2, 0), reverse = crankSliderReferenceAtAngle(p, 0.7, -2, 0);
  assert.equal(forward.sliderPositionMm, reverse.sliderPositionMm);
  assert.equal(forward.sliderVelocityMmPerSec, -reverse.sliderVelocityMmPerSec);
  assert.equal(forward.sliderAccelerationMmPerSec2, reverse.sliderAccelerationMmPerSec2);
  const h = 0.0001, theta = t => 0.7 + 2 * t + 3 * t * t / 2;
  const x = t => crankSliderReferenceAtAngle(p, theta(t)).sliderPositionMm;
  const actual = crankSliderReferenceAtAngle(p, 0.7, 2, 3);
  assert(Math.abs(actual.sliderAccelerationMmPerSec2 - (x(h) - 2 * x(0) + x(-h)) / h ** 2) < 0.0001);
});

test('invalid dimensions, near-toggle rod ratios and nonfinite controls are rejected', () => {
  for (const patch of [{ radiusMm: 14 }, { radiusMm: 41 }, { rodLengthMm: 74 }, { rodLengthMm: 181 }, { radiusMm: 40, rodLengthMm: 119 }, { rpm: 31 }, { rpm: -31 }, { rpm: NaN }, { radiusMm: Infinity }]) {
    assert.throws(() => buildCrankSliderAssembly({ ...DEFAULT_CRANK_SLIDER_PARAMS, ...patch }));
  }
  assert.throws(() => validateCrankSliderParams(null));
  assert.throws(() => crankSliderReference(DEFAULT_CRANK_SLIDER_PARAMS, -1));
  assert.throws(() => crankSliderReferenceAtAngle(DEFAULT_CRANK_SLIDER_PARAMS, Infinity));
});
