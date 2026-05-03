// Phase 4 Split A — Topology enumeration.
//
// Given a TopoDS_Shape that has already been tessellated, walk its faces and
// edges to build per-element metadata for the picker:
//   - Stable IDs hashed from canonical geometry, with a deterministic
//     occurrence-index tie-breaker so geometrically-coincident-but-distinct
//     entities (e.g. shared cylinder seam edges that appear twice in the
//     B-Rep) stay distinguishable. TopExp_Explorer iteration order is
//     deterministic for a given B-Rep, so the tie-breaker is reproducible.
//   - Type classification (line/circle/arc/spline/other; plane/cylinder/...).
//   - Geometric properties: edge length / midpoint, face area / centroid /
//     normal at centroid.
//   - Edge polylines sampled in world space directly via BRepAdaptor_Curve's
//     `D0(t, gp_Pnt)` evaluator — this avoids the bug where a manually-built
//     local frame (`cross(axis, seed)`) puts arcs in the wrong angular
//     sector relative to OCCT's intrinsic gp_Ax2 frame.
//   - Per-face triangle index lists (zipped with `faceRanges` from the
//     tessellator's deterministic face-walk order) — used to build the
//     translucent face overlay.
//   - Plane basis (origin + u/v) for planar faces — used by point-on-face UV.
//
// All transient OCCT wrappers are `.delete()`-d in finally blocks so the
// WASM heap doesn't grow on rapid regen.

import type {
  EdgeMetadata,
  EdgeType,
  FaceMetadata,
  FaceType,
  TessellatedMesh,
} from "../types";
import type { FaceTriangleRange } from "./tessellate";

// OCCT GeomAbs enums (the underlying values are stable across OCCT versions
// — see C++ enums GeomAbs_CurveType / GeomAbs_SurfaceType).
const GEOM_ABS_LINE = 0;
const GEOM_ABS_CIRCLE = 1;
const GEOM_ABS_BEZIER_CURVE = 5;
const GEOM_ABS_BSPLINE_CURVE = 6;
const GEOM_ABS_PLANE = 0;
const GEOM_ABS_CYLINDER = 1;
const GEOM_ABS_CONE = 2;
const GEOM_ABS_SPHERE = 3;
const GEOM_ABS_TORUS = 4;

/**
 * Coerce an OCCT `GetType()` return into a plain integer.
 *
 * opencascade.js (and most embind-based OCCT bindings) expose enums as
 * value-object instances: `BRepAdaptor_Curve.GetType()` returns something
 * shaped like `{ value: 1 }` for `GeomAbs_Circle`, NOT the integer `1`. A
 * naive `curveType === 1` strict-equality check is therefore always false
 * for every edge, and every classification falls through to the `"other"`
 * fallback branch — the exact symptom QA reproduced
 * (`typeHistogram: { other: 12 }` on a two-cylinder scene where 8 of 12
 * edges should be `circle` and 4 should be `line`).
 *
 * This helper accepts:
 *   - a raw number (older bindings or hand-rolled wrappers)
 *   - an embind enum value with `.value: number`
 *   - an object whose `valueOf()` returns a number
 * and returns `-1` for anything else, which trivially fails every dispatch
 * branch and routes to `"other"` — same fail-safe behaviour as before, but
 * now only when the type is genuinely unrecognised.
 */
function enumVal(x: unknown): number {
  if (typeof x === "number") return x;
  if (x && typeof x === "object") {
    const v = (x as { value?: unknown }).value;
    if (typeof v === "number") return v;
    const vo = (x as { valueOf?: () => unknown }).valueOf?.();
    if (typeof vo === "number" && vo !== (x as unknown)) return vo;
  }
  return -1;
}

const FULL_CIRCLE_TOL = 1e-3;

/** Sample counts when expanding curves into polylines for highlighting. */
const SAMPLES_FULL_CIRCLE = 32;
const SAMPLES_OTHER = 16;

/** Coordinate rounding used by the canonical-geometry hash. */
const HASH_PRECISION = 1000; // 0.001 mm / 0.001 rad

