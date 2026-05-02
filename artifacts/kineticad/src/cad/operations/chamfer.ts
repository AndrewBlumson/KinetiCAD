// Apply a constant-distance chamfer to a set of edges on a TopoDS_Shape.
//
// Uses BRepFilletAPI_MakeChamfer + Add_2(distance, edge) for each target edge
// resolved via the picker's stable-id → TopoDS_Edge map. Mirrors the error
// mapping of fillet.ts — `edge-not-found` for missing ids, generic
// `chamfer-size-too-large` for OCCT build failures.
//
// Caller owns the returned shape and must `.delete()` it.

export function applyChamfer(
  oc: unknown,
  shape: unknown,
  edgeRefs: Map<string, unknown>,
  targetEdgeIds: string[],
  sizeMm: number,
): unknown {
  const ocAny = oc as any;

  if (!Number.isFinite(sizeMm) || sizeMm <= 0) {
    throw new Error(`Chamfer size must be positive, got ${sizeMm}.`);
  }
  if (targetEdgeIds.length === 0) {
    throw new Error("Chamfer requires at least one target edge.");
  }

  const resolved: unknown[] = [];
  for (const id of targetEdgeIds) {
    const edge = edgeRefs.get(id);
    if (!edge) {
      throw new Error(`edge-not-found: edge ${id} no longer exists.`);
    }
    resolved.push(edge);
  }

  const builder = new ocAny.BRepFilletAPI_MakeChamfer(shape as any);
  let progress: any = null;
  let result: any = null;
  try {
    for (const edge of resolved) {
      builder.Add_2(sizeMm, edge as any);
    }
    progress = new ocAny.Message_ProgressRange_1();
    builder.Build(progress);
    if (!builder.IsDone()) {
      throw new Error(
        "chamfer-size-too-large: BRepFilletAPI_MakeChamfer did not complete.",
      );
    }
    result = builder.Shape();
    if (!result) {
      throw new Error(
        "chamfer-size-too-large: MakeChamfer produced no shape.",
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/edge-not-found|chamfer-/i.test(msg)) {
      throw err;
    }
    throw new Error(`chamfer-size-too-large: ${msg}`);
  } finally {
    if (progress) progress.delete?.();
    builder.delete?.();
  }

  return result;
}
