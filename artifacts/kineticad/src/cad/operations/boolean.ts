// Apply a boolean operation (Union/Subtract/Intersect) across N TopoDS_Shapes.
//
// Algorithm:
//   1. Validate every input is a solid (TopAbs_SOLID/COMPSOLID, or a
//      TopAbs_COMPOUND that contains at least one solid). If not, throws
//      `invalid-input-not-solid:` so the inspector can surface it.
//   2. For Subtract, require exactly 2 shapes; the caller orders them
//      `[body, tool]`. Throws `subtract-needs-tool:` otherwise.
//   3. Iterate pairwise:
//        - Union     → BRepAlgoAPI_Fuse_3
//        - Subtract  → BRepAlgoAPI_Cut_3
//        - Intersect → BRepAlgoAPI_Common_3
//      The accumulator starts as `shapes[0]` (caller-owned, not deleted by
//      us). Each successful pair produces a new accumulator that we own
//      and delete on the next iteration / on error.
//   4. One-shot fuzzy retry per pair: on `!IsDone()`, retry once with
//      `SetFuzzyValue(0.001)`. If still failing, throw `boolean-failed:`.
//   5. Final result must be a non-empty solid. Throws `empty-result:` if
//      the bounding box is void or has effectively zero volume, or if no
//      TopAbs_SOLID is reachable from the result.
//
// Caller owns the returned shape and must `.delete()` it.

import type { BooleanOperation } from "@/state/schemas";

/** Bounding-box volume floor below which we consider a result empty. */
const EMPTY_VOLUME_FLOOR_MM3 = 1e-9;

/**
 * Returns true if `shape` is (or transitively contains) a TopAbs_SOLID. We
 * accept TopAbs_SOLID, TopAbs_COMPSOLID, and TopAbs_COMPOUND-with-solids
 * because BRepAlgoAPI results in this build often arrive as compounds.
 */
function isSolidShape(ocAny: any, shape: any): boolean {
  if (!shape || (typeof shape.IsNull === "function" && shape.IsNull())) {
    return false;
  }
  const tSolid = ocAny.TopAbs_ShapeEnum?.TopAbs_SOLID ?? ocAny.TopAbs_SOLID;
  const tCompSolid =
    ocAny.TopAbs_ShapeEnum?.TopAbs_COMPSOLID ?? ocAny.TopAbs_COMPSOLID;
  const tCompound =
    ocAny.TopAbs_ShapeEnum?.TopAbs_COMPOUND ?? ocAny.TopAbs_COMPOUND;
  const tShape = ocAny.TopAbs_ShapeEnum?.TopAbs_SHAPE ?? ocAny.TopAbs_SHAPE;
  const t = shape.ShapeType();
  if (t === tSolid || t === tCompSolid) return true;
  if (t === tCompound) {
    const exp = new ocAny.TopExp_Explorer_2(shape, tSolid, tShape);
    try {
      return exp.More();
    } finally {
      exp.delete?.();
    }
  }
  return false;
}

/**
 * Empty-result detector. Combines a "shape contains no solid" check with a
 * bounding-box volume floor. Either condition signals an empty boolean.
 */
function isResultEmpty(ocAny: any, shape: any): boolean {
  if (!shape || (typeof shape.IsNull === "function" && shape.IsNull())) {
    return true;
  }
  if (!isSolidShape(ocAny, shape)) return true;

  const bbox = new ocAny.Bnd_Box_1();
  let cMin: any = null;
  let cMax: any = null;
  try {
    ocAny.BRepBndLib.Add(shape, bbox, false);
    if (bbox.IsVoid?.()) return true;
    cMin = bbox.CornerMin();
    cMax = bbox.CornerMax();
    const dx = cMax.X() - cMin.X();
    const dy = cMax.Y() - cMin.Y();
    const dz = cMax.Z() - cMin.Z();
    return dx * dy * dz < EMPTY_VOLUME_FLOOR_MM3;
  } catch {
    return false;
  } finally {
    if (cMin) cMin.delete?.();
    if (cMax) cMax.delete?.();
    bbox.delete?.();
  }
}