// ─── Hash helpers ────────────────────────────────────────────────────────────

/** FNV-1a 32-bit → 8-char hex. Matches `featureRegen.ts`'s implementation. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function r(n: number): number {
  // Round to HASH_PRECISION and normalize -0 to 0 so the string form is
  // identical regardless of float sign of zero.
  const v = Math.round(n * HASH_PRECISION) / HASH_PRECISION;
  return v === 0 ? 0 : v;
}

function rTriple(p: readonly [number, number, number]): string {
  return `${r(p[0])},${r(p[1])},${r(p[2])}`;
}

/**
 * Force a direction vector into a canonical orientation: the first
 * non-near-zero component is positive. This makes "the same axis" hash to
 * the same string regardless of which way OCCT happened to express it for a
 * given face/edge.
 */
function canonicalDir(d: readonly [number, number, number]): [number, number, number] {
  const eps = 1e-9;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) > eps) {
      if (d[i] < 0) return [-d[0], -d[1], -d[2]];
      return [d[0], d[1], d[2]];
    }
  }
  return [d[0], d[1], d[2]];
}

// ─── Tiny gp_Pnt / gp_Dir extractor helpers ─────────────────────────────────

function pntXYZ(p: any): [number, number, number] {
  return [p.X(), p.Y(), p.Z()];
}

function dirXYZ(d: any): [number, number, number] {
  return [d.X(), d.Y(), d.Z()];
}

/**
 * Run `f` with the OCCT wrapper produced by `make`, then `.delete()` it.
 * Equivalent to a small `using` block, but compatible with the embind
 * wrappers which don't implement Symbol.dispose.
 */
function withWrapper<T, W extends { delete: () => void }>(
  make: () => W,
  f: (w: W) => T,
): T {
  const w = make();
  try {
    return f(w);
  } finally {
    try {
      w.delete();
    } catch {
      /* tolerate double-delete on certain singleton enums */
    }
  }
}

// ─── Edge enumeration ───────────────────────────────────────────────────────

type CurveInfo = {
  type: EdgeType;
  /**
   * Polyline sampled from the curve via `BRepAdaptor_Curve.D0`. xyz triplets
   * in world space (the adaptor uses the edge's location).
   */
  polyline: Float32Array;
  /** Hash material derived from the curve's *intrinsic* geometry. */
  hashSig: string;
  /**
   * For circle / arc edges only: the true geometric centre of the circle in
   * the part's local frame (from `gp_Circ.Location()`). Used as the edge's
   * `midpoint` so that revolute mate pivots land at the circle centre rather
   * than at an arbitrary point on the circumference.
   */
  circleCenter?: [number, number, number];
};

