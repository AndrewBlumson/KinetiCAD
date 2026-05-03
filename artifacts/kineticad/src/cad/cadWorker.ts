/// <reference lib="webworker" />
//
// CAD Web Worker: hosts OpenCascade.js and exposes a Comlink-typed API to the
// main thread. The kernel is heavy, so anything that touches B-rep geometry
// must run here.

import * as Comlink from "comlink";
// We bypass opencascade.js's index.js wrapper because it does a bare
// `import "./opencascade.full.wasm"` that Vite cannot pre-bundle. Instead we
// import the Emscripten factory directly and feed it a CDN-hosted WASM URL
// via locateFile.
//
// Phase 9.5 Follow-up #8 — load the 50 MB WASM blob from jsDelivr instead
// of bundling it. Replit's static-deploy pipeline returns 200 + empty body
// for assets above its size cap (~10 MB in practice), which manifested at
// runtime as `WebAssembly.instantiate(): BufferSource argument is empty`
// on the deployed `.replit.app` URL while dev kept working from
// `localhost`. jsDelivr serves the exact pinned package version with
// `application/wasm` content-type, permissive CORS, and a 1-year
// immutable cache, so streaming-instantiate works first try.
//
// The version literal MUST stay in lock-step with `opencascade.js` in
// `package.json` — there is a runtime check at `ensureKernel` that
// records this string as the kernel version.
import ocFactoryRaw from "opencascade.js/dist/opencascade.full.js";
import type { OpenCascadeInstance } from "opencascade.js";
import type {
  BooleanOpArgs,
  CadKernelApi,
  ChamferArgs,
  ExtrudeArgs,
  FilletArgs,
  HoleArgs,
  KernelInitResult,
  MassPropertiesArgs,
  MassPropertiesResult,
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
import { applyBoolean } from "./operations/boolean";
import { computeMassProperties } from "./operations/massProperties";

const OCCT_VERSION = "2.0.0-beta.94e2944";
const OCCT_WASM_URL = `https://cdn.jsdelivr.net/npm/opencascade.js@${OCCT_VERSION}/dist/opencascade.full.wasm`;

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
        path.endsWith(".wasm") ? OCCT_WASM_URL : path,
    });

    const initTimeMs = Math.round(performance.now() - start);

    // Self-test: build a 20mm square, extrude 10mm, tessellate. Logs the
    // triangle count + axis-aligned bounding box so QA can confirm the
    // kernel is fully operational at boot. Catches any regression in the
    // sketch→wire→prism→mesh pipeline immediately, without needing the
    // user to draw a sketch first. Failure is logged loudly but does not
    // throw — kernel init still succeeds so the UI doesn't deadlock.
    runSelfTest(ocInstance).catch((err) => {
      // Should never trigger (runSelfTest swallows its own errors), but
      // belt-and-braces.
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] self-test wrapper threw:", err);
    });

    return {
      initTimeMs,
      // Version metadata isn't directly exposed by opencascade.js. The
      // OCCT_VERSION constant above is the source of truth (it's also
      // baked into the CDN URL the kernel just loaded from).
      version: OCCT_VERSION,
    };
  })();

  return initPromise;
}

/**
 * Boot-time smoke test for the CAD pipeline. Builds a 20mm square sketch,
 * extrudes it 10mm forward, tessellates the result and logs the triangle
 * count + bounding box. Any failure is logged via console.error with the
 * raw error so QA can see exactly where the pipeline broke.
 *
 * Expected output: triCount = 12 (six faces × two triangles each), bbox
 * spanning roughly (-10,-10,0) → (10,10,10).
 */
