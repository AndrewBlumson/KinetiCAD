// Phase 6 — TransformControls wrapper. Owns one TransformControls instance,
// exposes a small imperative API to Scene.tsx, and emits position/rotation
// changes once per animation frame so a gizmo drag doesn't blast the store
// with 60+ updates per second.
//
// Three.js v0.184 made TransformControls extend Controls (not Object3D), so
// the gizmo's *visual* must be added to the scene via `getHelper()`; the
// controller object itself just listens to pointer events on the renderer's
// dom element.

import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

/** Translate / rotate handles, or hidden (gizmo detached or suppressed). */
export type GizmoMode = "translate" | "rotate" | "hidden";

export type TransformGizmoOptions = {
  camera: THREE.Camera;
  domElement: HTMLElement;
  /** The scene to add the gizmo's visual helper into. */
  scene: THREE.Scene;
  /**
   * Called at most once per animation frame while the user drags a handle,
   * and once more on drag end to flush the final value. Position is in
   * world units (mm); rotation is the attached object's `THREE.Euler`.
   */
  onChange: (position: THREE.Vector3, rotation: THREE.Euler) => void;
  /**
   * Called whenever the drag state flips. Scene.tsx wires this to
   * `controls.enabled` so OrbitControls don't fight the gizmo for pointer
   * events while a handle is grabbed.
   */
  onDraggingChanged: (dragging: boolean) => void;
};

export type TransformGizmo = {
  attach: (object: THREE.Object3D) => void;
  detach: () => void;
  isAttached: () => boolean;
  attachedTo: () => THREE.Object3D | null;
  setMode: (mode: GizmoMode) => void;
  getMode: () => GizmoMode;
  dispose: () => void;
};

/**
 * Construct a TransformControls + helper pair and wire up rAF-throttled
 * change emission. Caller is responsible for calling `dispose()` on
 * teardown.
 */
export function createTransformGizmo(
  opts: TransformGizmoOptions,
): TransformGizmo {
  const tc = new TransformControls(opts.camera, opts.domElement);
  tc.setSize(0.85);

  // v0.184 split the visual into a separate helper object. Older API
  // returned the controller itself as an Object3D; newer requires
  // `getHelper()` to obtain the visual to add to the scene. Keep a fallback
  // for safety.
  const helperFn = (
    tc as unknown as { getHelper?: () => THREE.Object3D | null }
  ).getHelper;
  const helper: THREE.Object3D | null =
    typeof helperFn === "function"
      ? (helperFn.call(tc) as THREE.Object3D | null)
      : (tc as unknown as THREE.Object3D);

  if (helper) {
    helper.visible = false;
    opts.scene.add(helper);
  }
  // Disable gizmo input until something is attached.
  tc.enabled = false;

  let attached: THREE.Object3D | null = null;
  let mode: GizmoMode = "translate";
  let raf = 0;
  let pendingEmit = false;
  let isDisposed = false;

  const emit = (): void => {
    if (!attached) return;
    opts.onChange(attached.position.clone(), attached.rotation.clone());
  };

  const flushRaf = (): void => {
    raf = 0;
    if (!pendingEmit || isDisposed) return;
    pendingEmit = false;
    emit();
  };

  const onObjectChange = (): void => {
    pendingEmit = true;
    if (raf === 0 && !isDisposed) {
      raf = requestAnimationFrame(flushRaf);
    }
  };

  const onDragging = (e: { value: boolean }): void => {
    opts.onDraggingChanged(Boolean(e.value));
    // On drag end, flush any deferred emit so the final value can't get
    // dropped between rAF and the dragging-changed event.
    if (!e.value) {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (pendingEmit) {
        pendingEmit = false;
        emit();
      }
    }
  };

  tc.addEventListener("objectChange", onObjectChange);
  // The TransformControls type defs declare a generic event payload; we
  // know the value field is a boolean.
  tc.addEventListener(
    "dragging-changed",
    onDragging as unknown as (e: unknown) => void,
  );

  const refreshVisual = (): void => {
    if (!helper) return;
    if (!attached || mode === "hidden") {
      helper.visible = false;
      tc.enabled = false;
    } else {
      helper.visible = true;
      tc.enabled = true;
    }
  };

  const attach = (obj: THREE.Object3D): void => {
    if (isDisposed) return;
    if (attached === obj) {
      // Already attached to this object — refresh the visual (e.g. mode
      // changed while attached) and bail out.
      refreshVisual();
      return;
    }
    attached = obj;
    tc.attach(obj);
    // Default back to translate when re-attaching after a hidden state.
    if (mode === "hidden") mode = "translate";
    tc.setMode(mode);
    refreshVisual();
  };

  const detach = (): void => {
    if (!attached) {
      refreshVisual();
      return;
    }
    attached = null;
    tc.detach();
    refreshVisual();
  };

  const setMode = (m: GizmoMode): void => {
    mode = m;
    if (m !== "hidden" && attached) tc.setMode(m);
    refreshVisual();
  };

  const dispose = (): void => {
    isDisposed = true;
    tc.removeEventListener("objectChange", onObjectChange);
    tc.removeEventListener(
      "dragging-changed",
      onDragging as unknown as (e: unknown) => void,
    );
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (attached) {
      tc.detach();
      attached = null;
    }
    if (helper && helper.parent) helper.parent.remove(helper);
    tc.dispose();
  };

  return {
    attach,
    detach,
    isAttached: () => attached !== null,
    attachedTo: () => attached,
    setMode,
    getMode: () => mode,
    dispose,
  };
}
