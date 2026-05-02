import { forwardRef, useImperativeHandle, useRef } from "react";
import type { SceneHandle } from "../types";

const ITEMS: { label: string }[] = [
  { label: "Worker self-test on every kernel boot" },
  { label: "12 regression tests run by Claude in Chrome (continuous QA)" },
  { label: "Architect code review on every commit" },
  { label: "End-to-end visual verification on M-series Chrome" },
  { label: "Manual gizmo and mate-picker testing" },
  { label: "Cross-phase memory leak monitoring (OCCT handles)" },
];

const SCENE_DURATION = 10;

export const Testing = forwardRef<SceneHandle>((_, ref) => {
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

      const heading = root.querySelector<HTMLElement>("[data-heading]");
      if (heading) {
        master.fromTo(
          heading,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, ease: "power2.out" },
          start + 0.2,
        );
      }

      const items = root.querySelectorAll<HTMLElement>("[data-item]");
      const itemStart = 0.7;
      const totalItemTime = SCENE_DURATION - 2.5; // leave room for footer + fade
      const stagger = totalItemTime / ITEMS.length;

      items.forEach((item, i) => {
        const t = start + itemStart + i * stagger;
        const check = item.querySelector<HTMLElement>("[data-check]");
        const text = item.querySelector<HTMLElement>("[data-text]");

        master.set(item, { opacity: 1 }, t - 0.01);
        if (check) {
          master.fromTo(
            check,
            { scale: 0.4, opacity: 0, rotate: -25 },
            {
              scale: 1,
              opacity: 1,
              rotate: 0,
              duration: 0.5,
              ease: "back.out(1.7)",
            },
            t,
          );
        }
        if (text) {
          master.fromTo(
            text,
            { x: 16, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.5, ease: "power2.out" },
            t + 0.05,
          );
        }
      });

      // Footer line
      const footer = root.querySelector<HTMLElement>("[data-footer]");
      if (footer) {
        master.fromTo(
          footer,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
          start + SCENE_DURATION - 2.0,
        );
      }

      master.to(
        root,
        { opacity: 0, duration: 0.55, ease: "power2.inOut" },
        start + SCENE_DURATION - 0.6,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center justify-center opacity-0"
      data-scene="testing"
    >
      <div className="flex w-full max-w-[1100px] flex-col gap-10 px-12">
        <div data-heading className="flex items-center gap-4 opacity-0">
          <span className="font-mono text-xs uppercase tracking-[0.32em] text-orange">
            // Testing
          </span>
          <h2 className="font-sans text-[42px] font-bold text-ink">
            Quality assurance
          </h2>
          <span className="h-px flex-1 bg-orange/30" />
        </div>

        <ul className="flex flex-col gap-3">
          {ITEMS.map((item, i) => (
            <li
              key={i}
              data-item
              className="flex items-center gap-5 rounded-md border border-orange/15 bg-navy-2/55 px-6 py-4 opacity-0"
            >
              <span
                data-check
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange/15 ring-1 ring-orange/40"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12.5L10 17.5L19 7"
                    stroke="#FF6B1A"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span data-text className="font-mono text-[16px] text-ink">
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <p
          data-footer
          className="max-w-[820px] font-sans text-[16px] leading-[1.6] text-ink/75 opacity-0"
        >
          <span className="font-mono text-orange">Six</span> full QA regression
          passes during the build. Every phase verified end-to-end before
          proceeding to the next.
        </p>
      </div>
    </div>
  );
});

Testing.displayName = "Testing";
