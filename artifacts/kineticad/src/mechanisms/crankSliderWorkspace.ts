import type { Assembly, SimulationState } from '../state/schemas';
import { parseDemoDocument, type DemoDocument } from '../demos/demoDocument';
import {
  buildCrankSliderAssembly,
  validateCrankSliderParams,
  CRANK_SLIDER_DURATION_MS,
  CRANK_SLIDER_TIME_STEP_MS,
  type CrankSliderParams,
} from './crankSlider';

/** A complete replacement document, never a merge with another experiment's
 * gravity, forces or controller. Workspace ownership/persistence stay with the
 * existing session provider; this factory has no store or worker side effects. */
export function createCrankSliderDocument(params: CrankSliderParams): DemoDocument {
  const validated = validateCrankSliderParams(params);
  return parseDemoDocument({
    version: 9,
    state: {
      mode: 'simulator',
      assembly: buildCrankSliderAssembly(validated),
      simulation: {
        running: false,
        paused: false,
        simulationTimeMs: 0,
        timeStepMs: CRANK_SLIDER_TIME_STEP_MS,
        durationMs: CRANK_SLIDER_DURATION_MS,
        gravity: [0, 0, 0],
        speedMultiplier: 1,
        crankSlider: { ...validated },
      },
    },
  });
}

// Object insertion order is not a physical edit. Array order is preserved:
// feature history and Boolean input order can alter the final CAD solid.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter(key => record[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite physical value.');
  return JSON.stringify(value) ?? 'undefined';
}

function physicalAssembly(assembly: Assembly) {
  return {
    groundPartId: assembly.groundPartId,
    parts: assembly.parts.map(part => ({
      id: part.id,
      visible: part.visible,
      materialId: part.materialId,
      transform: part.transform,
      sketches: part.sketches.map(({ name: _name, ...sketch }) => sketch),
      features: part.features,
    })),
    mates: assembly.mates.map(({ name: _name, ...mate }) => mate),
    booleanFeatures: assembly.booleanFeatures.map(({ resultPartName: _name, ...feature }) => feature),
  };
}

/** Manual physical edits must never be overwritten by a parameter Apply that
 * still claims to describe the original mechanism. Names and computed renderer
 * caches do not change the physical assembly and remain safe to ignore. */
export function matchesCrankSliderAssembly(assembly: Assembly, params: CrankSliderParams): boolean {
  try {
    const expected = buildCrankSliderAssembly(validateCrankSliderParams(params));
    return canonical(physicalAssembly(assembly)) === canonical(physicalAssembly(expected));
  } catch {
    return false;
  }
}

/** Use before showing a validated motion comparison. Runtime clock/pause and
 * playback speed do not change geometry; gravity or an unrelated experiment
 * would change the stated reference case. */
export function matchesCrankSliderConfiguration(assembly: Assembly, simulation: SimulationState): boolean {
  return !!simulation.crankSlider
    && matchesCrankSliderAssembly(assembly, simulation.crankSlider)
    && simulation.gravity.every(value => value === 0)
    && simulation.timeStepMs === CRANK_SLIDER_TIME_STEP_MS
    && simulation.durationMs === CRANK_SLIDER_DURATION_MS
    && simulation.forceExperiment === undefined
    && simulation.stewartMotion === undefined;
}
