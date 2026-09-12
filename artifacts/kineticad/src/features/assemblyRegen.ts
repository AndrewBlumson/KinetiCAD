// Assembly-level boolean regeneration orchestrator.
//
// Phase 5 booleans live on `assembly.booleanFeatures` and combine 2+
// existing parts. Each boolean re-executes every input part's full feature
// chain inside the worker, then runs Fuse_3 / Cut_3 / Common_3 across the
// resulting solids.
//
// This module owns:
//   - `computePartChainHash(part)` — stable hash of a part's full feature
//     chain, folding in every sketch and feature parameter so any upstream
//     edit cascades into a cache miss for any boolean that consumes it.
//   - `computeBooleanHash(feature, parts)` — extends the part hashes with
//     the operation type + tool-part id (subtract).
//   - `regenerateBoolean(feature, parts, kernel)` — cache-aware async
//     wrapper that asks the worker to compute the boolean and returns
//     `{ mesh, hash, error }`. For Subtract, the body part is placed first
//     in the worker's `inputs` array and the tool part second (the worker
//     trusts this ordering).

import type { BooleanOpArgs, CadKernelApi, TessellatedMesh } from "@/cad/types";
import type { BooleanFeature, Part } from "@/state/schemas";
import type { Remote } from "comlink";
import { computeFeatureHash } from "./featureRegen";
import { getCacheGeneration } from "./featureCache";

// Worker-owned imported shape IDs must never hit another worker's cache.
type MeshCache = { generation: number; settled: Map<string, TessellatedMesh>; pending: Map<string, Promise<TessellatedMesh>> };
const meshCaches = new WeakMap<Remote<CadKernelApi>, MeshCache>();

function stableGeometry(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableGeometry).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableGeometry(object[key])}`).join(',')}}`;
}

/**
 * Stable hash for a part's full feature chain. We reuse `computeFeatureHash`
 * (which folds sketch + upstream into each step) and return the hash of
 * the *last* feature, which transitively encodes everything that came
 * before it. For empty parts (no features), returns a deterministic
 * sentinel so cache keys stay stable.
 */
export function computePartChainHash(part: Part): string {
  if (part.features.length === 0) return "empty";
  const upstream: string[] = [];
  let last = "empty";
  for (const f of part.features) {
    const h = computeFeatureHash(f, part.sketches, upstream);
    upstream.push(h);
    last = h;
  }
  return last;
}

/**
 * Compute the cache key for a boolean feature. Includes:
 *   - operation type (and tool-part id for subtract)
 *   - the complete source geometry and exact transform of every input part
 *
 * Because `inputPartIds` order is significant for subtract (orchestrator
 * places body first, tool second when sending to worker) we preserve the
 * caller-supplied order here too.
 */
export function computeBooleanHash(
  feature: BooleanFeature,
  parts: ReadonlyArray<Part>,
): string {
  const partsById = new Map(parts.map((part) => [part.id, part]));
  // Full source geometry prevents short-hash collisions from reusing a different
  // physical solid. Preserve every numeric transform bit; 0.00001mm edits matter.
  return stableGeometry({
    operation: feature.operation,
    inputs: feature.inputPartIds.map((id) => {
      const part = partsById.get(id);
      return part ? { id, features: part.features, transform: part.transform,
        sketches: part.sketches.map(({ id, plane, primitives }) => ({ id, plane, primitives })) }
        : { missing: id };
    }),
  });
}

/** Deep immutable worker snapshot, with the selected subtract cutter last. */
export function createBooleanOpArgs(feature: BooleanFeature, parts: ReadonlyArray<Part>): BooleanOpArgs {
  if (feature.inputPartIds.length < 2 || feature.inputPartIds.length > 8
    || new Set(feature.inputPartIds).size !== feature.inputPartIds.length) {
    throw new Error('boolean-failed: need 2–8 distinct input parts.');
  }
  const partsById = new Map(parts.map((part) => [part.id, part]));
  for (const id of feature.inputPartIds) {
    const part = partsById.get(id);
    if (!part) throw new Error(`boolean-failed: input part ${id} no longer exists.`);
    if (!part.features.length) throw new Error(`boolean-failed: input part "${part.name}" has no features.`);
    const tx = part.transform;
    if (!tx || tx.positionMm.length !== 3 || tx.rotationDeg.length !== 3
      || [...tx.positionMm, ...tx.rotationDeg].some((value) => !Number.isFinite(value))) {
      throw new Error(`boolean-failed: input part "${part.name}" has an invalid transform.`);
    }
  }
  let orderedIds = feature.inputPartIds;
  if (feature.operation.type === 'subtract') {
    const tool = feature.operation.toolPartId;
    if (orderedIds.length !== 2 || !orderedIds.includes(tool)) {
      throw new Error('subtract-needs-tool: expected exactly two inputs including the selected cutter.');
    }
    orderedIds = [orderedIds.find((id) => id !== tool)!, tool];
  } else if (feature.operation.type !== 'union' && feature.operation.type !== 'intersect') {
    throw new Error('boolean-failed: unsupported Boolean operation.');
  }
  return structuredClone({
    operation: feature.operation,
    inputs: orderedIds.map((id) => {
      const part = partsById.get(id)!;
      return { partId: id, features: part.features, sketches: part.sketches, transform: part.transform };
    }),
  });
}

export type BooleanRegenResult = {
  /** Mesh produced by the worker, or null if `error` is set. */
  mesh: TessellatedMesh | null;
  /** Cache-key hash. Always populated. */
  hash: string;
  /** Raw error message from the worker (un-mapped). Null on success. */
  error: string | null;
  /**
   * Stack trace of the worker-side exception, when available. Surfaced in
   * the inspector's "Technical details" disclosure for diagnosability.
   * Null on success or when the error wasn't an `Error` instance.
   */
  stack: string | null;
};

/**
 * Regenerate a single boolean feature. Returns `{mesh, hash, error}`.
 *
 * For Subtract, this orders the worker's `inputs` array as `[body, tool]`
 * based on `feature.operation.toolPartId`. For Union/Intersect the order
 * matches `feature.inputPartIds`.
 *
 * If any required part is missing, returns an error result without calling
 * the worker.
 */
export async function regenerateBoolean(
  feature: BooleanFeature,
  parts: ReadonlyArray<Part>,
  kernel: Remote<CadKernelApi>,
): Promise<BooleanRegenResult> {
  const hash = computeBooleanHash(feature, parts);
  try {
    const args = createBooleanOpArgs(feature, parts);
    const generation = getCacheGeneration();
    let cache = meshCaches.get(kernel);
    if (!cache || cache.generation !== generation) {
      cache = { generation, settled: new Map(), pending: new Map() };
      meshCaches.set(kernel, cache);
    }
    let mesh = cache.settled.get(hash);
    if (!mesh) {
      let operation = cache.pending.get(hash);
      if (!operation) {
        const owner = cache;
        operation = kernel.booleanOp(args).then((value) => {
          if (generation === getCacheGeneration() && meshCaches.get(kernel) === owner) owner.settled.set(hash, value);
          return value;
        }).finally(() => { owner.pending.delete(hash); });
        cache.pending.set(hash, operation);
      }
      mesh = await operation;
    }
    return { mesh, hash, error: null, stack: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : null;
    return { mesh: null, hash, error: message, stack };
  }
}
