// Shared types between the CAD worker and main thread.
//
// All units are millimetres unless stated otherwise.

import type { Feature, Sketch, SketchPrimitive } from "@/state/schemas";
import type { CardinalPlane } from "@/sketch/plane";

/**
 * High-level edge geometry classifier. Drives picking heuristics, future
 * fillet/chamfer applicability, and downstream UI labels.
 *
 * 'arc' is a partial circle (parameter span < 2π); 'circle' is a full one.
 * 'spline' covers Bezier and BSpline. 'other' is the catch-all for ellipses,
 * hyperbolas, parabolas, and offset/composite curves.
 */
export type EdgeType = "line" | "circle" | "arc" | "spline" | "other";

/** High-level face geometry classifier. */
export type FaceType =
  | "plane"
  | "cylinder"
  | "cone"
  | "sphere"
  | "torus"
  | "other";

/**
 * Per-edge metadata returned by the kernel alongside the tessellated mesh.
 *
 * `id` is a stable hash derived from the edge's canonical geometry (line:
 * sorted endpoints; circle/arc: centre+radius+axis+angles; etc.) so that
 * picker selection survives parameter edits whenever the underlying geometry
 * is preserved.
 *
 * `polyline` is a flat xyz Float32Array (3 floats per point) sampled in
 * world space. Lines have 2 points; circles ~32; arcs proportional; splines
 * sampled uniformly along arc length. We deliberately store xyz triplets
 * rather than indices into `positions` so the highlight layer and screen-
 * space proximity raycast both consume the same buffer with no lookup.
 */
export type EdgeMetadata = {
  id: string;
  type: EdgeType;
  lengthMm: number;
  midpoint: [number, number, number];
  polyline: Float32Array;
};

/**
 * Per-face metadata returned by the kernel alongside the tessellated mesh.
 *
 * `triangles` is a list of triangle indices (k, where the triangle's three
 * vertex indices live at `indices[3k..3k+2]`) — used by the highlight layer
 * to build an overlay mesh, and inverted on the main thread into a
 * `faceForTriangle: Uint32Array` parallel to the triangle count for
 * O(1) raycast lookup.
 */
export type FaceMetadata = {
  id: string;
  type: FaceType;
  areaMm2: number;
  centroid: [number, number, number];
  /** Outward-pointing normal at the centroid; honours face orientation. */
  normalAtCentroid: [number, number, number];
  triangles: Uint32Array;
  /**
   * For planar faces only: 3D origin + two orthonormal basis vectors that
   * span the face plane. Used by `point-on-face` picking to compute UV.
   * `null` for non-planar faces (point-on-face on those is deferred).
   */
  planeBasis: {
    origin: [number, number, number];
    u: [number, number, number];
    v: [number, number, number];
  } | null;
};

export type TessellatedMesh = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  edges: EdgeMetadata[];
  faces: FaceMetadata[];
};

export type KernelInitResult = {
  initTimeMs: number;
  version: string;
};

export type ExtrudeArgs = {
  sketchPrimitives: SketchPrimitive[];
  plane: CardinalPlane;
  depthMm: number;
  direction: "forward" | "backward" | "symmetric";
};

export type RevolveArgs = {
  sketchPrimitives: SketchPrimitive[];
  plane: CardinalPlane;
  axis: "X" | "Y" | "Z";
  angleDeg: number;
};

/**
 * Modifier-feature args (fillet/chamfer/hole). The worker re-executes the
 * `upstreamFeatures` chain against `upstreamSketches` to rebuild the OCCT
 * shape, resolves the target edge/face IDs to live TopoDS wrappers, applies
 * the modification, and returns the tessellated result.
 *
 * Caching by feature hash on the main thread guarantees we don't pay this
 * cost on cache hits; on cache miss the worker pays a single re-execution.
 */
export type FilletArgs = {
  upstreamFeatures: Feature[];
  upstreamSketches: Sketch[];
  targetEdgeIds: string[];
  radiusMm: number;
};

export type ChamferArgs = {
  upstreamFeatures: Feature[];
  upstreamSketches: Sketch[];
  targetEdgeIds: string[];
  sizeMm: number;
};

export type HoleArgs = {
  upstreamFeatures: Feature[];
  upstreamSketches: Sketch[];
  targetFaceId: string;
  /** UV in mm along the face's planar basis (planar faces only in v1). */
  positionUV: [number, number];
  diameterMm: number;
  /** 0 = through-all (cylinder length = 2 × upstream bbox diagonal). */
  depthMm: number;
};

export type CadKernelApi = {
  init: () => Promise<KernelInitResult>;
  createTestCube: (sizeMm: number) => Promise<TessellatedMesh>;
  /**
   * Build a closed wire from the given sketch, extrude into a 3D solid, and
   * return its tessellated mesh. Throws (rejects) with a descriptive message
   * if the sketch is not closed, has gaps, or OCCT fails on the operation.
   */
  extrude: (args: ExtrudeArgs) => Promise<TessellatedMesh>;
  /**
   * Build a closed wire from the given sketch, revolve around the given world
   * axis through the origin, and return the tessellated solid mesh.
   */
  revolve: (args: RevolveArgs) => Promise<TessellatedMesh>;
  /**
   * Re-execute the upstream feature chain, apply a fillet to the named edges
   * with the given radius, tessellate, return mesh.
   */
  fillet: (args: FilletArgs) => Promise<TessellatedMesh>;
  /**
   * Re-execute the upstream feature chain, apply a chamfer to the named
   * edges with the given size, tessellate, return mesh.
   */
  chamfer: (args: ChamferArgs) => Promise<TessellatedMesh>;
  /**
   * Re-execute the upstream feature chain, drill a cylindrical hole at
   * (positionUV) on the target planar face, tessellate, return mesh.
   * `depthMm = 0` means through-all.
   */
  hole: (args: HoleArgs) => Promise<TessellatedMesh>;
};
