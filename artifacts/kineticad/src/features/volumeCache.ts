// Per-part volume cache, keyed by tip-feature hash.
//
// Volume (mm³), inertia (mm⁵) and centre-of-mass are purely geometric — they depend only
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

import type { MassPropertiesResult } from "../cad/types";

export type VolumeData = {
  /** Geometric volume in mm³, independent of material. */
  volumeMm3: number;
  /**
   * Centre of mass in part-local coordinates [x, y, z] mm.
   * Depends only on shape, not density.
   */
  comLocal: [number, number, number];
  /** Geometric principal moments at unit density, independent of material. */
  principalInertiaMm5: [number, number, number];
  principalInertiaLocalFrame: [number, number, number, number];
};

/** Strip material density while retaining the actual B-rep inertia. */
export function volumeDataFromMassProperties(props: MassPropertiesResult, densityGcm3: number): VolumeData {
  const scale = densityGcm3 * 1e-6;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Material density must be finite and positive.");
  return {
    volumeMm3: props.volumeMm3,
    comLocal: [...props.comLocal],
    principalInertiaMm5: props.principalInertiaKgMm2.map((v) => v / scale) as [number, number, number],
    principalInertiaLocalFrame: [...props.principalInertiaLocalFrame],
  };
}

/** Reapply material density without losing shape-dependent rotational inertia. */
export function massPropertiesForMaterial(data: VolumeData, densityGcm3: number): MassPropertiesResult {
  const scale = densityGcm3 * 1e-6;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Material density must be finite and positive.");
  if (!(data.volumeMm3 > 0) || !Number.isFinite(data.volumeMm3)
    || data.principalInertiaMm5.some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new Error("Cached physical mass properties are invalid.");
  }
  return {
    volumeMm3: data.volumeMm3,
    massKg: data.volumeMm3 * scale,
    comLocal: [...data.comLocal],
    principalInertiaKgMm2: data.principalInertiaMm5.map((v) => v * scale) as [number, number, number],
    principalInertiaLocalFrame: [...data.principalInertiaLocalFrame],
  };
}

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
