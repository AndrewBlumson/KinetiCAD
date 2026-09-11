// Per-feature mesh cache, keyed by a stable parameter+upstream hash.
//
// The CAD worker is the only producer of TessellatedMesh data; once it
// transfers a mesh to the main thread the buffers are detached on the
// worker side. The cache lives on the main thread so a re-open of a
// previously-evaluated feature can reuse its mesh in O(1) without a
// worker round-trip.
//
// Phase 3 has at most one feature per part, but the structure is built
// to support Phase 4+ chains where a mid-chain edit must invalidate every
// feature downstream of it (handled by the regen pipeline computing each
// hash with its upstream hashes folded in).

import type { TessellatedMesh } from "@/cad/types";

const cache = new Map<string, TessellatedMesh>();
let generation = 0;

/** Distinguish work started before an explicit cache reset. */
export function getCacheGeneration(): number {
  return generation;
}

/** Look up a previously-tessellated mesh by its full parameter hash. */
export function getCachedMesh(hash: string): TessellatedMesh | undefined {
  return cache.get(hash);
}

/** Record a freshly-tessellated mesh under its parameter hash. */
export function setCachedMesh(hash: string, mesh: TessellatedMesh): void {
  cache.set(hash, mesh);
}

/** Drop all cached entries. */
export function clearCache(): void {
  generation += 1;
  cache.clear();
}

/** For diagnostics / tests. */
export function cacheSize(): number {
  return cache.size;
}
