// React-owned Three.js scene. Mounts a single canvas, builds the WebGPU
// renderer, runs the orbit camera and render loop, and renders both the
// committed part meshes (PartMeshLayer, driven by the regen pipeline) and
// the in-flight feature editor's preview (PreviewMeshLayer).
//
// Lifecycle is handled imperatively inside a single useEffect to avoid
// React re-creating the renderer on every render.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import {
  COLOURS,
  applyEnvironment,
  createAxes,
  createCamera,
  createGrid,
  createLights,
  createScene,
  disposeObject3D,
} from "./sceneSetup";
import { OrbitControls } from "./OrbitControls";
import { getCadKernel } from "@/cad/cadClient";
import { useKinetiCADStore } from "@/state/store";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  DEFAULT_CAMERA_UP,
  PLANE_VIEWS,
  type CardinalPlane,
} from "@/sketch/plane";
import { createSketchOverlay, type SketchOverlay } from "@/sketch/sketchOverlay";
import {
  createSketchSession,
  type SketchSessionHandle,
} from "@/sketch/SketchSession";
import {
  createFinishedSketchesLayer,
  type FinishedSketchesLayer,
} from "@/sketch/finishedSketchesLayer";
import type { SketchTool } from "@/state/store";
import type { Feature } from "@/state/schemas";
import {
  createPartMeshLayer,
  type PartMeshLayer,
} from "./PartMeshLayer";
import {
  createPreviewMeshLayer,
  type PreviewMeshLayer,
} from "./PreviewMeshLayer";
import {
  createBooleanResultLayer,
  type BooleanResultLayer,
} from "./BooleanResultLayer";
import {
  computeFeatureHash,
  previewFeature,
} from "@/features/featureRegen";
import {
  computeBooleanHash,
  regenerateBoolean,
} from "@/features/assemblyRegen";
import { mapKernelError } from "@/features/kernelErrors";
import {
  createEdgeHighlightLayer,
  type EdgeHighlightLayer,
} from "./EdgeHighlightLayer";
import {
  createFaceHighlightLayer,
  type FaceHighlightLayer,
} from "./FaceHighlightLayer";
import {
  createTopologyPicker,
  type TopologyPicker,
} from "./TopologyPicker";
import {
  createTransformGizmo,
  type GizmoMode,
  type TransformGizmo,
} from "./TransformGizmo";
import type { FaceMetadata } from "@/cad/types";

type Status =
  | { kind: "checking-webgpu" }
  | { kind: "no-webgpu" }
  | { kind: "loading-kernel" }
  | { kind: "ready"; initTimeMs: number }
  | { kind: "error"; message: string };

type CameraTween = {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromUp: THREE.Vector3;
  toUp: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startMs: number;
  durationMs: number;
  /** What to do when the tween completes. */
  onComplete: "enable-controls" | "leave-controls-disabled";
};

