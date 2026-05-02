import { forwardRef, useImperativeHandle, useRef } from "react";
import { Equation } from "../components/Equation";
import type { SceneHandle } from "../types";

interface MathBlock {
  tex: string;
  caption: React.ReactNode;
}

const BLOCKS: MathBlock[] = [
  {
    tex: "M = T \\cdot R_{x} \\cdot R_{y} \\cdot R_{z}",
    caption: (
      <>
        Translation and rotation composed in OCCT to match Three.js{" "}
        <span className="font-mono text-orange">XYZ</span> Euler order. Booleans
        operate in world space after this transform is baked in.
      </>
    ),
  },
  {
    tex: "\\boxed{\\text{Stable hash: } f(\\text{geometry}) \\rightarrow \\text{ID}}",
    caption: (
      <>
        Topological naming via canonical geometry hash. Edges and faces survive
        parameter edits.{" "}
        <span className="font-mono text-orange">Fillet 1</span> stays attached to
        the same edge even if the upstream extrude depth changes.
      </>
    ),
  },
  {
    tex: "12\\;\\text{tris/cube} \\,\\cdot\\, 60\\;\\text{FPS} \\,\\cdot\\, 16\\;\\text{ms budget}",
    caption: (
      <>
        Performance target. Hit consistently on{" "}
        <span className="font-mono text-orange">M4 Chrome</span>.
      </>
    ),
  },
];

// Scene 5 spans 15s. Each equation gets ~5s on screen with overlapping fades.
const PER_BLOCK = 5;

export const Maths = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      master.set(root, { opacity: 0 }, start);
      master.to(
        root,
        { opacity: 1, duration: 0.5, ease: "power2.inOut" },
        start,
      );

      const blocks = root.querySelectorAll<HTMLElement>("[data-math-block]");
      blocks.forEach((block, i) => {
        const t0 = start + 0.4 + i * PER_BLOCK;
        const eq = block.querySelector<HTMLElement>("[data-eq]");
        const cap = block.querySelector<HTMLElement>("[data-cap]");

        master.set(block, { opacity: 1 }, t0 - 0.01);
        if (eq) {
          master.fromTo(
            eq,
            { y: 24, opacity: 0, scale: 0.94 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.7,
              ease: "back.out(1.7)",
            },
            t0,
          );
        }
        if (cap) {
          master.fromTo(
            cap,
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
            t0 + 0.4,
          );
        }

        // Fade the block out unless it's the last one (handled by scene fade)
        if (i < blocks.length - 1) {
          master.to(
            block,
            { opacity: 0, y: -10, duration: 0.5, ease: "power2.inOut" },
            t0 + PER_BLOCK - 0.6,
          );
        }
      });

      master.to(
        root,
        { opacity: 0, duration: 0.6, ease: "power2.inOut" },
        start + 14.4,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center justify-center opacity-0"
      data-scene="maths"
    >
      <div className="relative flex w-full max-w-[1100px] flex-col items-center justify-center px-12">
        <div className="mb-12 flex items-center gap-4 self-stretch">
          <span className="font-mono text-xs uppercase tracking-[0.32em] text-orange">
            // Mathematics
          </span>
          <span className="h-px flex-1 bg-orange/30" />
        </div>
        <div className="relative h-[360px] w-full">
          {BLOCKS.map((b, i) => (
            <div
              key={i}
              data-math-block
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-10 opacity-0"
            >
              <div data-eq>
                <Equation
                  tex={b.tex}
                  className="font-mono text-[44px] text-ink"
                />
              </div>
              <p
                data-cap
                className="max-w-[820px] text-center font-sans text-[18px] leading-[1.55] text-ink/75"
              >
                {b.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

Maths.displayName = "Maths";
