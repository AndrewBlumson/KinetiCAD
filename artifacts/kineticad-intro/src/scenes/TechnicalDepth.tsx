import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SceneHandle } from "../types";

interface Layer {
  id: string;
  name: string;
}

interface Bullet {
  /** Layer ID this bullet binds to. */
  layer: string;
  body: React.ReactNode;
}

const LAYERS: Layer[] = [
  { id: "react", name: "React 19 UI Layer" },
  { id: "zustand", name: "Zustand State Management" },
  { id: "three", name: "Three.js WebGPU Renderer (r184)" },
  { id: "occt", name: "OpenCascade.js B-rep Kernel (WebAssembly)" },
  { id: "worker", name: "Web Worker (kernel isolation)" },
  { id: "rapier", name: "Rapier3D Physics Engine (Web Worker)" },
];

const BULLETS: Bullet[] = [
  {
    layer: "occt",
    body: (
      <>
        <strong className="text-ink">Real B-rep geometry.</strong>{" "}
        <span className="font-mono text-orange">OpenCascade</span>, the same CAD kernel
        as FreeCAD, compiled to WebAssembly.{" "}
        <span className="font-mono text-ink">~30MB WASM.</span> Runs in a dedicated
        Web Worker so the main thread stays at{" "}
        <span className="font-mono text-ink">60 fps</span> while the kernel computes.
      </>
    ),
  },
  {
    layer: "three",
    body: (
      <>
        <strong className="text-ink">WebGPU rendering.</strong>{" "}
        <span className="font-mono text-orange">Three.js r184</span> with the modern GPU
        pipeline. PBR materials, environment lighting, soft shadows, no WebGL fallback.
        Designed for M-series Macs.
      </>
    ),
  },
  {
    layer: "occt",
    body: (
      <>
        <strong className="text-ink">Parametric features.</strong>{" "}
        <span className="font-mono text-ink-dim">
          Sketch on plane → wire → face → prism.
        </span>{" "}
        Extrude, revolve, fillet, chamfer, hole, boolean operations
        (<span className="font-mono text-orange">union, subtract, intersect</span>).
        All operations cached by parameter hash for instant re-render.
      </>
    ),
  },
  {
    layer: "three",
    body: (
      <>
        <strong className="text-ink">Z-up CAD convention.</strong> Mechanical convention
        with the floor as the{" "}
        <span className="font-mono text-orange">XY plane</span> and{" "}
        <span className="font-mono text-orange">Z as up</span>. Camera, OrbitControls,
        plane normals, Euler order all aligned.
      </>
    ),
  },
  {
    layer: "rapier",
    body: (
      <>
        <strong className="text-ink">Rapier3D physics.</strong> Rust-to-WASM physics
        engine. <span className="font-mono text-ink">60Hz simulation.</span> Mass derived
        from material density and computed volume. Joint constraints applied as
        Rapier joints.
      </>
    ),
  },
  {
    layer: "rapier",
    body: (
      <>
        <strong className="text-ink">Mate joints.</strong> Five types:{" "}
        <span className="font-mono text-orange">
          revolute, prismatic, spherical, fixed, planar
        </span>
        . Each maps to a Rapier joint constraint. Motors apply continuous force to
        revolute and prismatic mates.
      </>
    ),
  },
  {
    layer: "occt",
    body: (
      <>
        <strong className="text-ink">STEP round-trip + Save/Load.</strong>{" "}
        Import STEP files into the assembly, model over them, and export back to STEP for
        downstream tooling. Save the full assembly state to a{" "}
        <span className="font-mono text-orange">portable JSON file</span> and reload
        it at any time — no proprietary format, no cloud account.
      </>
    ),
  },
  {
    layer: "rapier",
    body: (
      <>
        <strong className="text-ink">8-material library.</strong>{" "}
        <span className="font-mono text-orange">
          Aluminium, steel, brass, titanium, nylon, PLA, ABS, acrylic
        </span>
        — each with real density. The physics simulation derives mass and rotational
        inertia directly from computed{" "}
        <span className="font-mono text-ink">volume × density</span>, so the orrery's
        13 bodies behave correctly without manual mass entry.
      </>
    ),
  },
];

const SCENE_DURATION = 30; // seconds

