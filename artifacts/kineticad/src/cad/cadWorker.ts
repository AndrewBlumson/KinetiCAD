/// <reference lib="webworker" />
//
// CAD Web Worker: hosts OpenCascade.js and exposes a Comlink-typed API to the
// main thread. The kernel is heavy, so anything that touches B-rep geometry
// must run here.

import * as Comlink from "comlink";
// We bypass opencascade.js's index.js wrapper because it does a bare
// `import "./opencascade.full.wasm"` that Vite cannot pre-bundle. Instead we
// import the Emscripten factory directly and feed it the Vite-resolved WASM
// URL via locateFile.
import ocFactoryRaw from "opencascade.js/dist/opencascade.full.js";
import ocWasmUrl from "opencascade.js/dist/opencascade.full.wasm?url";
import type { OpenCascadeInstance } from "opencascade.js";
import type { TessellatedMesh, KernelInitResult, CadKernelApi } from "./types";

type OC = OpenCascadeInstance;

type OcFactorySettings = {
  locateFile: (path: string) => string;
};
type OcFactory = new (settings: OcFactorySettings) => Promise<OC>;

const ocFactory = ocFactoryRaw as unknown as OcFactory;

let ocInstance: OC | null = null;
let initPromise: Promise<KernelInitResult> | null = null;

async function ensureKernel(): Promise<KernelInitResult> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const start = performance.now();

    // The factory returns a thenable that resolves to the OC instance once the
    // WASM module is fully initialised.
    ocInstance = await new ocFactory({
      locateFile: (path: string) =>
        path.endsWith(".wasm") ? ocWasmUrl : path,
    });

    const initTimeMs = Math.round(performance.now() - start);
    return {
      initTimeMs,
      // Version metadata isn't directly exposed by opencascade.js. The package
      // pin in package.json is the source of truth; we surface the npm tag.
      version: "2.0.0-beta.94e2944",
    };
  })();

  return initPromise;
}

/**
 * Tessellate the given TopoDS_Shape into flat Float32 / Uint32 arrays suitable
 * for direct upload to a Three.js BufferGeometry.
 *
 * Iterates each face, calls BRepMesh_IncrementalMesh, then walks each face's
 * Poly_Triangulation and copies nodes / triangles / normals into one merged
 * buffer.
 */
function tessellateShape(oc: OC, shape: any, linDeflection: number): TessellatedMesh {
  // Cast to any: opencascade.js's TS surface is large and uses opaque enum
  // types that aren't easy to satisfy without giving up. The runtime API is
  // stable.
  const ocAny = oc as any;

  // Run the meshing algorithm on the whole shape first.
  new ocAny.BRepMesh_IncrementalMesh_2(shape, linDeflection, false, 0.5, false);

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const explorer = new ocAny.TopExp_Explorer_2(
    shape,
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

    // Copy nodes (1-indexed in OCCT).
    for (let i = 1; i <= nbNodes; i++) {
      const pnt = triangulation.Node(i);
      const transformed = pnt.Transformed(transformation);
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

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

const api: CadKernelApi = {
  async init() {
    return ensureKernel();
  },

  async createTestCube(sizeMm: number) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");

    const oc = ocInstance as any;
    const half = sizeMm / 2;

    // Centre the cube on the origin so it sits nicely under the camera target.
    const corner1 = new oc.gp_Pnt_3(-half, -half, -half);
    const corner2 = new oc.gp_Pnt_3(half, half, half);
    const boxBuilder = new oc.BRepPrimAPI_MakeBox_4(corner1, corner2);
    const shape = boxBuilder.Shape();

    const mesh = tessellateShape(oc, shape, 0.1);

    // Release every transient OCCT wrapper we built. The shape is owned by the
    // builder, so deleting the builder reclaims its TShape; we still null out
    // our local ref. Order matters: shape first (cheap), then builder, then
    // the gp_Pnt corners.
    shape.delete();
    boxBuilder.delete();
    corner1.delete();
    corner2.delete();

    return Comlink.transfer(mesh, [
      mesh.positions.buffer,
      mesh.normals.buffer,
      mesh.indices.buffer,
    ]);
  },
};

Comlink.expose(api);
