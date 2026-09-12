export type RigidPartTransform = {
  positionMm: readonly [number, number, number];
  rotationDeg: readonly [number, number, number];
};

/** Row-major 3×4 T·Rx·Ry·Rz, matching Three's intrinsic XYZ Euler convention. */
export function partTransformMatrix(transform: RigidPartTransform): number[] {
  const { positionMm, rotationDeg } = transform;
  if (positionMm.length !== 3 || rotationDeg.length !== 3
    || [...positionMm, ...rotationDeg].some((value) => !Number.isFinite(value))) {
    throw new Error("Part transform must contain finite XYZ position and rotation values.");
  }
  const [x, y, z] = rotationDeg.map((value) => value * Math.PI / 180);
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return [
    c * e, -c * f, d, positionMm[0],
    a * f + b * d * e, a * e - b * d * f, -b * c, positionMm[1],
    b * f - a * d * e, b * e + a * d * f, a * c, positionMm[2],
  ];
}

/** Caller owns the returned gp_Trsf and must delete it. */
export function makePartTransform(oc: any, transform: RigidPartTransform): any {
  const values = partTransformMatrix(transform);
  const trsf = new oc.gp_Trsf_1();
  try {
    // Explicit coefficients avoid gp_Trsf.Multiply's post-multiplication
    // semantics accidentally rotating the translation or reversing Euler order.
    trsf.SetValues(...values);
    return trsf;
  } catch (error) {
    trsf.delete();
    throw error;
  }
}

/** Return an independent transformed shape. The input remains caller-owned. */
export function transformPartShape(oc: any, shape: any, transform: RigidPartTransform): any {
  const trsf = makePartTransform(oc, transform);
  let builder: any;
  try {
    builder = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
    if (!builder.IsDone()) throw new Error("OCCT failed to apply the part transform.");
    return builder.Shape();
  } finally {
    builder?.delete();
    trsf.delete();
  }
}
