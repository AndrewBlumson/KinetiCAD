// Per-part volume cache, keyed by tip-feature hash.
//
// Volume (mm³) and centre-of-mass are purely geometric — they depend only
// on the part's shape, not on the material or density assigned to it. Mass
// is just volume × density × unit-conversion, which is arithmetic.
//
// Caching volume + COM by the same hash that `featureCache` uses for
// tessellated meshes means:
//  - Geometry changes → tip hash changes → automatic invalidation.
//  - Material changes → tip hash unchanged → cache hit, zero OCCT calls.
//
// Two consumers share this cache:
//  1. PartMeshLayer — populates on each regen; reads on material-only change
//     to update the inspector mass readout without an OCCT round-trip.
//  2. simulationRunner — reads on Play to compute per-part mass + inertia
//     without re-executing the full OCCT feature chain.
//
// Lifecycle: module-level Map, same as featureCache. Cleared on page reload.
// No persistence, no schema implications.

export type VolumeData = {
  /** Geometric volume in mm³, independent of material. */
  volumeMm3: number;
  /**
   * Centre of mass in part-local coordinates [x, y, z] mm.
   * Depends only on shape, not density.
   */
  comLocal: [number, number, number];
};

const cache = new Map<string, VolumeData>();

/**
 * Look up cached volume data for a part by its tip-feature hash.
 * Returns undefined on a cold cache (first regen this session, or after
 * a geometry change that produced a new hash).
 */
export function getVolumeData(tipHash: string): VolumeData | undefined {
  return cache.get(tipHash);
}

/**
 * Store volume data for a tip-feature hash. Called by PartMeshLayer after
 * each successful getMassProperties response, and by simulationRunner after
 * a cold-cache fallback.
 */
export function setVolumeData(tipHash: string, data: VolumeData): void {
  cache.set(tipHash, data);
}

/** Drop all entries. Useful for tests or explicit cache-bust. */
export function clearVolumeCache(): void {
  cache.clear();
}

/** For diagnostics / tests. */
export function volumeCacheSize(): number {
  return cache.size;
}