const TWEEN_MS = 600;
const PREVIEW_DEBOUNCE_MS = 200;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function Scene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "checking-webgpu" });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let renderer: WebGPURenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let shadowCatcher: THREE.Mesh | null = null;
    let disposeEnv: (() => void) | null = null;
    let fpsTimer: ReturnType<typeof setInterval> | null = null;
    let frameCounter = 0;
    let cameraTween: CameraTween | null = null;
    let sketchOverlay: SketchOverlay | null = null;
    let unsubscribeStore: (() => void) | null = null;
    let sketchSessionHandle: SketchSessionHandle | null = null;
    let finishedLayer: FinishedSketchesLayer | null = null;
    let unsubscribeAssembly: (() => void) | null = null;
    let unsubscribeFeatureEditor: (() => void) | null = null;
    let partMeshLayer: PartMeshLayer | null = null;
    let previewMeshLayer: PreviewMeshLayer | null = null;
    let booleanResultLayer: BooleanResultLayer | null = null;
    let edgeHighlightLayer: EdgeHighlightLayer | null = null;
    let faceHighlightLayer: FaceHighlightLayer | null = null;
    let topologyPicker: TopologyPicker | null = null;
    let transformGizmo: TransformGizmo | null = null;
    let unsubscribeSelection: (() => void) | null = null;
    let unsubscribeGizmo: (() => void) | null = null;
    let onGizmoKeydown: ((e: KeyboardEvent) => void) | null = null;
    let lastResolvedSelectionRef: unknown = undefined;
    let lastResolvedTopologyVersion = -1;
    let lastReconciledGizmoMesh: THREE.Mesh | null = null;
    let gizmoMode: GizmoMode = "translate";
    let gizmoDragging = false;
    /**
     * Per-frame hook invoked from inside the existing renderLoop. Set by the
     * topology-picker bringup once the kernel + part layer are ready; null
     * otherwise. Kept on the closure so we don't have to swap the animation
     * loop function out from under the renderer.
     */
    let perFrameTopologyCheck: (() => void) | null = null;
    let previewDebounce: ReturnType<typeof setTimeout> | null = null;
    let previewToken = 0;
    let lastPreviewHash: string | null = null;
    let booleanPreviewDebounce: ReturnType<typeof setTimeout> | null = null;
    let booleanPreviewToken = 0;
    let lastBooleanPreviewHash: string | null = null;
    let canvasResW = 1;
    let canvasResH = 1;

    const scene = createScene();
    const lights = createLights(scene);
    const grid = createGrid();
    const axes = createAxes(50);
    scene.add(grid);
    scene.add(axes);

    const initialWidth = container.clientWidth || 1;
    const initialHeight = container.clientHeight || 1;
    const camera = createCamera(initialWidth / initialHeight);

    (async () => {
      try {
        // 1. WebGPU detection. Hard requirement, no fallback. Both the API
        // surface AND a real adapter must be available; the Replit preview
        // iframe exposes navigator.gpu but cannot return an adapter.
        const gpu = (navigator as unknown as {
          gpu?: {
            requestAdapter: (opts?: {
              powerPreference?: "low-power" | "high-performance";
            }) => Promise<unknown>;
          };
        }).gpu;
        if (!gpu) {
          setStatus({ kind: "no-webgpu" });
          return;
        }
        let adapter: unknown = null;
        try {
          adapter = await gpu.requestAdapter({
            powerPreference: "high-performance",
          });
        } catch {
          adapter = null;
        }
        if (cancelled) return;
        if (!adapter) {
          setStatus({ kind: "no-webgpu" });
          return;
        }

        renderer = new WebGPURenderer({
          antialias: true,
          alpha: false,
          forceWebGL: false,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(initialWidth, initialHeight, false);
        renderer.setClearColor(COLOURS.background, 1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        try {
          await renderer.init();
        } catch (initErr) {
          // Treat any init failure as a WebGPU unavailability rather than a
          // hard crash, so the user sees the fallback message instead.
          // eslint-disable-next-line no-console
          console.warn("[SCENE] WebGPURenderer init failed:", initErr);
          renderer.dispose();
          renderer = null;
          setStatus({ kind: "no-webgpu" });
          return;
        }
        if (cancelled) {
          renderer.dispose();
          return;
        }

        container.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";

        // PBR environment lighting via PMREM + RoomEnvironment.
        try {
          disposeEnv = applyEnvironment(scene, renderer);
        } catch (envErr) {
          // Non-fatal: scene still has the directional light.
          // eslint-disable-next-line no-console
          console.warn("[SCENE] PMREM environment skipped:", envErr);
        }

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 0, 0);
        controls.minDistance = 20;
        controls.maxDistance = 500;
        controls.update();

        // Sketch overlay: built once, hidden until the user enters sketch mode.
        sketchOverlay = createSketchOverlay("XY");
        sketchOverlay.group.visible = false;
        scene.add(sketchOverlay.group);

        // Persistent overlay layer: thin orange wireframes for sketches the
        // user has already finished, visible from any camera angle.
        canvasResW = initialWidth;
        canvasResH = initialHeight;
        finishedLayer = createFinishedSketchesLayer({
          widthPx: canvasResW,
          heightPx: canvasResH,
        });
        scene.add(finishedLayer.group);
        finishedLayer.sync(useKinetiCADStore.getState().assembly);
        unsubscribeAssembly = useKinetiCADStore.subscribe((state) => {
          finishedLayer?.sync(state.assembly);
        });

        // Sketch session sync: reconcile the current sketch state with the
        // camera, overlay, orbit controls, and the active SketchSession.
        let prevSketchActive = false;
        let prevSketchPlane: CardinalPlane | null = null;
        let prevSketchTool: SketchTool = "idle";

        const reconcileSketch = (state: ReturnType<typeof useKinetiCADStore.getState>) => {
          if (!controls || !sketchOverlay || !renderer) return;
          const session = state.sketchSession;

          if (session.active && session.plane) {
            // Either entering sketch or switching plane while inside one.
            if (!prevSketchActive || prevSketchPlane !== session.plane) {
              const view = PLANE_VIEWS[session.plane];
              cameraTween = {
                fromPos: camera.position.clone(),
                toPos: new THREE.Vector3(...view.cameraPosition),
                fromUp: camera.up.clone(),
                toUp: new THREE.Vector3(...view.cameraUp),
                fromTarget: controls.target.clone(),
                toTarget: new THREE.Vector3(...DEFAULT_CAMERA_TARGET),
                startMs: performance.now(),
                durationMs: TWEEN_MS,
                onComplete: "leave-controls-disabled",
              };
              controls.enabled = false;
              sketchOverlay.setPlane(session.plane);
              sketchOverlay.group.visible = true;

              if (!sketchSessionHandle) {
                sketchSessionHandle = createSketchSession({
                  scene,
                  camera,
                  canvas: renderer.domElement as HTMLCanvasElement,
                  initialPlane: session.plane,
                  initialTool: session.tool,
                  initialResolution: { widthPx: canvasResW, heightPx: canvasResH },
                  onPrimitiveCommitted: (primitive) => {
                    useKinetiCADStore.getState().commitPrimitive(primitive);
                  },
                  getCommittedPrimitives: () =>
                    useKinetiCADStore.getState().sketchSession.committedPrimitives,
                });
              } else {
                sketchSessionHandle.setPlane(session.plane);
              }

              prevSketchActive = true;
              prevSketchPlane = session.plane;
              prevSketchTool = session.tool;
            }
            if (sketchSessionHandle && session.tool !== prevSketchTool) {
              sketchSessionHandle.setTool(session.tool);
              prevSketchTool = session.tool;
            }
          } else if (prevSketchActive) {
            cameraTween = {
              fromPos: camera.position.clone(),
              toPos: new THREE.Vector3(...DEFAULT_CAMERA_POSITION),
              fromUp: camera.up.clone(),
              toUp: new THREE.Vector3(...DEFAULT_CAMERA_UP),
              fromTarget: controls.target.clone(),
              toTarget: new THREE.Vector3(...DEFAULT_CAMERA_TARGET),
              startMs: performance.now(),
              durationMs: TWEEN_MS,
              onComplete: "enable-controls",
            };
            sketchOverlay.group.visible = false;
            if (sketchSessionHandle) {
              sketchSessionHandle.dispose();
              sketchSessionHandle = null;
            }
            prevSketchActive = false;
            prevSketchPlane = null;
            prevSketchTool = "idle";
          }
        };

        unsubscribeStore = useKinetiCADStore.subscribe(reconcileSketch);
        reconcileSketch(useKinetiCADStore.getState());

        // Render loop. WebGPU requires setAnimationLoop, not rAF.
        const renderLoop = () => {
          if (!renderer) return;
          // Topology-picker bookkeeping: clears stale highlight geometry
          // after part regen completions. No-op until set in step 3.
          perFrameTopologyCheck?.();

          if (cameraTween && controls) {
            const t = Math.min(
              1,
              (performance.now() - cameraTween.startMs) /
                cameraTween.durationMs,
            );
            const e = easeInOutCubic(t);
            camera.position.lerpVectors(
              cameraTween.fromPos,
              cameraTween.toPos,
              e,
            );
            camera.up.copy(cameraTween.fromUp).lerp(cameraTween.toUp, e);
            controls.target.lerpVectors(
              cameraTween.fromTarget,
              cameraTween.toTarget,
              e,
            );
            camera.lookAt(controls.target);
            if (t >= 1) {
              if (cameraTween.onComplete === "enable-controls") {
                controls.enabled = true;
              }
              cameraTween = null;
            }
          } else {
            controls?.update();
          }

          renderer.renderAsync(scene, camera);
          frameCounter += 1;
        };
        renderer.setAnimationLoop(renderLoop);

        // FPS counter, dev-mode only, once per second.
        if (import.meta.env.DEV) {
          fpsTimer = setInterval(() => {
            // eslint-disable-next-line no-console
            console.info(`[FPS] ${frameCounter}`);
            frameCounter = 0;
          }, 1000);
        }

        // Resize handling via ResizeObserver.
        resizeObserver = new ResizeObserver((entries) => {
          if (!renderer) return;
          const entry = entries[0];
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          canvasResW = width;
          canvasResH = height;
          sketchSessionHandle?.setResolution(width, height);
          finishedLayer?.setResolution(width, height);
          edgeHighlightLayer?.setResolution(width, height);
          faceHighlightLayer?.setResolution(width, height);
          topologyPicker?.setResolution(width, height);
        });
        resizeObserver.observe(container);

        // 2. Boot the CAD kernel.
        setStatus({ kind: "loading-kernel" });
        const kernel = await getCadKernel();
        if (cancelled) return;

        // Shadow catcher so part meshes have a grounded look. PlaneGeometry
        // already lies in the XY plane (normal +Z), which IS the floor in
        // our Z-up convention, so no rotation is required. Sit it just
        // below Z=0 to avoid z-fighting with the grid.
        shadowCatcher = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.ShadowMaterial({ opacity: 0.35 }),
        );
        shadowCatcher.position.z = -5;
        shadowCatcher.receiveShadow = true;
        scene.add(shadowCatcher);

        // 3. Build the part / preview layers and wire them up to the store.
        partMeshLayer = createPartMeshLayer();
        previewMeshLayer = createPreviewMeshLayer();
        booleanResultLayer = createBooleanResultLayer();
        edgeHighlightLayer = createEdgeHighlightLayer();
        faceHighlightLayer = createFaceHighlightLayer();
        scene.add(partMeshLayer.group);
        scene.add(previewMeshLayer.group);
        scene.add(booleanResultLayer.group);
        scene.add(edgeHighlightLayer.group);
        scene.add(faceHighlightLayer.group);
        edgeHighlightLayer.setResolution(canvasResW, canvasResH);
        faceHighlightLayer.setResolution(canvasResW, canvasResH);

        // Topology picker. Reads pickingMode + selection from the store and
        // dispatches `selectEdges` / `selectFace` / `selectPointOnFace` from
        // canvas mouse events. Always-on; gated internally by pickingMode.
        topologyPicker = createTopologyPicker({
          domElement: renderer.domElement,
          camera,
          partMeshLayer,
          edgeLayer: edgeHighlightLayer,
          faceLayer: faceHighlightLayer,
          store: useKinetiCADStore,
        });
        topologyPicker.setResolution(canvasResW, canvasResH);

        // Phase 6 — TransformControls gizmo. Attached when a single part is
        // selected (and visible, no editor open, no sketch active). Drives
        // the part's transform via setPartTransformPartial; OrbitControls
        // are paused while the user drags a handle so the camera doesn't
        // fight for pointer events.
        transformGizmo = createTransformGizmo({
          camera,
          domElement: renderer.domElement,
          scene,
          onChange: (position, rotation) => {
            const mesh = lastReconciledGizmoMesh;
            if (!mesh) return;
            // Map mesh.name → partId. PartMeshLayer formats names as
            // `Part:${id}`; bail out if the format ever changes so we
            // don't silently corrupt unrelated meshes.
            const prefix = "Part:";
            if (!mesh.name.startsWith(prefix)) return;
            const partId = mesh.name.slice(prefix.length);
            // Three.js euler is in radians and uses 'XYZ' order; convert
            // back to degrees for the store / OCCT.
            const RAD = 180 / Math.PI;
            useKinetiCADStore.getState().setPartTransformPartial(partId, {
              positionMm: [position.x, position.y, position.z],
              rotationDeg: [
                rotation.x * RAD,
                rotation.y * RAD,
                rotation.z * RAD,
              ],
            });
          },
          onDraggingChanged: (dragging) => {
            gizmoDragging = dragging;
            if (controls) controls.enabled = !dragging;
          },
        });

        // Decide whether the gizmo should be attached, and if so to which
        // mesh. Suppression cases: no part selection, part hidden, sketch
        // session active, feature/boolean editor open, or the part mesh
        // simply isn't realised yet (regen pending). We detach instead of
        // hiding so a stray drag can't mutate a stale partId.
        const reconcileGizmo = (): void => {
          if (!transformGizmo || !partMeshLayer) return;
          const state = useKinetiCADStore.getState();
          const sel = state.selection;
          const blocked =
            state.sketchSession.active ||
            state.featureEditor.open ||
            state.booleanEditor.open ||
            // Don't yank the gizmo away mid-drag — the user is actively
            // manipulating the previously-attached mesh.
            gizmoDragging;
          if (sel?.kind !== "part" || blocked) {
            if (transformGizmo.isAttached()) {
              transformGizmo.detach();
              lastReconciledGizmoMesh = null;
            }
            return;
          }
          const part = state.assembly.parts.find((p) => p.id === sel.partId);
          if (!part || !part.visible) {
            if (transformGizmo.isAttached()) {
              transformGizmo.detach();
              lastReconciledGizmoMesh = null;
            }
            return;
          }
          const mesh = partMeshLayer.getPartMesh(sel.partId);
          if (!mesh) {
            // Part exists but its mesh isn't ready (no base feature yet,
            // or regen still pending). Detach until it shows up.
            if (transformGizmo.isAttached()) {
              transformGizmo.detach();
              lastReconciledGizmoMesh = null;
            }
            return;
          }
          if (lastReconciledGizmoMesh !== mesh) {
            transformGizmo.attach(mesh);
            lastReconciledGizmoMesh = mesh;
          }
          if (transformGizmo.getMode() !== gizmoMode) {
            transformGizmo.setMode(gizmoMode);
          }
        };

        // R/T keyboard shortcuts. Only act when the gizmo is currently
        // attached and the user isn't typing in an input.
        onGizmoKeydown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement | null;
          if (
            target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable)
          ) {
            return;
          }
          if (!transformGizmo || !transformGizmo.isAttached()) return;
          if (e.key === "r" || e.key === "R") {
            e.preventDefault();
            gizmoMode = "rotate";
            transformGizmo.setMode("rotate");
          } else if (e.key === "t" || e.key === "T") {
            e.preventDefault();
            gizmoMode = "translate";
            transformGizmo.setMode("translate");
          }
        };
        window.addEventListener("keydown", onGizmoKeydown);

        // Subscribe to store changes that affect gizmo attachment.
        unsubscribeGizmo = useKinetiCADStore.subscribe((state, prev) => {
          if (
            state.selection !== prev.selection ||
            state.assembly !== prev.assembly ||
            state.sketchSession.active !== prev.sketchSession.active ||
            state.featureEditor.open !== prev.featureEditor.open ||
            state.booleanEditor.open !== prev.booleanEditor.open
          ) {
            reconcileGizmo();
          }
        });

        // Resolve the selection-driven 'selected' highlights on the edge and
        // face layers. Re-runs on:
        //   - selection identity change (any reducer that touches selection)
        //   - topology version bump (a part regen completed and the cached
        //     edges/faces may now refer to different stable ids)
        // Uses the current store snapshot so the call site can be triggered
        // from anywhere (subscription or polling).
        const resolveSelectionHighlights = (): void => {
          const state = useKinetiCADStore.getState();
          const sel = state.selection;
          if (!partMeshLayer || !edgeHighlightLayer || !faceHighlightLayer) {
            return;
          }
          // Edges selection
          if (sel?.kind === "edges") {
            const topology = partMeshLayer.getPartTopology(sel.partId);
            if (!topology) {
              // Topology not loaded yet (regen in flight, or part hidden by
              // live preview). Clear visuals but keep the selection — it
              // may resolve once the regen finishes.
              edgeHighlightLayer.setSelected([]);
              faceHighlightLayer.setSelected(null, []);
              return;
            }
            const lookup = new Map(topology.edges.map((e) => [e.id, e]));
            const polylines: Float32Array[] = [];
            let anyResolved = false;
            for (const id of sel.edgeIds) {
              const e = lookup.get(id);
              if (e) {
                polylines.push(e.polyline);
                anyResolved = true;
              }
            }
            // Stale-id invalidation: topology is present but none of the
            // referenced edges exist any more (e.g. the user re-extruded
            // and the new geometry has different topology). Drop the
            // selection so future hovers/clicks aren't ghosting an old
            // highlight that will never come back.
            if (!anyResolved) {
              edgeHighlightLayer.setSelected([]);
              faceHighlightLayer.setSelected(null, []);
              useKinetiCADStore.getState().clearSelection();
              return;
            }
            edgeHighlightLayer.setSelected(polylines);
            faceHighlightLayer.setSelected(null, []);
            return;
          }
          // Face / point-on-face selection
          if (sel?.kind === "face" || sel?.kind === "point-on-face") {
            const topology = partMeshLayer.getPartTopology(sel.partId);
            const mesh = partMeshLayer.getPartMesh(sel.partId);
            if (!topology || !mesh) {
              edgeHighlightLayer.setSelected([]);
              faceHighlightLayer.setSelected(null, []);
              return;
            }
            const face = topology.faces.find((f) => f.id === sel.faceId);
            const positions = (
              mesh.geometry.getAttribute("position") as
                | THREE.BufferAttribute
                | null
            )?.array as Float32Array | undefined;
            const indices = (
              mesh.geometry.getIndex() as THREE.BufferAttribute | null
            )?.array as Uint32Array | undefined;
            if (!positions || !indices) {
              edgeHighlightLayer.setSelected([]);
              faceHighlightLayer.setSelected(null, []);
              return;
            }
            if (!face) {
              // Stale face id: topology+mesh both present but the id
              // doesn't resolve. Same reasoning as edges above.
              edgeHighlightLayer.setSelected([]);
              faceHighlightLayer.setSelected(null, []);
              useKinetiCADStore.getState().clearSelection();
              return;
            }
            const boundary = extractBoundaryPolylines(face, positions, indices);
            faceHighlightLayer.setSelected(
              { triangles: face.triangles, positions, indices },
              boundary,
            );
            edgeHighlightLayer.setSelected([]);
            return;
          }
          // Other / null selection: clear both.
          edgeHighlightLayer.setSelected([]);
          faceHighlightLayer.setSelected(null, []);
        };

        // Initial resolve in case selection survived a fast remount (it
        // shouldn't, since selection isn't persisted, but be defensive).
        resolveSelectionHighlights();

        // Selection-change subscription.
        unsubscribeSelection = useKinetiCADStore.subscribe((state, prev) => {
          if (state.selection !== prev.selection) {
            lastResolvedSelectionRef = state.selection;
            resolveSelectionHighlights();
          }
        });

        // Cheap per-frame check: if the part topology changed (a regen
        // completed) re-resolve highlights so a stale selection clears. This
        // is a Map identity check + a number compare, ~free unless we need
        // to actually rebuild buffers. Also re-check the gizmo attachment
        // because the part mesh handle is recreated on regen completion.
        perFrameTopologyCheck = (): void => {
          if (!partMeshLayer) return;
          const v = partMeshLayer.topologyVersion();
          const sel = useKinetiCADStore.getState().selection;
          if (
            v !== lastResolvedTopologyVersion ||
            sel !== lastResolvedSelectionRef
          ) {
            lastResolvedTopologyVersion = v;
            lastResolvedSelectionRef = sel;
            resolveSelectionHighlights();
            reconcileGizmo();
          }
        };

        // Initial reconcile in case a part selection survived a remount.
        reconcileGizmo();

        // Helpers: per-part and per-boolean visibility for the two layers.
        //
        // Three states per part / boolean:
        //   - hidden  → not rendered at all (preview REPLACES the body)
        //   - dimmed  → rendered at 0.4 opacity (preview OVERLAYS the body)
        //   - default → full opacity, no entry in either set
        //
        // Routing:
        //   - featureEditor open, CREATE on a base feature
        //     (extrude / revolve from sketch) → HIDE (preview is the body)
        //   - featureEditor open, CREATE on a modifier feature
        //     (fillet / chamfer / hole) → DEFAULT (body must stay visible
        //     so the user can hover edges/faces to pick them; preview
        //     overlays at 0.85)
        //   - featureEditor open, EDIT on any feature → DIM (so the user
        //     sees both before and after, with the preview at 0.85 over
        //     the dimmed body). Tied to livePreview because without an
        //     overlay, dimming a body for no reason is just confusing.
        //
        // Boolean inputs always HIDDEN when their boolean has
        // `hideInputs=true` (unchanged from before).
        // Boolean editor's target boolean is DIMMED in EDIT mode with
        // live-preview on (mirrors the per-part edit-mode rule); HIDDEN
        // is no longer used for the edited boolean because the preview
        // overlays at 0.85.
        const computePartVisibility = (
          state: ReturnType<typeof useKinetiCADStore.getState>,
        ): { hidden: Set<string>; dimmed: Set<string> } => {
          const hidden = new Set<string>();
          const dimmed = new Set<string>();
          const ed = state.featureEditor;
          if (ed.open) {
            const isModifier =
              ed.type === "fillet" ||
              ed.type === "chamfer" ||
              ed.type === "hole";
            const isBaseCreate = ed.mode === "create" && !isModifier;
            if (isBaseCreate && ed.livePreview) {
              hidden.add(ed.partId);
            } else if (ed.mode === "edit" && ed.livePreview) {
              dimmed.add(ed.partId);
            }
            // CREATE on a modifier → no entry → full opacity.
          }
          const editingBooleanId =
            state.booleanEditor.open && state.booleanEditor.mode === "edit"
              ? state.booleanEditor.featureId ?? null
              : null;
          for (const b of state.assembly.booleanFeatures) {
            if (!b.hideInputs) continue;
            if (b.id === editingBooleanId) continue;
            for (const id of b.inputPartIds) hidden.add(id);
          }
          if (state.booleanEditor.open && state.booleanEditor.params.hideInputs) {
            for (const id of state.booleanEditor.params.inputPartIds) {
              hidden.add(id);
            }
          }
          return { hidden, dimmed };
        };

        const computeBooleanVisibility = (
          state: ReturnType<typeof useKinetiCADStore.getState>,
        ): { hidden: Set<string>; dimmed: Set<string> } => {
          const hidden = new Set<string>();
          const dimmed = new Set<string>();
          if (
            state.booleanEditor.open &&
            state.booleanEditor.mode === "edit" &&
            state.booleanEditor.featureId &&
            state.booleanEditor.livePreview
          ) {
            dimmed.add(state.booleanEditor.featureId);
          }
          return { hidden, dimmed };
        };

        // Initial sync: render any persisted parts and boolean results.
        {
          const initialState = useKinetiCADStore.getState();
          const initialPartVis = computePartVisibility(initialState);
          const initialBooleanVis = computeBooleanVisibility(initialState);
          partMeshLayer.sync(
            initialState.assembly,
            initialPartVis.hidden,
            initialPartVis.dimmed,
            kernel,
          );
          booleanResultLayer.sync(
            initialState.assembly,
            initialBooleanVis.hidden,
            initialBooleanVis.dimmed,
            kernel,
          );
        }

        // Live preview pipeline. Watches the editor's parameters; on every
        // change we debounce 200ms then ask `previewFeature` for a fresh
        // mesh. The token guards against out-of-order kernel returns.
        const runPreview = (): void => {
          const state = useKinetiCADStore.getState();
          const editor = state.featureEditor;
          if (!editor.open || !editor.livePreview) {
            previewMeshLayer?.setMesh(null);
            lastPreviewHash = null;
            if (state.featurePreview.status !== "idle") {
              state.setFeaturePreview({
                status: "idle",
                error: null,
                details: null,
              });
            }
            return;
          }
          const part = state.assembly.parts.find(
            (p) => p.id === editor.partId,
          );
          const sketch = part?.sketches.find(
            (s) => s.id === editor.sketchId,
          );
          if (!part || !sketch) {
            previewMeshLayer?.setMesh(null);
            lastPreviewHash = null;
            return;
          }

          // Modifier features (fillet/chamfer/hole) need the upstream
          // feature chain to rebuild the OCCT shape. For 'edit' mode we
          // exclude the feature being edited so the preview replaces it
          // rather than stacking on top of itself.
          const isModifier =
            editor.type === "fillet" ||
            editor.type === "chamfer" ||
            editor.type === "hole";

          const upstreamFeatures: Feature[] = isModifier
            ? part.features.filter(
                (f) =>
                  editor.mode === "create" || f.id !== editor.featureId,
              )
            : [];

          let feature: Feature | null = null;
          if (editor.type === "extrude") {
            feature = {
              id: "preview",
              type: "extrude",
              sketchId: editor.sketchId,
              depthMm: editor.params.depthMm,
              direction: editor.params.direction,
            };
          } else if (editor.type === "revolve") {
            feature = {
              id: "preview",
              type: "revolve",
              sketchId: editor.sketchId,
              axis: editor.params.axis,
              angleDeg: editor.params.angleDeg,
            };
          } else if (editor.type === "fillet") {
            // Skip preview if the user hasn't picked any edges yet.
            if (editor.params.targetEdges.length === 0) {
              previewMeshLayer?.setMesh(null);
              lastPreviewHash = null;
              if (state.featurePreview.status !== "idle") {
                state.setFeaturePreview({
                  status: "idle",
                  error: null,
                  details: null,
                });
              }
              return;
            }
            feature = {
              id: "preview",
              type: "fillet",
              targetEdges: [...editor.params.targetEdges],
              radiusMm: editor.params.radiusMm,
            };
          } else if (editor.type === "chamfer") {
            if (editor.params.targetEdges.length === 0) {
              previewMeshLayer?.setMesh(null);
              lastPreviewHash = null;
              if (state.featurePreview.status !== "idle") {
                state.setFeaturePreview({
                  status: "idle",
                  error: null,
                  details: null,
                });
              }
              return;
            }
            feature = {
              id: "preview",
              type: "chamfer",
              targetEdges: [...editor.params.targetEdges],
              sizeMm: editor.params.sizeMm,
            };
          } else if (editor.type === "hole") {
            if (
              !editor.params.targetFace ||
              !editor.params.positionUV
            ) {
              previewMeshLayer?.setMesh(null);
              lastPreviewHash = null;
              if (state.featurePreview.status !== "idle") {
                state.setFeaturePreview({
                  status: "idle",
                  error: null,
                  details: null,
                });
              }
              return;
            }
            feature = {
              id: "preview",
              type: "hole",
              targetFace: editor.params.targetFace,
              positionUV: [
                editor.params.positionUV[0],
                editor.params.positionUV[1],
              ],
              diameterMm: editor.params.diameterMm,
              depthMm: editor.params.depthMm,
            };
          }
          if (!feature) return;

          const hash = computeFeatureHash(
            feature,
            part.sketches,
            upstreamFeatures.map((f) =>
              computeFeatureHash(f, part.sketches, []),
            ),
          );
          if (hash === lastPreviewHash) return;
          lastPreviewHash = hash;

          state.setFeaturePreview({
            status: "computing",
            error: null,
            details: null,
          });
          const myToken = ++previewToken;
          const opLabel = feature.type;
          previewFeature(feature, part.sketches, upstreamFeatures, kernel)
            .then((mesh) => {
              if (myToken !== previewToken) return;
              previewMeshLayer?.setMesh(mesh);
              useKinetiCADStore
                .getState()
                .setFeaturePreview({
                  status: "ok",
                  error: null,
                  details: null,
                });
            })
            .catch((err: unknown) => {
              if (myToken !== previewToken) return;
              previewMeshLayer?.setMesh(null);
              const message =
                err instanceof Error ? err.message : String(err);
              const stack =
                err instanceof Error && err.stack ? err.stack : null;
              // Always log on the MAIN thread console — Chrome's default
              // console filter hides worker-side console.error from the
              // page's DevTools view, which is why the previous fix didn't
              // surface anything to QA. Logging here guarantees the
              // exception is visible regardless of dev-tools settings.
              // eslint-disable-next-line no-console
              console.error(
                `[CAD] ${opLabel} preview failed: ${message}`,
                stack ?? "(no stack)",
              );
              const mapped = mapKernelError(message);
              const details = stack
                ? `${message}\n\n${stack}`
                : message;
              useKinetiCADStore
                .getState()
                .setFeaturePreview({
                  status: "error",
                  error: mapped.message,
                  details,
                });
            });
        };

        const schedulePreview = (): void => {
          if (previewDebounce) clearTimeout(previewDebounce);
          previewDebounce = setTimeout(runPreview, PREVIEW_DEBOUNCE_MS);
        };

        // Phase 5 — boolean editor live-preview pipeline. Mirrors
        // schedulePreview / runPreview but routes through `regenerateBoolean`
        // and writes into the same previewMeshLayer (the two pipelines are
        // mutually exclusive — only one editor can be open at a time).
        const clearBooleanPreview = (): void => {
          previewMeshLayer?.setMesh(null);
          lastBooleanPreviewHash = null;
          // Bump the token so any in-flight regenerateBoolean call's
          // resolution is discarded — otherwise a late mesh could land
          // after the inspector cancelled into an invalid state.
          booleanPreviewToken += 1;
          const s = useKinetiCADStore.getState();
          if (s.featurePreview.status !== "idle") {
            s.setFeaturePreview({
              status: "idle",
              error: null,
              details: null,
            });
          }
        };
        const runBooleanPreview = (): void => {
          const state = useKinetiCADStore.getState();
          const editor = state.booleanEditor;
          if (!editor.open || !editor.livePreview) {
            clearBooleanPreview();
            return;
          }
          const { params } = editor;
          // Same validation gates the inspector enforces — skip preview
          // until the user has a chance of producing valid output. Every
          // invalid-state branch must clear stale preview/error so the
          // viewport doesn't show a leftover mesh from an earlier valid
          // configuration the user just edited away from.
          if (params.inputPartIds.length < 2) {
            clearBooleanPreview();
            return;
          }
          if (params.operation.type === "subtract") {
            if (params.inputPartIds.length !== 2) {
              clearBooleanPreview();
              return;
            }
            if (
              !params.operation.toolPartId ||
              !params.inputPartIds.includes(params.operation.toolPartId)
            ) {
              clearBooleanPreview();
              return;
            }
          }
          // Build a transient BooleanFeature for the regen helper. The id is
          // arbitrary because we don't commit it; the cache key uses the
          // operation + input chain hashes anyway.
          const transient = {
            id: editor.featureId ?? "preview",
            type: "boolean" as const,
            operation: params.operation,
            inputPartIds: [...params.inputPartIds],
            resultPartName: params.resultPartName,
            hideInputs: params.hideInputs,
          };
          const hash = computeBooleanHash(transient, state.assembly.parts);
          if (hash === lastBooleanPreviewHash) return;
          lastBooleanPreviewHash = hash;

          state.setFeaturePreview({
            status: "computing",
            error: null,
            details: null,
          });
          const myToken = ++booleanPreviewToken;
          regenerateBoolean(transient, state.assembly.parts, kernel)
            .then((result) => {
              if (myToken !== booleanPreviewToken) return;
              if (result.error || !result.mesh) {
                previewMeshLayer?.setMesh(null);
                const rawMsg = result.error ?? "";
                const mapped = mapKernelError(rawMsg);
                // Surface the raw kernel message on the main-thread console
                // — see comment in the per-feature catch above for why this
                // can't rely on worker console.error reaching DevTools.
                // eslint-disable-next-line no-console
                console.error(
                  `[CAD] boolean preview failed: ${rawMsg}`,
                  result.stack ?? "(no stack)",
                );
                const details = result.stack
                  ? `${rawMsg}\n\n${result.stack}`
                  : rawMsg;
                useKinetiCADStore.getState().setFeaturePreview({
                  status: "error",
                  error: mapped.message,
                  details: details || null,
                });
                return;
              }
              previewMeshLayer?.setMesh(result.mesh);
              useKinetiCADStore
                .getState()
                .setFeaturePreview({
                  status: "ok",
                  error: null,
                  details: null,
                });
            })
            .catch((err: unknown) => {
              if (myToken !== booleanPreviewToken) return;
              previewMeshLayer?.setMesh(null);
              const message =
                err instanceof Error ? err.message : String(err);
              const stack =
                err instanceof Error && err.stack ? err.stack : null;
              // eslint-disable-next-line no-console
              console.error(
                `[CAD] boolean preview failed: ${message}`,
                stack ?? "(no stack)",
              );
              const mapped = mapKernelError(message);
              const details = stack ? `${message}\n\n${stack}` : message;
              useKinetiCADStore.getState().setFeaturePreview({
                status: "error",
                error: mapped.message,
                details,
              });
            });
        };

        const scheduleBooleanPreview = (): void => {
          if (booleanPreviewDebounce) clearTimeout(booleanPreviewDebounce);
          booleanPreviewDebounce = setTimeout(
            runBooleanPreview,
            PREVIEW_DEBOUNCE_MS,
          );
        };

        // Subscribe to assembly + featureEditor + booleanEditor changes. We
        // compare object identity to skip re-runs caused by unrelated state
        // updates (e.g. sketchSession changes during drawing).
        let prevAssembly = useKinetiCADStore.getState().assembly;
        let prevEditor = useKinetiCADStore.getState().featureEditor;
        let prevBooleanEditor = useKinetiCADStore.getState().booleanEditor;
        let prevPartVis = computePartVisibility(useKinetiCADStore.getState());
        let prevBooleanVis = computeBooleanVisibility(
          useKinetiCADStore.getState(),
        );

        const setsEqual = (a: Set<string>, b: Set<string>): boolean => {
          if (a.size !== b.size) return false;
          for (const v of a) if (!b.has(v)) return false;
          return true;
        };

        unsubscribeFeatureEditor = useKinetiCADStore.subscribe((state) => {
          const partVis = computePartVisibility(state);
          const booleanVis = computeBooleanVisibility(state);
          const editorChanged = state.featureEditor !== prevEditor;
          const booleanEditorChanged =
            state.booleanEditor !== prevBooleanEditor;
          const assemblyChanged = state.assembly !== prevAssembly;
          const partVisChanged =
            !setsEqual(partVis.hidden, prevPartVis.hidden) ||
            !setsEqual(partVis.dimmed, prevPartVis.dimmed);
          const booleanVisChanged =
            !setsEqual(booleanVis.hidden, prevBooleanVis.hidden) ||
            !setsEqual(booleanVis.dimmed, prevBooleanVis.dimmed);

          if (assemblyChanged || partVisChanged) {
            partMeshLayer?.sync(
              state.assembly,
              partVis.hidden,
              partVis.dimmed,
              kernel,
            );
          }
          if (assemblyChanged || booleanVisChanged) {
            booleanResultLayer?.sync(
              state.assembly,
              booleanVis.hidden,
              booleanVis.dimmed,
              kernel,
            );
          }

          if (editorChanged) {
            // Apply / cancel resets editor.open=false; if we just closed it,
            // also clear the preview mesh and reset the cached hash so the
            // next open re-computes from scratch.
            if (!state.featureEditor.open) {
              previewMeshLayer?.setMesh(null);
              lastPreviewHash = null;
              previewToken += 1; // invalidate any in-flight callback
              if (previewDebounce) {
                clearTimeout(previewDebounce);
                previewDebounce = null;
              }
            } else {
              schedulePreview();
            }
          }

          if (booleanEditorChanged) {
            if (!state.booleanEditor.open) {
              previewMeshLayer?.setMesh(null);
              lastBooleanPreviewHash = null;
              booleanPreviewToken += 1;
              if (booleanPreviewDebounce) {
                clearTimeout(booleanPreviewDebounce);
                booleanPreviewDebounce = null;
              }
            } else {
              scheduleBooleanPreview();
            }
          }

          prevAssembly = state.assembly;
          prevEditor = state.featureEditor;
          prevBooleanEditor = state.booleanEditor;
          prevPartVis = partVis;
          prevBooleanVis = booleanVis;
        });

        // Catch up if either editor was somehow already open at mount.
        if (useKinetiCADStore.getState().featureEditor.open) {
          schedulePreview();
        }
        if (useKinetiCADStore.getState().booleanEditor.open) {
          scheduleBooleanPreview();
        }

        // Surface kernel meta in the status so the loading panel hides.
        const meta = (await import("@/cad/cadClient")).getKernelMeta();
        setStatus({
          kind: "ready",
          initTimeMs: meta?.initTimeMs ?? 0,
        });
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("[SCENE] Initialisation failed:", err);
        setStatus({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Unknown error initialising the 3D scene.",
        });
      }
    })();

    return () => {
      cancelled = true;
      if (previewDebounce) clearTimeout(previewDebounce);
      if (booleanPreviewDebounce) clearTimeout(booleanPreviewDebounce);
      perFrameTopologyCheck = null;
      unsubscribeStore?.();
      unsubscribeAssembly?.();
      unsubscribeFeatureEditor?.();
      unsubscribeSelection?.();
      unsubscribeGizmo?.();
      if (onGizmoKeydown) {
        window.removeEventListener("keydown", onGizmoKeydown);
        onGizmoKeydown = null;
      }
      if (transformGizmo) {
        transformGizmo.dispose();
        transformGizmo = null;
        lastReconciledGizmoMesh = null;
      }
      sketchSessionHandle?.dispose();
      sketchSessionHandle = null;
      if (finishedLayer) {
        scene.remove(finishedLayer.group);
        finishedLayer.dispose();
        finishedLayer = null;
      }
      if (topologyPicker) {
        topologyPicker.dispose();
        topologyPicker = null;
      }
      if (edgeHighlightLayer) {
        edgeHighlightLayer.dispose();
        edgeHighlightLayer = null;
      }
      if (faceHighlightLayer) {
        faceHighlightLayer.dispose();
        faceHighlightLayer = null;
      }
      if (partMeshLayer) {
        partMeshLayer.dispose();
        partMeshLayer = null;
      }
      if (previewMeshLayer) {
        previewMeshLayer.dispose();
        previewMeshLayer = null;
      }
      if (booleanResultLayer) {
        booleanResultLayer.dispose();
        booleanResultLayer = null;
      }
      if (fpsTimer) clearInterval(fpsTimer);
      resizeObserver?.disconnect();
      controls?.dispose();
      disposeEnv?.();
      if (shadowCatcher) {
        scene.remove(shadowCatcher);
        shadowCatcher.geometry.dispose();
        (shadowCatcher.material as THREE.Material).dispose();
      }
      if (sketchOverlay) {
        scene.remove(sketchOverlay.group);
        sketchOverlay.dispose();
      }
      // Axes is a Group of cylinders + a sphere — walk and dispose all of it.
      scene.remove(axes);
      disposeObject3D(axes);
      scene.remove(grid);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      lights.ambient.dispose?.();
      lights.key.dispose?.();
      if (renderer) {
        renderer.setAnimationLoop(null);
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <SceneOverlay status={status} />
    </div>
  );
}

