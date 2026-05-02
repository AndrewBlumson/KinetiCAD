import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SceneHandle } from "../types";

const LINES = [
  "The brief: build something Replit could repost.",
  "The differentiator: every other browser CAD",
  "stops at static geometry.",
  "KinetiCAD makes mechanisms move.",
];

export const Mission = forwardRef<SceneHandle>((_, ref) => {
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

      // Section label
      const label = root.querySelector<HTMLElement>("[data-label]");
      if (label) {
        master.fromTo(
          label,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
          start + 0.2,
        );
      }

      const lines = root.querySelectorAll<HTMLElement>("[data-mission-line]");
      master.fromTo(
        lines,
        { y: 22, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          ease: "power2.out",
          stagger: 0.45,
        },
        start + 0.5,
      );

      // Highlight the last line — "KinetiCAD makes mechanisms move."
      const highlight = root.querySelector<HTMLElement>("[data-mission-highlight]");
      if (highlight) {
        master.fromTo(
          highlight,
          { color: "#F5F5F5" },
          { color: "#FF6B1A", duration: 0.6, ease: "power2.inOut" },
          start + 2.3,
        );
      }

      // Fade out
      master.to(
        root,
        { opacity: 0, duration: 0.55, ease: "power2.inOut" },
        start + 7.4,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center opacity-0"
      data-scene="mission"
    >
      {/*
       * The linkage card is absolutely positioned at `right: 8vw` with
       * `width: 44vw`, occupying the right half of the viewport from
       * roughly 48vw onward. The text column must stay strictly left of
       * that boundary, with breathing room — we cap it at 38vw and pad
       * the left edge with px-24 so the text never reaches the box.
       */}
      <div className="flex h-full w-full items-center px-24">
        <div className="flex w-[38vw] max-w-[640px] flex-col gap-7">
          <span
            data-label
            className="font-mono text-xs uppercase tracking-[0.32em] text-orange opacity-0"
          >
            // Mission
          </span>
          <div className="flex flex-col gap-4">
            {LINES.map((ln, i) => (
              <p
                key={i}
                data-mission-line
                data-mission-highlight={i === LINES.length - 1 ? "true" : undefined}
                className={`opacity-0 leading-tight tracking-tight ${
                  i === LINES.length - 1
                    ? "font-display italic text-[52px] font-normal text-ink"
                    : "font-sans text-[40px] font-medium text-ink"
                }`}
              >
                {ln}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

Mission.displayName = "Mission";
