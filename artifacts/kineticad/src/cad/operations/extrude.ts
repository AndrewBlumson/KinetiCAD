// Extrude a closed wire on a cardinal plane along the plane normal.
//
// Symmetric direction is implemented by translating the source face by
// -normal * (depth/2) before sweeping +normal * depth — this matches the
// usual CAD convention where "Symmetric, depth = 10mm" produces a 10mm-tall
// solid centred on the sketch plane.

import type { CardinalPlane } from "@/sketch/plane";
import { planeNormal } from "./sketchToWire";

export type ExtrudeDirection = "forward" | "backward" | "symmetric";

/**
 * Extrude the given wire and return the resulting TopoDS_Shape (solid).
 *
 * The wire is consumed by BRepBuilderAPI_MakeFace; do not reuse it after
 * calling this. Caller owns the returned shape and must `.delete()` it.
 */
export function extrude(
  oc: unknown,
  wire: unknown,
  plane: CardinalPlane,
  depthMm: number,
  direction: ExtrudeDirection,
): unknown {
  const ocAny = oc as any;
  const wireAny = wire as any;

  if (!Number.isFinite(depthMm) || depthMm <= 0) {
    throw new Error(`Extrude depth must be positive, got ${depthMm}.`);
  }

  const normal = planeNormal(plane);

  // Build the planar face from the wire.
  const faceBuilder = new ocAny.BRepBuilderAPI_MakeFace_15(wireAny, true);
  if (!faceBuilder.IsDone()) {
    faceBuilder.delete();
    throw new Error("Failed to build face from sketch wire.");
  }

  // Either the original face from the builder, or a translated copy when
  // we're doing a symmetric extrude. We always end up with a single `face`
  // wrapper that we own and must delete.
  let face: any = faceBuilder.Face();
  let translatedBuilder: any = null;

  if (direction === "symmetric") {
    const halfDepth = depthMm / 2;
    const offset = new ocAny.gp_Vec_4(
      -normal[0] * halfDepth,
      -normal[1] * halfDepth,
      -normal[2] * halfDepth,
    );
    const trsf = new ocAny.gp_Trsf_1();
    try {
      trsf.SetTranslation_1(offset);
      translatedBuilder = new ocAny.BRepBuilderAPI_Transform_2(face, trsf, true);
      if (!translatedBuilder.IsDone()) {
        throw new Error("Failed to translate face for symmetric extrude.");
      }
      const newFace = translatedBuilder.Shape();
      // Replace `face` with the translated copy and free the original.
      face.delete();
      face = newFace;
    } finally {
      trsf.delete();
      offset.delete();
    }
  }

  // Build the extrude vector in world space.
  const sign = direction === "backward" ? -1 : 1;
  const fullDepth = direction === "symmetric" ? depthMm : depthMm * sign;
  const extrudeVec = new ocAny.gp_Vec_4(
    normal[0] * fullDepth,
    normal[1] * fullDepth,
    normal[2] * fullDepth,
  );

  let prismBuilder: any = null;
  let solid: any;
  try {
    prismBuilder = new ocAny.BRepPrimAPI_MakePrism_1(
      face,
      extrudeVec,
      false,
      true,
    );
    if (!prismBuilder.IsDone()) {
      throw new Error("OCCT extrude (MakePrism) failed.");
    }
    solid = prismBuilder.Shape();
  } finally {
    extrudeVec.delete();
    if (prismBuilder) prismBuilder.delete();
    face.delete();
    if (translatedBuilder) translatedBuilder.delete();
    faceBuilder.delete();
  }

  return solid;
}
