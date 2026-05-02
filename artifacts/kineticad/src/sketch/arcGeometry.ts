// Math for the 3-point arc tool.
//
// Given three plane-local points P1 (start), P2 (end), P3 (mid / sweep
// indicator), produce the unique circle that passes through all three and
// pick the sweep direction so that the resulting arc passes *through P3*.
//
// We always normalise to a CCW sweep where `endAngle > startAngle`, so the
// renderer can sample with a single forward loop and not worry about
// direction.

const TAU = Math.PI * 2;

export type ArcDescriptor = {
  centre: [number, number];
  radius: number;
  /** CCW sweep starts here. */
  startAngle: number;
  /** CCW sweep ends here. Always strictly greater than `startAngle`. */
  endAngle: number;
};

/**
 * Compute the unique circle through three points using the perpendicular-
 * bisector intersection. Returns `null` when the points are collinear.
 *
 * Output `endAngle` is normalised to be strictly greater than `startAngle`
 * (CCW sweep), and the sweep is chosen so that P3 lies on the resulting arc.
 */
export function arcFromThreePoints(
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
): ArcDescriptor | null {
  const [ax, ay] = p1;
  const [bx, by] = p2;
  const [cx, cy] = p3;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null; // collinear — no unique circle

  const ux =
    ((ax * ax + ay * ay) * (by - cy) +
      (bx * bx + by * by) * (cy - ay) +
      (cx * cx + cy * cy) * (ay - by)) /
    d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) +
      (bx * bx + by * by) * (ax - cx) +
      (cx * cx + cy * cy) * (bx - ax)) /
    d;

  const radius = Math.hypot(ax - ux, ay - uy);

  const a1 = Math.atan2(ay - uy, ax - ux);
  const a2 = Math.atan2(by - uy, bx - ux);
  const a3 = Math.atan2(cy - uy, cx - ux);

  // Pick the sweep direction so P3 lies on the arc from P1 to P2.
  // ccwInRange(start, end, mid) is true iff a CCW sweep from `start` to `end`
  // passes through `mid`.
  if (ccwInRange(a1, a2, a3)) {
    return {
      centre: [ux, uy],
      radius,
      startAngle: a1,
      endAngle: positiveSweepEnd(a1, a2),
    };
  }
  // Otherwise the CCW sweep from a2 to a1 contains a3 instead.
  return {
    centre: [ux, uy],
    radius,
    startAngle: a2,
    endAngle: positiveSweepEnd(a2, a1),
  };
}

/**
 * Sample `segments + 1` points along the CCW arc, including both endpoints.
 */
export function sampleArcPoints(
  arc: ArcDescriptor,
  segments: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const sweep = arc.endAngle - arc.startAngle;
  const [cx, cy] = arc.centre;
  const r = arc.radius;
  for (let i = 0; i <= segments; i++) {
    const a = arc.startAngle + sweep * (i / segments);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * Choose how many segments to use for an arc rendering. Heavier arcs (bigger
 * sweep, bigger radius) get more segments. Bounded so we never produce
 * thousands.
 */
export function arcSegmentCount(arc: ArcDescriptor): number {
  const sweep = Math.abs(arc.endAngle - arc.startAngle);
  // Roughly 1 segment per ~0.06 rad (~3.4°), capped to [16, 128].
  const raw = Math.ceil(sweep / 0.06);
  return Math.min(128, Math.max(16, raw));
}

// ---- helpers ----

function ccwInRange(start: number, end: number, mid: number): boolean {
  // Reduce sweep and mid offset to [0, TAU). 0 is treated as "right at start",
  // not "all the way around".
  let e = end - start;
  let m = mid - start;
  e = ((e % TAU) + TAU) % TAU;
  m = ((m % TAU) + TAU) % TAU;
  return m > 0 && m < e;
}

function positiveSweepEnd(start: number, end: number): number {
  let e = end;
  while (e <= start) e += TAU;
  return e;
}
