import type { Assembly, SimulationState } from '../state/schemas';
import { parseDemoDocument, type DemoDocument } from '../demos/demoDocument';
import { buildFourBarAssembly } from './fourBarAssembly';
import { validateFourBarDesign, type FourBarDesign } from './fourBarSynthesis';
import type { FourBarParams } from './fourBarKinematics';
import { FOUR_BAR_DURATION_MS, FOUR_BAR_TIME_STEP_MS } from './fourBarSolver';

/** Pure replacement document. The caller preflights native CAD before entering
 * the existing protected session; this function never changes live state. */
export function createFourBarDocument(input: FourBarDesign): DemoDocument {
  const design = validateFourBarDesign(input);
  if (Math.abs(design.params.rpm) !== 10 || design.params.initialCrankAngleDeg !== 0) {
    throw new Error('The path mechanism uses one complete turn at ±10 RPM, starting at zero crank angle.');
  }
  return parseDemoDocument({ version: 9, state: {
    mode: 'simulator', assembly: buildFourBarAssembly(design.params),
    simulation: { running: false, paused: false, simulationTimeMs: 0,
      timeStepMs: FOUR_BAR_TIME_STEP_MS, durationMs: FOUR_BAR_DURATION_MS,
      gravity: [0, 0, 0], speedMultiplier: 1, fourBar: design },
  } });
}

/** Browser and Node can round transcendental factory angles a few ulps
 * differently. Accept only bounded machine roundoff; never quantize a sketch
 * dimension or permit nonfinite data to match. Arrays remain ordered and
 * object keys remain exact (undefined optional fields are absent in JSON). */
function samePhysicalValue(left: unknown, right: unknown): boolean {
  if (typeof left !== typeof right) return false;
  if (typeof left === 'number' && typeof right === 'number') {
    return Number.isFinite(left) && Number.isFinite(right)
      && Math.abs(left - right) <= 16 * Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
  }
  if (left === null || right === null) return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
      if (!(index in left) || !(index in right) || !samePhysicalValue(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    const keysA = Object.keys(a).filter(key => a[key] !== undefined).sort();
    const keysB = Object.keys(b).filter(key => b[key] !== undefined).sort();
    return keysA.length === keysB.length && keysA.every((key, index) => key === keysB[index]
      && samePhysicalValue(a[key], b[key]));
  }
  return left === right;
}
function physicalAssembly(assembly: Assembly) {
  return {
    groundPartId: assembly.groundPartId,
    parts: assembly.parts.map(part => ({ id: part.id, visible: part.visible, materialId: part.materialId,
      transform: part.transform, sketches: part.sketches.map(({ name: _name, ...sketch }) => sketch), features: part.features })),
    mates: assembly.mates.map(({ name: _name, ...mate }) => mate),
    booleanFeatures: assembly.booleanFeatures.map(({ resultPartName: _name, ...feature }) => feature),
  };
}

/** Protect native sketches, feature order, transforms, materials, ground and
 * joint structure. Cosmetic names and derived renderer/mass data are ignored. */
export function matchesFourBarAssembly(assembly: Assembly, params: FourBarParams): boolean {
  try { return samePhysicalValue(physicalAssembly(assembly), physicalAssembly(buildFourBarAssembly(params))); }
  catch { return false; }
}

/** A saved target or nominal reference is valid only for the canonical,
 * unloaded, zero-gravity mechanism and its measured numerical profile. */
export function matchesFourBarConfiguration(assembly: Assembly, simulation: SimulationState): boolean {
  try {
    const design = validateFourBarDesign(simulation.fourBar);
    return !simulation.sketchGeometryEdited && matchesFourBarAssembly(assembly, design.params)
      && Math.abs(design.params.rpm) === 10 && design.params.initialCrankAngleDeg === 0
      && simulation.gravity.every(value => value === 0)
      && simulation.timeStepMs === FOUR_BAR_TIME_STEP_MS && simulation.durationMs === FOUR_BAR_DURATION_MS
      && simulation.forceExperiment === undefined && simulation.stewartMotion === undefined && simulation.crankSlider === undefined;
  } catch { return false; }
}
