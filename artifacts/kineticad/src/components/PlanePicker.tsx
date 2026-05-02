// Centred modal that appears when "New Sketch" is clicked. The user picks
// one of the three cardinal planes (XY/XZ/YZ) and the sketch session begins.

import { useEffect } from "react";
import { PLANE_VIEWS, type CardinalPlane } from "@/sketch/plane";

type Props = {
  open: boolean;
  onPick: (plane: CardinalPlane) => void;
  onCancel: () => void;
};

const PLANE_ORDER: ReadonlyArray<CardinalPlane> = ["XY", "XZ", "YZ"];

export default function PlanePicker({ open, onPick, onCancel }: Props) {
  // Escape key closes the picker without selecting a plane.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center"
      // Soft scrim so the canvas behind dims slightly.
      style={{ background: "rgba(10, 14, 26, 0.55)" }}
      onClick={onCancel}
      data-testid="plane-picker-scrim"
    >
      <div
        className="bg-card border border-border rounded shadow-xl w-72 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          Choose sketch plane
        </div>
        <div className="flex flex-col gap-1">
          {PLANE_ORDER.map((plane) => (
            <button
              key={plane}
              type="button"
              onClick={() => onPick(plane)}
              data-testid={`plane-pick-${plane.toLowerCase()}`}
              className="group flex items-center justify-between gap-3 px-3 py-2 rounded text-left transition-colors hover:bg-[#FF6B1A] focus:bg-[#FF6B1A] focus:outline-none"
            >
              <span className="font-technical text-sm text-foreground group-hover:text-white group-focus:text-white tracking-wider">
                {plane}
              </span>
              <span className="font-technical text-xs text-muted-foreground group-hover:text-white/85 group-focus:text-white/85">
                {PLANE_VIEWS[plane].label}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            data-testid="plane-pick-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
