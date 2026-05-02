// Prismatic mate inspector — picks two planar faces, validates their
// normals are parallel within 5°, derives the slide axis from face A's
// normal in part-A local frame. Motor params: force (N) + velocity (mm/s).

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getPartMeshLayer } from "@/three/partMeshLayerRef";
import {
  validatePrismaticPicks,
  isPlanarFace,
} from "@/three/MatePickerCoordinator";
import MateInspectorShell, {
  NameField,
  NumericField,
} from "./MateInspectorShell";

export default function PrismaticMateInspector() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const setParams = useKinetiCADStore((s) => s.setMateEditorParams);
  const setStage = useKinetiCADStore((s) => s.setMateEditorStage);
  const setError = useKinetiCADStore((s) => s.setMateEditorError);
  const setPickingMode = useKinetiCADStore((s) => s.setPickingMode);
  const setPickFilter = useKinetiCADStore((s) => s.setPickFilter);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  useEffect(() => {
    setPickingMode("faces");
    setPickFilter({ faceTypes: ["plane"] });
    return () => {
      setPickingMode("idle");
      setPickFilter(null);
    };
  }, [setPickingMode, setPickFilter]);

  useEffect(() => {
    if (!editor.open || editor.params.type !== "prismatic") return;
    if (!selection || selection.kind !== "face") return;
    const layer = getPartMeshLayer();
    if (!layer) return;
    const topology = layer.getPartTopology(selection.partId);
    if (!topology) return;
    const face = topology.faces.find((f) => f.id === selection.faceId);
    if (!face) return;
    if (!isPlanarFace(face)) {
      setError("Prismatic requires planar faces on both sides.");
      clearSelection();
      return;
    }

    if (editor.stage === "pick-a") {
      setParams({
        ...editor.params,
        partA: selection.partId,
        pivotA: { kind: "face", faceId: face.id, localPoint: face.centroid },
      });
      setStage("pick-b");
      setError(null);
      clearSelection();
      return;
    }

    if (editor.stage === "pick-b" || editor.stage === "ready") {
      if (selection.partId === editor.params.partA) {
        setError("Pick a face on a different part.");
        clearSelection();
        return;
      }
      const partA = assembly.parts.find((p) => p.id === editor.params.partA);
      if (!partA || !editor.params.pivotA || editor.params.pivotA.kind !== "face") {
        setError("Re-pick the first face.");
        return;
      }
      const topologyA = layer.getPartTopology(editor.params.partA!);
      const faceA = topologyA?.faces.find(
        (f) => f.id === (editor.params.pivotA as { faceId: string }).faceId,
      );
      if (!topologyA || !faceA) {
        setError("Re-pick the first face.");
        return;
      }
      const partB = assembly.parts.find((p) => p.id === selection.partId);
      if (!partB) return;
      const result = validatePrismaticPicks({
        partA,
        faceA,
        topologyA,
        partB,
        faceB: face,
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
        pivotB: { kind: "face", faceId: face.id, localPoint: face.centroid },
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

  if (!editor.open || editor.params.type !== "prismatic") return null;

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
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Prismatic Mate";

  return (
    <MateInspectorShell heading={heading} canApply={canApply}>
      <NameField />
      <Row label="Part A" value={partA?.name ?? "—"} />
      <Row label="Part B" value={partB?.name ?? "—"} />
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
        Motor (optional)
      </div>
      <NumericField
        label="Force"
        unit="N"
        value={editor.params.motorForceN}
        onChange={(v) => setParams({ ...editor.params, motorForceN: v })}
        testId="mate-motor-force"
      />
      <NumericField
        label="Velocity"
        unit="mm/s"
        value={editor.params.motorVelocityMmPerSec}
        onChange={(v) =>
          setParams({ ...editor.params, motorVelocityMmPerSec: v })
        }
        testId="mate-motor-velocity"
      />
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
