import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SceneHandle } from "../types";

const CAPTIONS = [
  "13 bodies. 12 motorised revolute joints. One orrery.",
  "60 RPM. 60 FPS. Browser tab.",
  "No install. No license. No CAD seat.",
];

export const KillerDemo = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      // Background overlay fades in (the linkage container will already be
      // sized to fullscreen by the App-level orchestration).
      master.set(root, { opacity: 0 }, start);
      master.to(
        root,
        { opacity: 1, duration: 0.6, ease: "power2.inOut" },
        start,
      );

      const caps = root.querySelectorAll<HTMLElement>("[data-caption]");

      // Per the brief: cap1 hold ~8s; cap2 appears ~13s in (after camera zoom +
      // re-orbit); cap3 appears ~18s in. Hold cap3 ~4s, then fade scene out.
      const schedule = [
        { in: 1.0, out: 9.0 }, // 0-8s after a 1s lead-in
        { in: 13.0, out: 18.0 }, // 13-18
        { in: 18.5, out: 24.5 }, // 18.5-24.5
      ];

      caps.forEach((cap, i) => {
        const s = schedule[i];
        if (!s) return;
        master.fromTo(
          cap,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.4)" },
          start + s.in,
        );
        master.to(
          cap,
          { y: -10, opacity: 0, duration: 0.6, ease: "power2.inOut" },
          start + s.out,
        );
      });

      // Lower-third bar fades in just before each caption window
      const bar = root.querySelector<HTMLElement>("[data-lower-third]");
      if (bar) {
        master.fromTo(
          bar,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
          start + 0.6,
        );
        master.to(
          bar,
          { opacity: 0, y: 18, duration: 0.6, ease: "power2.inOut" },
          start + 24.5,
        );
      }

      // Vignette overlay fades out at the very end
      master.to(
        root,
        { opacity: 0, duration: 0.6, ease: "power2.inOut" },
        start + 24.5,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="vignette absolute inset-0 pointer-events-none opacity-0"
      data-scene="killer"
    >
      {/*
       * Lower-third caption strip. Anchored to the very bottom of the
       * viewport, full width, with a soft gradient underlay so the text
       * never overlaps the orbiting linkage in the centre of the screen.
       * Captions are stacked positionally (each `absolute` inside a fixed
       * 1080px box that itself has explicit width — without explicit width
       * the absolute children would collapse the relative parent to 0 and
       * render the text as a narrow vertical column over the mechanism).
       */}
      <div
        data-lower-third
        className="absolute inset-x-0 bottom-0 flex justify-center pb-10 pt-24 opacity-0 bg-gradient-to-t from-navy/95 via-navy/65 to-navy/0"
      >
        <div className="relative h-[80px] w-full max-w-[1080px] px-8">
          {CAPTIONS.map((c, i) => (
            <p
              key={i}
              data-caption
              className={`absolute inset-x-8 bottom-0 text-center whitespace-nowrap opacity-0 ${
                i === 0
                  ? "font-sans text-[32px] font-bold tracking-tight text-ink"
                  : i === 1
                    ? "font-mono text-[26px] font-semibold tracking-[0.04em] text-orange"
                    : "font-sans text-[28px] font-semibold tracking-tight text-ink"
              }`}
            >
              {c}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
});

KillerDemo.displayName = "KillerDemo";
