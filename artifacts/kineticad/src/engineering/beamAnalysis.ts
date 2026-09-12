import type { Assembly, Part } from '../state/schemas';

export type BeamAxis = 'X' | 'Y' | 'Z';
export type BeamInput = {
  lengthMm: number; widthMm: number; depthMm: number;
  forceN: number; youngsModulusGPa: number; elasticLimitMPa: number;
};
export type BeamResult = {
  secondMomentMm4: number; tipDeflectionMm: number; tipSlopeRad: number;
  maxBendingStressMPa: number; maxElasticStrain: number;
  clampForceN: number; clampMomentNmm: number;
  slenderness: number; deflectionRatio: number; elasticUtilisation: number;
  withinAssumptions: boolean; violations: string[];
  curve: { xMm: number; deflectionMm: number }[];
};

/** Linear Euler–Bernoulli cantilever, uniform rectangular section, point force
 * at the free end. N/mm/MPa throughout; 1 GPa = 1000 N/mm². No self weight,
 * shear deformation, plasticity, instability, contacts or 3D stress solution. */
export function analyseCantilever(input: BeamInput): BeamResult {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || (key !== 'forceN' && value <= 0)) throw new Error(`${key} must be finite${key === 'forceN' ? '' : ' and positive'}.`);
  }
  const { lengthMm: length, widthMm: width, depthMm: depth, forceN: force } = input;
  const modulus = input.youngsModulusGPa * 1000;
  const secondMomentMm4 = width * depth ** 3 / 12;
  const tipDeflectionMm = force * length ** 3 / (3 * modulus * secondMomentMm4);
  const tipSlopeRad = force * length ** 2 / (2 * modulus * secondMomentMm4);
  const maxBendingStressMPa = Math.abs(force) * length * depth / (2 * secondMomentMm4);
  const maxElasticStrain = maxBendingStressMPa / modulus;
  const slenderness = length / Math.max(width, depth);
  const deflectionRatio = Math.abs(tipDeflectionMm) / length;
  const elasticUtilisation = maxBendingStressMPa / input.elasticLimitMPa;
  const values = [secondMomentMm4, tipDeflectionMm, tipSlopeRad, maxBendingStressMPa, maxElasticStrain, slenderness, deflectionRatio, elasticUtilisation];
  if (values.some((value) => !Number.isFinite(value)) || secondMomentMm4 === 0) throw new Error('Dimensions or material values exceed the numerical range of this calculation.');
  const violations: string[] = [];
  if (slenderness < 10) violations.push('The beam is too short or wide for this slender-beam model: L / max(b, h) must be at least 10.');
  if (deflectionRatio > 0.02) violations.push('Calculated deflection exceeds 2% of length; small-deflection theory is outside this tool’s accepted range.');
  if (elasticUtilisation > 1) violations.push('Calculated bending stress exceeds the supplied elastic limit; linear elastic deformation is not a valid prediction.');
  const curve = Array.from({ length: 41 }, (_, i) => {
    const xMm = length * i / 40;
    return { xMm, deflectionMm: force * xMm ** 2 * (3 * length - xMm) / (6 * modulus * secondMomentMm4) };
  });
  return { secondMomentMm4, tipDeflectionMm, tipSlopeRad, maxBendingStressMPa, maxElasticStrain,
    clampForceN: -force, clampMomentNmm: -force * length,
    slenderness, deflectionRatio, elasticUtilisation, withinAssumptions: violations.length === 0, violations, curve };
}

/** Only an unchanged, single rectangle/extrude feature is an eligible CAD
 * section. Holes, modifiers, arbitrary STEP and assembly booleans need a
 * different structural model and must not be approximated by their bounds. */
export function rectangularPartDimensions(part: Part, assembly: Assembly): Record<BeamAxis, number> | null {
  if (part.features.length !== 1 || assembly.booleanFeatures.some((b) => b.inputPartIds.includes(part.id))) return null;
  const feature = part.features[0];
  if (feature.type !== 'extrude') return null;
  const sketch = part.sketches.find((s) => s.id === feature.sketchId);
  if (!sketch || typeof sketch.plane !== 'string' || sketch.primitives.length !== 1) return null;
  const rectangle = sketch.primitives[0];
  if (rectangle.type !== 'rectangle') return null;
  const u = Math.abs(rectangle.width), v = Math.abs(rectangle.height), d = feature.depthMm;
  if ([u, v, d].some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return sketch.plane === 'XY' ? { X: u, Y: v, Z: d } : sketch.plane === 'XZ' ? { X: u, Y: d, Z: v } : { X: d, Y: u, Z: v };
}

export function beamSectionFromAxes(dimensions: Record<BeamAxis, number>, lengthAxis: BeamAxis, forceAxis: BeamAxis) {
  if (lengthAxis === forceAxis) throw new Error('The force direction must be transverse to the beam length.');
  const widthAxis = (['X', 'Y', 'Z'] as const).find((axis) => axis !== lengthAxis && axis !== forceAxis)!;
  return { lengthMm: dimensions[lengthAxis], widthMm: dimensions[widthAxis], depthMm: dimensions[forceAxis] };
}