/**
 * Extract the boundary of a face's tessellated sub-mesh as discrete 2-point
 * polylines. The boundary edges are those that appear in exactly one
 * triangle of the face (edges shared by two triangles are interior).
 *
 * Drawn via Line2 by FaceHighlightLayer to give the selected face a crisp
 * outline. We don't bother stitching segments into loops because Line2
 * handles each polyline independently and the count is small (a few dozen
 * for any reasonable face).
 */
function extractBoundaryPolylines(
  face: FaceMetadata,
  positions: Float32Array,
  indices: Uint32Array,
): Float32Array[] {
  const counts = new Map<string, number>();
  const tris = face.triangles;
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    const v0 = indices[3 * t];
    const v1 = indices[3 * t + 1];
    const v2 = indices[3 * t + 2];
    const ab = v0 < v1 ? `${v0}-${v1}` : `${v1}-${v0}`;
    const bc = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
    const ca = v2 < v0 ? `${v2}-${v0}` : `${v0}-${v2}`;
    counts.set(ab, (counts.get(ab) ?? 0) + 1);
    counts.set(bc, (counts.get(bc) ?? 0) + 1);
    counts.set(ca, (counts.get(ca) ?? 0) + 1);
  }
  const out: Float32Array[] = [];
  for (const [key, count] of counts) {
    if (count !== 1) continue;
    const dash = key.indexOf("-");
    const a = Number(key.slice(0, dash));
    const b = Number(key.slice(dash + 1));
    out.push(
      new Float32Array([
        positions[3 * a],
        positions[3 * a + 1],
        positions[3 * a + 2],
        positions[3 * b],
        positions[3 * b + 1],
        positions[3 * b + 2],
      ]),
    );
  }
  return out;
}

