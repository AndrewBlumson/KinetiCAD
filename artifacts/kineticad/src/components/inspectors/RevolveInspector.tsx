// Inspector for the revolve feature editor.
//
// Mirrors ExtrudeInspector's structure: axis picker (X/Y/Z) and a 1-360°
// angle input, plus the live-preview toggle, error region, and Apply/Cancel.

import { useKinetiCADStore } from "@/state/store";
import type { RevolveAxis } from "@/state/schemas";
import NumericInput from "@/components/NumericInput";
import SegmentedControl from "@/components/SegmentedControl";

const AXIS_OPTIONS: ReadonlyArray<{
  value: RevolveAxis;
  label: string;
}> = [
  { value: "X", label: "X" },
  { value: "Y", label: "Y" },
  { value: "Z", label: "Z" },
];

export default function RevolveInspector() {
  const editor = useKinetiCADStore((s) => s.featureEditor);
  const featurePreview = useKinetiCADStore((s) => s.featurePreview);
  const setRevolveParams = useKinetiCADStore(
    (s) => s.setFeatureEditorRevolveParams,
  );
  const setLivePreview = useKinetiCADStore(
    (s) => s.setFeatureEditorLivePreview,
  );
  const apply = useKinetiCADStore((s) => s.applyFeatureEditor);
  const cancel = useKinetiCADStore((s) => s.cancelFeatureEditor);
  const assembly = useKinetiCADStore((s) => s.assembly);

  if (!editor.open || editor.type !== "revolve") return null;

  const part = assembly.parts.find((p) => p.id === editor.partId);
  const sketch = part?.sketches.find((s) => s.id === editor.sketchId);
  const sketchName = sketch?.name ?? "Sketch";

  let heading = `Revolve (${sketchName})`;
  if (editor.mode === "edit" && editor.featureId && part) {
    const idx = part.features
      .filter((f) => f.type === "revolve")
      .findIndex((f) => f.id === editor.featureId);
    if (idx >= 0) heading = `Edit Revolve ${idx + 1} (${sketchName})`;
  }

  const error =
    featurePreview.status === "error" ? featurePreview.error : null;
  const errorDetails =
    featurePreview.status === "error" ? featurePreview.details : null;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <Field label="Axis">
        <SegmentedControl<RevolveAxis>
          value={editor.params.axis}
          onChange={(v) =>
            setRevolveParams({ ...editor.params, axis: v })
          }
          options={AXIS_OPTIONS}
          ariaLabel="Revolve axis"
          testId="revolve-axis"
        />
      </Field>

      <Field label="Angle (degrees)">
        <NumericInput
          value={editor.params.angleDeg}
          onChange={(v) =>
            setRevolveParams({ ...editor.params, angleDeg: v })
          }
          min={1}
          max={360}
          step={1}
          decimals={0}
          unit="°"
          testId="revolve-angle"
          ariaLabel="Revolve angle"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={editor.livePreview}
          onChange={(e) => setLivePreview(e.target.checked)}
          data-testid="revolve-live-preview"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Live preview
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          data-testid="revolve-error"
          className="flex flex-col gap-1.5 px-2 py-1.5 rounded border border-[#FF6B6B]/40 bg-[#FF6B6B]/10"
        >
          <div className="flex items-start gap-1.5">
            <span className="text-[#FF6B6B] text-xs leading-none mt-0.5">
              ⚠
            </span>
            <span className="font-technical text-[11px] text-[#FF6B6B] leading-snug">
              {error}
            </span>
          </div>
          {errorDetails ? (
            <details
              data-testid="revolve-error-details"
              className="font-technical text-[10px] text-[#FF6B6B]/80"
            >
              <summary className="cursor-pointer select-none">
                Technical details
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-tight bg-[#0F1424] border border-[#FF6B6B]/20 rounded p-1.5 text-[#FF6B6B]/90">
                {errorDetails}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={apply}
          data-testid="revolve-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="revolve-cancel"
          className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
