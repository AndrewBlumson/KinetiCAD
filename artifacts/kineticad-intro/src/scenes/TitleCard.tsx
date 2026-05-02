import { forwardRef, useImperativeHandle, useRef } from "react";
import { KLogo } from "../components/KLogo";
import type { SceneHandle } from "../types";

export const TitleCard = forwardRef<SceneHandle>((_, ref) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    register(master, start) {
      const root = rootRef.current;
      if (!root) return;

      master.set(root, { opacity: 0 }, start);
      master.to(root, { opacity: 1, duration: 0.4, ease: "power2.out" }, start);

      // Logo slides in from the left
      const logo = root.querySelector<HTMLElement>("[data-logo]");
      if (logo) {
        master.fromTo(
          logo,
          { x: -60, scale: 0.85, opacity: 0 },
          { x: 0, scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.7)" },
          start + 0.4,
        );
      }

      // Title rises into place as one word so font kerning (especially around
      // narrow glyphs like the lowercase "i") remains intact. Splitting the
      // word into per-letter `inline-block` spans disables kerning and makes
      // the "i" sit visibly off-centre between "t" and "C".
      const title = root.querySelector<HTMLElement>("[data-title]");
      if (title) {
        master.fromTo(
          title,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: "back.out(1.4)" },
          start + 0.5,
        );
      }

      // Subtitle lines
      const subs = root.querySelectorAll<HTMLElement>("[data-sub]");
      master.fromTo(
        subs,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.12,
        },
        start + 1.4,
      );

      // Hold ~3s then fade out
      master.to(
        root,
        { opacity: 0, duration: 0.55, ease: "power2.inOut" },
        start + 4.6,
      );
    },
  }));

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 flex items-center justify-center opacity-0"
      data-scene="title"
    >
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-7">
          <div data-logo>
            <KLogo size={92} />
          </div>
          {/*
           * Hero title rendered in all-caps. The mixed-case "KinetiCAD"
           * brand reads beautifully at body sizes, but at 140px display
           * weight the lowercase "i" between "t" and "C" never quite
           * settles — the dot reads as a stray glyph regardless of font
           * weight or tracking. All-caps avoids the issue and gives the
           * hero its own distinct, monumental treatment.
           */}
          <h1
            data-title
            className="font-sans text-[140px] font-extrabold uppercase tracking-[-0.02em] text-ink opacity-0"
          >
            KINETICAD
          </h1>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p
            data-sub
            className="font-mono text-base tracking-[0.05em] text-ink-dim opacity-0"
          >
            Browser CAD. Real B-rep geometry. Live physics.
          </p>
          <p
            data-sub
            className="font-mono text-sm uppercase tracking-[0.32em] text-orange opacity-0"
          >
            Built in 24 hours · Replit 10 Buildathon
          </p>
        </div>
      </div>
    </div>
  );
});

TitleCard.displayName = "TitleCard";
