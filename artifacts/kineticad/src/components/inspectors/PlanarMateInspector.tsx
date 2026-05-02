// Planar mate inspector — picks one planar face per part; the mate
// constrains the parts to share the face plane (no pivot point, no axis).

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getPartMeshLayer } from "@/three/partMeshLayerRef";
import { isPlanarFace } from "@/three/MatePickerCoordinator";
import MateInspectorShell, { NameField } from "./MateInspectorShell";

export default function PlanarMateInspector() {
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
    if (!editor.open || editor.params.type !== "planar") return;
    if (!selection || selection.kind !== "face") return;
    const layer = getPartMeshLayer();
    if (!layer) return;
    const topology = layer.getPartTopology(selection.partId);
    if (!topology) return;
    const face = topology.faces.find((f) => f.id === selection.faceId);
    if (!face) return;
    if (!isPlanarFace(face)) {
      setError("Planar requires planar faces on both sides.");
      clearSelection();
      return;
    }

    if (editor.stage === "pick-a") {
      setParams({
        ...editor.params,
        partA: selection.partId,
        // Planar pivot stores faceId only — but our editor params share the
        // generic MatePivot shape; we stash the centroid as localPoint so
        // sub-inspectors that read the field can render hints. The Apply
        // path strips it down to the bare PlanarPivot.
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
      setParams({
        ...editor.params,
        partB: selection.partId,
        pivotB: { kind: "face", faceId: face.id, localPoint: face.centroid },
      });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [selection, editor, setParams, setStage, setError, clearSelection]);

  if (!editor.open || editor.params.type !== "planar") return null;

  const partA = assembly.parts.find((p) => p.id === editor.params.partA);
  const partB = assembly.parts.find((p) => p.id === editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!editor.params.partA &&
    !!editor.params.partB &&
    !!editor.params.pivotA &&
    !!editor.params.pivotB;

  const heading =
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Planar Mate";

  return (
    <MateInspectorShell heading={heading} canApply={canApply}>
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
