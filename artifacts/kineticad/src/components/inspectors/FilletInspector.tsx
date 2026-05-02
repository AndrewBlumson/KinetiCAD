// Inspector for the fillet feature editor.
//
// Layout:
//   - Heading ("Fillet" / "Edit Fillet N")
//   - Edge list with × to remove
//   - Radius NumericInput (0.1–50, step 0.1)
//   - Live preview toggle, error region, Apply / Cancel
//
// Selection bridge: while this inspector is mounted, the picker is in
// 'edges' mode (set by `beginCreateFilletFeature` / `beginEditFeature`).
// Each edge click pushes a single-id 'edges' selection into the store; this
// inspector's useEffect merges it into `editor.params.targetEdges`
// (toggle semantics), then clears the selection so the next click starts
// fresh and the highlight overlay stays clean.

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import NumericInput from "@/components/NumericInput";

export default function FilletInspector() {
  const editor = useKinetiCADStore((s) => s.featureEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const featurePreview = useKinetiCADStore((s) => s.featurePreview);
  const setParams = useKinetiCADStore((s) => s.setFeatureEditorFilletParams);
  const setLivePreview = useKinetiCADStore(
    (s) => s.setFeatureEditorLivePreview,
  );
  const apply = useKinetiCADStore((s) => s.applyFeatureEditor);
  const cancel = useKinetiCADStore((s) => s.cancelFeatureEditor);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  // Fold any incoming 'edges' selection into the editor's targetEdges and
  // immediately clear the selection. Toggle on a re-click so the user can
  // un-pick the same edge to remove it. We deliberately depend ONLY on
  // `selection` so re-runs are tied to picker events, not parameter edits.
  useEffect(() => {
    if (!editor.open || editor.type !== "fillet") return;
    if (selection?.kind !== "edges") return;
    if (selection.partId !== editor.partId) return;
    if (selection.edgeIds.length === 0) return;

    const current = new Set(editor.params.targetEdges);
    for (const id of selection.edgeIds) {
      if (current.has(id)) current.delete(id);
      else current.add(id);
    }
    setParams({
      ...editor.params,
      targetEdges: Array.from(current),
    });
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  if (!editor.open || editor.type !== "fillet") return null;

  const part = assembly.parts.find((p) => p.id === editor.partId);
  let heading = "Fillet";
  if (editor.mode === "edit" && editor.featureId && part) {
    const idx = part.features
      .filter((f) => f.type === "fillet")
      .findIndex((f) => f.id === editor.featureId);
    if (idx >= 0) heading = `Edit Fillet ${idx + 1}`;
  }

  const error =
    featurePreview.status === "error" ? featurePreview.error : null;
  const errorDetails =
    featurePreview.status === "error" ? featurePreview.details : null;

  const removeEdge = (id: string) => {
    setParams({
      ...editor.params,
      targetEdges: editor.params.targetEdges.filter((e) => e !== id),
    });
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <Field label={`Edges (${editor.params.targetEdges.length})`}>
        {editor.params.targetEdges.length === 0 ? (
          <div className="font-technical text-[11px] text-muted-foreground italic">
            Click edges in the 3D view to add them.
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {editor.params.targetEdges.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-1 px-2 h-6 rounded bg-secondary/40"
                data-testid={`fillet-edge-${id}`}
              >
                <span className="font-technical text-[11px] text-foreground truncate">
                  {id.slice(0, 12)}
                </span>
                <button
                  type="button"
                  onClick={() => removeEdge(id)}
                  data-testid={`fillet-edge-remove-${id}`}
                  className="font-technical text-[11px] text-muted-foreground hover:text-[#FF6B6B] transition px-1"
                  aria-label={`Remove edge ${id}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>

      <Field label="Radius (mm)">
        <NumericInput
          value={editor.params.radiusMm}
          onChange={(v) => setParams({ ...editor.params, radiusMm: v })}
          min={0.1}
          max={50}
          step={0.1}
          decimals={1}
          unit="mm"
          testId="fillet-radius"
          ariaLabel="Fillet radius"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={editor.livePreview}
          onChange={(e) => setLivePreview(e.target.checked)}
          data-testid="fillet-live-preview"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Live preview
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          data-testid="fillet-error"
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
              data-testid="fillet-error-details"
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
          disabled={editor.params.targetEdges.length === 0}
          data-testid="fillet-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="fillet-cancel"
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
