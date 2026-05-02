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

import type { CadKernelApi, TessellatedMesh } from "@/cad/types";
import type { BooleanFeature, Part } from "@/state/schemas";
import type { Remote } from "comlink";
import { computeFeatureHash } from "./featureRegen";
import { getCachedMesh, setCachedMesh } from "./featureCache";

/** Cache key prefix so boolean entries can't collide with feature entries. */
const BOOLEAN_CACHE_PREFIX = "boolean:";

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
 *   - the chain hash of every input part, in `inputPartIds` order
 *
 * Because `inputPartIds` order is significant for subtract (orchestrator
 * places body first, tool second when sending to worker) we preserve the
 * caller-supplied order here too.
 */
export function computeBooleanHash(
  feature: BooleanFeature,
  parts: ReadonlyArray<Part>,
): string {
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const inputHashes = feature.inputPartIds.map((id) => {
    const p = partsById.get(id);
    return p ? computePartChainHash(p) : `missing:${id}`;
  });
  // Phase 6: each input's transform participates in the cache key so a
  // gizmo drag (or PartInspector edit) on any input invalidates this
  // boolean's cached mesh. Using fixed precision keeps the key stable
  // across rounding noise.
  const inputTransforms = feature.inputPartIds.map((id) => {
    const p = partsById.get(id);
    if (!p) return "missing";
    const t = p.transform;
    return `${t.positionMm.map((v) => v.toFixed(4)).join("/")}|${t.rotationDeg
      .map((v) => v.toFixed(4))
      .join("/")}`;
  });
  const opTag =
    feature.operation.type === "subtract"
      ? `subtract:${feature.operation.toolPartId}`
      : feature.operation.type;
  // Hash via a small concat + the existing FNV path through computeFeatureHash
  // would over-couple us; just a plain string is fine here since the inputs
  // are already hex hashes.
  return `${opTag}|${feature.inputPartIds.join(",")}|${inputHashes.join(
    ",",
  )}|tx:${inputTransforms.join(";")}`;
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
  const cacheKey = BOOLEAN_CACHE_PREFIX + hash;

  const cached = getCachedMesh(cacheKey);
  if (cached) return { mesh: cached, hash, error: null, stack: null };

  const partsById = new Map(parts.map((p) => [p.id, p]));

  // Validate inputs exist and have features.
  for (const id of feature.inputPartIds) {
    const p = partsById.get(id);
    if (!p) {
      return {
        mesh: null,
        hash,
        error: `boolean-failed: input part ${id} no longer exists.`,
        stack: null,
      };
    }
    if (p.features.length === 0) {
      return {
        mesh: null,
        hash,
        error: `boolean-failed: input part "${p.name}" has no features.`,
        stack: null,
      };
    }
  }

  // Order inputs. For subtract the body shape goes first and the tool
  // shape second; the worker trusts this ordering.
  let orderedIds: string[] = feature.inputPartIds;
  if (feature.operation.type === "subtract") {
    const tool = feature.operation.toolPartId;
    if (!feature.inputPartIds.includes(tool)) {
      return {
        mesh: null,
        hash,
        error: `subtract-needs-tool: tool part ${tool} is not in the input list.`,
        stack: null,
      };
    }
    if (feature.inputPartIds.length !== 2) {
      return {
        mesh: null,
        hash,
        error: `subtract-needs-tool: expected exactly 2 inputs, got ${feature.inputPartIds.length}.`,
        stack: null,
      };
    }
    const body = feature.inputPartIds.find((id) => id !== tool);
    if (!body) {
      return {
        mesh: null,
        hash,
        error: `subtract-needs-tool: cannot identify body part.`,
        stack: null,
      };
    }
    orderedIds = [body, tool];
  }

  const inputs = orderedIds.map((id) => {
    const p = partsById.get(id)!;
    return {
      partId: p.id,
      features: [...p.features],
      sketches: [...p.sketches],
      transform: {
        positionMm: [...p.transform.positionMm] as [number, number, number],
        rotationDeg: [...p.transform.rotationDeg] as [number, number, number],
      },
    };
  });

  try {
    const mesh = await kernel.booleanOp({
      inputs,
      operation: feature.operation,
    });
    setCachedMesh(cacheKey, mesh);
    return { mesh, hash, error: null, stack: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : null;
    return { mesh: null, hash, error: message, stack };
  }
}
