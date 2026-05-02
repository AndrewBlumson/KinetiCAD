import { forwardRef, useImperativeHandle, useRef } from "react";
import gsap from "gsap";
import type { SceneHandle } from "../types";

const BLOCKS: { id: string; lines: string[] }[] = [
  {
    id: "b1",
    lines: ["Andrew,", "You asked for this.", "You have no idea how hard this was."],
  },
  {
    id: "b2",
    lines: ["12 hours straight. No break.", "One of the hardest builds I've done to date."],
  },
  {
    id: "b3",
    lines: ["But I don't like to disappoint.", "Especially not to another Andrew."],
  },
];

/**
 * Returns a typed-out span: each character is wrapped so the master timeline
 * can stagger their reveals. We pre-render every character at opacity 0; GSAP
 * just animates them in.
 */
function TypedLine({ text, dataKey }: { text: string; dataKey: string }) {
  return (
    <span
      className="scribe-underline relative inline-block"
      data-line={dataKey}
    >
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          data-char
          className="inline-block opacity-0"
          style={{ whiteSpace: "pre" }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export const OpeningAddress = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      // Show the wrapper at the very start of the scene.
      master.set(root, { opacity: 0 }, start);
      master.to(
        root,
        { opacity: 1, duration: 0.6, ease: "power2.inOut" },
        start,
      );

      // Each block: type its lines, hold, fade out
      // Block 1: 0.6 - 4.8s   (lines type 0.6-3.2, hold 3.2-3.8, fade 3.8-4.4)
      // Block 2: 4.8 - 7.6s
      // Block 3: 7.6 - 11.4s, hold extra 3s on last block per brief
      // Then root fade out by end (12s)
      const blocks = root.querySelectorAll<HTMLElement>("[data-block]");

      const blockSchedule = [
        { offset: 0.6, dwell: 1.0, fadeOut: true }, // ends ~4.4
        { offset: 4.8, dwell: 1.0, fadeOut: true }, // ends ~7.0
        { offset: 7.6, dwell: 3.0, fadeOut: false }, // hold 3s, then big fade
      ];

      blocks.forEach((block, idx) => {
        const sched = blockSchedule[idx];
        if (!sched) return;
        const t0 = start + sched.offset;
        const lines = block.querySelectorAll<HTMLElement>("[data-line]");

        // Set initial state
        master.set(block, { opacity: 1, y: 0 }, t0 - 0.01);

        let lineCursor = t0;
        lines.forEach((line) => {
          const chars = line.querySelectorAll<HTMLElement>("[data-char]");
          const dur = Math.max(0.5, chars.length * 0.05); // ~50ms per char
          // Reveal characters
          master.to(
            chars,
            {
              opacity: 1,
              duration: 0.05,
              stagger: 0.05,
              ease: "none",
            },
            lineCursor,
          );
          // Underline draws in beneath the line
          master.fromTo(
            line,
            { "--scribe": 0 } as gsap.TweenVars,
            {
              duration: dur * 0.7,
              ease: "power2.out",
              onUpdate: function () {
                const p = (this.progress?.() ?? 0) as number;
                line.style.setProperty("--scribe", String(p));
              },
            },
            lineCursor + 0.05,
          );
          // Manually animate the ::after via inline style on the line element
          // (we pin it through a CSS variable read by an attached after)
          lineCursor += dur + 0.25;
        });

        // Pause then fade
        const fadeStart = lineCursor + sched.dwell;
        master.to(
          block,
          { opacity: 0, y: -10, duration: 0.6, ease: "power2.inOut" },
          fadeStart,
        );
      });

      // Final wrapper fade-out at the end of the 12s window so scene 2 can rise.
      master.to(
        root,
        { opacity: 0, duration: 0.5, ease: "power2.inOut" },
        start + 11.4,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center justify-center opacity-0"
      data-scene="opening"
    >
      <div className="flex w-full max-w-[1100px] flex-col items-center gap-12 text-center">
        {BLOCKS.map((block, i) => (
          <div
            key={block.id}
            data-block
            className="flex flex-col items-center gap-4 opacity-0"
          >
            {block.lines.map((ln, j) => (
              <p
                key={j}
                className="font-mono text-[34px] font-medium leading-snug tracking-tight text-ink"
                style={{ position: "relative" }}
              >
                <TypedLine text={ln} dataKey={`${i}-${j}`} />
              </p>
            ))}
          </div>
        ))}
      </div>
      <UnderlineStyles />
    </div>
  );
});

OpeningAddress.displayName = "OpeningAddress";

/**
 * Inject the keyframe-style CSS that turns the [data-line] --scribe variable
 * into a horizontal scale on the underline pseudo-element. We can't write
 * this directly in a CSS file because the variable is per-element.
 */
function UnderlineStyles() {
  return (
    <style>
      {`
      [data-line]::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -8px;
        height: 2px;
        transform-origin: left center;
        transform: scaleX(var(--scribe, 0));
        background: linear-gradient(
          90deg,
          rgba(255,107,26,0) 0%,
          #FF6B1A 30%,
          #FF6B1A 70%,
          rgba(255,107,26,0) 100%
        );
      }
      `}
    </style>
  );
}
