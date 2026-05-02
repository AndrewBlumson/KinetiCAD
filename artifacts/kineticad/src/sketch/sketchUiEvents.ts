// Module-level event bus for sketch-mode cursor info.
//
// The Three.js side (SketchSession, inside Scene's useEffect closure) is the
// authoritative source of "where is the snapped cursor right now?" because it
// owns the canvas raycasting. The DOM side (SketchCursor component, sibling
// to Scene in Modeller) needs the same information to render the crosshair
// and coordinate label.
//
// Pushing every mousemove through Zustand would re-render every store
// subscriber 60×/s. Using this lightweight emitter keeps the cursor data on
// a side channel that React doesn't see except inside the SketchCursor
// effect.

import type { SnapResult } from "./snapEngine";

export type SketchCursorInfo = {
  /** True when the cursor is currently inside the canvas during sketch mode. */
  visible: boolean;
  /** Raw client-space X (CSS pixels), or 0 if not visible. */
  screenX: number;
  /** Raw client-space Y (CSS pixels), or 0 if not visible. */
  screenY: number;
  /** Snap result at this cursor, or null if not visible. */
  snap: SnapResult | null;
};

type Listener = (info: SketchCursorInfo) => void;

let current: SketchCursorInfo = {
  visible: false,
  screenX: 0,
  screenY: 0,
  snap: null,
};

const listeners = new Set<Listener>();

export function publishCursor(info: SketchCursorInfo): void {
  current = info;
  for (const l of listeners) {
    try {
      l(info);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[sketchUiEvents] listener threw:", err);
    }
  }
}

export function subscribeCursor(listener: Listener): () => void {
  listeners.add(listener);
  // Immediately call with current value so consumers don't have to wait for
  // the next mousemove to render.
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function getCursor(): SketchCursorInfo {
  return current;
}

export function clearCursor(): void {
  publishCursor({ visible: false, screenX: 0, screenY: 0, snap: null });
}
