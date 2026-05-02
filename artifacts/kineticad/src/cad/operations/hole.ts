// Drill a cylindrical hole into a TopoDS_Shape at a UV point on a planar face.
//
// Algorithm:
//   1. Resolve the target face id via the face refs map; the caller computes
//      the face's plane basis (origin + u/v + outward normal) from the same
//      enumeration that produced the refs.
//   2. World-space hole start point = origin + u*U + v*V.
//   3. Compute hole length:
//      - explicit `depthMm` if > 0; cylinder origin sits AT the face surface,
//        cylinder axis points INWARD (-normal).
//      - otherwise (through-all): length = 2 × bbox diagonal of the upstream
//        shape, and we shift the cylinder origin OUTWARD along the normal
//        by length/2 so the cylinder spans the entire part.
//   4. Build the cylinder via `BRepPrimAPI_MakeCylinder_3(ax2, radius, length)`.
//   5. Subtract via `BRepAlgoAPI_Cut_3`. On first failure, retry once with
//      `SetFuzzyValue(0.001)` to give the boolean a tolerance bump.
//
// Caller owns the returned shape and must `.delete()` it.

export type HoleFaceRef = {
  /** TopoDS_Face wrapper for the target. */
  face: unknown;
  /** Plane origin in world space. */
  origin: [number, number, number];
  /** Plane u basis (unit) in world space. */
  u: [number, number, number];
  /** Plane v basis (unit) in world space. */
  v: [number, number, number];
  /** Outward face normal (unit) in world space. */
  normal: [number, number, number];
};

/**
 * Compute the diagonal of a shape's axis-aligned bounding box in mm. Used to
 * size through-all holes long enough to clear the part on both sides.
 */
function bboxDiagonalMm(ocAny: any, shape: any): number {
  const bbox = new ocAny.Bnd_Box_1();
  let cMin: any = null;
  let cMax: any = null;
  try {
    ocAny.BRepBndLib.Add(shape, bbox, false);
    cMin = bbox.CornerMin();
    cMax = bbox.CornerMax();
    const dx = cMax.X() - cMin.X();
    const dy = cMax.Y() - cMin.Y();
    const dz = cMax.Z() - cMin.Z();
    return Math.hypot(dx, dy, dz);
  } finally {
    if (cMin) cMin.delete?.();
    if (cMax) cMax.delete?.();
    bbox.delete?.();
  }
}

export function applyHole(
  oc: unknown,
  shape: unknown,
  faceRef: HoleFaceRef,
  positionUV: [number, number],
  diameterMm: number,
  depthMm: number,
): unknown {
  const ocAny = oc as any;
  const shapeAny = shape as any;

  if (!Number.isFinite(diameterMm) || diameterMm <= 0) {
    throw new Error(`Hole diameter must be positive, got ${diameterMm}.`);
  }
  if (!Number.isFinite(depthMm) || depthMm < 0) {
    throw new Error(`Hole depth must be ≥ 0, got ${depthMm}.`);
  }

  const radius = diameterMm / 2;
  const through = depthMm === 0;
  // Through-all: 2× bbox diagonal guarantees the cylinder spans the part
  // even with significant offset. Floor at 1mm in the unlikely event the
  // bbox computation returns 0.
  const length = through
    ? 2 * Math.max(bboxDiagonalMm(ocAny, shapeAny), 1)
    : depthMm;

  // World-space point on the face surface for the hole origin.
  const px =
    faceRef.origin[0] + faceRef.u[0] * positionUV[0] + faceRef.v[0] * positionUV[1];
  const py =
    faceRef.origin[1] + faceRef.u[1] * positionUV[0] + faceRef.v[1] * positionUV[1];
  const pz =
    faceRef.origin[2] + faceRef.u[2] * positionUV[0] + faceRef.v[2] * positionUV[1];

  // Cylinder axis = inward (opposite of outward face normal) so the hole
  // extends INTO the part.
  const dx = -faceRef.normal[0];
  const dy = -faceRef.normal[1];
  const dz = -faceRef.normal[2];

  // For through-all, push the cylinder origin OUTWARD along the normal so
  // the cylinder body straddles the face surface and exits the back too.
  const offset = through ? length / 2 : 0;
  const ox = px + faceRef.normal[0] * offset;
  const oy = py + faceRef.normal[1] * offset;
  const oz = pz + faceRef.normal[2] * offset;

  // Build cylinder.
  let pnt: any = null;
  let dir: any = null;
  let ax2: any = null;
  let cylBuilder: any = null;
  let cylinder: any = null;
  try {
    pnt = new ocAny.gp_Pnt_3(ox, oy, oz);
    dir = new ocAny.gp_Dir_4(dx, dy, dz);
    ax2 = new ocAny.gp_Ax2_3(pnt, dir);
    cylBuilder = new ocAny.BRepPrimAPI_MakeCylinder_3(ax2, radius, length);
    if (!cylBuilder.IsDone()) {
      throw new Error("MakeCylinder did not complete.");
    }
    cylinder = cylBuilder.Shape();
  } catch (err) {
    if (cylinder) cylinder.delete?.();
    if (cylBuilder) cylBuilder.delete?.();
    if (ax2) ax2.delete?.();
    if (dir) dir.delete?.();
    if (pnt) pnt.delete?.();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`boolean-failed: hole cylinder build failed: ${msg}`);
  }

  // Subtract.
  let result: any = null;
  let cut: any = null;
  let progress1: any = null;
  let progress2: any = null;
  let progress3: any = null;
  let progress4: any = null;
  try {
    progress1 = new ocAny.Message_ProgressRange_1();
    cut = new ocAny.BRepAlgoAPI_Cut_3(shapeAny, cylinder, progress1);
    progress2 = new ocAny.Message_ProgressRange_1();
    cut.Build(progress2);
    if (!cut.IsDone()) {
      // Retry once with a fuzzy tolerance bump.
      cut.delete?.();
      progress3 = new ocAny.Message_ProgressRange_1();
      cut = new ocAny.BRepAlgoAPI_Cut_3(shapeAny, cylinder, progress3);
      cut.SetFuzzyValue(0.001);
      progress4 = new ocAny.Message_ProgressRange_1();
      cut.Build(progress4);
      if (!cut.IsDone()) {
        throw new Error("boolean-failed: BRepAlgoAPI_Cut did not complete.");
      }
    }
    result = cut.Shape();
    if (!result) {
      throw new Error("boolean-failed: Cut produced no shape.");
    }
  } catch (err) {
    if (result) {
      result.delete?.();
      result = null;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/boolean-failed/i.test(msg)) throw err;
    throw new Error(`boolean-failed: ${msg}`);
  } finally {
    if (progress1) progress1.delete?.();
    if (progress2) progress2.delete?.();
    if (progress3) progress3.delete?.();
    if (progress4) progress4.delete?.();
    if (cut) cut.delete?.();
    cylinder.delete?.();
    cylBuilder.delete?.();
    ax2.delete?.();
    dir.delete?.();
    pnt.delete?.();
  }

  return result;
}