function classifyAndExtractCurve(
  ocAny: any,
  curveTypeRaw: unknown,
  startParam: number,
  endParam: number,
  adaptor: any,
): CurveInfo {
  // Coerce the embind enum return into an integer; see enumVal docstring.
  const curveType = enumVal(curveTypeRaw);
  // Line: hash on sorted endpoints (so direction doesn't matter).
  if (curveType === GEOM_ABS_LINE) {
    return withWrapper(
      () => new ocAny.gp_Pnt_3(0, 0, 0),
      (p0) =>
        withWrapper(
          () => new ocAny.gp_Pnt_3(0, 0, 0),
          (p1) => {
            adaptor.D0(startParam, p0);
            adaptor.D0(endParam, p1);
            const start = pntXYZ(p0);
            const end = pntXYZ(p1);
            const a = rTriple(start);
            const b = rTriple(end);
            const [first, second] = a <= b ? [a, b] : [b, a];
            return {
              type: "line" as EdgeType,
              polyline: new Float32Array([
                start[0], start[1], start[2],
                end[0], end[1], end[2],
              ]),
              hashSig: `line|${first}|${second}`,
            };
          },
        ),
    );
  }

  // Circle (full or partial). Get geometric params via gp_Circ for the hash,
  // then sample the polyline through the adaptor (so we get the *actual*
  // OCCT frame, not a recomputed one).
  if (curveType === GEOM_ABS_CIRCLE) {
    let centre: [number, number, number] = [0, 0, 0];
    let axisDirArr: [number, number, number] = [0, 0, 1];
    let radius = 0;
    withWrapper(
      () => adaptor.Circle(),
      (circ) => {
        radius = circ.Radius();
        withWrapper(
          () => circ.Location(),
          (centrePnt) => {
            centre = pntXYZ(centrePnt);
          },
        );
        withWrapper(
          () => circ.Axis(),
          (axis1) => {
            withWrapper(
              () => axis1.Direction(),
              (axisDir) => {
                axisDirArr = dirXYZ(axisDir);
              },
            );
          },
        );
      },
    );
    const span = Math.abs(endParam - startParam);
    const full = Math.abs(span - 2 * Math.PI) < FULL_CIRCLE_TOL;
    const segments = full
      ? SAMPLES_FULL_CIRCLE
      : Math.max(
          8,
          Math.ceil((SAMPLES_FULL_CIRCLE * span) / (2 * Math.PI)),
        );
    const polyline = sampleCurveUniform(
      ocAny,
      adaptor,
      startParam,
      endParam,
      segments,
    );
    const ax = rTriple(canonicalDir(axisDirArr));
    const cen = rTriple(centre);
    const rd = r(radius);
    const hashSig = full
      ? `circle|${cen}|${rd}|${ax}`
      : (() => {
          const [s, e] =
            startParam <= endParam
              ? [startParam, endParam]
              : [endParam, startParam];
          return `arc|${cen}|${rd}|${ax}|${r(s)}|${r(e)}`;
        })();
    // For full circles: compute the centre from the polyline average rather
    // than from gp_Circ.Location(). gp_Circ.Location() returns the centre in
    // the circle's intrinsic geometric frame and does NOT include the edge's
    // accumulated TopLoc_Location from its parent shapes — so it reads (0,0,0)
    // for a top-face circle at z=60 even though D0 correctly places the
    // polyline samples at z=60. Averaging the first `segments` non-duplicate
    // points (sampleCurveUniform emits segments+1 points, with the last
    // duplicating the first for a closed circle) is exact for a circle and
    // inherits the correct placement from the adaptor's D0 evaluations.
    let circleCenter: [number, number, number] | undefined;
    if (full) {
      let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < segments; i++) {
        sx += polyline[3 * i];
        sy += polyline[3 * i + 1];
        sz += polyline[3 * i + 2];
      }
      circleCenter = [sx / segments, sy / segments, sz / segments];
    }
    return {
      type: full ? "circle" : "arc",
      polyline,
      hashSig,
      circleCenter,
    };
  }

  // BSpline / Bezier / other: emit a uniform parametric sample and hash by
  // sample points (canonical because the parameter space is fixed).
  const isSpline =
    curveType === GEOM_ABS_BEZIER_CURVE ||
    curveType === GEOM_ABS_BSPLINE_CURVE;
  const polyline = sampleCurveUniform(
    ocAny,
    adaptor,
    startParam,
    endParam,
    SAMPLES_OTHER,
  );
  let s = isSpline ? "spline|" : "other|";
  for (let i = 0; i < polyline.length; i++) s += `${r(polyline[i])},`;
  return {
    type: isSpline ? "spline" : "other",
    polyline,
    hashSig: s,
  };
}

/**
 * Sample N+1 evenly-spaced parameters between [t0, t1] and write xyz into a
 * Float32Array (3*(N+1) floats). Used for every curve type — uses the
 * adaptor's own evaluator so we always hit the curve in OCCT's actual frame.
 */
function sampleCurveUniform(
  ocAny: any,
  adaptor: any,
  t0: number,
  t1: number,
  segments: number,
): Float32Array {
  const out = new Float32Array(3 * (segments + 1));
  const p = new ocAny.gp_Pnt_3(0, 0, 0);
  try {
    for (let i = 0; i <= segments; i++) {
      const t = t0 + ((t1 - t0) * i) / segments;
      adaptor.D0(t, p);
      out[3 * i] = p.X();
      out[3 * i + 1] = p.Y();
      out[3 * i + 2] = p.Z();
    }
  } finally {
    p.delete();
  }
  return out;
}

