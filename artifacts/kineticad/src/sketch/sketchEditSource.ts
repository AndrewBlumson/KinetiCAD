import type { Assembly, SketchPrimitive } from '../state/schemas';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Optimistic transaction identity, excluding derived caches and cosmetic
 * part/project names. Every geometry, transform and consumer is retained. */
export function sketchEditAssemblySignature(assembly: Assembly): string {
  return stable({
    id: assembly.id,
    groundPartId: assembly.groundPartId,
    parts: assembly.parts.map(({ name: _name, meshHash: _hash, massKg: _mass, volumeCm3: _volume, ...part }) => part),
    mates: assembly.mates,
    booleanFeatures: assembly.booleanFeatures,
  });
}

export function sketchEditPrimitivesSignature(primitives: SketchPrimitive[]): string {
  return stable(primitives);
}
