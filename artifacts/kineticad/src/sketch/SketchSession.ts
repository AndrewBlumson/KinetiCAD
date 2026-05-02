// Orchestrator for an active sketch session. Owns the per-tool sub-state, the
// snap engine, the active sketch's primitive renderer (in-flight + committed),
// and the snap marker. Wires DOM pointer events on the canvas through to
// state transitions and publishes cursor info via the module-level emitter
// so the DOM crosshair / coordinate label can render without React re-renders
// on every mousemove.
//
// Lifetime: created by Scene.tsx when sketch mode begins, disposed when
// sketch mode ends (Finish or Cancel). Tool changes from the store come
// through `setTool()` rather than being driven by the session itself.

import * as THREE from "three";
import type { SketchPrimitive } from "@/state/schemas";
import type { SketchTool } from "@/state/store";
import {
  type CardinalPlane,
  PLANE_VIEWS,
  worldToPlane,
} from "./plane";
import {
  applyClick,
  applyEscape,
  defaultStateForTool,
  inFlightPrimitiveFor,
  type ToolState,
} from "./SketchTools";
import {
  computeSnap,
  screenRadiusToWorldMm,
  type SnapResult,
} from "./snapEngine";
import {
  createSketchPrimitiveRenderer,
  type SketchPrimitiveRenderer,
} from "./sketchPrimitiveRenderer";
import { createSnapMarker, type SnapMarker } from "@/components/SnapMarker";
import { clearCursor, publishCursor } from "./sketchUiEvents";

const SCREEN_PICKUP_RADIUS_PX = 5;

export type SketchSessionOptions = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  initialPlane: CardinalPlane;
  initialTool: SketchTool;
  /** Called when a primitive is committed; expected to push it into the store. */
  onPrimitiveCommitted: (primitive: SketchPrimitive) => void;
  /** Provides the latest committed primitives (for snap input). */
  getCommittedPrimitives: () => ReadonlyArray<SketchPrimitive>;
  initialResolution: { widthPx: number; heightPx: number };
};

/**
 * Handle returned by `createSketchSession`. Named with the `Handle` suffix
 * to avoid clashing with the `SketchSession` *state* type exported from
 * `@/state/store`.
 */
export type SketchSessionHandle = {
  setPlane: (plane: CardinalPlane) => void;
  setTool: (tool: SketchTool) => void;
  /** Notify the session that committedPrimitives changed externally. */
  notifyCommittedChanged: () => void;
  setResolution: (widthPx: number, heightPx: number) => void;
  /** Top-level groups added to the scene by the session. */
  groups: ReadonlyArray<THREE.Group>;
  dispose: () => void;
};