function midpointFromPolyline(poly: Float32Array): [number, number, number] {
  // Pick the point at the polyline's midpoint of cumulative length. For a
  // simple highlight midpoint this is plenty.
  if (poly.length < 6) return [poly[0] || 0, poly[1] || 0, poly[2] || 0];
  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < poly.length / 3 - 1; i++) {
    const dx = poly[3 * (i + 1)] - poly[3 * i];
    const dy = poly[3 * (i + 1) + 1] - poly[3 * i + 1];
    const dz = poly[3 * (i + 1) + 2] - poly[3 * i + 2];
    const l = Math.hypot(dx, dy, dz);
    lens.push(l);
    total += l;
  }
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= half) {
      const t = lens[i] === 0 ? 0 : (half - acc) / lens[i];
      return [
        poly[3 * i] + t * (poly[3 * (i + 1)] - poly[3 * i]),
        poly[3 * i + 1] + t * (poly[3 * (i + 1) + 1] - poly[3 * i + 1]),
        poly[3 * i + 2] + t * (poly[3 * (i + 1) + 2] - poly[3 * i + 2]),
      ];
    }
    acc += lens[i];
  }
  // Fallback: last point.
  const last = poly.length / 3 - 1;
  return [poly[3 * last], poly[3 * last + 1], poly[3 * last + 2]];
}

function lengthFromPolyline(poly: Float32Array): number {
  let total = 0;
  for (let i = 0; i < poly.length / 3 - 1; i++) {
    const dx = poly[3 * (i + 1)] - poly[3 * i];
    const dy = poly[3 * (i + 1) + 1] - poly[3 * i + 1];
    const dz = poly[3 * (i + 1) + 2] - poly[3 * i + 2];
    total += Math.hypot(dx, dy, dz);
  }
  return total;
}

/**
 * Append a per-bucket occurrence index to the base hash to disambiguate
 * geometrically-coincident-but-topologically-distinct entities (e.g. a seam
 * edge that the explorer reports twice). Order is deterministic across
 * regenerations because TopExp_Explorer iterates in B-Rep order.
 */
function disambiguateId(
  baseHash: string,
  occurrenceCounts: Map<string, number>,
): string {
  const idx = occurrenceCounts.get(baseHash) ?? 0;
  occurrenceCounts.set(baseHash, idx + 1);
  return idx === 0 ? baseHash : `${baseHash}:${idx}`;
}

