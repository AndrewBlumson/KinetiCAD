// Right-panel inspector shown when the user has selected a finished sketch in
// the feature tree. Offers two actions: turn the sketch into an extrusion or
// a revolve. Both call `beginCreateFeature`, which opens the corresponding
// FeatureInspector with default parameters.

import { useState } from "react";
import { useKinetiCADStore } from "@/state/store";
import type { Part, Sketch } from "@/state/schemas";
import { dimensionFields } from '@/sketch/sketchDimensions';
import SketchDimensionsEditor from './SketchDimensionsEditor';

function planeLabel(plane: Sketch["plane"]): string {
  return typeof plane === "string" ? plane : "Custom";
}

export default function SketchInspector(props: { part: Part; sketch: Sketch }) {
  return <SketchInspectorBody key={`${props.part.id}:${props.sketch.id}:${JSON.stringify(props.sketch.primitives)}`} {...props} />;
}

function SketchInspectorBody({
  part,
  sketch,
}: {
  part: Part;
  sketch: Sketch;
}) {
  const beginCreateFeature = useKinetiCADStore((s) => s.beginCreateFeature);
  const [editing, setEditing] = useState(false);

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

      {editing ? <SketchDimensionsEditor part={part} sketch={sketch} onClose={() => setEditing(false)} /> : <>
      <section aria-label="Saved sketch dimensions" className="flex flex-col gap-2 border-y border-border py-3">
        <h3 className="text-xs font-semibold">Sketch dimensions</h3>
        <div className="max-h-48 overflow-y-auto text-xs">
          {sketch.primitives.map((primitive, index) => <div key={index} className="mb-2 last:mb-0">
            <p className="mb-1 capitalize text-orange-300">{primitive.type} {index + 1}</p>
            <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-muted-foreground">
              {dimensionFields(primitive).map(field => <div key={field.key} className="contents">
                <dt>{field.label}</dt><dd className="text-right font-technical">{Number(field.value.toPrecision(8))} {field.unit}</dd>
              </div>)}
            </dl>
          </div>)}
        </div>
        <button type="button" onClick={() => setEditing(true)} disabled={sketch.primitives.length === 0 || typeof sketch.plane !== 'string'}
          className="min-h-9 rounded border border-orange-400/50 px-2 text-xs text-orange-300 hover:bg-orange-400/10 disabled:opacity-40">Edit dimensions</button>
      </section>
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
      </>}
    </div>
  );
}
