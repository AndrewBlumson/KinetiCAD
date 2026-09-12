// Revolute mate inspector — picks circular edges on each part, derives the
// rotation axis from the picked edge polylines, and persists motor params
// (RPM / Nm) for Phase 9 simulation.
//
// Picker mode: 'edges'. Cylindrical-face picking is out of scope for v1;
// users pick the silhouette edge instead (much more accurate axis).

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getAssemblyBody } from "@/state/assemblyBodies";
import { captureBooleanGeometryHash, getAssemblyBodyTopology } from "@/three/booleanResultLayerRef";
import {
  validateRevolutePicks,
  isCircularEdge,
  type Vec3,
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
  const setPickFilter = useKinetiCADStore((s) => s.setPickFilter);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  // Drive the picker mode + filter while this inspector is mounted. The
  // filter restricts both hover and click to circle/arc edges so the user
  // can't accidentally pick a nearby line edge (e.g. cylinder seam).
  useEffect(() => {
    setPickingMode("edges");
    setPickFilter({ edgeTypes: ["circle", "arc"] });
    return () => {
      setPickingMode("idle");
      setPickFilter(null);
    };
  }, [setPickingMode, setPickFilter]);

  // Fold incoming edge picks into the editor stage by stage.
  useEffect(() => {
    if (!editor.open || editor.params.type !== "revolute") return;
    if (!selection || selection.kind !== "edges") return;
    if (selection.edgeIds.length === 0) return;

    const topology = getAssemblyBodyTopology(selection.partId);
    if (!topology) return;
    let booleanGeometryHashes: Record<string, string> | undefined;
    try {
      booleanGeometryHashes = captureBooleanGeometryHash(selection.partId, editor.params.booleanGeometryHashes);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      clearSelection();
      return;
    }

    const edge = topology.edges.find((e) => e.id === selection.edgeIds[0]);
    if (!edge) return;
    if (!isCircularEdge(edge)) {
      setError("Revolute requires circular geometry on both sides.");
      clearSelection();
      return;
    }

    if (editor.stage === "pick-a") {
      const part = getAssemblyBody(assembly, selection.partId);
      if (!part) return;
      // OCCT topology is already local to this body. Boolean result bodies
      // use an identity frame because their geometry is baked in world space.
      const localPoint = [...edge.midpoint] as Vec3;
      // eslint-disable-next-line no-console
      console.log("[mate-create-pivot]", {
        stage: "pick-a",
        partId: selection.partId,
        clickedEdge: edge.id,
        edgeType: edge.type,
        edgeMidpoint: edge.midpoint,
        capturedPivot: localPoint,
      });
      setParams({
        ...editor.params,
        booleanGeometryHashes,
        partA: selection.partId,
        pivotA: { kind: "edge", edgeId: edge.id, localPoint },
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
      const partA = getAssemblyBody(assembly, editor.params.partA);
      if (!partA || !editor.params.pivotA || editor.params.pivotA.kind !== "edge") {
        setError("Re-pick the first piece.");
        return;
      }
      const topologyA = getAssemblyBodyTopology(editor.params.partA!);
      const edgeA = topologyA?.edges.find(
        (e) => e.id === (editor.params.pivotA as { edgeId: string }).edgeId,
      );
      if (!topologyA || !edgeA) {
        setError("Re-pick the first piece.");
        return;
      }
      const partB = getAssemblyBody(assembly, selection.partId);
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
      // eslint-disable-next-line no-console
      console.log("[mate-create-pivot]", {
        stage: "pick-b",
        partId: selection.partId,
        clickedEdge: edge.id,
        edgeType: edge.type,
        edgeMidpoint: edge.midpoint,
        capturedPivot: result.pivotLocalB,
        pivotAUpdated: result.pivotLocalA,
        pivotAAlreadyStored: editor.params.pivotA,
      });
      setParams({
        ...editor.params,
        booleanGeometryHashes,
        partB: selection.partId,
        pivotA: {
          ...(editor.params.pivotA as { kind: "edge"; edgeId: string; localPoint: Vec3 }),
          localPoint: result.pivotLocalA,
        },
        pivotB: { kind: "edge", edgeId: edge.id, localPoint: result.pivotLocalB },
        axisLocal: result.axisLocalA,
      });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [
    selection,
    editor,
    assembly,
    setParams,
    setStage,
    setError,
    clearSelection,
  ]);

  if (!editor.open || editor.params.type !== "revolute") return null;

  const partA = getAssemblyBody(assembly, editor.params.partA);
  const partB = getAssemblyBody(assembly, editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!partA &&
    !!partB &&
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
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Ideal velocity drive. Blank or 0 switches the motor off and leaves
        the joint free to move. Torque limits are not modelled.
      </p>
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