export function enumerateEdges(oc: unknown, shape: unknown): EdgeMetadata[] {
  const ocAny = oc as any;
  const out: EdgeMetadata[] = [];
  const occurrenceCounts = new Map<string, number>();

  const explorer = new ocAny.TopExp_Explorer_2(
    shape as any,
    ocAny.TopAbs_ShapeEnum.TopAbs_EDGE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  try {
    while (explorer.More()) {
      const edgeShape = explorer.Current();
      let edge: any = null;
      let adaptor: any = null;
      try {
        edge = ocAny.TopoDS.Edge_1(edgeShape);
        adaptor = new ocAny.BRepAdaptor_Curve_2(edge);
        const curveType = adaptor.GetType();
        const t0 = adaptor.FirstParameter();
        const t1 = adaptor.LastParameter();
        const curveInfo = classifyAndExtractCurve(
          ocAny,
          curveType,
          t0,
          t1,
          adaptor,
        );
        const baseHash = fnv1a(curveInfo.hashSig);
        const id = disambiguateId(baseHash, occurrenceCounts);
        const lengthMm = lengthFromPolyline(curveInfo.polyline);
        // For circle / arc edges use the true geometric centre (from gp_Circ)
        // rather than the arc midpoint so that revolute mate pivots land at
        // the circle's axis rather than at a random point on the rim.
        const midpoint: [number, number, number] =
          curveInfo.circleCenter ?? midpointFromPolyline(curveInfo.polyline);
        if (curveInfo.circleCenter) {
          // eslint-disable-next-line no-console
          console.log("[topology-circle]", {
            edgeHash: baseHash,
            edgeId: id,
            edgeType: curveInfo.type,
            circleCenter: curveInfo.circleCenter,
            midpoint,
            matched: "circleCenter used as midpoint",
          });
        }
        out.push({
          id,
          type: curveInfo.type,
          lengthMm,
          midpoint,
          polyline: curveInfo.polyline,
        });
      } catch {
        // Skip pathological edges (degenerate, no curve, etc.). Adding them
        // would only confuse the picker.
      } finally {
        if (adaptor) adaptor.delete?.();
        if (edge) edge.delete?.();
        explorer.Next();
      }
    }
  } finally {
    explorer.delete();
  }

  return out;
}

// ─── Face enumeration ───────────────────────────────────────────────────────

type SurfaceInfo = {
  type: FaceType;
  planeBasis: FaceMetadata["planeBasis"];
  /** Extra hash material per face type (canonicalized). */
  hashSig: string;
};

function classifyAndExtractSurface(ocAny: any, face: any): SurfaceInfo {
  const adaptor = new ocAny.BRepAdaptor_Surface_2(face, true);
  try {
    // Same embind-enum coercion as for curves; see enumVal docstring.
    const surfType = enumVal(adaptor.GetType());

    if (surfType === GEOM_ABS_PLANE) {
      let origin: [number, number, number] = [0, 0, 0];
      let u: [number, number, number] = [1, 0, 0];
      let v: [number, number, number] = [0, 1, 0];
      let n: [number, number, number] = [0, 0, 1];
      withWrapper(
        () => adaptor.Plane(),
        (pln) => {
          withWrapper(
            () => pln.Position(),
            (ax3) => {
              withWrapper(
                () => ax3.Location(),
                (loc) => {
                  origin = pntXYZ(loc);
                },
              );
              withWrapper(
                () => ax3.XDirection(),
                (xd) => {
                  u = dirXYZ(xd);
                },
              );
              withWrapper(
                () => ax3.YDirection(),
                (yd) => {
                  v = dirXYZ(yd);
                },
              );
              withWrapper(
                () => ax3.Direction(),
                (zd) => {
                  n = dirXYZ(zd);
                },
              );
            },
          );
        },
      );
      const hashSig = `${rTriple(canonicalDir(n))}|${rTriple(origin)}`;
      return { type: "plane", planeBasis: { origin, u, v }, hashSig };
    }

    if (surfType === GEOM_ABS_CYLINDER) {
      let origin: [number, number, number] = [0, 0, 0];
      let dir: [number, number, number] = [0, 0, 1];
      let radius = 0;
      withWrapper(
        () => adaptor.Cylinder(),
        (cyl) => {
          radius = cyl.Radius();
          withWrapper(
            () => cyl.Axis(),
            (ax1) => {
              withWrapper(
                () => ax1.Location(),
                (loc) => (origin = pntXYZ(loc)),
              );
              withWrapper(
                () => ax1.Direction(),
                (d) => (dir = canonicalDir(dirXYZ(d))),
              );
            },
          );
        },
      );
      return {
        type: "cylinder",
        planeBasis: null,
        hashSig: `${rTriple(origin)}|${rTriple(dir)}|${r(radius)}`,
      };
    }

    if (surfType === GEOM_ABS_CONE) {
      let origin: [number, number, number] = [0, 0, 0];
      let dir: [number, number, number] = [0, 0, 1];
      let radius = 0;
      let semi = 0;
      withWrapper(
        () => adaptor.Cone(),
        (cone) => {
          radius = cone.RefRadius();
          semi = cone.SemiAngle();
          withWrapper(
            () => cone.Axis(),
            (ax1) => {
              withWrapper(
                () => ax1.Location(),
                (loc) => (origin = pntXYZ(loc)),
              );
              withWrapper(
                () => ax1.Direction(),
                (d) => (dir = canonicalDir(dirXYZ(d))),
              );
            },
          );
        },
      );
      return {
        type: "cone",
        planeBasis: null,
        hashSig: `${rTriple(origin)}|${rTriple(dir)}|${r(radius)}|${r(semi)}`,
      };
    }

    if (surfType === GEOM_ABS_SPHERE) {
      let centre: [number, number, number] = [0, 0, 0];
      let radius = 0;
      withWrapper(
        () => adaptor.Sphere(),
        (sph) => {
          radius = sph.Radius();
          withWrapper(
            () => sph.Location(),
            (loc) => (centre = pntXYZ(loc)),
          );
        },
      );
      return {
        type: "sphere",
        planeBasis: null,
        hashSig: `${rTriple(centre)}|${r(radius)}`,
      };
    }

    if (surfType === GEOM_ABS_TORUS) {
      let origin: [number, number, number] = [0, 0, 0];
      let dir: [number, number, number] = [0, 0, 1];
      let major = 0;
      let minor = 0;
      withWrapper(
        () => adaptor.Torus(),
        (tor) => {
          major = tor.MajorRadius();
          minor = tor.MinorRadius();
          withWrapper(
            () => tor.Axis(),
            (ax1) => {
              withWrapper(
                () => ax1.Location(),
                (loc) => (origin = pntXYZ(loc)),
              );
              withWrapper(
                () => ax1.Direction(),
                (d) => (dir = canonicalDir(dirXYZ(d))),
              );
            },
          );
        },
      );
      return {
        type: "torus",
        planeBasis: null,
        hashSig: `${rTriple(origin)}|${rTriple(dir)}|${r(major)}|${r(minor)}`,
      };
    }

    return {
      type: "other",
      planeBasis: null,
      hashSig: `surf${surfType}`,
    };
  } finally {
    adaptor.delete?.();
  }
}

/**
 * Compute area-weighted centroid + normal for a face's triangle range, using
 * the merged tessellation arrays. The mesh winding has already been
 * orientation-corrected by `tessellate.ts` so the resulting normal points
 * outward without further adjustment.
 */
function centroidAndNormalFromTriangles(
  positions: Float32Array,
  indices: Uint32Array,
  range: FaceTriangleRange,
): {
  centroid: [number, number, number];
  normal: [number, number, number];
  areaMm2: number;
} {
  let cx = 0, cy = 0, cz = 0;
  let nx = 0, ny = 0, nz = 0;
  let totalArea = 0;
  for (let k = 0; k < range.triangleCount; k++) {
    const t = range.triangleStart + k;
    const i0 = indices[3 * t];
    const i1 = indices[3 * t + 1];
    const i2 = indices[3 * t + 2];
    const ax = positions[3 * i0], ay = positions[3 * i0 + 1], az = positions[3 * i0 + 2];
    const bx = positions[3 * i1], by = positions[3 * i1 + 1], bz = positions[3 * i1 + 2];
    const dx = positions[3 * i2], dy = positions[3 * i2 + 1], dz = positions[3 * i2 + 2];
    const ex = bx - ax, ey = by - ay, ez = bz - az;
    const fx = dx - ax, fy = dy - ay, fz = dz - az;
    const cxn = ey * fz - ez * fy;
    const cyn = ez * fx - ex * fz;
    const czn = ex * fy - ey * fx;
    const triArea = 0.5 * Math.hypot(cxn, cyn, czn);
    if (triArea <= 0) continue;
    // Triangle centroid contribution, weighted by area.
    const tcx = (ax + bx + dx) / 3;
    const tcy = (ay + by + dy) / 3;
    const tcz = (az + bz + dz) / 3;
    cx += tcx * triArea;
    cy += tcy * triArea;
    cz += tcz * triArea;
    // Sum un-normalized cross products (weighted by 2*triArea) for normal.
    nx += cxn;
    ny += cyn;
    nz += czn;
    totalArea += triArea;
  }
  if (totalArea === 0) {
    return {
      centroid: [0, 0, 0],
      normal: [0, 0, 1],
      areaMm2: 0,
    };
  }
  const nlen = Math.hypot(nx, ny, nz);
  return {
    centroid: [cx / totalArea, cy / totalArea, cz / totalArea],
    normal:
      nlen > 0 ? [nx / nlen, ny / nlen, nz / nlen] : [0, 0, 1],
    areaMm2: totalArea,
  };
}

/**
 * Walk the shape's faces in TopExp_Explorer order, zipping each face's
 * metadata with the corresponding entry in `faceRanges` (which the
 * tessellator emitted in the same order).
 */
export function enumerateFaces(
  oc: unknown,
  shape: unknown,
  positions: Float32Array,
  indices: Uint32Array,
  faceRanges: FaceTriangleRange[],
): FaceMetadata[] {
  const ocAny = oc as any;
  const out: FaceMetadata[] = [];
  const occurrenceCounts = new Map<string, number>();

  const explorer = new ocAny.TopExp_Explorer_2(
    shape as any,
    ocAny.TopAbs_ShapeEnum.TopAbs_FACE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  let idx = 0;
  try {
    while (explorer.More()) {
      const faceShape = explorer.Current();
      let face: any = null;
      try {
        face = ocAny.TopoDS.Face_1(faceShape);
        const surf = classifyAndExtractSurface(ocAny, face);
        const range = faceRanges[idx];
        if (!range || range.triangleCount === 0) {
          // No triangles for this face — skip but consume an index.
          continue;
        }
        const triangles = new Uint32Array(range.triangleCount);
        for (let i = 0; i < range.triangleCount; i++) {
          triangles[i] = range.triangleStart + i;
        }
        const { centroid, normal, areaMm2 } = centroidAndNormalFromTriangles(
          positions,
          indices,
          range,
        );
        // Hash by intrinsic surface params + canonical centroid; the latter
        // distinguishes geometrically distinct faces sharing a surface (e.g.
        // top vs bottom face of a cylinder share the same plane normal).
        const baseHash = fnv1a(
          `${surf.type}|${surf.hashSig}|${rTriple(centroid)}`,
        );
        const id = disambiguateId(baseHash, occurrenceCounts);
        out.push({
          id,
          type: surf.type,
          areaMm2,
          centroid,
          normalAtCentroid: normal,
          triangles,
          planeBasis: surf.planeBasis,
        });
      } catch {
        // Skip faces that fail classification.
      } finally {
        if (face) face.delete?.();
        explorer.Next();
        idx++;
      }
    }
  } finally {
    explorer.delete();
  }

  return out;
}

/**
 * Convenience: enumerate both edges and faces in one call. Returns objects
 * suitable to slot directly into a TessellatedMesh.
 */
export function enumerateTopology(
  oc: unknown,
  shape: unknown,
  positions: Float32Array,
  indices: Uint32Array,
  faceRanges: FaceTriangleRange[],
): { edges: EdgeMetadata[]; faces: FaceMetadata[] } {
  const faces = enumerateFaces(oc, shape, positions, indices, faceRanges);
  const edges = enumerateEdges(oc, shape);
  return { edges, faces };
}

/** Collect every transferable buffer from a TessellatedMesh — used by the
 *  worker's `Comlink.transfer` envelope. */
export function collectTransferables(mesh: TessellatedMesh): Transferable[] {
  const buffers: Transferable[] = [
    mesh.positions.buffer,
    mesh.normals.buffer,
    mesh.indices.buffer,
  ];
  for (const e of mesh.edges) buffers.push(e.polyline.buffer);
  for (const f of mesh.faces) buffers.push(f.triangles.buffer);
  return buffers;
}

// ─── Refs enumeration (Phase 4 Split B) ─────────────────────────────────────
//
// `enumerateEdgeRefs` / `enumerateFaceRefs` walk the same TopExp_Explorer
// traversal in the same order as the metadata enumerators above, computing
// the same canonical-geometry hashes + occurrence-index disambiguation. But
// instead of producing display metadata, they return a Map<id, TopoDS_*>
// holding the live OCCT wrappers — used by fillet/chamfer/hole to resolve a
// stable picker ID back to an OCCT entity.
//
// CONTRACT: the caller MUST `disposeRefMap()` the returned map (even on
// throw) so the WASM heap doesn't leak.

/**
 * Enumerate edges, returning a map from canonical edge id → live TopoDS_Edge
 * wrapper. Caller owns the wrappers and must dispose them via
 * `disposeRefMap`.
 */
export function enumerateEdgeRefs(
  oc: unknown,
  shape: unknown,
): Map<string, unknown> {
  const ocAny = oc as any;
  const out = new Map<string, unknown>();
  const occurrenceCounts = new Map<string, number>();

  const explorer = new ocAny.TopExp_Explorer_2(
    shape as any,
    ocAny.TopAbs_ShapeEnum.TopAbs_EDGE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  try {
    while (explorer.More()) {
      const edgeShape = explorer.Current();
      let edge: any = null;
      let adaptor: any = null;
      let keepEdge = false;
      try {
        edge = ocAny.TopoDS.Edge_1(edgeShape);
        adaptor = new ocAny.BRepAdaptor_Curve_2(edge);
        const curveType = adaptor.GetType();
        const t0 = adaptor.FirstParameter();
        const t1 = adaptor.LastParameter();
        const curveInfo = classifyAndExtractCurve(
          ocAny,
          curveType,
          t0,
          t1,
          adaptor,
        );
        const baseHash = fnv1a(curveInfo.hashSig);
        const id = disambiguateId(baseHash, occurrenceCounts);
        // Only one wrapper per id — duplicates from pathological topology
        // are dropped (the first wins).
        if (!out.has(id)) {
          out.set(id, edge);
          keepEdge = true;
        }
      } catch {
        // Skip pathological edges.
      } finally {
        if (adaptor) adaptor.delete?.();
        if (edge && !keepEdge) edge.delete?.();
        explorer.Next();
      }
    }
  } finally {
    explorer.delete();
  }

  return out;
}

/**
 * Enumerate faces, returning a map from canonical face id → live TopoDS_Face
 * wrapper. The id computation matches `enumerateFaces` exactly (including
 * the area-weighted centroid in the hash) so picker IDs round-trip back to
 * the right wrapper. Caller owns the wrappers and must dispose them via
 * `disposeRefMap`.
 */
export function enumerateFaceRefs(
  oc: unknown,
  shape: unknown,
  positions: Float32Array,
  indices: Uint32Array,
  faceRanges: FaceTriangleRange[],
): Map<string, unknown> {
  const ocAny = oc as any;
  const out = new Map<string, unknown>();
  const occurrenceCounts = new Map<string, number>();

  const explorer = new ocAny.TopExp_Explorer_2(
    shape as any,
    ocAny.TopAbs_ShapeEnum.TopAbs_FACE,
    ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  let idx = 0;
  try {
    while (explorer.More()) {
      const faceShape = explorer.Current();
      let face: any = null;
      let keepFace = false;
      try {
        face = ocAny.TopoDS.Face_1(faceShape);
        const surf = classifyAndExtractSurface(ocAny, face);
        const range = faceRanges[idx];
        if (!range || range.triangleCount === 0) {
          continue;
        }
        const { centroid } = centroidAndNormalFromTriangles(
          positions,
          indices,
          range,
        );
        const baseHash = fnv1a(
          `${surf.type}|${surf.hashSig}|${rTriple(centroid)}`,
        );
        const id = disambiguateId(baseHash, occurrenceCounts);
        if (!out.has(id)) {
          out.set(id, face);
          keepFace = true;
        }
      } catch {
        // Skip faces that fail classification.
      } finally {
        if (face && !keepFace) face.delete?.();
        explorer.Next();
        idx++;
      }
    }
  } finally {
    explorer.delete();
  }

  return out;
}

/** Dispose every TopoDS wrapper held in a refs map. Safe to call multiple times. */
export function disposeRefMap(m: Map<string, unknown>): void {
  for (const w of m.values()) {
    try {
      (w as { delete?: () => void }).delete?.();
    } catch {
      /* tolerate double-delete */
    }
  }
  m.clear();
}
