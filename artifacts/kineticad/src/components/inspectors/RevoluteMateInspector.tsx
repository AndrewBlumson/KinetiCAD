// Revolute mate inspector — picks circular edges on each part, derives the
// rotation axis from the picked edge polylines, and persists motor params
// (RPM / Nm) for Phase 9 simulation.
//
// Picker mode: 'edges'. Cylindrical-face picking is out of scope for v1;
// users pick the silhouette edge instead (much more accurate axis).

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getPartMeshLayer } from "@/three/partMeshLayerRef";
import {
  validateRevolutePicks,
  isCircularEdge,
} from "@/three/MatePickerCoordinator";
import MateInspectorShell, {
  NameField,
  NumericField,
} from "./MateInspectorShell";

export default function RevoluteMateInspector() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const setParams = useKinetiCADStore((s) => s.setMateEditorParams);
  const setStage = useKinetiCADStore((s) => s.setMateEditorStage);
  const setError = useKinetiCADStore((s) => s.setMateEditorError);
  const setPickingMode = useKinetiCADStore((s) => s.setPickingMode);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  // Drive the picker mode while this inspector is mounted.
  useEffect(() => {
    setPickingMode("edges");
    return () => {
      setPickingMode("idle");
    };
  }, [setPickingMode]);

  // Fold incoming edge picks into the editor stage by stage.
  useEffect(() => {
    if (!editor.open || editor.params.type !== "revolute") return;
    if (!selection || selection.kind !== "edges") return;
    if (selection.edgeIds.length === 0) return;

    const layer = getPartMeshLayer();
    if (!layer) return;
    const topology = layer.getPartTopology(selection.partId);
    if (!topology) return;

    const edge = topology.edges.find((e) => e.id === selection.edgeIds[0]);
    if (!edge) return;
    if (!isCircularEdge(edge)) {
      setError("Revolute requires circular geometry on both sides.");
      clearSelection();
      return;
    }

    if (editor.stage === "pick-a") {
      setParams({
        ...editor.params,
        partA: selection.partId,
        pivotA: { kind: "edge", edgeId: edge.id, localPoint: edge.midpoint },
      });
      setStage("pick-b");
      setError(null);
      clearSelection();
      return;
    }

    if (editor.stage === "pick-b" || editor.stage === "ready") {
      if (selection.partId === editor.params.partA) {
        setError("Pick a piece on a different part.");
        clearSelection();
        return;
      }
      const partA = assembly.parts.find((p) => p.id === editor.params.partA);
      if (!partA || !editor.params.pivotA || editor.params.pivotA.kind !== "edge") {
        setError("Re-pick the first piece.");
        return;
      }
      const topologyA = layer.getPartTopology(editor.params.partA!);
      const edgeA = topologyA?.edges.find(
        (e) => e.id === (editor.params.pivotA as { edgeId: string }).edgeId,
      );
      if (!topologyA || !edgeA) {
        setError("Re-pick the first piece.");
        return;
      }
      const partB = assembly.parts.find((p) => p.id === selection.partId);
      if (!partB) return;
      const result = validateRevolutePicks({
        partA,
        edgeA,
        topologyA,
        partB,
        edgeB: edge,
        topologyB: topology,
      });
      if (!result.ok) {
        setError(result.error);
        clearSelection();
        return;
      }
      setParams({
        ...editor.params,
        partB: selection.partId,
        pivotB: { kind: "edge", edgeId: edge.id, localPoint: edge.midpoint },
        axisLocal: result.axisLocalA,
      });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [
    selection,
    editor,
    assembly.parts,
    setParams,
    setStage,
    setError,
    clearSelection,
  ]);

  if (!editor.open || editor.params.type !== "revolute") return null;

  const partA = assembly.parts.find((p) => p.id === editor.params.partA);
  const partB = assembly.parts.find((p) => p.id === editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!editor.params.partA &&
    !!editor.params.partB &&
    !!editor.params.pivotA &&
    !!editor.params.pivotB &&
    !!editor.params.axisLocal;

  const heading =
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Revolute Mate";

  return (
    <MateInspectorShell heading={heading} canApply={canApply}>
      <NameField />
      <PartRow label="Part A" name={partA?.name ?? "—"} />
      <PartRow label="Part B" name={partB?.name ?? "—"} />
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
        Motor (optional)
      </div>
      <NumericField
        label="Speed"
        unit="RPM"
        value={editor.params.motorSpeedRpm}
        onChange={(v) => setParams({ ...editor.params, motorSpeedRpm: v })}
        testId="mate-motor-rpm"
      />
      <NumericField
        label="Torque"
        unit="Nm"
        value={editor.params.motorTorqueNm}
        onChange={(v) => setParams({ ...editor.params, motorTorqueNm: v })}
        testId="mate-motor-torque"
      />
    </MateInspectorShell>
  );
}

function PartRow({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-technical text-[11px] text-foreground truncate">
        {name}
      </span>
    </div>
  );
}
