// Inspector for the hole feature editor.
//
// Two-stage picker workflow (handled by TopologyPicker internally — we just
// react to selections):
//   1. User clicks a planar face → store dispatches `selectFace` →
//      this inspector copies the faceId into editor.params.targetFace
//      and clears the selection.
//   2. User clicks a point on the chosen face → store dispatches
//      `selectPointOnFace` → this inspector copies the UV into
//      editor.params.positionUV and clears the selection.
//
// The picker mode stays 'point-on-face' the whole time; the picker uses the
// presence/absence of a face selection to decide which stage to handle.
//
// Layout: face slot (with Clear), position slot, diameter, depth (with
// "Through-all" label when 0).

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import NumericInput from "@/components/NumericInput";

export default function HoleInspector() {
  const editor = useKinetiCADStore((s) => s.featureEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const featurePreview = useKinetiCADStore((s) => s.featurePreview);
  const setParams = useKinetiCADStore((s) => s.setFeatureEditorHoleParams);
  const setLivePreview = useKinetiCADStore(
    (s) => s.setFeatureEditorLivePreview,
  );
  const apply = useKinetiCADStore((s) => s.applyFeatureEditor);
  const cancel = useKinetiCADStore((s) => s.cancelFeatureEditor);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  useEffect(() => {
    if (!editor.open || editor.type !== "hole") return;
    if (!selection) return;
    // Assembly-level selections (boolean / mate) have no partId; ignore.
    if (selection.kind === "boolean" || selection.kind === "mate") return;
    if (selection.partId !== editor.partId) return;

    if (selection.kind === "face") {
      // Stage 1: face pick. Replace any prior face/UV.
      setParams({
        ...editor.params,
        targetFace: selection.faceId,
        positionUV: null,
      });
      clearSelection();
      return;
    }
    if (selection.kind === "point-on-face") {
      // Stage 2: point pick. Only accept it if the face matches the chosen
      // one (defensive: protects against stale selections during a face swap).
      if (
        editor.params.targetFace &&
        selection.faceId === editor.params.targetFace
      ) {
        setParams({
          ...editor.params,
          positionUV: [selection.uv[0], selection.uv[1]],
        });
        clearSelection();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  if (!editor.open || editor.type !== "hole") return null;

  const part = assembly.parts.find((p) => p.id === editor.partId);
  let heading = "Hole";
  if (editor.mode === "edit" && editor.featureId && part) {
    const idx = part.features
      .filter((f) => f.type === "hole")
      .findIndex((f) => f.id === editor.featureId);
    if (idx >= 0) heading = `Edit Hole ${idx + 1}`;
  }

  const error =
    featurePreview.status === "error" ? featurePreview.error : null;
  const errorDetails =
    featurePreview.status === "error" ? featurePreview.details : null;

  const clearFace = () =>
    setParams({ ...editor.params, targetFace: null, positionUV: null });

  const through = editor.params.depthMm === 0;
  const canApply =
    editor.params.targetFace !== null && editor.params.positionUV !== null;

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <Field label="Face">
        {editor.params.targetFace ? (
          <div
            className="flex items-center justify-between gap-1 px-2 h-6 rounded bg-secondary/40"
            data-testid="hole-face-slot"
          >
            <span className="font-technical text-[11px] text-foreground truncate">
              {editor.params.targetFace.slice(0, 12)}
            </span>
            <button
              type="button"
              onClick={clearFace}
              data-testid="hole-face-clear"
              className="font-technical text-[11px] text-muted-foreground hover:text-[#FF6B6B] transition px-1"
              aria-label="Clear face"
            >
              ×
            </button>
          </div>
        ) : (
          <div
            className="font-technical text-[11px] text-muted-foreground italic"
            data-testid="hole-face-empty"
          >
            Click a planar face in the 3D view.
          </div>
        )}
      </Field>

      <Field label="Position (U / V mm)">
        {editor.params.positionUV ? (
          <div
            className="flex items-center gap-2 px-2 h-6 rounded bg-secondary/40"
            data-testid="hole-position-slot"
          >
            <span className="font-technical text-[11px] text-foreground">
              U {editor.params.positionUV[0].toFixed(2)}
            </span>
            <span className="font-technical text-[11px] text-muted-foreground">
              ·
            </span>
            <span className="font-technical text-[11px] text-foreground">
              V {editor.params.positionUV[1].toFixed(2)}
            </span>
          </div>
        ) : (
          <div
            className="font-technical text-[11px] text-muted-foreground italic"
            data-testid="hole-position-empty"
          >
            {editor.params.targetFace
              ? "Click a point on the face."
              : "Pick a face first."}
          </div>
        )}
      </Field>

      <Field label="Diameter (mm)">
        <NumericInput
          value={editor.params.diameterMm}
          onChange={(v) => setParams({ ...editor.params, diameterMm: v })}
          min={0.1}
          max={500}
          step={0.1}
          decimals={1}
          unit="mm"
          testId="hole-diameter"
          ariaLabel="Hole diameter"
        />
      </Field>

      <Field label={through ? "Depth (Through-all)" : "Depth (mm)"}>
        <NumericInput
          value={editor.params.depthMm}
          onChange={(v) => setParams({ ...editor.params, depthMm: v })}
          min={0}
          max={1000}
          step={0.1}
          decimals={1}
          unit={through ? "" : "mm"}
          testId="hole-depth"
          ariaLabel="Hole depth"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={editor.livePreview}
          onChange={(e) => setLivePreview(e.target.checked)}
          data-testid="hole-live-preview"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Live preview
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          data-testid="hole-error"
          className="flex flex-col gap-1.5 px-2 py-1.5 rounded border border-[#FF6B6B]/40 bg-[#FF6B6B]/10"
        >
          <div className="flex items-start gap-1.5">
            <span className="text-[#FF6B6B] text-xs leading-none mt-0.5">⚠</span>
            <span className="font-technical text-[11px] text-[#FF6B6B] leading-snug">
              {error}
            </span>
          </div>
          {errorDetails ? (
            <details
              data-testid="hole-error-details"
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
          disabled={!canApply}
          data-testid="hole-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="hole-cancel"
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
