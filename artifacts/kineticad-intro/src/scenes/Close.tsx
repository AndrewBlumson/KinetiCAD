import { forwardRef, useImperativeHandle, useRef } from "react";
import { KLogo } from "../components/KLogo";
import type { SceneHandle } from "../types";

const SCENE_DURATION = 15;

export const Close = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      master.set(root, { opacity: 0 }, start);
      master.to(
        root,
        { opacity: 1, duration: 0.7, ease: "power2.inOut" },
        start,
      );

      // Block 1: KinetiCAD / Built solo / Replit 10 Buildathon
      const block1Lines = root.querySelectorAll<HTMLElement>("[data-b1-line]");
      master.fromTo(
        block1Lines,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "back.out(1.5)",
          stagger: 0.16,
        },
        start + 0.6,
      );

      // Block 2: credits — appears ~3s in
      const block2Lines = root.querySelectorAll<HTMLElement>("[data-b2-line]");
      master.fromTo(
        block2Lines,
        { y: 14, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.14,
        },
        start + 4.2,
      );

      // Block 3: try it / URL — appears ~8s in
      const block3 = root.querySelector<HTMLElement>("[data-b3]");
      if (block3) {
        master.fromTo(
          block3,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
          start + 7.5,
        );
      }

      // Logo lockup at the bottom
      const lockup = root.querySelector<HTMLElement>("[data-lockup]");
      if (lockup) {
        master.fromTo(
          lockup,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
          start + 8.6,
        );
      }

      // Fade-to-black at the end of the scene
      master.to(
        root,
        { opacity: 0, duration: 1.2, ease: "power2.inOut" },
        start + SCENE_DURATION - 1.4,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex flex-col items-center justify-between py-24 opacity-0"
      data-scene="close"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <p
            data-b1-line
            className="font-sans text-[80px] font-extrabold tracking-[-0.04em] text-ink opacity-0"
          >
            KinetiCAD.
          </p>
          <p
            data-b1-line
            className="font-mono text-[20px] tracking-[0.04em] text-ink-dim opacity-0"
          >
            Built solo in 24 hours.
          </p>
          <p
            data-b1-line
            className="font-mono text-[16px] uppercase tracking-[0.32em] text-orange opacity-0"
          >
            Replit 10 Buildathon · 02/05/2026
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p
            data-b2-line
            className="font-sans text-[20px] text-ink opacity-0"
          >
            Andrew Blumson, Adevious AI Ltd.
          </p>
          <p
            data-b2-line
            className="font-mono text-[14px] uppercase tracking-[0.32em] text-ink-dim opacity-0"
          >
            UK Replit Ambassador
          </p>
        </div>

        <p
          data-b3
          className="font-mono text-[16px] tracking-[0.04em] text-ink-dim opacity-0"
        >
          <span className="text-orange">Try it →</span>{" "}
          <span className="text-ink">KinetiCAD.replit.app</span>
        </p>
      </div>

      <div
        data-lockup
        className="flex w-full items-center justify-between px-20 opacity-0"
      >
        <div className="flex items-center gap-3">
          <KLogo size={42} />
          <span className="font-mono text-sm uppercase tracking-[0.28em] text-ink-dim">
            KinetiCAD
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm uppercase tracking-[0.28em] text-ink-dim">
            Replit
          </span>
          <img
            src={`${import.meta.env.BASE_URL}replit-logo.png`}
            alt="Replit"
            className="h-8 w-auto"
          />
        </div>
      </div>
    </div>
  );
});

Close.displayName = "Close";
