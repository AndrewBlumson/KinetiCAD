// Phase 7 — Mate picker / validation helpers.
//
// Pure-logic module: no scene/renderer/store coupling. Mate inspectors call
// these helpers to (a) classify topology picks, (b) derive world-space
// pivots and rotation/sliding axes, and (c) run the per-type validation
// described in the Phase 7 spec:
//
//  - Revolute: both pivots resolve to circular geometry; axis derived from
//    the picked circle/arc edge polyline (face-pick on cylinder is out of
//    scope for v1 — users pick the silhouette edge instead).
//  - Prismatic: both pivots are planar faces; their normals must be
//    parallel within 5° (anti-parallel counts as parallel — same line).
//  - Planar: both pivots are planar faces (used as a co-planar
//    constraint).
//
// Geometry conventions match the rest of the modeller: millimetres,
// Z-up world frame, transforms = positionMm + XYZ-Euler rotationDeg.
// `localToWorld` / `worldToLocal` are split into point and direction
// flavours because mates store directions in the part-A local frame
// (`axisLocal`) but pivots' `localPoint` are points.

import type { Part, Transform } from "@/state/schemas";
import type { EdgeMetadata, FaceMetadata } from "@/cad/types";
import type { PartTopology } from "./PartMeshLayer";

export type Vec3 = [number, number, number];

const EPSILON = 1e-9;
const DEG = Math.PI / 180;

/* -------------------------------------------------------------------------- */
/*  Topology classifiers                                                      */
/* -------------------------------------------------------------------------- */

export function isCircularEdge(edge: EdgeMetadata): boolean {
  return edge.type === "circle" || edge.type === "arc";
}

/** Cylinder faces are the standard "circular face" for revolute mates. */
export function isCircularFace(face: FaceMetadata): boolean {
  return face.type === "cylinder";
}

export function isPlanarFace(face: FaceMetadata): boolean {
  return face.type === "plane";
}

/* -------------------------------------------------------------------------- */
/*  Vector / matrix helpers                                                   */
/* -------------------------------------------------------------------------- */

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vec3): Vec3 {
  const L = len(a);
  if (L < EPSILON) return [0, 0, 1];
  return [a[0] / L, a[1] / L, a[2] / L];
}

/**
 * Geometric centre of an edge's polyline: arithmetic mean of all sample
 * points.  For a full circle this is exact (the polyline is uniformly
 * distributed around the circumference, so the average is the centre).
 * For an arc the result is the centroid of the sample set — a good-enough
 * approximation for revolute pivot placement on the joint axis.
 *
 * Supersedes `edge.midpoint` for revolute pivots because `edge.midpoint`
 * falls back to a single arc-length midpoint vertex whenever topology.ts's
 * `circleCenter` branch was not triggered (e.g. when OCCT classifies a
 * cylinder seam edge as a non-full arc).
 */
function polylineCenter(poly: Float32Array): Vec3 {
  const n = Math.floor(poly.length / 3);
  if (n === 0) return [0, 0, 0];
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < n; i++) {
    sx += poly[i * 3];
    sy += poly[i * 3 + 1];
    sz += poly[i * 3 + 2];
  }
  return [sx / n, sy / n, sz / n];
}

/**
 * Build the 3×3 rotation matrix for an XYZ-Euler triple in degrees, applied
 * in XYZ order (matches three.js's default and the way `Part.transform`
 * is consumed elsewhere).
 */
function rotationMatrix(rotationDeg: Vec3): number[] {
  const [rx, ry, rz] = rotationDeg.map((d) => d * DEG);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  // Three.js Euler XYZ order: M = Rx * Ry * Rz.
  // Row-major 3×3.
  return [
    cy * cz,
    -cy * sz,
    sy,
    cx * sz + sx * sy * cz,
    cx * cz - sx * sy * sz,
    -sx * cy,
    sx * sz - cx * sy * cz,
    sx * cz + cx * sy * sz,
    cx * cy,
  ];
}

