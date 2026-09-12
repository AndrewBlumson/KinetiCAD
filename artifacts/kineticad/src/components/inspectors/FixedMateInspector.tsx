// Fixed mate inspector — bonds two parts at their current relative
// transform. No pivot pick; users click native parts or Boolean results in
// the tree to set partA then partB.

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getAssemblyBody, booleanBodyId } from "@/state/assemblyBodies";
import { captureBooleanGeometryHash } from "@/three/booleanResultLayerRef";
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
    if (!selection || (selection.kind !== "part" && selection.kind !== "boolean")) return;
    const bodyId = selection.kind === "boolean" ? booleanBodyId(selection.booleanId) : selection.partId;
    if (!getAssemblyBody(assembly, bodyId)) return;
    let booleanGeometryHashes: Record<string, string> | undefined;
    try {
      booleanGeometryHashes = captureBooleanGeometryHash(bodyId, editor.params.booleanGeometryHashes);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      clearSelection();
      return;
    }

    if (editor.stage === "pick-a") {
      setParams({ ...editor.params, partA: bodyId, booleanGeometryHashes });
      setStage("pick-b");
      setError(null);
      clearSelection();
      return;
    }
    if (editor.stage === "pick-b" || editor.stage === "ready") {
      if (bodyId === editor.params.partA) {
        setError("Pick a different part.");
        // Must clear selection here — leaving it set kept the validation
        // effect re-firing on every render and (without the store-side
        // equality guard) crashed the page with "Maximum update depth".
        clearSelection();
        return;
      }
      setParams({ ...editor.params, partB: bodyId, booleanGeometryHashes });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [selection, editor, assembly, setParams, setStage, setError, clearSelection]);

  if (!editor.open || editor.params.type !== "fixed") return null;

  const partA = getAssemblyBody(assembly, editor.params.partA);
  const partB = getAssemblyBody(assembly, editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!partA &&
    !!partB;

  const heading =
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Fixed Mate";

  return (
    <MateInspectorShell
      heading={heading}
      canApply={canApply}
      validationHint="Click a part or Boolean result in the tree, then a different body."
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
