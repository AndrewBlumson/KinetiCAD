import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseCantilever, rectangularPartDimensions, beamSectionFromAxes } from '../src/engineering/beamAnalysis.ts';
const reference = { lengthMm: 300, widthMm: 20, depthMm: 10, forceN: 10, youngsModulusGPa: 200, elasticLimitMPa: 250 };
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-11 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
test('independent hand-calculated steel-like reference uses N/mm/GPa consistently', () => {
  const r = analyseCantilever(reference);
  close(r.secondMomentMm4, 1666.6666666666667); close(r.tipDeflectionMm, 0.27);
  close(r.maxBendingStressMPa, 9); close(r.tipSlopeRad, 0.00135);
  close(r.clampForceN, -10); close(r.clampMomentNmm, -3000);
  assert.equal(r.withinAssumptions, true);
});
test('curve satisfies clamped/free-end solution and intermediate hand reference', () => {
  const r = analyseCantilever(reference);
  close(r.curve[0].deflectionMm, 0); close(r.curve.at(-1).deflectionMm, r.tipDeflectionMm);
  // y(L/2) / y(L) = 5/16 for a cantilever tip force.
  close(r.curve[20].deflectionMm, r.tipDeflectionMm * 5 / 16);
});
test('load reversal reverses displacement/reactions and retains stress magnitude', () => {
  const a = analyseCantilever(reference), b = analyseCantilever({ ...reference, forceN: -20 });
  close(b.tipDeflectionMm, -2 * a.tipDeflectionMm); close(b.clampForceN, -2 * a.clampForceN);
  close(b.maxBendingStressMPa, 2 * a.maxBendingStressMPa);
  const zero = analyseCantilever({ ...reference, forceN: 0 }); close(zero.tipDeflectionMm, 0); close(zero.maxBendingStressMPa, 0);
});
test('depth cubed, width, length cubed and modulus govern bending stiffness', () => {
  const a = analyseCantilever(reference);
  close(analyseCantilever({ ...reference, depthMm: 20 }).tipDeflectionMm, a.tipDeflectionMm / 8);
  close(analyseCantilever({ ...reference, widthMm: 40 }).tipDeflectionMm, a.tipDeflectionMm / 2);
  close(analyseCantilever({ ...reference, lengthMm: 600 }).tipDeflectionMm, a.tipDeflectionMm * 8);
  close(analyseCantilever({ ...reference, youngsModulusGPa: 100 }).tipDeflectionMm, a.tipDeflectionMm * 2);
});
test('elastic, slenderness and small-deflection failures are explicit', () => {
  assert.match(analyseCantilever({ ...reference, elasticLimitMPa: 8 }).violations.join(' '), /elastic limit/);
  assert.match(analyseCantilever({ ...reference, lengthMm: 100 }).violations.join(' '), /too short/);
  assert.match(analyseCantilever({ ...reference, forceN: 1000, elasticLimitMPa: 1e5 }).violations.join(' '), /2%/);
});
test('missing/nonfinite/nonpositive material or geometry and overflow reject', () => {
  for (const [key, value] of [['youngsModulusGPa', 0], ['elasticLimitMPa', NaN], ['lengthMm', -1], ['forceN', Infinity], ['depthMm', 1e-300]]) {
    assert.throws(() => analyseCantilever({ ...reference, [key]: value }));
  }
});
test('eligible native dimensions respect sketch planes and exclude modified/imported/boolean shapes', () => {
  const part = { id: 'part', sketches: [{ id: 'sketch', plane: 'XY', primitives: [{ type: 'rectangle', corner: [0, 0], width: 300, height: 20 }] }], features: [{ id: 'ext', type: 'extrude', sketchId: 'sketch', depthMm: 10 }] };
  const assembly = { booleanFeatures: [] };
  assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 300, Y: 20, Z: 10 });
  part.sketches[0].plane = 'XZ'; assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 300, Y: 10, Z: 20 });
  part.sketches[0].plane = 'YZ'; assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 10, Y: 300, Z: 20 });
  assert.deepEqual(beamSectionFromAxes({ X: 20, Y: 300, Z: 10 }, 'Y', 'Z'), { lengthMm: 300, widthMm: 20, depthMm: 10 });
  assert.throws(() => beamSectionFromAxes({ X: 20, Y: 300, Z: 10 }, 'Y', 'Y'));
  assembly.booleanFeatures.push({ inputPartIds: ['part', 'other'] }); assert.equal(rectangularPartDimensions(part, assembly), null);
  assembly.booleanFeatures = []; part.features.push({ type: 'hole' }); assert.equal(rectangularPartDimensions(part, assembly), null);
  part.features = [{ type: 'imported-step' }]; assert.equal(rectangularPartDimensions(part, assembly), null);
});
