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
  ChamferArgs,
  ExtrudeArgs,
  FilletArgs,
  HoleArgs,
  KernelInitResult,
  RevolveArgs,
  TessellatedMesh,
} from "./types";
import type { Feature, Sketch } from "@/state/schemas";
import { isCardinalPlane } from "@/sketch/plane";
import { tessellateShape } from "./operations/tessellate";
import { sketchToWire } from "./operations/sketchToWire";
import { extrude as extrudeWire } from "./operations/extrude";
import { revolve as revolveWire } from "./operations/revolve";
import {
  collectTransferables,
  disposeRefMap,
  enumerateEdgeRefs,
  enumerateFaceRefs,
  enumerateTopology,
} from "./operations/topology";
import { applyFillet } from "./operations/fillet";
import { applyChamfer } from "./operations/chamfer";
import { applyHole, type HoleFaceRef } from "./operations/hole";

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
 * Tessellate + enumerate topology for a TopoDS_Shape in one shot, returning a
 * fully-populated TessellatedMesh.
 *
 * Every per-face / per-edge typed array buffer is transferable; the caller
 * wraps the result in `Comlink.transfer` with `collectTransferables(mesh)`.
 */
function buildMesh(oc: OC, solid: unknown): TessellatedMesh {
  const tess = tessellateShape(oc, solid);
  const { edges, faces } = enumerateTopology(
    oc,
    solid,
    tess.positions,
    tess.indices,
    tess.faceRanges,
  );
  return {
    positions: tess.positions,
    normals: tess.normals,
    indices: tess.indices,
    edges,
    faces,
  };
}

/**
 * Wrap a tessellated mesh in a Comlink transfer envelope so the typed arrays
 * are moved (not copied) across the worker boundary.
 */
function transferMesh(mesh: TessellatedMesh): TessellatedMesh {
  return Comlink.transfer(mesh, collectTransferables(mesh));
}

/**
 * Build a single OCCT shape by re-executing a feature chain in order. Each
 * step's intermediate shape is freed after the next step consumes it. The
 * caller owns the returned shape and must `.delete()` it.
 *
 * Used by modifier features (fillet/chamfer/hole) whose worker call needs the
 * upstream geometry as a TopoDS_Shape, not just metadata. This deliberately
 * mirrors the ordering and per-feature dispatch of `featureRegen.runFeature`,
 * but stays inside the worker to avoid round-tripping shapes back to JS.
 */
