// Snap calculation. Pure logic that the renderer / cursor doesn't depend on
// directly — they consume the SnapResult.
//
// Snap priority (highest → lowest):
//   endpoint > midpoint > grid
// Only the "free" type returns the raw cursor; that happens when Alt is held.

import type { SketchPrimitive } from "@/state/schemas";

export type SnapType = "grid" | "endpoint" | "midpoint" | "free";

export type SnapResult = {
  /** The snapped position in plane-local UV coordinates. */
  position: [number, number];
  type: SnapType;
};

const GRID_STEP_MM = 1;

export type SnapInput = {
  cursor: readonly [number, number];
  primitives: ReadonlyArray<SketchPrimitive>;
  /** World-space radius (mm) corresponding to roughly 5 screen pixels. */
  worldRadiusMm: number;
  altHeld: boolean;
};

export function computeSnap(input: SnapInput): SnapResult {
  if (input.altHeld) {
    return { position: [input.cursor[0], input.cursor[1]], type: "free" };
  }

  // Endpoint snap (highest priority).
  const endpoint = closestPoint(
    input.cursor,
    collectEndpoints(input.primitives),
    input.worldRadiusMm,
  );
  if (endpoint) {
    return { position: endpoint, type: "endpoint" };
  }

  // Midpoint snap. Spec: midpoints of committed lines.
  const midpoint = closestPoint(
    input.cursor,
    collectLineMidpoints(input.primitives),
    input.worldRadiusMm,
  );
  if (midpoint) {
    return { position: midpoint, type: "midpoint" };
  }

  // Grid snap. Always succeeds.
  return {
    position: [
      roundTo(input.cursor[0], GRID_STEP_MM),
      roundTo(input.cursor[1], GRID_STEP_MM),
    ],
    type: "grid",
  };
}

/**
 * Convert a screen-space radius (in CSS pixels) to world-space mm at the
 * given camera distance. Used to compute the snap pickup radius dynamically
 * so it always feels like 5px regardless of zoom.
 */
export function screenRadiusToWorldMm(
  screenRadiusPx: number,
  cameraDistance: number,
  fovDeg: number,
  canvasHeightPx: number,
): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  const worldHeightAtCamera = 2 * cameraDistance * Math.tan(fovRad / 2);
  return (worldHeightAtCamera / Math.max(1, canvasHeightPx)) * screenRadiusPx;
}

// ---- internals ----

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function closestPoint(
  cursor: readonly [number, number],
  candidates: ReadonlyArray<[number, number]>,
  radius: number,
): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDist = radius;
  for (const c of candidates) {
    const dx = c[0] - cursor[0];
    const dy = c[1] - cursor[1];
    const d = Math.hypot(dx, dy);
    if (d <= bestDist) {
      bestDist = d;
      best = [c[0], c[1]];
    }
  }
  return best;
}

function collectEndpoints(
  primitives: ReadonlyArray<SketchPrimitive>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of primitives) {
    switch (p.type) {
      case "line":
        out.push([p.start[0], p.start[1]]);
        out.push([p.end[0], p.end[1]]);
        break;
      case "rectangle": {
        const [x, y] = p.corner;
        const w = p.width;
        const h = p.height;
        out.push([x, y]);
        out.push([x + w, y]);
        out.push([x + w, y + h]);
        out.push([x, y + h]);
        break;
      }
      case "circle":
        // Centre is a useful snap target for circles.
        out.push([p.centre[0], p.centre[1]]);
        break;
      case "arc": {
        // Both arc endpoints (computed from centre + radius + angles).
        out.push([
          p.centre[0] + p.radius * Math.cos(p.startAngle),
          p.centre[1] + p.radius * Math.sin(p.startAngle),
        ]);
        out.push([
          p.centre[0] + p.radius * Math.cos(p.endAngle),
          p.centre[1] + p.radius * Math.sin(p.endAngle),
        ]);
        // Centre is also a useful snap target.
        out.push([p.centre[0], p.centre[1]]);
        break;
      }
    }
  }
  return out;
}

function collectLineMidpoints(
  primitives: ReadonlyArray<SketchPrimitive>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of primitives) {
    if (p.type === "line") {
      out.push([
        (p.start[0] + p.end[0]) / 2,
        (p.start[1] + p.end[1]) / 2,
      ]);
    }
  }
  return out;
}