async function runSelfTest(oc: OC): Promise<void> {
  const ocAny = oc as any;
  let wire: any = null;
  let solid: any = null;
  try {
    const primitives = [
      {
        type: "rectangle" as const,
        corner: [-10, -10] as [number, number],
        width: 20,
        height: 20,
      },
    ];
    wire = sketchToWire(ocAny, "XY", primitives);
    solid = extrudeWire(ocAny, wire, "XY", 10, "forward");
    const tess = tessellateShape(ocAny, solid);
    const triCount = tess.indices.length / 3;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    const pos = tess.positions;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    if (triCount === 0 || pos.length === 0) {
      const msg =
        `[SELF-TEST] FAILED: empty mesh (tris=${triCount}, positions=${pos.length}). ` +
        `Sketch→wire→prism→tessellate produced no geometry — extrude is broken.`;
      // eslint-disable-next-line no-console
      console.error(msg);
      // Bridge to the main thread so it's visible in the page DevTools
      // regardless of worker-console filter settings.
      try {
        (self as unknown as Worker).postMessage({
          type: "self-test",
          ok: false,
          message: msg,
        });
      } catch {
        // postMessage may not be available outside DedicatedWorkerScope.
      }
      return;
    }

    const okMsg =
      `[SELF-TEST] OK: tris=${triCount} ` +
      `bbox=[${minX.toFixed(2)}, ${minY.toFixed(2)}, ${minZ.toFixed(2)}] → ` +
      `[${maxX.toFixed(2)}, ${maxY.toFixed(2)}, ${maxZ.toFixed(2)}]`;
    // Use console.error (not console.info) so Chrome's default filter
    // ("Errors" only) still surfaces it without the user expanding the
    // "Info" level. Semantically not an error — the [SELF-TEST] prefix
    // makes the intent obvious and greppable.
    // eslint-disable-next-line no-console
    console.error(okMsg);
    try {
      (self as unknown as Worker).postMessage({
        type: "self-test",
        ok: true,
        message: okMsg,
      });
    } catch {
      // ignore
    }
  } catch (err) {
    const failMsg =
      err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[SELF-TEST] FAILED:", err);
    try {
      (self as unknown as Worker).postMessage({
        type: "self-test",
        ok: false,
        message: `[SELF-TEST] FAILED: ${failMsg}`,
      });
    } catch {
      // ignore
    }
  } finally {
    if (solid) {
      try {
        solid.delete();
      } catch {
        // ignore
      }
    }
    if (wire) {
      try {
        wire.delete();
      } catch {
        // ignore
      }
    }
  }
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
      throw new Error(
        `Unsupported upstream feature type: ${(feat as { type: string }).type}`,
      );
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
      // Always surface the raw error in the worker console so QA + dev tools
      // can see exactly what OCCT reported, regardless of how the inspector
      // chooses to render it.
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] extrude failed:", err);
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
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] revolve failed:", err);
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
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] fillet failed:", err);
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
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] chamfer failed:", err);
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
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] hole failed:", err);
      if (err instanceof Error) throw err;
      throw new Error(`Hole failed: ${String(err)}`);
    } finally {
      if (result) result.delete();
      if (faceRefs) disposeRefMap(faceRefs);
      if (upstream) upstream.delete();
    }
  },

  async booleanOp(args: BooleanOpArgs) {
    await ensureKernel();
    if (!ocInstance) throw new Error("CAD kernel failed to initialise");
    const oc = ocInstance;

    if (!Array.isArray(args.inputs) || args.inputs.length < 2) {
      throw new Error(
        `boolean-failed: need ≥2 inputs, got ${args.inputs?.length ?? 0}.`,
      );
    }
    if (args.operation.type === "subtract" && args.inputs.length !== 2) {
      throw new Error(
        `subtract-needs-tool: expected 2 inputs (body + tool), got ${args.inputs.length}.`,
      );
    }

    // Build every input shape from its upstream chain, then apply each
    // input's rigid-body transform via BRepBuilderAPI_Transform_2 BEFORE
    // running the boolean. We track base + transformed shapes separately
    // so the finally cleanup frees both regardless of which step throws.
    const baseShapes: any[] = [];
    const transformedShapes: any[] = [];
    let result: any = null;
    try {
      for (const input of args.inputs) {
        if (!input.features || input.features.length === 0) {
          throw new Error(
            `boolean-failed: input part ${input.partId} has no features.`,
          );
        }
        const base = executeUpstreamChain(oc, input.features, input.sketches);
        baseShapes.push(base);

        // Phase 6: apply the part's transform. Identity short-circuits
        // (saves an OCCT call per part on the common case).
        const tx = input.transform;
        const isIdentity =
          tx &&
          tx.positionMm[0] === 0 &&
          tx.positionMm[1] === 0 &&
          tx.positionMm[2] === 0 &&
          tx.rotationDeg[0] === 0 &&
          tx.rotationDeg[1] === 0 &&
          tx.rotationDeg[2] === 0;

        if (!tx || isIdentity) {
          transformedShapes.push(base);
          continue;
        }

        // Compose M = T · Rx · Ry · Rz so that, applied to a point p, the
        // result is T(Rx(Ry(Rz(p)))) — i.e. rotation first (Z then Y then
        // X) and translation last. This matches three.js's
        // mesh.matrixWorld with rotation order "XYZ" so the live mesh
        // position and the OCCT-baked geometry stay in lockstep.
        const trsf = new oc.gp_Trsf_1();
        const origin = new oc.gp_Pnt_3(0, 0, 0);
        const axisX = new oc.gp_Dir_4(1, 0, 0);
        const axisY = new oc.gp_Dir_4(0, 1, 0);
        const axisZ = new oc.gp_Dir_4(0, 0, 1);
        const ax1X = new oc.gp_Ax1_2(origin, axisX);
        const ax1Y = new oc.gp_Ax1_2(origin, axisY);
        const ax1Z = new oc.gp_Ax1_2(origin, axisZ);

        const trsfRotZ = new oc.gp_Trsf_1();
        trsfRotZ.SetRotation_1(ax1Z, (tx.rotationDeg[2] * Math.PI) / 180);
        const trsfRotY = new oc.gp_Trsf_1();
        trsfRotY.SetRotation_1(ax1Y, (tx.rotationDeg[1] * Math.PI) / 180);
        const trsfRotX = new oc.gp_Trsf_1();
        trsfRotX.SetRotation_1(ax1X, (tx.rotationDeg[0] * Math.PI) / 180);
        const trsfTrans = new oc.gp_Trsf_1();
        const transVec = new oc.gp_Vec_4(
          tx.positionMm[0],
          tx.positionMm[1],
          tx.positionMm[2],
        );
        trsfTrans.SetTranslation_1(transVec);

        // Multiply pre-multiplies: trsf becomes (other · trsf). Start with
        // Z (innermost), then Y, X, T to end up with M = T·Rx·Ry·Rz.
        trsf.Multiply(trsfRotZ);
        trsf.Multiply(trsfRotY);
        trsf.Multiply(trsfRotX);
        trsf.Multiply(trsfTrans);

        const transformer = new oc.BRepBuilderAPI_Transform_2(
          base as never,
          trsf,
          true,
        );
        const transformed = transformer.Shape();
        transformedShapes.push(transformed);

        // Free every gp_* and the transformer wrapper. The transformed
        // TopoDS_Shape is now independent.
        transformer.delete();
        transVec.delete();
        trsfTrans.delete();
        trsfRotX.delete();
        trsfRotY.delete();
        trsfRotZ.delete();
        ax1Z.delete();
        ax1Y.delete();
        ax1X.delete();
        axisZ.delete();
        axisY.delete();
        axisX.delete();
        origin.delete();
        trsf.delete();
      }

      // Worker trusts the orchestrator's ordering: for subtract the body
      // shape is at index 0 and the tool shape at index 1.
      result = applyBoolean(oc, transformedShapes, args.operation);
      const mesh = buildMesh(oc, result);
      return transferMesh(mesh);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] booleanOp failed:", err);
      if (err instanceof Error) throw err;
      throw new Error(`boolean-failed: ${String(err)}`);
    } finally {
      if (result) result.delete?.();
      for (let i = 0; i < transformedShapes.length; i++) {
        // Skip if transformed === base (identity short-circuit) — the
        // base loop below will handle it.
        if (transformedShapes[i] !== baseShapes[i]) {
          transformedShapes[i]?.delete?.();
        }
      }
      for (const s of baseShapes) {
        s?.delete?.();
      }
    }
  },

  async getMassProperties(
    args: MassPropertiesArgs,
  ): Promise<MassPropertiesResult> {
    await ensureKernel();
    if (!ocInstance) throw new Error("OC kernel not initialised.");
    const oc = ocInstance;

    // Build the part's tip shape from the upstream chain. Identical
    // pipeline to booleanOp's per-input regen, just without the
    // Transform application — Rapier owns the body pose.
    let tip: any = null;
    try {
      tip = executeUpstreamChain(oc, args.features, args.sketches);
      if (!tip) {
        // No features → empty part. Return a zero-volume fallback so
        // the physics layer can choose to skip the body.
        return {
          volumeMm3: 0,
          massKg: 1e-6,
          comLocal: [0, 0, 0],
          principalInertiaKgMm2: [1e-6, 1e-6, 1e-6],
        };
      }
      const props = computeMassProperties(oc, tip, args.density);
      if (!props) {
        return {
          volumeMm3: 0,
          massKg: 1e-6,
          comLocal: [0, 0, 0],
          principalInertiaKgMm2: [1e-6, 1e-6, 1e-6],
        };
      }
      return props;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CAD WORKER] getMassProperties failed:", err);
      if (err instanceof Error) throw err;
      throw new Error(`mass-properties-failed: ${String(err)}`);
    } finally {
      if (tip) {
        try {
          tip.delete?.();
        } catch {
          // ignore
        }
      }
    }
  },
};

Comlink.expose(api);