function executeUpstreamChain(
  oc: OC,
  features: Feature[],
  sketches: Sketch[],
): unknown {
  const ocAny = oc as any;
  let current: any = null;

  for (const feat of features) {
    let nextShape: any = null;

    if (feat.type === "extrude" || feat.type === "revolve") {
      const sketch = sketches.find((s) => s.id === feat.sketchId);
      if (!sketch) {
        if (current) current.delete();
        throw new Error(`Sketch ${feat.sketchId} not found in upstream chain.`);
      }
      if (!isCardinalPlane(sketch.plane)) {
        if (current) current.delete();
        throw new Error("Upstream chain has a non-cardinal sketch plane.");
      }
      let wire: any = null;
      try {
        wire = sketchToWire(ocAny, sketch.plane, sketch.primitives);
        nextShape =
          feat.type === "extrude"
            ? extrudeWire(ocAny, wire, sketch.plane, feat.depthMm, feat.direction)
            : revolveWire(ocAny, wire, feat.axis, feat.angleDeg);
      } finally {
        if (wire) wire.delete();
      }
    } else if (feat.type === "fillet") {
      if (!current) throw new Error("Fillet has no upstream shape.");
      const refs = enumerateEdgeRefs(ocAny, current);
      try {
        nextShape = applyFillet(
          ocAny,
          current,
          refs,
          feat.targetEdges,
          feat.radiusMm,
        );
      } finally {
        disposeRefMap(refs);
      }
    } else if (feat.type === "chamfer") {
      if (!current) throw new Error("Chamfer has no upstream shape.");
      const refs = enumerateEdgeRefs(ocAny, current);
      try {
        nextShape = applyChamfer(
          ocAny,
          current,
          refs,
          feat.targetEdges,
          feat.sizeMm,
        );
      } finally {
        disposeRefMap(refs);
      }
    } else if (feat.type === "hole") {
      if (!current) throw new Error("Hole has no upstream shape.");
      // We need both the FaceMetadata (for plane basis + normal) and the
      // TopoDS_Face wrapper (for the cylinder math) of the same face id.
      const tess = tessellateShape(ocAny, current);
      const enumerated = enumerateTopology(
        ocAny,
        current,
        tess.positions,
        tess.indices,
        tess.faceRanges,
      );
      const meta = enumerated.faces.find((f) => f.id === feat.targetFace);
      if (!meta) {
        throw new Error(
          `face-not-found: face ${feat.targetFace} no longer exists.`,
        );
      }
      if (!meta.planeBasis) {
        throw new Error(
          "Hole target face must be planar (non-planar holes are not supported in v1).",
        );
      }
      const refs = enumerateFaceRefs(
        ocAny,
        current,
        tess.positions,
        tess.indices,
        tess.faceRanges,
      );
      try {
        const face = refs.get(feat.targetFace);
        if (!face) {
          throw new Error(
            `face-not-found: face ${feat.targetFace} no longer exists.`,
          );
        }
        const ref: HoleFaceRef = {
          face,
          origin: meta.planeBasis.origin,
          u: meta.planeBasis.u,
          v: meta.planeBasis.v,
          normal: meta.normalAtCentroid,
        };
        nextShape = applyHole(
          ocAny,
          current,
          ref,
          feat.positionUV,
          feat.diameterMm,
          feat.depthMm,
        );
      } finally {
        disposeRefMap(refs);
      }
    } else {
      throw new Error(`Unsupported upstream feature type: ${feat.type}`);
    }

    if (current) current.delete();
    current = nextShape;
  }

  if (!current) {
    throw new Error("Upstream feature chain produced no shape.");
  }
  return current;
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

    const mesh = buildMesh(ocInstance, shape);

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
      const mesh = buildMesh(oc, solid);
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
      const mesh = buildMesh(oc, solid);
      return transferMesh(mesh);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Revolve failed: ${String(err)}`);
    } finally {
      if (solid) solid.delete();
      if (wire) wire.delete();
    }
  },

  async fillet(args: FilletArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    let upstream: any = null;
    let edgeRefs: Map<string, unknown> | null = null;
    let result: any = null;
    try {
      upstream = executeUpstreamChain(
        oc,
        args.upstreamFeatures,
        args.upstreamSketches,
      );
      edgeRefs = enumerateEdgeRefs(oc, upstream);
      result = applyFillet(
        oc,
        upstream,
        edgeRefs,
        args.targetEdgeIds,
        args.radiusMm,
      );
      const mesh = buildMesh(oc, result);
      return transferMesh(mesh);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Fillet failed: ${String(err)}`);
    } finally {
      if (result) result.delete();
      if (edgeRefs) disposeRefMap(edgeRefs);
      if (upstream) upstream.delete();
    }
  },

  async chamfer(args: ChamferArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    let upstream: any = null;
    let edgeRefs: Map<string, unknown> | null = null;
    let result: any = null;
    try {
      upstream = executeUpstreamChain(
        oc,
        args.upstreamFeatures,
        args.upstreamSketches,
      );
      edgeRefs = enumerateEdgeRefs(oc, upstream);
      result = applyChamfer(
        oc,
        upstream,
        edgeRefs,
        args.targetEdgeIds,
        args.sizeMm,
      );
      const mesh = buildMesh(oc, result);
      return transferMesh(mesh);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Chamfer failed: ${String(err)}`);
    } finally {
      if (result) result.delete();
      if (edgeRefs) disposeRefMap(edgeRefs);
      if (upstream) upstream.delete();
    }
  },

  async hole(args: HoleArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    let upstream: any = null;
    let faceRefs: Map<string, unknown> | null = null;
    let result: any = null;
    try {
      upstream = executeUpstreamChain(
        oc,
        args.upstreamFeatures,
        args.upstreamSketches,
      );

      // Tessellate + enumerate topology so we can resolve the face id to its
      // FaceMetadata (plane basis + normal) AND its TopoDS_Face wrapper.
      const tess = tessellateShape(oc, upstream);
      const enumerated = enumerateTopology(
        oc,
        upstream,
        tess.positions,
        tess.indices,
        tess.faceRanges,
      );
      const meta = enumerated.faces.find((f) => f.id === args.targetFaceId);
      if (!meta) {
        throw new Error(
          `face-not-found: face ${args.targetFaceId} no longer exists.`,
        );
      }
      if (!meta.planeBasis) {
        throw new Error(
          "Hole target face must be planar (non-planar holes are not supported in v1).",
        );
      }

      faceRefs = enumerateFaceRefs(
        oc,
        upstream,
        tess.positions,
        tess.indices,
        tess.faceRanges,
      );
      const face = faceRefs.get(args.targetFaceId);
      if (!face) {
        throw new Error(
          `face-not-found: face ${args.targetFaceId} no longer exists.`,
        );
      }
      const ref: HoleFaceRef = {
        face,
        origin: meta.planeBasis.origin,
        u: meta.planeBasis.u,
        v: meta.planeBasis.v,
        normal: meta.normalAtCentroid,
      };

      result = applyHole(
        oc,
        upstream,
        ref,
        args.positionUV,
        args.diameterMm,
        args.depthMm,
      );
      const mesh = buildMesh(oc, result);
      return transferMesh(mesh);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Hole failed: ${String(err)}`);
    } finally {
      if (result) result.delete();
      if (faceRefs) disposeRefMap(faceRefs);
      if (upstream) upstream.delete();
    }
  },
};

Comlink.expose(api);
