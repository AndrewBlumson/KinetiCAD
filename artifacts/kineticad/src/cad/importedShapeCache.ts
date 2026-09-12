// Main-thread cache for tessellated meshes that came from imported STEP
// shapes. This render cache is transient. Project assets in IndexedDB and
// downloaded project files reconstruct it before the scene mounts on reload.
//
// Populated by the import handler in Modeller.tsx immediately after
// cadWorker.importStep() resolves. Consumed by featureRegen.runFeature()
// when it encounters an 'imported-step' feature type, so the regen
// pipeline never has to make an extra worker round-trip for imports.

import type { TessellatedMesh } from './types';

const cache = new Map<string, TessellatedMesh>();

/** Retrieve the tessellated mesh for a previously imported STEP shape. */
export function getImportedShapeMesh(shapeId: string): TessellatedMesh | undefined {
  return cache.get(shapeId);
}

/** Store the tessellated mesh for a STEP shape so the regen pipeline can use it. */
export function setImportedShapeMesh(shapeId: string, mesh: TessellatedMesh): void {
  cache.set(shapeId, mesh);
}

/** Drop all cached meshes (e.g. on full assembly reset). */
export function clearImportedShapeCache(): void {
  cache.clear();
}
