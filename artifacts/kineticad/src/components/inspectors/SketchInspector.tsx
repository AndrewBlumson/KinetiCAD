// Right-panel inspector shown when the user has selected a finished sketch in
// the feature tree. Offers two actions: turn the sketch into an extrusion or
// a revolve. Both call `beginCreateFeature`, which opens the corresponding
// FeatureInspector with default parameters.

import { useKinetiCADStore } from "@/state/store";
import type { Part, Sketch } from "@/state/schemas";

function planeLabel(plane: Sketch["plane"]): string {
  return typeof plane === "string" ? plane : "Custom";
}

export default function SketchInspector({
  part,
  sketch,
}: {
  part: Part;
  sketch: Sketch;
}) {
  const beginCreateFeature = useKinetiCADStore((s) => s.beginCreateFeature);

  const onExtrude = () =>
    beginCreateFeature(part.id, sketch.id, "extrude");
  const onRevolve = () =>
    beginCreateFeature(part.id, sketch.id, "revolve");

  const plural =
    sketch.primitives.length === 1 ? "primitive" : "primitives";

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-col gap-0.5">
        <div className="font-technical text-xs text-foreground">
          {sketch.name} ({planeLabel(sketch.plane)})
        </div>
        <div className="font-technical text-[11px] text-muted-foreground">
          {sketch.primitives.length} {plural}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
          Create feature from this sketch
        </div>
        <button
          type="button"
          onClick={onExtrude}
          data-testid="sketch-inspector-extrude"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition"
        >
          Extrude
        </button>
        <button
          type="button"
          onClick={onRevolve}
          data-testid="sketch-inspector-revolve"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition"
        >
          Revolve
        </button>
      </div>
    </div>
  );
}
