// Apply a fillet (constant-radius rounding) to a set of edges on a TopoDS_Shape.
//
// Uses BRepFilletAPI_MakeFillet + Add_2(radius, edge) for each target edge
// resolved via the picker's stable-id → TopoDS_Edge map. If any of the
// requested edge ids are missing from the map (e.g. the upstream shape lost
// that edge), throws `edge-not-found:` so the inspector can surface it.
//
// On OCCT failure (`!IsDone()` or `Build()` exception), throws one of:
//   - `fillet-self-intersect`: catches obvious self-intersection signatures
//   - `fillet-radius-too-large`: generic fallback for build failures
//
// Caller owns the returned shape and must `.delete()` it.

export function applyFillet(
  oc: unknown,
  shape: unknown,
  edgeRefs: Map<string, unknown>,
  targetEdgeIds: string[],
  radiusMm: number,
): unknown {
  const ocAny = oc as any;

  if (!Number.isFinite(radiusMm) || radiusMm <= 0) {
    throw new Error(`Fillet radius must be positive, got ${radiusMm}.`);
  }
  if (targetEdgeIds.length === 0) {
    throw new Error("Fillet requires at least one target edge.");
  }

  // Resolve every requested id BEFORE touching OCCT so we can fail fast.
  const resolved: unknown[] = [];
  for (const id of targetEdgeIds) {
    const edge = edgeRefs.get(id);
    if (!edge) {
      throw new Error(`edge-not-found: edge ${id} no longer exists.`);
    }
    resolved.push(edge);
  }

  // BRepFilletAPI_MakeFillet's only constructor takes the shape AND a fillet
  // shape kind. ChFi3d_Rational is OCCT's default and works for the kinds of
  // edges Phase 4 supports.
  const filletShape = ocAny.ChFi3d_FilletShape.ChFi3d_Rational;
  const builder = new ocAny.BRepFilletAPI_MakeFillet(
    shape as any,
    filletShape,
  );
  let progress: any = null;
  let result: any = null;
  try {
    for (const edge of resolved) {
      builder.Add_2(radiusMm, edge as any);
    }
    progress = new ocAny.Message_ProgressRange_1();
    builder.Build(progress);
    if (!builder.IsDone()) {
      throw new Error(
        "fillet-radius-too-large: BRepFilletAPI_MakeFillet did not complete.",
      );
    }
    result = builder.Shape();
    if (!result) {
      throw new Error(
        "fillet-radius-too-large: MakeFillet produced no shape.",
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/self.?intersect/i.test(msg) || /intersect/i.test(msg)) {
      throw new Error(`fillet-self-intersect: ${msg}`);
    }
    if (/edge-not-found|fillet-/i.test(msg)) {
      throw err;
    }
    throw new Error(`fillet-radius-too-large: ${msg}`);
  } finally {
    if (progress) progress.delete?.();
    builder.delete?.();
  }

  return result;
}
