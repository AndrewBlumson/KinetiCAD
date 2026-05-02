// Sub-toolbar shown in place of the normal modelling toolbar while a sketch
// session is active. Tool buttons (Line / Rectangle / Circle / Arc) are
// stubbed out in Split A; Split B will wire them to the sketch tool state
// machine. Finish and Cancel buttons are fully wired here.

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import type { SketchTool } from "@/state/store";

const TOOLS: ReadonlyArray<{
  tool: SketchTool;
  icon: string;
  label: string;
}> = [
  { tool: "line", icon: "╱", label: "Line" },
  { tool: "rectangle", icon: "□", label: "Rectangle" },
  { tool: "circle", icon: "○", label: "Circle" },
  { tool: "arc", icon: "◜", label: "Arc" },
];

export default function SketchToolbar() {
  const session = useKinetiCADStore((s) => s.sketchSession);
  const setSketchTool = useKinetiCADStore((s) => s.setSketchTool);
  const finishSketch = useKinetiCADStore((s) => s.finishSketch);
  const cancelSketch = useKinetiCADStore((s) => s.cancelSketch);

  // Enter/Escape keyboard shortcuts per the spec.
  useEffect(() => {
    if (!session.active) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when the user is typing in an input.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finishSketch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session.active, finishSketch]);

  if (!session.active) return null;

  return (
    <>
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        Sketch
      </span>
      {TOOLS.map((t) => {
        const active = session.tool === t.tool;
        // Tools are wired in Split B. Keep them disabled visually but allow
        // clicks so the active-tool state becomes selectable for testing.
        return (
          <button
            key={t.tool}
            title={t.label}
            type="button"
            disabled
            onClick={() => setSketchTool(t.tool)}
            data-testid={`sketch-tool-${t.tool}`}
            className={[
              "flex items-center justify-center w-7 h-7 rounded text-sm transition-colors",
              active
                ? "bg-[#FF6B1A] text-white"
                : "text-muted-foreground opacity-40 cursor-not-allowed",
            ].join(" ")}
          >
            {t.icon}
          </button>
        );
      })}
      <div className="w-px h-5 bg-border mx-2" />
      <button
        type="button"
        onClick={finishSketch}
        data-testid="sketch-finish"
        className="px-3 h-7 rounded font-technical text-[11px] uppercase tracking-widest bg-[#FF6B1A] text-white hover:brightness-110"
      >
        Finish Sketch
      </button>
      <button
        type="button"
        onClick={cancelSketch}
        data-testid="sketch-cancel"
        className="px-3 h-7 rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary"
      >
        Cancel Sketch
      </button>
    </>
  );
}
