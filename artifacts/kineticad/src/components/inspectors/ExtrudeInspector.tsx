// Inspector for the extrude feature editor.
//
// Reads `featureEditor` (must be open with type === 'extrude') and
// `featurePreview` from the store. Writes parameter changes back via the
// store actions; Scene.tsx watches those and runs the debounced live
// preview through the kernel.

import { useKinetiCADStore } from "@/state/store";
import type { ExtrudeDirection, ExtrudeMode } from "@/state/schemas";
import NumericInput from "@/components/NumericInput";
import SegmentedControl from "@/components/SegmentedControl";

const DIRECTION_OPTIONS: ReadonlyArray<{
  value: ExtrudeDirection;
  label: string;
}> = [
  { value: "forward", label: "Forward" },
  { value: "backward", label: "Backward" },
  { value: "symmetric", label: "Symmetric" },
];

const MODE_OPTIONS: ReadonlyArray<{
  value: ExtrudeMode;
  label: string;
}> = [
  { value: "add", label: "Add" },
  { value: "subtract", label: "Cut" },
  { value: "new-body", label: "New Body" },
];

export default function ExtrudeInspector() {
  const editor = useKinetiCADStore((s) => s.featureEditor);
  const featurePreview = useKinetiCADStore((s) => s.featurePreview);
  const setExtrudeParams = useKinetiCADStore(
    (s) => s.setFeatureEditorExtrudeParams,
  );
  const setLivePreview = useKinetiCADStore(
    (s) => s.setFeatureEditorLivePreview,
  );
  const apply = useKinetiCADStore((s) => s.applyFeatureEditor);
  const cancel = useKinetiCADStore((s) => s.cancelFeatureEditor);
  const assembly = useKinetiCADStore((s) => s.assembly);

  if (!editor.open || editor.type !== "extrude") return null;

  const part = assembly.parts.find((p) => p.id === editor.partId);
  const sketch = part?.sketches.find((s) => s.id === editor.sketchId);
  const sketchName = sketch?.name ?? "Sketch";

  // For "Edit Extrude N" headings, find the existing feature's index in
  // creation order to derive a friendly number.
  let heading = `Extrude (${sketchName})`;
  if (editor.mode === "edit" && editor.featureId && part) {
    const idx = part.features
      .filter((f) => f.type === "extrude")
      .findIndex((f) => f.id === editor.featureId);
    if (idx >= 0) heading = `Edit Extrude ${idx + 1} (${sketchName})`;
  }

  const error =
    featurePreview.status === "error" ? featurePreview.error : null;
  const errorDetails =
    featurePreview.status === "error" ? featurePreview.details : null;

  // Forcibly remount per-feature so NumericInput's local `draft` state
  // (initialised lazily from `value`) reflects the saved depth on every
  // open of "Edit Extrude N". Without this key, switching from one
  // extrude row to another while the inspector stays mounted leaves the
  // input showing the previously-edited draft string instead of the
  // newly-loaded feature's depth (T5 regression).
  const inputKey = editor.featureId ?? "create";

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <Field label="Depth (mm)">
        <NumericInput
          key={`depth-${inputKey}`}
          value={editor.params.depthMm}
          onChange={(v) =>
            setExtrudeParams({ ...editor.params, depthMm: v })
          }
          min={0.1}
          max={1000}
          step={0.1}
          decimals={1}
          unit="mm"
          testId="extrude-depth"
          ariaLabel="Extrude depth"
        />
      </Field>

      <Field label="Direction">
        <SegmentedControl<ExtrudeDirection>
          value={editor.params.direction}
          onChange={(v) =>
            setExtrudeParams({ ...editor.params, direction: v })
          }
          options={DIRECTION_OPTIONS}
          ariaLabel="Extrude direction"
          testId="extrude-direction"
        />
      </Field>

      <Field label="Mode">
        <SegmentedControl<ExtrudeMode>
          value={editor.params.extrudeMode}
          onChange={(v) =>
            setExtrudeParams({ ...editor.params, extrudeMode: v })
          }
          options={MODE_OPTIONS}
          ariaLabel="Extrude mode"
          testId="extrude-mode"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={editor.livePreview}
          onChange={(e) => setLivePreview(e.target.checked)}
          data-testid="extrude-live-preview"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Live preview
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          data-testid="extrude-error"
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
              data-testid="extrude-error-details"
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
          data-testid="extrude-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="extrude-cancel"
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
