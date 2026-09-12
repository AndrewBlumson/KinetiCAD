import { z } from 'zod';
import type { AppMode, Assembly, SimulationState } from '../state/schemas';
import { validateStewartMotionConfig } from '../physics/stewartKinematics';
import { MATERIALS } from '../cad/materials';
import { validateCrankSliderParams } from '../mechanisms/crankSlider';

export type ProjectState = { mode: AppMode; assembly: Assembly; simulation: SimulationState };
export type StepAsset = {
  id: string; sha256: string; fileName: string; data: string; preserveCoordinates: boolean;
  bodies: { meshSha256: string; min: [number, number, number]; max: [number, number, number] }[];
};
export type ProjectDocument = { format: 'kineticad-project'; version: 1; stateVersion: 9; state: ProjectState; assets: StepAsset[] };
export const MAX_PROJECT_BYTES = 100 * 1024 * 1024;
const number = z.number().finite();
const positive = number.positive();
const id = z.string().min(1).max(256);
const vec2 = z.tuple([number, number]);
const vec3 = z.tuple([number, number, number]);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const primitive = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line'), start: vec2, end: vec2 }),
  z.object({ type: z.literal('circle'), centre: vec2, radius: positive }),
  z.object({ type: z.literal('arc'), centre: vec2, radius: positive, startAngle: number, endAngle: number }),
  z.object({ type: z.literal('rectangle'), corner: vec2, width: number, height: number }),
]);
const feature = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('extrude'), sketchId: id, depthMm: positive, direction: z.enum(['forward', 'backward', 'symmetric']), extrudeMode: z.enum(['new-body', 'add', 'subtract']) }),
  z.object({ id, type: z.literal('revolve'), sketchId: id, axis: z.enum(['X', 'Y', 'Z']), angleDeg: positive.max(360) }),
  z.object({ id, type: z.literal('fillet'), targetEdges: z.array(id), radiusMm: positive }),
  z.object({ id, type: z.literal('chamfer'), targetEdges: z.array(id), sizeMm: positive }),
  z.object({ id, type: z.literal('hole'), targetFace: id, positionUV: vec2, diameterMm: positive, depthMm: number.nonnegative() }),
  z.object({ id, type: z.literal('imported-step'), shapeId: id }),
]);
const pivot = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('face'), faceId: id, localPoint: vec3 }),
  z.object({ kind: z.literal('edge'), edgeId: id, localPoint: vec3 }),
]);
const mateBase = { id, name: z.string().optional(), partA: id, partB: id };
const mate = z.discriminatedUnion('type', [
  z.object({ ...mateBase, type: z.literal('fixed') }),
  z.object({ ...mateBase, type: z.literal('spherical'), pivotA: pivot, pivotB: pivot }),
  z.object({ ...mateBase, type: z.literal('revolute'), pivotA: pivot, pivotB: pivot, axisLocal: vec3, motorSpeedRpm: number.nullish(), motorTorqueNm: number.nullish() }),
  z.object({ ...mateBase, type: z.literal('prismatic'), pivotA: pivot, pivotB: pivot, axisLocal: vec3, motorVelocityMmPerSec: number.nullish(), motorForceN: number.nullish() }),
  z.object({ ...mateBase, type: z.literal('planar'), pivotA: z.object({ kind: z.literal('face'), faceId: id }), pivotB: z.object({ kind: z.literal('face'), faceId: id }) }),
]);
const stateSchema = z.object({
  mode: z.enum(['modeller', 'simulator']),
  assembly: z.object({
    id, name: z.string(), groundPartId: z.string(),
    parts: z.array(z.object({ id, name: z.string(), visible: z.boolean(), materialId: id,
      transform: z.object({ positionMm: vec3, rotationDeg: vec3 }),
      sketches: z.array(z.object({ id, name: z.string(), plane: z.union([z.enum(['XY', 'XZ', 'YZ']), z.object({ customId: id })]), primitives: z.array(primitive) })),
      features: z.array(feature),
    })).max(4096),
    mates: z.array(mate).max(16384),
    booleanFeatures: z.array(z.object({ id, type: z.literal('boolean'), resultPartName: z.string(), hideInputs: z.boolean(), inputPartIds: z.array(id).min(2).max(8),
      operation: z.discriminatedUnion('type', [z.object({ type: z.literal('union') }), z.object({ type: z.literal('intersect') }), z.object({ type: z.literal('subtract'), toolPartId: id })]),
    })),
  }),
  simulation: z.object({
    running: z.boolean(), paused: z.boolean(), simulationTimeMs: number.nonnegative(), timeStepMs: positive.max(1000),
    gravity: vec3, speedMultiplier: positive, durationMs: positive.optional(),
    forceExperiment: z.object({ kind: z.literal('equal-force'), partIds: z.array(id).min(1), forceN: positive, direction: vec3, durationMs: positive }).optional(),
    stewartMotion: z.unknown().optional(),
    crankSlider: z.unknown().optional(),
  }).passthrough(),
});
const assetSchema = z.object({ id: id, sha256: digest, fileName: z.string().max(1024), data: z.string().max(MAX_PROJECT_BYTES), preserveCoordinates: z.boolean(),
  bodies: z.array(z.object({ meshSha256: digest, min: vec3, max: vec3 })).min(1).max(4096),
});
const schema = z.object({ format: z.literal('kineticad-project'), version: z.literal(1), stateVersion: z.literal(9), state: stateSchema, assets: z.array(assetSchema).max(4096) });
export const shapeIdForAsset = (asset: Pick<StepAsset, 'id'>, index: number) => `step-${asset.id}-${index}`;
const unique = (ids: string[], label: string) => { if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} IDs in the project.`); };

export function parseProjectState(value: unknown): ProjectState {
  const parsed = stateSchema.parse(value);
  const { assembly, simulation } = parsed;
  unique(assembly.parts.map((p) => p.id), 'part');
  unique(assembly.mates.map((m) => m.id), 'joint');
  unique(assembly.booleanFeatures.map((b) => b.id), 'boolean');
  const parts = new Set(assembly.parts.map((p) => p.id));
  if (assembly.groundPartId && !parts.has(assembly.groundPartId)) throw new Error('Ground part is missing.');
  for (const part of assembly.parts) {
    if (!Object.hasOwn(MATERIALS, part.materialId)) throw new Error(`${part.name}: unknown material ${part.materialId}. Choose a supported material before saving.`);
    unique(part.sketches.map((s) => s.id), 'sketch'); unique(part.features.map((f) => f.id), 'feature');
    const sketches = new Set(part.sketches.map((s) => s.id));
    for (const f of part.features) if ('sketchId' in f && !sketches.has(f.sketchId)) throw new Error(`${part.name}: a feature references a missing sketch.`);
  }
  for (const m of assembly.mates) {
    if (!parts.has(m.partA) || !parts.has(m.partB) || m.partA === m.partB) throw new Error('A joint references missing or identical parts.');
    if ('axisLocal' in m && Math.abs(Math.hypot(...m.axisLocal) - 1) > 1e-5) throw new Error('A joint axis is not a unit vector.');
  }
  for (const b of assembly.booleanFeatures) {
    unique(b.inputPartIds, 'boolean input');
    if (b.inputPartIds.some((id) => !parts.has(id)) || (b.operation.type === 'subtract' && !b.inputPartIds.includes(b.operation.toolPartId))) throw new Error('A boolean references a missing part.');
  }
  const e = simulation.forceExperiment;
  if (e && (new Set(e.partIds).size !== e.partIds.length || e.partIds.some((id) => !parts.has(id) || id === assembly.groundPartId) || Math.abs(Math.hypot(...e.direction) - 1) > 1e-9)) throw new Error('Invalid force experiment.');
  if (simulation.stewartMotion !== undefined) validateStewartMotionConfig(simulation.stewartMotion);
  if (simulation.crankSlider !== undefined) simulation.crankSlider = validateCrankSliderParams(simulation.crankSlider);
  simulation.running = false; simulation.paused = false; simulation.simulationTimeMs = 0;
  return parsed as unknown as ProjectState;
}

export function parseProjectDocument(value: unknown): ProjectDocument {
  const doc = schema.parse(value) as unknown as ProjectDocument;
  doc.state = parseProjectState(doc.state);
  unique(doc.assets.map((a) => a.id), 'asset');
  const shapes = new Set<string>();
  for (const a of doc.assets) {
    if (a.id !== `${a.sha256}-${a.preserveCoordinates ? 'local' : 'ground'}`) throw new Error('Invalid STEP asset identity.');
    a.bodies.forEach((body, index) => {
      if (body.min.some((v, axis) => v > body.max[axis])) throw new Error('Invalid STEP body bounds.');
      shapes.add(shapeIdForAsset(a, index));
    });
  }
  for (const part of doc.state.assembly.parts) for (const f of part.features) {
    if (f.type === 'imported-step' && !shapes.has(f.shapeId)) throw new Error(`${part.name}: embedded STEP geometry is missing. Re-import the original STEP file.`);
  }
  return doc;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const textBytes = (text: string) => new TextEncoder().encode(text);
export function encodeBytes(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
export function decodeBytes(data: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw new Error('Invalid embedded STEP encoding.');
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}
export async function validateAssetBytes(asset: StepAsset): Promise<Uint8Array> {
  const bytes = decodeBytes(asset.data);
  if (!bytes.length || await sha256(bytes) !== asset.sha256) throw new Error(`STEP checksum failed: ${asset.fileName}. The project has not been replaced.`);
  return bytes;
}
