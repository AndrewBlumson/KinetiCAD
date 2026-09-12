import { validateFourBarDesign } from '../mechanisms/fourBarSynthesis';
import { z } from 'zod';
import type { Assembly, AppMode, SimulationState } from '../state/schemas';
import { validateStewartMotionConfig } from '../physics/stewartKinematics.ts';
import { validateCrankSliderParams } from '../mechanisms/crankSlider.ts';

export type DemoDocument = {
  version: 9;
  state: { mode: AppMode; assembly: Assembly; simulation: SimulationState };
};

const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const partSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), visible: z.boolean(), materialId: z.string(),
  transform: z.object({ positionMm: vec3, rotationDeg: vec3 }),
  sketches: z.array(z.object({ id: z.string(), primitives: z.array(z.object({ type: z.string() }).passthrough()) }).passthrough()),
  features: z.array(z.object({ id: z.string(), type: z.enum(['extrude', 'revolve', 'fillet', 'chamfer', 'hole']) }).passthrough()).min(1),
}).passthrough();
const documentSchema = z.object({
  version: z.literal(9),
  state: z.object({
    mode: z.enum(['modeller', 'simulator']),
    assembly: z.object({
      id: z.string(), name: z.string(), parts: z.array(partSchema).min(1),
      mates: z.array(z.object({ id: z.string(), type: z.enum(['revolute', 'prismatic', 'fixed', 'spherical']), partA: z.string(), partB: z.string() }).passthrough()),
      groundPartId: z.string(), booleanFeatures: z.array(z.unknown()),
    }),
    simulation: z.object({
      running: z.boolean(), paused: z.boolean(), timeStepMs: z.number().positive().finite(),
      gravity: vec3, speedMultiplier: z.number().positive().finite(), simulationTimeMs: z.number().finite(),
      durationMs: z.number().finite().positive().optional(),
      stewartMotion: z.unknown().transform((v) => validateStewartMotionConfig(v)).optional(),
      fourBar: z.unknown().transform((v) => validateFourBarDesign(v)).optional(),
      crankSlider: z.unknown().transform((v) => validateCrankSliderParams(v)).optional(),
      forceExperiment: z.object({
        kind: z.literal('equal-force'), partIds: z.array(z.string().min(1)).min(1),
        forceN: z.number().finite().positive(), direction: vec3,
        durationMs: z.number().finite().positive(),
      }).optional(),
    }),
  }),
});

// Validate a bundled document before changing either the live assembly or storage.
export function parseDemoDocument(value: unknown): DemoDocument {
  const parsed = documentSchema.parse(value);
  const { assembly } = parsed.state;
  const ids = new Set(assembly.parts.map((part) => part.id));
  if (ids.size !== assembly.parts.length || !ids.has(assembly.groundPartId)) {
    throw new Error('This demo has invalid part references.');
  }
  for (const mate of assembly.mates) {
    if (!ids.has(mate.partA) || !ids.has(mate.partB) || mate.partA === mate.partB) {
      throw new Error('This demo has an invalid joint.');
    }
  }
  const experiment = parsed.state.simulation.forceExperiment;
  if (experiment && (new Set(experiment.partIds).size !== experiment.partIds.length
    || experiment.partIds.some((id) => !ids.has(id) || id === assembly.groundPartId)
    || Math.abs(Math.hypot(...experiment.direction) - 1) > 1e-9)) {
    throw new Error('This demo has invalid force experiment targets or direction.');
  }
  // The JSON is generated from typed/validated fixture builders, not user input.
  return parsed as unknown as DemoDocument;
}

export function demoAssetUrl(id: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/demos/${encodeURIComponent(id)}.json`;
}
