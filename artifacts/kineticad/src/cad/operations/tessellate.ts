// Tessellate a TopoDS_Shape into flat Float32 / Uint32 arrays for direct
// upload to a Three.js BufferGeometry.
//
// Walks each face, runs BRepMesh_IncrementalMesh, then copies the
// Poly_Triangulation nodes / triangles / normals into one merged buffer.
// Honours the face's TopAbs_Orientation by flipping normals + winding for
// REVERSED faces so we always emit outward-facing triangles.
//
// Phase 4 Split A: also returns per-face triangle ranges in face-walk order.
// `topology.ts` walks the same shape with TopExp_Explorer (deterministic
// order) and zips its per-face metadata against these ranges to build
// FaceMetadata.triangles[].
//
// All transient OCCT wrappers are `.delete()`-d in a finally block per
// face iteration so an exception mid-loop doesn't leak heap.

/** Default OCCT meshing parameters used across the app. */
export const DEFAULT_LINEAR_DEFLECTION_MM = 0.1;
export const DEFAULT_ANGULAR_DEFLECTION_RAD = 0.5;

/**
 * Per-face range of triangle indices in the merged `indices` array. A face
 * occupies triangles `[triangleStart, triangleStart + triangleCount)`, where
 * each triangle's three vertex indices live at `indices[3k..3k+2]`.
 */
export type FaceTriangleRange = {
  triangleStart: number;
  triangleCount: number;
};

export type TessellationResult = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  faceRanges: FaceTriangleRange[];
};

/**
 * @param oc        The OpenCascade.js instance.
 * @param shape     A TopoDS_Shape (solid, shell, compound, etc.).
 * @param linDefl   Linear deflection in mm. Smaller = more triangles.
 * @param angDefl   Angular deflection in radians.
 */
export function tessellateShape(
  oc: unknown,
  shape: unknown,
  linDefl: number = DEFAULT_LINEAR_DEFLECTION_MM,
  angDefl: number = DEFAULT_ANGULAR_DEFLECTION_RAD,
): TessellationResult {
  // Cast to any: opencascade.js's TS surface is large and uses opaque enum
  // types that aren't easy to satisfy without giving up. The runtime API is
  // stable.
  const ocAny = oc as any;
  const shapeAny = shape as any;

  // Run the meshing algorithm on the whole shape first.
  const mesher = new ocAny.BRepMesh_IncrementalMesh_2(
    shapeAny,
    linDefl,
    false,
    angDefl,
    false,
  );

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const faceRanges: FaceTriangleRange[] = [];

  const explorer = new ocAny.TopExp_Explorer_2(
    shapeAny,
    ocAny.TopAbs_ShapeEnum.TopAbs_FACE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  let nodeOffset = 0;

  try {
    while (explorer.More()) {
      // Per-face wrappers — declared at the top so the finally block can
      // release whatever was allocated before an exception.
      let face: any = null;
      let location: any = null;
      let triangulationHandle: any = null;
      let transformation: any = null;

      try {
        const faceShape = explorer.Current();
        face = ocAny.TopoDS.Face_1(faceShape);
        location = new ocAny.TopLoc_Location_1();
        triangulationHandle = ocAny.BRep_Tool.Triangulation(
          face,
          location,
          0, // Poly_MeshPurpose_NONE
        );

        if (triangulationHandle.IsNull()) {
          // Even a degenerate face must occupy a slot in faceRanges so that
          // the topology walk's k-th face matches our k-th range. Emit an
          // empty range and let `finally` release wrappers.
          faceRanges.push({
            triangleStart: indices.length / 3,
            triangleCount: 0,
          });
          continue;
        }

        const triangulation = triangulationHandle.get();
        transformation = location.Transformation();
        // Embind exposes enum values as singleton objects. Reference equality
        // works because oc.TopAbs_Orientation.TopAbs_REVERSED is the same
        // object returned by the shape.
        const orientationReversed =
          faceShape.Orientation_1() === ocAny.TopAbs_Orientation.TopAbs_REVERSED;

        // Ensure normals are present so we don't have to recompute later.
        if (!triangulation.HasNormals()) {
          triangulation.ComputeNormals();
        }

        const nbNodes = triangulation.NbNodes();
        const nbTriangles = triangulation.NbTriangles();
        const triangleStart = indices.length / 3;

        // Copy nodes (1-indexed in OCCT). Each Node()/Transformed() call
        // returns a fresh JS wrapper around a gp_Pnt — these accumulate
        // fast on solids with many faces if we don't release them on every
        // iteration.
        for (let i = 1; i <= nbNodes; i++) {
          const pnt = triangulation.Node(i);
          const transformed = pnt.Transformed(transformation);
          try {
            positions.push(transformed.X(), transformed.Y(), transformed.Z());

            const normalVec = new ocAny.gp_Vec3f_1();
            try {
              triangulation.Normal_2(i, normalVec);
              // gp_Vec3f getter methods are suffixed _1 in this build.
              let nx: number = normalVec.x_1();
              let ny: number = normalVec.y_1();
              let nz: number = normalVec.z_1();
              if (orientationReversed) {
                nx = -nx;
                ny = -ny;
                nz = -nz;
              }
              normals.push(nx, ny, nz);
            } finally {
              normalVec.delete();
            }
          } finally {
            transformed.delete();
            pnt.delete();
          }
        }

        // Copy triangles.
        for (let i = 1; i <= nbTriangles; i++) {
          const tri = triangulation.Triangle(i);
          try {
            const n1 = tri.Value(1);
            const n2 = tri.Value(2);
            const n3 = tri.Value(3);
            // OCCT uses 1-based indices, Three.js wants 0-based.
            if (orientationReversed) {
              indices.push(
                nodeOffset + n1 - 1,
                nodeOffset + n3 - 1,
                nodeOffset + n2 - 1,
              );
            } else {
              indices.push(
                nodeOffset + n1 - 1,
                nodeOffset + n2 - 1,
                nodeOffset + n3 - 1,
              );
            }
          } finally {
            tri.delete?.();
          }
        }

        faceRanges.push({ triangleStart, triangleCount: nbTriangles });
        nodeOffset += nbNodes;
      } finally {
        // Drop every OCCT-side wrapper this iteration owned. The
        // triangulation itself lives on the face's TShape and must NOT be
        // deleted here. Each delete is guarded individually so a failure on
        // one (e.g. transformation already gone in some builds) doesn't
        // skip the others.
        if (transformation) {
          try { transformation.delete?.(); } catch { /* tolerate */ }
        }
        if (triangulationHandle) {
          try { triangulationHandle.delete(); } catch { /* tolerate */ }
        }
        if (location) {
          try { location.delete(); } catch { /* tolerate */ }
        }
        if (face) {
          try { face.delete(); } catch { /* tolerate */ }
        }
        explorer.Next();
      }
    }
  } finally {
    explorer.delete();
    // Mesher holds intermediate state; release it to free WASM heap.
    try { mesher.delete?.(); } catch { /* tolerate */ }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    faceRanges,
  };
}
