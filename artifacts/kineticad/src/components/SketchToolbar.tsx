// Sub-toolbar shown in place of the normal modelling toolbar while a sketch
// session is active. Tool buttons (Line / Rectangle / Circle / Arc) drive the
// sketchSession.tool field which `SketchSession` (Three.js side) reacts to.
// Finish and Cancel are wired to the corresponding store actions.

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
  // Narrow selectors so 60Hz mouse activity (which doesn't touch any of
  // these fields) can't re-render the toolbar.
  const active = useKinetiCADStore((s) => s.sketchSession.active);
  const tool = useKinetiCADStore((s) => s.sketchSession.tool);
  const setSketchTool = useKinetiCADStore((s) => s.setSketchTool);
  const finishSketch = useKinetiCADStore((s) => s.finishSketch);
  const cancelSketch = useKinetiCADStore((s) => s.cancelSketch);
  // Phase 6: surface which part the new sketch will land on. Same
  // resolution rules as `finishSketch`: selected part wins, then first
  // existing part, otherwise "Part 1" (the auto-create name).
  const targetPartName = useKinetiCADStore((s) => {
    const sel = s.selection;
    if (sel?.kind === "part") {
      const p = s.assembly.parts.find((pp) => pp.id === sel.partId);
      if (p) return p.name;
    }
    if (s.assembly.parts.length > 0) return s.assembly.parts[0].name;
    return "Part 1";
  });

  // Enter/Escape keyboard shortcuts per the spec.
  useEffect(() => {
    if (!active) return;
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
  }, [active, finishSketch]);

  if (!active) return null;

  return (
    <>
      <span
        className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden md:inline"
        data-testid="sketch-target-part"
      >
        Sketching on:{" "}
        <span className="text-foreground normal-case tracking-normal">
          {targetPartName}
        </span>
      </span>
      <div className="w-px h-5 bg-border mx-1 hidden md:block" />
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        Sketch
      </span>
      {TOOLS.map((t) => {
        const isActive = tool === t.tool;
        // Re-clicking the active tool toggles back to idle (cancels in-flight).
        const onClick = () => setSketchTool(isActive ? "idle" : t.tool);
        return (
          <button
            key={t.tool}
            title={t.label}
            type="button"
            onClick={onClick}
            data-testid={`sketch-tool-${t.tool}`}
            className={[
              "flex items-center justify-center w-7 h-7 rounded text-sm transition-colors",
              isActive
                ? "bg-[#FF6B1A] text-white"
                : "text-foreground hover:bg-secondary active:bg-secondary/80",
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