function SceneOverlay({ status }: { status: Status }) {
  if (status.kind === "ready") return null;

  if (status.kind === "no-webgpu") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="max-w-sm text-center px-6">
          <div className="font-technical text-[11px] uppercase tracking-widest text-[#FF6B1A] mb-3">
            WebGPU required
          </div>
          <p className="font-sans text-sm text-foreground leading-relaxed">
            KinetiCAD requires WebGPU.
          </p>
          <p className="font-sans text-xs text-muted-foreground mt-2 leading-relaxed">
            Open in Chrome on an M-series Mac.
          </p>
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="max-w-md text-center px-6">
          <div className="font-technical text-[11px] uppercase tracking-widest text-destructive mb-3">
            Initialisation failed
          </div>
          <p className="font-technical text-xs text-muted-foreground leading-relaxed break-words">
            {status.message}
          </p>
        </div>
      </div>
    );
  }

  const label =
    status.kind === "checking-webgpu" ? "Checking WebGPU" : "Loading CAD kernel";

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded border border-[#FF6B1A]/40 flex items-center justify-center">
          <span
            className="text-[#FF6B1A] text-base"
            style={{
              animation: "kineticad-pulse 1.4s ease-in-out infinite",
            }}
          >
            ◱
          </span>
        </div>
        <div className="font-technical text-[11px] uppercase tracking-widest text-[#FF6B1A]">
          {label}&hellip;
        </div>
      </div>
      <style>{`
        @keyframes kineticad-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
