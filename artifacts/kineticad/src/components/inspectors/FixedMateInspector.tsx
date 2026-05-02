// Fixed mate inspector — bonds two parts at their current relative
// transform. No pivot pick; users click parts in the tree (selection.kind
// === 'part') to set partA then partB.

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import MateInspectorShell, { NameField } from "./MateInspectorShell";

export default function FixedMateInspector() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const setParams = useKinetiCADStore((s) => s.setMateEditorParams);
  const setStage = useKinetiCADStore((s) => s.setMateEditorStage);
  const setError = useKinetiCADStore((s) => s.setMateEditorError);
  const setPickingMode = useKinetiCADStore((s) => s.setPickingMode);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  useEffect(() => {
    // Fixed uses tree clicks, not the topology picker.
    setPickingMode("idle");
  }, [setPickingMode]);

  useEffect(() => {
    if (!editor.open || editor.params.type !== "fixed") return;
    if (!selection || selection.kind !== "part") return;

    if (editor.stage === "pick-a") {
      setParams({ ...editor.params, partA: selection.partId });
      setStage("pick-b");
      setError(null);
      clearSelection();
      return;
    }
    if (editor.stage === "pick-b" || editor.stage === "ready") {
      if (selection.partId === editor.params.partA) {
        setError("Pick a different part.");
        // Must clear selection here — leaving it set kept the validation
        // effect re-firing on every render and (without the store-side
        // equality guard) crashed the page with "Maximum update depth".
        clearSelection();
        return;
      }
      setParams({ ...editor.params, partB: selection.partId });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [selection, editor, setParams, setStage, setError, clearSelection]);

  if (!editor.open || editor.params.type !== "fixed") return null;

  const partA = assembly.parts.find((p) => p.id === editor.params.partA);
  const partB = assembly.parts.find((p) => p.id === editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!editor.params.partA &&
    !!editor.params.partB;

  const heading =
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Fixed Mate";

  return (
    <MateInspectorShell
      heading={heading}
      canApply={canApply}
      validationHint="Click Part A in the tree, then Part B."
    >
      <NameField />
      <Row label="Part A" value={partA?.name ?? "—"} />
      <Row label="Part B" value={partB?.name ?? "—"} />
    </MateInspectorShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-technical text-[11px] text-foreground truncate">
        {value}
      </span>
    </div>
  );
}
