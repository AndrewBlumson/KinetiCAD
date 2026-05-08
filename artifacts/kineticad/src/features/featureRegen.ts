// Top-level feature regeneration orchestrator.
//
// Walks a Part's features in order, computes a stable hash per feature
// (folding in the source sketch's primitives and every upstream feature's
// hash), and either reuses a cached mesh or dispatches the operation to the
// CAD worker.
//
// Phase 4 Split B adds fillet / chamfer / hole. Modifier features carry the
// upstream feature chain + source sketches across the worker boundary so the
// worker can re-execute the upstream chain into a TopoDS_Shape, resolve the
// picker IDs to TopoDS_Edge / TopoDS_Face wrappers, and apply the
// modification — all without any shape needing to round-trip back to JS.

import type { CadKernelApi, TessellatedMesh } from "@/cad/types";
import type {
  Feature,
  Part,
  Sketch,
  SketchPlane,
} from "@/state/schemas";
import { isCardinalPlane } from "@/sketch/plane";
import { getCachedMesh, setCachedMesh } from "./featureCache";
import { getImportedShapeMesh } from "@/cad/importedShapeCache";
import type { Remote } from "comlink";

/**
 * Stable JSON serialiser. Mirrors JSON.stringify but sorts object keys so
 * the resulting string is order-independent. Arrays preserve their order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + stableStringify(obj[k]),
  );
  return "{" + parts.join(",") + "}";
}

/** Tiny non-cryptographic FNV-1a 32-bit hash → hex string. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Compute the cache key for a single feature. Includes:
 *  - the feature's own parameters
 *  - the source sketch's plane and primitives (so editing the sketch invalidates)
 *  - every upstream feature's hash (so an upstream edit cascades)
 */
export function computeFeatureHash(
  feature: Feature,
  sketches: ReadonlyArray<Sketch>,
  upstreamHashes: ReadonlyArray<string>,
): string {
  let sourceSketch: Sketch | undefined;
  if (feature.type === "extrude" || feature.type === "revolve") {
    sourceSketch = sketches.find((s) => s.id === feature.sketchId);
  }
  const payload = {
    feature,
    sketch: sourceSketch
      ? {
          id: sourceSketch.id,
          plane: sourceSketch.plane,
          primitives: sourceSketch.primitives,
        }
      : null,
    upstream: [...upstreamHashes],
  };
  return fnv1a(stableStringify(payload));
}

/**
 * Run a single feature against the kernel and return its mesh. Errors from
 * the worker propagate (caller is expected to surface them to the inspector).
 *
 * Modifier features (fillet/chamfer/hole) need the full upstream feature
 * chain plus the part's sketches to rebuild the OCCT shape inside the worker.
 */
async function runFeature(
  feature: Feature,
  sketches: ReadonlyArray<Sketch>,
  upstreamFeatures: ReadonlyArray<Feature>,
  kernel: Remote<CadKernelApi>,
): Promise<TessellatedMesh> {
  if (feature.type === "extrude") {
    const sketch = sketches.find((s) => s.id === feature.sketchId);
    if (!sketch) throw new Error(`Sketch ${feature.sketchId} not found.`);
    const plane: SketchPlane = sketch.plane;
    if (!isCardinalPlane(plane)) {
      throw new Error("Only cardinal planes (XY/XZ/YZ) are supported in v1.");
    }
    return kernel.extrude({
      sketchPrimitives: sketch.primitives,
      plane,
      depthMm: feature.depthMm,
      direction: feature.direction,
      // Pass mode + upstream so the worker can accumulate (add/subtract)
      // or replace (new-body). upstreamFeatures is [] for the first feature
      // or when mode === 'new-body', which is fine — worker no-ops correctly.
      extrudeMode: feature.extrudeMode,
      upstreamFeatures: [...upstreamFeatures],
      upstreamSketches: [...sketches],
    });
  }

  if (feature.type === "revolve") {
    const sketch = sketches.find((s) => s.id === feature.sketchId);
    if (!sketch) throw new Error(`Sketch ${feature.sketchId} not found.`);
    const plane: SketchPlane = sketch.plane;
    if (!isCardinalPlane(plane)) {
      throw new Error("Only cardinal planes (XY/XZ/YZ) are supported in v1.");
    }
    return kernel.revolve({
      sketchPrimitives: sketch.primitives,
      plane,
      axis: feature.axis,
      angleDeg: feature.angleDeg,
    });
  }

  if (feature.type === "fillet") {
    return kernel.fillet({
      upstreamFeatures: [...upstreamFeatures],
      upstreamSketches: [...sketches],
      targetEdgeIds: [...feature.targetEdges],
      radiusMm: feature.radiusMm,
    });
  }

  if (feature.type === "chamfer") {
    return kernel.chamfer({
      upstreamFeatures: [...upstreamFeatures],
      upstreamSketches: [...sketches],
      targetEdgeIds: [...feature.targetEdges],
      sizeMm: feature.sizeMm,
    });
  }

  if (feature.type === "hole") {
    return kernel.hole({
      upstreamFeatures: [...upstreamFeatures],
      upstreamSketches: [...sketches],
      targetFaceId: feature.targetFace,
      positionUV: [...feature.positionUV] as [number, number],
      diameterMm: feature.diameterMm,
      depthMm: feature.depthMm,
    });
  }

  if (feature.type === 'imported-step') {
    const mesh = getImportedShapeMesh(feature.shapeId);
    if (!mesh) {
      throw new Error(
        'This part was imported from a STEP file and is no longer available ' +
        'in memory. Re-import the STEP file to restore it.',
      );
    }
    return mesh;
  }

  throw new Error(
    `Feature type "${(feature as { type: string }).type}" is not supported until a later phase.`,
  );
}

