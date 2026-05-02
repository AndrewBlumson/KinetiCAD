// Tessellate a TopoDS_Shape into flat Float32 / Uint32 arrays for direct
// upload to a Three.js BufferGeometry.
//
// Walks each face, runs BRepMesh_IncrementalMesh, then copies the
// Poly_Triangulation nodes / triangles / normals into one merged buffer.
// Honours the face's TopAbs_Orientation by flipping normals + winding for
// REVERSED faces so we always emit outward-facing triangles.

import type { TessellatedMesh } from "../types";

/** Default OCCT meshing parameters used across the app. */
export const DEFAULT_LINEAR_DEFLECTION_MM = 0.1;
export const DEFAULT_ANGULAR_DEFLECTION_RAD = 0.5;

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
): TessellatedMesh {
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

  const explorer = new ocAny.TopExp_Explorer_2(
    shapeAny,
    ocAny.TopAbs_ShapeEnum.TopAbs_FACE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  let nodeOffset = 0;

  while (explorer.More()) {
    const faceShape = explorer.Current();
    const face = ocAny.TopoDS.Face_1(faceShape);
    const location = new ocAny.TopLoc_Location_1();
    const triangulationHandle = ocAny.BRep_Tool.Triangulation(
      face,
      location,
      0, // Poly_MeshPurpose_NONE
    );

    if (triangulationHandle.IsNull()) {
      triangulationHandle.delete();
      face.delete();
      location.delete();
      explorer.Next();
      continue;
    }

    const triangulation = triangulationHandle.get();
    const transformation = location.Transformation();
    // Embind exposes enum values as singleton objects. Reference equality
    // works because oc.TopAbs_Orientation.TopAbs_REVERSED is the same object
    // returned by the shape.
    const orientationReversed =
      faceShape.Orientation_1() === ocAny.TopAbs_Orientation.TopAbs_REVERSED;

    // Ensure normals are present so we don't have to recompute later.
    if (!triangulation.HasNormals()) {
      triangulation.ComputeNormals();
    }

    const nbNodes = triangulation.NbNodes();
    const nbTriangles = triangulation.NbTriangles();

    // Copy nodes (1-indexed in OCCT). Each Node()/Transformed() call returns
    // a fresh JS wrapper around a gp_Pnt — these accumulate fast on solids
    // with many faces if we don't release them on every iteration.
    for (let i = 1; i <= nbNodes; i++) {
      const pnt = triangulation.Node(i);
      const transformed = pnt.Transformed(transformation);
      try {
        positions.push(transformed.X(), transformed.Y(), transformed.Z());

        const normalVec = new ocAny.gp_Vec3f_1();
        try {
          triangulation.Normal_2(i, normalVec);
          // gp_Vec3f getter methods are suffixed _1 in this build's bindings.
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
    }

    nodeOffset += nbNodes;
    // Drop OCCT-side wrappers we own. The triangulation itself lives on the
    // face's TShape and must NOT be deleted here.
    triangulationHandle.delete();
    face.delete();
    location.delete();
    explorer.Next();
  }

  explorer.delete();
  // Mesher holds intermediate state; release it to free WASM heap.
  mesher.delete?.();

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
