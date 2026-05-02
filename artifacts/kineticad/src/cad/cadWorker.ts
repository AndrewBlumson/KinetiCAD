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
import type {
  CadKernelApi,
  ExtrudeArgs,
  KernelInitResult,
  RevolveArgs,
  TessellatedMesh,
} from "./types";
import { tessellateShape } from "./operations/tessellate";
import { sketchToWire } from "./operations/sketchToWire";
import { extrude as extrudeWire } from "./operations/extrude";
import { revolve as revolveWire } from "./operations/revolve";

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
 * Wrap a tessellated mesh in a Comlink transfer envelope so the typed arrays
 * are moved (not copied) across the worker boundary.
 */
function transferMesh(mesh: TessellatedMesh): TessellatedMesh {
  return Comlink.transfer(mesh, [
    mesh.positions.buffer,
    mesh.normals.buffer,
    mesh.indices.buffer,
  ]);
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

    return transferMesh(mesh);
  },

  async extrude(args: ExtrudeArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    let wire: any = null;
    let solid: any = null;
    try {
      wire = sketchToWire(oc, args.plane, args.sketchPrimitives);
      solid = extrudeWire(oc, wire, args.plane, args.depthMm, args.direction);
      const mesh = tessellateShape(oc, solid);
      return transferMesh(mesh);
    } catch (err) {
      // Re-throw with a clean message so the inspector can show it. Keep the
      // original message if it's already user-friendly, otherwise wrap.
      if (err instanceof Error) throw err;
      throw new Error(`Extrude failed: ${String(err)}`);
    } finally {
      if (solid) solid.delete();
      if (wire) wire.delete();
    }
  },

  async revolve(args: RevolveArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    let wire: any = null;
    let solid: any = null;
    try {
      wire = sketchToWire(oc, args.plane, args.sketchPrimitives);
      solid = revolveWire(oc, wire, args.axis, args.angleDeg);
      const mesh = tessellateShape(oc, solid);
      return transferMesh(mesh);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Revolve failed: ${String(err)}`);
    } finally {
      if (solid) solid.delete();
      if (wire) wire.delete();
    }
  },
};

Comlink.expose(api);