export function createSketchSession(
  options: SketchSessionOptions,
): SketchSessionHandle {
  let plane = options.initialPlane;
  let tool: SketchTool = options.initialTool;
  let toolState: ToolState = defaultStateForTool(tool);
  let altHeld = false;
  let cursorUv: [number, number] | null = null;
  let cursorScreen: { x: number; y: number } | null = null;
  let lastSnap: SnapResult | null = null;

  const renderer = createSketchPrimitiveRenderer(
    plane,
    options.initialResolution,
  );
  options.scene.add(renderer.group);
  renderer.setCommitted(options.getCommittedPrimitives());

  const marker = createSnapMarker();
  options.scene.add(marker.group);

  const raycaster = new THREE.Raycaster();
  const planeMath = new THREE.Plane();
  const tmpVec = new THREE.Vector3();
  const ndc = new THREE.Vector2();

  function rebuildPlaneMath(): void {
    const normal = new THREE.Vector3(...PLANE_VIEWS[plane].normal);
    planeMath.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, 0));
  }
  rebuildPlaneMath();

  function project(event: PointerEvent): {
    uv: [number, number] | null;
    screen: { x: number; y: number };
  } {
    const rect = options.canvas.getBoundingClientRect();
    const screen = { x: event.clientX, y: event.clientY };
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    if (rect.width <= 0 || rect.height <= 0) {
      return { uv: null, screen };
    }
    ndc.x = (localX / rect.width) * 2 - 1;
    ndc.y = -((localY / rect.height) * 2 - 1);
    raycaster.setFromCamera(ndc, options.camera);
    const hit = raycaster.ray.intersectPlane(planeMath, tmpVec);
    if (!hit) return { uv: null, screen };
    return { uv: worldToPlane(plane, hit), screen };
  }

  function snapAt(uv: [number, number]): SnapResult {
    const distance = Math.max(1, options.camera.position.length());
    const rect = options.canvas.getBoundingClientRect();
    const worldRadiusMm = screenRadiusToWorldMm(
      SCREEN_PICKUP_RADIUS_PX,
      distance,
      options.camera.fov,
      Math.max(1, rect.height),
    );
    return computeSnap({
      cursor: uv,
      primitives: options.getCommittedPrimitives(),
      worldRadiusMm,
      altHeld,
    });
  }

  function refreshInFlightAndMarker(): void {
    const prim = inFlightPrimitiveFor(toolState, lastSnap?.position ?? null);
    renderer.setInFlight(prim);
    marker.set(lastSnap, plane);
  }

  function publishCursorState(visible: boolean): void {
    if (!visible || !cursorScreen) {
      publishCursor({ visible: false, screenX: 0, screenY: 0, snap: null });
      return;
    }
    publishCursor({
      visible: true,
      screenX: cursorScreen.x,
      screenY: cursorScreen.y,
      snap: lastSnap,
    });
  }

  // ---- DOM event handlers ----

  function onPointerMove(event: PointerEvent): void {
    const { uv, screen } = project(event);
    cursorScreen = screen;
    if (!uv) {
      cursorUv = null;
      lastSnap = null;
      marker.set(null, plane);
      // Still publish so the DOM cursor can hide its label when off-plane.
      publishCursorState(true);
      return;
    }
    cursorUv = uv;
    lastSnap = snapAt(uv);
    refreshInFlightAndMarker();
    publishCursorState(true);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      // Right-click cancels in-flight, stays in tool.
      toolState = applyEscape(toolState);
      refreshInFlightAndMarker();
      return;
    }
    if (event.button !== 0) return;
    if (tool === "idle") return;
    const { uv, screen } = project(event);
    cursorScreen = screen;
    if (!uv) return;
    const snap = snapAt(uv);
    lastSnap = snap;
    cursorUv = uv;

    const result = applyClick(toolState, snap.position);
    toolState = result.next;
    if (result.commit) {
      options.onPrimitiveCommitted(result.commit);
      renderer.setCommitted(options.getCommittedPrimitives());
    }
    refreshInFlightAndMarker();
    publishCursorState(true);
  }

  function onPointerLeave(): void {
    cursorUv = null;
    cursorScreen = null;
    lastSnap = null;
    marker.set(null, plane);
    renderer.setInFlight(inFlightPrimitiveFor(toolState, null));
    publishCursor({ visible: false, screenX: 0, screenY: 0, snap: null });
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Don't steal keystrokes when typing into an input.
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    if (event.key === "Alt") {
      altHeld = true;
      if (cursorUv) {
        lastSnap = snapAt(cursorUv);
        refreshInFlightAndMarker();
        publishCursorState(true);
      }
      return;
    }
    if (event.key === "Escape") {
      toolState = applyEscape(toolState);
      refreshInFlightAndMarker();
      event.preventDefault();
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key === "Alt") {
      altHeld = false;
      if (cursorUv) {
        lastSnap = snapAt(cursorUv);
        refreshInFlightAndMarker();
        publishCursorState(true);
      }
    }
  }

  options.canvas.addEventListener("pointermove", onPointerMove);
  options.canvas.addEventListener("pointerdown", onPointerDown);
  options.canvas.addEventListener("pointerleave", onPointerLeave);
  options.canvas.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    setPlane: (next) => {
      if (next === plane) return;
      plane = next;
      rebuildPlaneMath();
      renderer.setPlane(plane);
      // Drop in-flight: switching planes invalidates pending input.
      toolState = defaultStateForTool(tool);
      cursorUv = null;
      lastSnap = null;
      refreshInFlightAndMarker();
    },
    setTool: (next) => {
      if (next === tool) return;
      tool = next;
      toolState = defaultStateForTool(tool);
      refreshInFlightAndMarker();
    },
    notifyCommittedChanged: () => {
      renderer.setCommitted(options.getCommittedPrimitives());
      refreshInFlightAndMarker();
    },
    setResolution: (w, h) => {
      renderer.setResolution(w, h);
    },
    groups: [renderer.group, marker.group] as const,
    dispose: () => {
      options.canvas.removeEventListener("pointermove", onPointerMove);
      options.canvas.removeEventListener("pointerdown", onPointerDown);
      options.canvas.removeEventListener("pointerleave", onPointerLeave);
      options.canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);

      options.scene.remove(renderer.group);
      options.scene.remove(marker.group);
      renderer.dispose();
      marker.dispose();
      clearCursor();
    },
  };
}
