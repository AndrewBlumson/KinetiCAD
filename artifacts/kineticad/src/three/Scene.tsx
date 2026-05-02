// React-owned Three.js scene. Mounts a single canvas, builds the WebGPU
// renderer, runs the orbit camera and render loop, and renders the test cube
// supplied by the CAD worker.
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

type Status =
  | { kind: "checking-webgpu" }
  | { kind: "no-webgpu" }
  | { kind: "loading-kernel" }
  | { kind: "loading-geometry" }
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
    let cubeMesh: THREE.Mesh | null = null;
    let shadowCatcher: THREE.Mesh | null = null;
    let disposeEnv: (() => void) | null = null;
    let fpsTimer: ReturnType<typeof setInterval> | null = null;
    let frameCounter = 0;
    let cameraTween: CameraTween | null = null;
    let sketchOverlay: SketchOverlay | null = null;
    let unsubscribeStore: (() => void) | null = null;

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
        // Loose typing: WebGPU types aren't in the default lib. The runtime
        // contract we care about is just `requestAdapter` resolving to truthy.
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
        // Initial plane is XY but it's invisible at first so it doesn't matter.
        sketchOverlay = createSketchOverlay("XY");
        sketchOverlay.group.visible = false;
        scene.add(sketchOverlay.group);

        // Sketch session sync: reconcile the current sketch state with the
        // camera, overlay, and orbit controls. We subscribe to the store AND
        // run the reconciler once immediately so an already-active session
        // (e.g. user clicked "New Sketch" before the scene finished booting)
        // gets picked up — `subscribe` only fires on subsequent changes.
        let prevSketchActive = false;
        let prevSketchPlane: CardinalPlane | null = null;

        const reconcileSketch = (state: ReturnType<typeof useKinetiCADStore.getState>) => {
          if (!controls || !sketchOverlay) return;
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
              prevSketchActive = true;
              prevSketchPlane = session.plane;
            }
          } else if (prevSketchActive) {
            // Exiting sketch — animate back to the default 3D view.
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
            prevSketchActive = false;
            prevSketchPlane = null;
          }
        };

        unsubscribeStore = useKinetiCADStore.subscribe(reconcileSketch);
        // Catch up to any sketch state set before this subscription existed.
        reconcileSketch(useKinetiCADStore.getState());

        // Render loop. WebGPU requires setAnimationLoop, not rAF.
        const renderLoop = () => {
          if (!renderer) return;

          // Camera tween, if any. We disable controls during the tween and
          // either re-enable on completion (exit) or leave disabled (enter).
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

        // Resize handling via ResizeObserver so we react to panel changes too,
        // not just window resizes.
        resizeObserver = new ResizeObserver((entries) => {
          if (!renderer) return;
          const entry = entries[0];
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) return;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        });
        resizeObserver.observe(container);

        // 2. Boot the CAD kernel and request the test cube.
        setStatus({ kind: "loading-kernel" });
        const kernel = await getCadKernel();
        if (cancelled) return;

        setStatus({ kind: "loading-geometry" });
        const meshData = await kernel.createTestCube(10);
        if (cancelled) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(meshData.positions, 3),
        );
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(meshData.normals, 3),
        );
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const material = new THREE.MeshStandardMaterial({
          color: COLOURS.defaultPart,
          metalness: 0.4,
          roughness: 0.5,
        });

        cubeMesh = new THREE.Mesh(geometry, material);
        cubeMesh.castShadow = true;
        cubeMesh.receiveShadow = true;
        cubeMesh.name = "TestCube";
        scene.add(cubeMesh);

        // Shadow catcher under the cube so the lighting reads as grounded.
        shadowCatcher = new THREE.Mesh(
          new THREE.PlaneGeometry(200, 200),
          new THREE.ShadowMaterial({ opacity: 0.35 }),
        );
        shadowCatcher.rotation.x = -Math.PI / 2;
        shadowCatcher.position.y = -5;
        shadowCatcher.receiveShadow = true;
        scene.add(shadowCatcher);

        // Surface kernel meta in the status so the loading panel can hide.
        // eslint-disable-next-line no-console
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
      unsubscribeStore?.();
      if (fpsTimer) clearInterval(fpsTimer);
      resizeObserver?.disconnect();
      controls?.dispose();
      disposeEnv?.();
      if (cubeMesh) {
        scene.remove(cubeMesh);
        cubeMesh.geometry.dispose();
        (cubeMesh.material as THREE.Material).dispose();
      }
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
    status.kind === "checking-webgpu"
      ? "Checking WebGPU"
      : status.kind === "loading-kernel"
        ? "Loading CAD kernel"
        : "Tessellating geometry";

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
