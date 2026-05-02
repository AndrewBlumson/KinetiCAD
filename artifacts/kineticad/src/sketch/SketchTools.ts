// Per-tool state machines for the sketch tools.
//
// These are pure: given a state and an input (click / move / escape), they
// return the next state and possibly a primitive to commit. The orchestrator
// (`SketchSession`) decides what to do with the commit (push to store,
// rebuild renderer, advance to the next sub-state).

import type { SketchPrimitive } from "@/state/schemas";
import type { SketchTool } from "@/state/store";
import { arcFromThreePoints } from "./arcGeometry";

export type ToolState =
  | { kind: "idle" }
  | { kind: "line"; sub: "awaiting-start" }
  | { kind: "line"; sub: "awaiting-end"; start: [number, number] }
  | { kind: "rectangle"; sub: "awaiting-first-corner" }
  | {
      kind: "rectangle";
      sub: "awaiting-second-corner";
      first: [number, number];
    }
  | { kind: "circle"; sub: "awaiting-centre" }
  | { kind: "circle"; sub: "awaiting-radius"; centre: [number, number] }
  | { kind: "arc"; sub: "awaiting-start" }
  | { kind: "arc"; sub: "awaiting-end"; start: [number, number] }
  | {
      kind: "arc";
      sub: "awaiting-mid";
      start: [number, number];
      end: [number, number];
    };

export type ApplyClickResult = {
  next: ToolState;
  /** A primitive to push to the committed list, if any. */
  commit?: SketchPrimitive;
};

/**
 * Initial state for a freshly-selected tool.
 */
export function defaultStateForTool(tool: SketchTool): ToolState {
  switch (tool) {
    case "idle":
      return { kind: "idle" };
    case "line":
      return { kind: "line", sub: "awaiting-start" };
    case "rectangle":
      return { kind: "rectangle", sub: "awaiting-first-corner" };
    case "circle":
      return { kind: "circle", sub: "awaiting-centre" };
    case "arc":
      return { kind: "arc", sub: "awaiting-start" };
  }
}

/**
 * Apply a click at the snapped UV. Advances sub-state and may emit a
 * primitive to commit.
 */
export function applyClick(
  state: ToolState,
  uv: readonly [number, number],
): ApplyClickResult {
  const point: [number, number] = [uv[0], uv[1]];

  switch (state.kind) {
    case "idle":
      return { next: state };

    case "line":
      if (state.sub === "awaiting-start") {
        return { next: { kind: "line", sub: "awaiting-end", start: point } };
      }
      // Awaiting end — commit the line, then chain by reusing the just-placed
      // endpoint as the next start (per spec).
      if (samePoint(state.start, point)) {
        // Zero-length line: don't commit, but also don't advance.
        return { next: state };
      }
      return {
        next: { kind: "line", sub: "awaiting-end", start: point },
        commit: { type: "line", start: state.start, end: point },
      };

    case "rectangle":
      if (state.sub === "awaiting-first-corner") {
        return {
          next: {
            kind: "rectangle",
            sub: "awaiting-second-corner",
            first: point,
          },
        };
      }
      // Second corner — emit a single rectangle primitive (not 4 lines).
      const rect = rectangleFromCorners(state.first, point);
      if (!rect) {
        // Zero-area rectangle — don't commit, stay awaiting second corner.
        return { next: state };
      }
      return {
        next: { kind: "rectangle", sub: "awaiting-first-corner" },
        commit: rect,
      };

    case "circle":
      if (state.sub === "awaiting-centre") {
        return {
          next: {
            kind: "circle",
            sub: "awaiting-radius",
            centre: point,
          },
        };
      }
      const radius = Math.hypot(point[0] - state.centre[0], point[1] - state.centre[1]);
      if (radius < 1e-6) return { next: state };
      return {
        next: { kind: "circle", sub: "awaiting-centre" },
        commit: { type: "circle", centre: state.centre, radius },
      };

    case "arc":
      if (state.sub === "awaiting-start") {
        return { next: { kind: "arc", sub: "awaiting-end", start: point } };
      }
      if (state.sub === "awaiting-end") {
        if (samePoint(state.start, point)) return { next: state };
        return {
          next: {
            kind: "arc",
            sub: "awaiting-mid",
            start: state.start,
            end: point,
          },
        };
      }
      // Awaiting mid (the third click, which selects the curvature).
      const arc = arcFromThreePoints(state.start, state.end, point);
      if (!arc) {
        // Collinear — nothing to commit, stay in awaiting-mid until user picks
        // a non-collinear point.
        return { next: state };
      }
      return {
        next: { kind: "arc", sub: "awaiting-start" },
        commit: {
          type: "arc",
          centre: arc.centre,
          radius: arc.radius,
          startAngle: arc.startAngle,
          endAngle: arc.endAngle,
        },
      };
  }
}

/**
 * Escape (or right-click): drop any in-flight primitive but stay in the same
 * tool, ready for a new first click.
 */
export function applyEscape(state: ToolState): ToolState {
  return defaultStateForTool(toolKindOf(state));
}

/**
 * Convert a tool state + current cursor UV to a primitive that should render
 * as a dashed rubber-band. Returns null when the tool isn't drawing yet.
 */
export function inFlightPrimitiveFor(
  state: ToolState,
  cursor: readonly [number, number] | null,
): SketchPrimitive | null {
  if (state.kind === "idle") return null;
  if (!cursor) return null;
  const point: [number, number] = [cursor[0], cursor[1]];

  switch (state.kind) {
    case "line":
      if (state.sub === "awaiting-end") {
        return { type: "line", start: state.start, end: point };
      }
      return null;

    case "rectangle":
      if (state.sub === "awaiting-second-corner") {
        return rectangleFromCorners(state.first, point) ?? null;
      }
      return null;

    case "circle":
      if (state.sub === "awaiting-radius") {
        const r = Math.hypot(
          point[0] - state.centre[0],
          point[1] - state.centre[1],
        );
        if (r < 1e-6) return null;
        return { type: "circle", centre: state.centre, radius: r };
      }
      return null;

    case "arc":
      if (state.sub === "awaiting-end") {
        // Preview as a straight line until the user has placed both endpoints.
        if (samePoint(state.start, point)) return null;
        return { type: "line", start: state.start, end: point };
      }
      if (state.sub === "awaiting-mid") {
        const arc = arcFromThreePoints(state.start, state.end, point);
        if (!arc) return null;
        return {
          type: "arc",
          centre: arc.centre,
          radius: arc.radius,
          startAngle: arc.startAngle,
          endAngle: arc.endAngle,
        };
      }
      return null;
  }
  return null;
}

// ---- helpers ----

function toolKindOf(state: ToolState): SketchTool {
  return state.kind;
}

function samePoint(
  a: readonly [number, number],
  b: readonly [number, number],
): boolean {
  return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function rectangleFromCorners(
  a: readonly [number, number],
  b: readonly [number, number],
): SketchPrimitive | null {
  const minU = Math.min(a[0], b[0]);
  const minV = Math.min(a[1], b[1]);
  const w = Math.abs(b[0] - a[0]);
  const h = Math.abs(b[1] - a[1]);
  if (w < 1e-6 || h < 1e-6) return null;
  return { type: "rectangle", corner: [minU, minV], width: w, height: h };
}
