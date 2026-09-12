// Spherical mate inspector — picks a point-on-face on each part. The mate
// has 3 rotational DOFs and 0 translational; no axis required, no motor.

import { useEffect } from "react";
import { useKinetiCADStore } from "@/state/store";
import { getAssemblyBody } from "@/state/assemblyBodies";
import { captureBooleanGeometryHash, getAssemblyBodyTopology } from "@/three/booleanResultLayerRef";
import MateInspectorShell, { NameField } from "./MateInspectorShell";

export default function SphericalMateInspector() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  const selection = useKinetiCADStore((s) => s.selection);
  const setParams = useKinetiCADStore((s) => s.setMateEditorParams);
  const setStage = useKinetiCADStore((s) => s.setMateEditorStage);
  const setError = useKinetiCADStore((s) => s.setMateEditorError);
  const setPickingMode = useKinetiCADStore((s) => s.setPickingMode);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const assembly = useKinetiCADStore((s) => s.assembly);

  useEffect(() => {
    setPickingMode("point-on-face");
    return () => {
      setPickingMode("idle");
    };
  }, [setPickingMode]);

  useEffect(() => {
    if (!editor.open || editor.params.type !== "spherical") return;
    if (!selection || selection.kind !== "point-on-face") return;
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
    const face = topology.faces.find((f) => f.id === selection.faceId);
    if (!face || !face.planeBasis) {
      // point-on-face is only emitted on planar faces; defensive guard.
      setError("Spherical requires a planar face for the pivot.");
      clearSelection();
      return;
    }

    // Re-derive the local point from the face's plane basis + uv. This is
    // the same path TopologyPicker uses to assemble the selection.
    const basis = face.planeBasis;
    const [u, v] = selection.uv;
    const localPoint: [number, number, number] = [
      basis.origin[0] + u * basis.u[0] + v * basis.v[0],
      basis.origin[1] + u * basis.u[1] + v * basis.v[1],
      basis.origin[2] + u * basis.u[2] + v * basis.v[2],
    ];

    if (editor.stage === "pick-a") {
      setParams({
        ...editor.params,
        booleanGeometryHashes,
        partA: selection.partId,
        pivotA: { kind: "face", faceId: face.id, localPoint },
      });
      setStage("pick-b");
      setError(null);
      clearSelection();
      return;
    }

    if (editor.stage === "pick-b" || editor.stage === "ready") {
      if (selection.partId === editor.params.partA) {
        setError("Pick a point on a different part.");
        clearSelection();
        return;
      }
      setParams({
        ...editor.params,
        booleanGeometryHashes,
        partB: selection.partId,
        pivotB: { kind: "face", faceId: face.id, localPoint },
      });
      setStage("ready");
      setError(null);
      clearSelection();
    }
  }, [
    selection,
    editor,
    setParams,
    setStage,
    setError,
    clearSelection,
  ]);

  if (!editor.open || editor.params.type !== "spherical") return null;

  const partA = getAssemblyBody(assembly, editor.params.partA);
  const partB = getAssemblyBody(assembly, editor.params.partB);
  const canApply =
    editor.stage === "ready" &&
    !!partA &&
    !!partB &&
    !!editor.params.pivotA &&
    !!editor.params.pivotB;

  const heading =
    editor.mode === "edit" ? `Edit ${editor.params.name}` : "Spherical Mate";

  return (
    <MateInspectorShell
      heading={heading}
      canApply={canApply}
      statusText={editor.stage === "ready" ? undefined : editor.stage === "pick-b"
        ? "On a different body, click a flat face, then click the attachment point on it."
        : "Click a flat face, then click the attachment point on it."}
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