export type RegenResult = {
  /** The final mesh (last feature's output), or null if the part has no features. */
  mesh: TessellatedMesh | null;
  /**
   * Per-feature evaluation results in order. Successful entries carry their
   * mesh; failures carry an error message. The pipeline stops at the first
   * failure (downstream features depend on upstream geometry).
   */
  perFeature: Array<
    | { id: string; ok: true; hash: string; mesh: TessellatedMesh }
    | { id: string; ok: false; hash: string; error: string }
  >;
};

/**
 * Walk `part.features`, returning the final mesh (or null if there are no
 * features). Each feature's mesh is cached by its hash; cache hits skip the
 * worker round-trip entirely.
 */
export async function regeneratePart(
  part: Part,
  kernel: Remote<CadKernelApi>,
): Promise<RegenResult> {
  const upstreamHashes: string[] = [];
  const upstreamFeatures: Feature[] = [];
  const perFeature: RegenResult["perFeature"] = [];
  let lastMesh: TessellatedMesh | null = null;

  for (const feature of part.features) {
    const hash = computeFeatureHash(feature, part.sketches, upstreamHashes);
    const cached = getCachedMesh(hash);
    if (cached) {
      perFeature.push({ id: feature.id, ok: true, hash, mesh: cached });
      lastMesh = cached;
      upstreamHashes.push(hash);
      upstreamFeatures.push(feature);
      continue;
    }
    try {
      const mesh = await runFeature(
        feature,
        part.sketches,
        upstreamFeatures,
        kernel,
      );
      setCachedMesh(hash, mesh);
      perFeature.push({ id: feature.id, ok: true, hash, mesh });
      lastMesh = mesh;
      upstreamHashes.push(hash);
      upstreamFeatures.push(feature);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      perFeature.push({ id: feature.id, ok: false, hash, error: message });
      // Stop on first failure: downstream features in a chain depend on the
      // upstream geometry. Returning what we have lets the inspector surface
      // the failure for this specific feature.
      break;
    }
  }

  return { mesh: lastMesh, perFeature };
}

/**
 * Convenience wrapper: regenerate a single feature in isolation, used by the
 * inspector's live preview path.
 *
 * For extrude/revolve, `upstreamFeatures` is conventionally `[]` because the
 * preview operates only on the source sketch. For fillet/chamfer/hole, the
 * caller passes the existing chain (excluding the feature being previewed)
 * so the worker can re-execute it.
 */
export async function previewFeature(
  feature: Feature,
  sketches: ReadonlyArray<Sketch>,
  upstreamFeatures: ReadonlyArray<Feature>,
  kernel: Remote<CadKernelApi>,
): Promise<TessellatedMesh> {
  // Fold upstream feature hashes into the cache key so editing an upstream
  // feature (e.g. extrude depth) invalidates the modifier preview.
  const upstreamHashes = upstreamFeatures.map((f) =>
    computeFeatureHash(f, sketches, []),
  );
  const hash = computeFeatureHash(feature, sketches, upstreamHashes);
  const cached = getCachedMesh(hash);
  if (cached) return cached;
  const mesh = await runFeature(feature, sketches, upstreamFeatures, kernel);
  setCachedMesh(hash, mesh);
  return mesh;
}