/**
 * Run a single pairwise boolean op. Returns the resulting shape (caller
 * owns) on success, or `null` if `IsDone()` reported failure. Caller is
 * responsible for retrying with `fuzzy` set on the second pass.
 *
 * `fuzzy = null` means no fuzzy bump; `fuzzy > 0` calls SetFuzzyValue.
 */
function runPair(
  ocAny: any,
  op: "union" | "subtract" | "intersect",
  a: any,
  b: any,
  fuzzy: number | null,
): unknown {
  let progressCtor: any = null;
  let progressBuild: any = null;
  let algo: any = null;
  try {
    progressCtor = new ocAny.Message_ProgressRange_1();
    if (op === "union") {
      algo = new ocAny.BRepAlgoAPI_Fuse_3(a, b, progressCtor);
    } else if (op === "subtract") {
      algo = new ocAny.BRepAlgoAPI_Cut_3(a, b, progressCtor);
    } else {
      algo = new ocAny.BRepAlgoAPI_Common_3(a, b, progressCtor);
    }
    if (fuzzy !== null && typeof algo.SetFuzzyValue === "function") {
      algo.SetFuzzyValue(fuzzy);
    }
    progressBuild = new ocAny.Message_ProgressRange_1();
    algo.Build(progressBuild);
    if (!algo.IsDone()) return null;
    const out = algo.Shape();
    return out ?? null;
  } catch {
    return null;
  } finally {
    if (algo) algo.delete?.();
    if (progressCtor) progressCtor.delete?.();
    if (progressBuild) progressBuild.delete?.();
  }
}

export function applyBoolean(
  oc: unknown,
  shapes: unknown[],
  operation: BooleanOperation,
): unknown {
  const ocAny = oc as any;

  if (!Array.isArray(shapes) || shapes.length < 2) {
    throw new Error(
      `boolean-failed: need ≥2 input shapes, got ${shapes?.length ?? 0}.`,
    );
  }
  if (operation.type === "subtract" && shapes.length !== 2) {
    throw new Error(
      `subtract-needs-tool: expected 2 inputs (body + tool), got ${shapes.length}.`,
    );
  }
  if (shapes.length > 8) {
    throw new Error(`boolean-failed: too many inputs (${shapes.length}, max 8).`);
  }

  // Validate every input is a solid up-front so we fail fast with a clean
  // message instead of letting the BRepAlgoAPI layer crash.
  for (let i = 0; i < shapes.length; i++) {
    if (!isSolidShape(ocAny, shapes[i])) {
      throw new Error(
        `invalid-input-not-solid: input #${i} is not a closed solid.`,
      );
    }
  }

  // Pairwise iteration. `acc` is the running accumulator. `accOwned` tells
  // us whether we allocated it (and therefore must `.delete()` it) or
  // whether it is the caller's `shapes[0]` (which we must NOT delete).
  let acc: any = shapes[0];
  let accOwned = false;
  try {
    for (let i = 1; i < shapes.length; i++) {
      const next = shapes[i];
      let pair = runPair(ocAny, operation.type, acc, next, null);
      if (!pair) {
        pair = runPair(ocAny, operation.type, acc, next, 0.001);
      }
      if (!pair) {
        throw new Error(
          `boolean-failed: ${operation.type} of input #${i} did not complete.`,
        );
      }
      if (accOwned) acc.delete?.();
      acc = pair;
      accOwned = true;
    }

    if (isResultEmpty(ocAny, acc)) {
      throw new Error("empty-result: boolean produced no geometry.");
    }

    // Caller owns `acc`. If it was the caller's shapes[0] (because
    // shapes.length === 1 — which we rejected above — or some pathological
    // path), they already own it; otherwise we hand off ownership.
    return acc;
  } catch (err) {
    if (accOwned) acc.delete?.();
    if (err instanceof Error) throw err;
    throw new Error(`boolean-failed: ${String(err)}`);
  }
}