export const TechnicalDepth = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      master.set(root, { opacity: 0 }, start);
      master.to(
        root,
        { opacity: 1, duration: 0.6, ease: "power2.inOut" },
        start,
      );

      // Title
      const title = root.querySelector<HTMLElement>("[data-title]");
      if (title) {
        master.fromTo(
          title,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
          start + 0.3,
        );
      }

      // Initial layer reveal — layers slide in from left
      const layers = root.querySelectorAll<HTMLElement>("[data-layer]");
      master.fromTo(
        layers,
        { x: -40, opacity: 0 },
        {
          x: 0,
          opacity: 0.55,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.08,
        },
        start + 0.6,
      );

      // Bullets — each bullet appears in sync with its associated layer glowing
      const bullets = root.querySelectorAll<HTMLElement>("[data-bullet]");
      const bulletStart = 1.6; // first bullet starts 1.6s into the scene
      const bulletGap = (SCENE_DURATION - bulletStart - 2.0) / BULLETS.length; // ~4.4s each

      // Make sure every bullet starts at opacity 0 under GSAP control so
      // there's no flash before its fade-in fires.
      master.set(bullets, { opacity: 0, x: 30 }, start);

      bullets.forEach((bullet, i) => {
        const t = start + bulletStart + i * bulletGap;
        const layerId = bullet.dataset.layerRef;
        const layerEl = layerId
          ? root.querySelector<HTMLElement>(`[data-layer="${layerId}"]`)
          : null;

        // Fade out the previous bullet first so it's fully gone before the
        // next one starts fading in (clean swap, no overlap).
        if (i > 0) {
          const prev = bullets[i - 1];
          master.to(
            prev,
            { opacity: 0, x: -24, duration: 0.45, ease: "power2.in" },
            t - 0.55,
          );
        }

        // Bullet fade in (starts after previous bullet is fully gone).
        master.fromTo(
          bullet,
          { x: 30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" },
          t,
        );

        // Linked layer glow
        if (layerEl) {
          master.to(
            layerEl,
            {
              opacity: 1,
              duration: 0.35,
              ease: "power2.out",
              boxShadow:
                "0 0 0 1px rgba(255,107,26,0.65), 0 0 32px rgba(255,107,26,0.55)",
              backgroundColor: "rgba(255,107,26,0.16)",
              borderColor: "rgba(255,107,26,0.55)",
              color: "#F5F5F5",
            },
            t,
          );
          // Decay glow before the next bullet, but keep the active layer slightly lit.
          master.to(
            layerEl,
            {
              boxShadow: "0 0 0 1px rgba(255,107,26,0.18), 0 0 12px rgba(255,107,26,0.18)",
              backgroundColor: "rgba(255,107,26,0.06)",
              duration: 0.6,
              ease: "power2.inOut",
            },
            t + 1.3,
          );
        }
      });

      // Fade out the final bullet so the scene ends clean.
      const lastBullet = bullets[bullets.length - 1];
      if (lastBullet) {
        master.to(
          lastBullet,
          { opacity: 0, x: -24, duration: 0.5, ease: "power2.in" },
          start + SCENE_DURATION - 1.4,
        );
      }

      // Fade scene out at the end
      master.to(
        root,
        { opacity: 0, duration: 0.7, ease: "power2.inOut" },
        start + SCENE_DURATION - 1,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center opacity-0"
      data-scene="technical"
    >
      <div className="grid h-full w-full grid-cols-12 gap-10 px-20 pt-24 pb-16">
        {/* Section header */}
        <div
          data-title
          className="col-span-12 -mb-2 flex items-center gap-4 opacity-0"
        >
          <span className="font-mono text-xs uppercase tracking-[0.32em] text-orange">
            // The Stack
          </span>
          <span className="h-px flex-1 bg-orange/30" />
          <span className="font-mono text-xs uppercase tracking-[0.32em] text-ink-mute">
            Six layers · Browser-native · Zero install
          </span>
        </div>

        {/* Left: layer stack */}
        <div className="col-span-5 flex flex-col justify-center gap-3">
          {LAYERS.map((layer, i) => (
            <div
              key={layer.id}
              data-layer={layer.id}
              className="flex items-center gap-4 rounded-md border px-5 py-4 font-mono text-[15px] text-ink/55 opacity-0"
              style={{
                borderColor: "rgba(255,107,26,0.18)",
                backgroundColor: "rgba(17,22,42,0.6)",
              }}
            >
              <span className="font-mono text-xs text-orange/80">
                {String(LAYERS.length - i).padStart(2, "0")}
              </span>
              <span className="text-current">{layer.name}</span>
            </div>
          ))}
        </div>

        {/* Right: bullets (only the active one or two visible thanks to fade choreography) */}
        <div className="col-span-7 flex flex-col justify-center">
          <div className="relative h-[420px]">
            {BULLETS.map((b, i) => (
              <p
                key={i}
                data-bullet
                data-layer-ref={b.layer}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 font-sans text-[19px] leading-[1.55] text-ink/85 opacity-0"
              >
                {b.body}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

TechnicalDepth.displayName = "TechnicalDepth";
