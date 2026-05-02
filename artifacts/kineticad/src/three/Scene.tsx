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
  computeFeatureHash,
  previewFeature,
} from "@/features/featureRegen";
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
    let edgeHighlightLayer: EdgeHighlightLayer | null = null;
    let faceHighlightLayer: FaceHighlightLayer | null = null;
    let topologyPicker: TopologyPicker | null = null;
    let unsubscribeSelection: (() => void) | null = null;
    let lastResolvedSelectionRef: unknown = undefined;
    let lastResolvedTopologyVersion = -1;
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
          disposeEnv = applyEnvironment(scene, renderer as unknown as THREE.WebGLRenderer);
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

        // Shadow catcher so part meshes have a grounded look. Same offset
        // and material as the Phase 1 test cube to keep visuals consistent.
        shadowCatcher = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.ShadowMaterial({ opacity: 0.35 }),
        );
        shadowCatcher.rotation.x = -Math.PI / 2;
        shadowCatcher.position.y = -5;
        shadowCatcher.receiveShadow = true;
        scene.add(shadowCatcher);

        // 3. Build the part / preview layers and wire them up to the store.
        partMeshLayer = createPartMeshLayer();
        previewMeshLayer = createPreviewMeshLayer();
        edgeHighlightLayer = createEdgeHighlightLayer();
        faceHighlightLayer = createFaceHighlightLayer();
        scene.add(partMeshLayer.group);
        scene.add(previewMeshLayer.group);
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
        // to actually rebuild buffers.
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
          }
        };

        // Helper: which part should PartMeshLayer hide because the preview
        // is currently overlaying it? Only when the editor is open AND the
        // user has live preview enabled.
        const computeHiddenPartId = (
          state: ReturnType<typeof useKinetiCADStore.getState>,
        ): string | null => {
          if (!state.featureEditor.open) return null;
          if (!state.featureEditor.livePreview) return null;
          return state.featureEditor.partId;
        };

        // Initial sync: render any persisted parts.
        partMeshLayer.sync(
          useKinetiCADStore.getState().assembly,
          computeHiddenPartId(useKinetiCADStore.getState()),
          kernel,
        );

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
              state.setFeaturePreview({ status: "idle", error: null });
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
                state.setFeaturePreview({ status: "idle", error: null });
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
                state.setFeaturePreview({ status: "idle", error: null });
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
                state.setFeaturePreview({ status: "idle", error: null });
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

          state.setFeaturePreview({ status: "computing", error: null });
          const myToken = ++previewToken;
          previewFeature(feature, part.sketches, upstreamFeatures, kernel)
            .then((mesh) => {
              if (myToken !== previewToken) return;
              previewMeshLayer?.setMesh(mesh);
              useKinetiCADStore
                .getState()
                .setFeaturePreview({ status: "ok", error: null });
            })
            .catch((err: unknown) => {
              if (myToken !== previewToken) return;
              previewMeshLayer?.setMesh(null);
              const message =
                err instanceof Error ? err.message : String(err);
              const mapped = mapKernelError(message);
              useKinetiCADStore
                .getState()
                .setFeaturePreview({
                  status: "error",
                  error: mapped.message,
                });
            });
        };

        const schedulePreview = (): void => {
          if (previewDebounce) clearTimeout(previewDebounce);
          previewDebounce = setTimeout(runPreview, PREVIEW_DEBOUNCE_MS);
        };

        // Subscribe to assembly + featureEditor changes. We compare object
        // identity to skip re-runs caused by unrelated state updates (e.g.
        // sketchSession changes during drawing).
        let prevAssembly = useKinetiCADStore.getState().assembly;
        let prevEditor = useKinetiCADStore.getState().featureEditor;
        let prevHidden = computeHiddenPartId(useKinetiCADStore.getState());

        unsubscribeFeatureEditor = useKinetiCADStore.subscribe((state) => {
          const hidden = computeHiddenPartId(state);
          const editorChanged = state.featureEditor !== prevEditor;
          const assemblyChanged = state.assembly !== prevAssembly;
          const hiddenChanged = hidden !== prevHidden;

          if (assemblyChanged || hiddenChanged) {
            partMeshLayer?.sync(state.assembly, hidden, kernel);
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

          prevAssembly = state.assembly;
          prevEditor = state.featureEditor;
          prevHidden = hidden;
        });

        // Catch up if the editor was somehow already open at mount.
        if (useKinetiCADStore.getState().featureEditor.open) {
          schedulePreview();
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
      perFrameTopologyCheck = null;
      unsubscribeStore?.();
      unsubscribeAssembly?.();
      unsubscribeFeatureEditor?.();
      unsubscribeSelection?.();
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