function mulMatVec(m: number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function transposeMat3(m: number[]): number[] {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/* -------------------------------------------------------------------------- */
/*  Local <-> World                                                           */
/* -------------------------------------------------------------------------- */

export function localToWorldPoint(p: Vec3, transform: Transform): Vec3 {
  const R = rotationMatrix(transform.rotationDeg);
  const rotated = mulMatVec(R, p);
  return add(rotated, transform.positionMm);
}

export function worldToLocalPoint(p: Vec3, transform: Transform): Vec3 {
  const R = rotationMatrix(transform.rotationDeg);
  const Rinv = transposeMat3(R);
  return mulMatVec(Rinv, sub(p, transform.positionMm));
}

export function localToWorldDir(d: Vec3, transform: Transform): Vec3 {
  const R = rotationMatrix(transform.rotationDeg);
  return normalize(mulMatVec(R, d));
}

export function worldToLocalDir(d: Vec3, transform: Transform): Vec3 {
  const R = rotationMatrix(transform.rotationDeg);
  const Rinv = transposeMat3(R);
  return normalize(mulMatVec(Rinv, d));
}

/* -------------------------------------------------------------------------- */
/*  Geometry derivations                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Centroid of a face in world coordinates. Uses the face's own centroid
 * (already in the part's local frame from the kernel) transformed by the
 * part's rigid-body transform.
 */
export function getFaceCentroidWorld(
  part: Part,
  faceId: string,
  topology: PartTopology,
): Vec3 | null {
  const face = topology.faces.find((f) => f.id === faceId);
  if (!face) return null;
  return localToWorldPoint(face.centroid, part.transform);
}

/**
 * Outward-pointing normal of a face in world coordinates. Defined for every
 * face type; the kernel guarantees `normalAtCentroid` is correctly oriented
 * with face orientation honoured.
 */
export function getFaceNormalWorld(
  part: Part,
  faceId: string,
  topology: PartTopology,
): Vec3 | null {
  const face = topology.faces.find((f) => f.id === faceId);
  if (!face) return null;
  return localToWorldDir(face.normalAtCentroid, part.transform);
}

/**
 * For a circular edge (full circle or arc), derive the rotation axis and
 * world-space centroid from the polyline samples returned by the kernel.
 *
 * Algorithm: pick three well-separated points on the polyline (start,
 * one-third, two-thirds), compute the plane normal via cross product, and
 * use the polyline's midpoint as the centroid. The kernel always returns
 * polylines with at least 3 samples for circles (~32) and proportional
 * samples for arcs (>=4).
 */
export function getEdgeAxisWorld(
  part: Part,
  edgeId: string,
  topology: PartTopology,
): { axis: Vec3; centroid: Vec3 } | null {
  const edge = topology.edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  if (!isCircularEdge(edge)) return null;
  const poly = edge.polyline;
  const pointCount = Math.floor(poly.length / 3);
  if (pointCount < 3) return null;
  const idx0 = 0;
  const idx1 = Math.floor(pointCount / 3);
  const idx2 = Math.floor((2 * pointCount) / 3);
  const p0: Vec3 = [poly[idx0 * 3], poly[idx0 * 3 + 1], poly[idx0 * 3 + 2]];
  const p1: Vec3 = [poly[idx1 * 3], poly[idx1 * 3 + 1], poly[idx1 * 3 + 2]];
  const p2: Vec3 = [poly[idx2 * 3], poly[idx2 * 3 + 1], poly[idx2 * 3 + 2]];
  const v01 = sub(p1, p0);
  const v02 = sub(p2, p0);
  const n = cross(v01, v02);
  if (len(n) < EPSILON) return null;
  // Polyline is already in local coords; transform to world.
  const axisLocal = normalize(n);
  const axis = localToWorldDir(axisLocal, part.transform);
  const centroid = localToWorldPoint(polylineCenter(edge.polyline), part.transform);
  return { axis, centroid };
}

/* -------------------------------------------------------------------------- */
/*  Angles                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Smallest angle between two unit vectors, in degrees, treating
 * anti-parallel as parallel (we care about the line, not the direction).
 * Returns a value in [0, 90].
 */
export function anglesBetween(a: Vec3, b: Vec3): number {
  const an = normalize(a);
  const bn = normalize(b);
  const c = Math.abs(dot(an, bn));
  // Clamp to [-1, 1] to avoid NaN from float drift.
  const clamped = Math.max(-1, Math.min(1, c));
  return Math.acos(clamped) / DEG;
}

/* -------------------------------------------------------------------------- */
/*  Validators                                                                */
/* -------------------------------------------------------------------------- */

export type RevoluteValidationOk = {
  ok: true;
  axisLocalA: Vec3;
  pivotLocalA: Vec3;
  pivotLocalB: Vec3;
};

export type RevoluteValidationErr = { ok: false; error: string };

/**
 * Revolute: both picks must be circular edges (the v1 picker constrains the
 * mode to 'edges'). Returns `axisLocal` in part-A's local frame plus both
 * pivots' local points so the caller can persist a `RevoluteMate`.
 *
 * The `axisLocal` derivation rotates the world-space axis (from the edge
 * polyline cross product) back into part-A's frame.
 */
export function validateRevolutePicks(args: {
  partA: Part;
  edgeA: EdgeMetadata;
  topologyA: PartTopology;
  partB: Part;
  edgeB: EdgeMetadata;
  topologyB: PartTopology;
}): RevoluteValidationOk | RevoluteValidationErr {
  const { partA, edgeA, topologyA, partB, edgeB, topologyB } = args;
  if (!isCircularEdge(edgeA) || !isCircularEdge(edgeB)) {
    return {
      ok: false,
      error: "Revolute requires circular geometry on both sides.",
    };
  }
  const a = getEdgeAxisWorld(partA, edgeA.id, topologyA);
  const b = getEdgeAxisWorld(partB, edgeB.id, topologyB);
  if (!a || !b) {
    return {
      ok: false,
      error: "Could not derive a rotation axis from the picked edges.",
    };
  }
  // Raw axis from edge A's polyline cross-product — may point either way.
  const axisLocalARaw = worldToLocalDir(a.axis, partA.transform);
  // Bring edge B's world-space normal into part A's local frame.
  // OCCT polyline winding gives opposite cross-product directions for a
  // top-face vs bottom-face circle on the same cylinder; reconcile the
  // sign so the stored axis always points consistently along the shared
  // rotation axis rather than depending on which face was picked first.
  const edgeBAxisLocalA = worldToLocalDir(b.axis, partA.transform);
  const axisLocalA: Vec3 =
    dot(axisLocalARaw, edgeBAxisLocalA) >= 0
      ? axisLocalARaw
      : [-axisLocalARaw[0], -axisLocalARaw[1], -axisLocalARaw[2]];
  return {
    ok: true,
    axisLocalA,
    pivotLocalA: polylineCenter(edgeA.polyline),
    pivotLocalB: polylineCenter(edgeB.polyline),
  };
}

export type PrismaticValidationOk = {
  ok: true;
  axisLocalA: Vec3;
  pivotLocalA: Vec3;
  pivotLocalB: Vec3;
};

export type PrismaticValidationErr = { ok: false; error: string };

/**
 * Prismatic: both faces must be planar AND their world-space normals must
 * be parallel within 5° (anti-parallel counts as parallel — same line).
 */
export function validatePrismaticPicks(args: {
  partA: Part;
  faceA: FaceMetadata;
  topologyA: PartTopology;
  partB: Part;
  faceB: FaceMetadata;
  topologyB: PartTopology;
}): PrismaticValidationOk | PrismaticValidationErr {
  const { partA, faceA, partB, faceB } = args;
  if (!isPlanarFace(faceA) || !isPlanarFace(faceB)) {
    return {
      ok: false,
      error: "Prismatic requires planar faces on both sides.",
    };
  }
  const nA = localToWorldDir(faceA.normalAtCentroid, partA.transform);
  const nB = localToWorldDir(faceB.normalAtCentroid, partB.transform);
  const angle = anglesBetween(nA, nB);
  if (angle > 5) {
    return {
      ok: false,
      error: `Faces are not parallel (${angle.toFixed(1)}° off; max 5°).`,
    };
  }
  // Slide axis = face-A normal, in part-A local frame.
  return {
    ok: true,
    axisLocalA: faceA.normalAtCentroid,
    pivotLocalA: faceA.centroid,
    pivotLocalB: faceB.centroid,
  };
}

export type PlanarValidationOk = {
  ok: true;
  faceIdA: string;
  faceIdB: string;
};

export type PlanarValidationErr = { ok: false; error: string };

/**
 * Planar: both faces must be planar. The mate stores bare {kind:'face',
 * faceId} pivots — the constraint operates over the whole face plane.
 */
export function validatePlanarPicks(args: {
  faceA: FaceMetadata;
  faceB: FaceMetadata;
}): PlanarValidationOk | PlanarValidationErr {
  const { faceA, faceB } = args;
  if (!isPlanarFace(faceA) || !isPlanarFace(faceB)) {
    return {
      ok: false,
      error: "Planar requires planar faces on both sides.",
    };
  }
  return { ok: true, faceIdA: faceA.id, faceIdB: faceB.id };
}
