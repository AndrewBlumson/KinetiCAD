// Revolve a closed wire around a world-space cardinal axis through the origin.
//
// The wire's plane should not coincide with or cross the revolution axis,
// otherwise OCCT will produce a self-intersecting solid (or fail outright).
// We don't try to detect that here — if OCCT throws, the caller surfaces the
// message to the inspector.

export type RevolveAxis = "X" | "Y" | "Z";

const AXIS_DIRS: Record<RevolveAxis, readonly [number, number, number]> = {
  X: [1, 0, 0],
  Y: [0, 1, 0],
  Z: [0, 0, 1],
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Revolve the given wire and return the resulting TopoDS_Shape (solid).
 *
 * Caller owns the returned shape and must `.delete()` it.
 */
export function revolve(
  oc: unknown,
  wire: unknown,
  axis: RevolveAxis,
  angleDeg: number,
): unknown {
  const ocAny = oc as any;
  const wireAny = wire as any;

  if (!Number.isFinite(angleDeg) || angleDeg <= 0 || angleDeg > 360) {
    throw new Error(`Revolve angle must be in (0, 360] degrees, got ${angleDeg}.`);
  }

  const angleRad = angleDeg * DEG_TO_RAD;
  const dirComp = AXIS_DIRS[axis];

  // Build face from wire.
  const faceBuilder = new ocAny.BRepBuilderAPI_MakeFace_15(wireAny, true);
  if (!faceBuilder.IsDone()) {
    faceBuilder.delete();
    throw new Error("Failed to build face from sketch wire.");
  }
  const face = faceBuilder.Face();

  // Build axis = gp_Ax1(origin, dir).
  const origin = new ocAny.gp_Pnt_3(0, 0, 0);
  const dir = new ocAny.gp_Dir_4(dirComp[0], dirComp[1], dirComp[2]);
  const ax1 = new ocAny.gp_Ax1_2(origin, dir);

  let revolBuilder: any = null;
  let solid: any;
  try {
    revolBuilder = new ocAny.BRepPrimAPI_MakeRevol_1(
      face,
      ax1,
      angleRad,
      false,
    );
    if (!revolBuilder.IsDone()) {
      throw new Error("OCCT revolve (MakeRevol) failed.");
    }
    solid = revolBuilder.Shape();
  } finally {
    if (revolBuilder) revolBuilder.delete();
    ax1.delete();
    dir.delete();
    origin.delete();
    face.delete();
    faceBuilder.delete();
  }

  return solid;
}
