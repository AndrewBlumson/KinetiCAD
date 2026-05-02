// Part-level inspector: shown when `selection.kind === 'part'`. Surfaces the
// "+ Add" buttons for the modifier features (fillet/chamfer/hole). Picked
// part name comes from the assembly so the heading stays in sync if the
// user renames it later.
//
// This is the canonical placement of "+ Add Feature" actions in v1: the user
// clicks the part name in the tree, then picks a modifier from this panel.

import { useKinetiCADStore } from "@/state/store";

export type PartInspectorProps = {
  /**
   * Modeller wraps the cascade-aware confirm dialog and passes the partId
   * back here when the user clicks Delete. Centralising the dialog at the
   * Modeller level keeps the inspector free of modal state.
   */
  onRequestDelete?: (partId: string) => void;
};

export default function PartInspector({ onRequestDelete }: PartInspectorProps) {
  const selection = useKinetiCADStore((s) => s.selection);
  const assembly = useKinetiCADStore((s) => s.assembly);
  const beginFillet = useKinetiCADStore((s) => s.beginCreateFilletFeature);
  const beginChamfer = useKinetiCADStore((s) => s.beginCreateChamferFeature);
  const beginHole = useKinetiCADStore((s) => s.beginCreateHoleFeature);

  if (selection?.kind !== "part") return null;
  const part = assembly.parts.find((p) => p.id === selection.partId);
  if (!part) return null;

  // The modifier features all need an upstream shape, so disable the buttons
  // until the part has at least one base feature (extrude/revolve).
  const hasBaseFeature = part.features.some(
    (f) => f.type === "extrude" || f.type === "revolve",
  );

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{part.name}</div>
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        Add Feature
      </div>
      <div className="flex flex-col gap-1.5">
        <AddBtn
          label="+ Fillet"
          disabled={!hasBaseFeature}
          onClick={() => beginFillet(part.id)}
          testId="add-fillet"
        />
        <AddBtn
          label="+ Chamfer"
          disabled={!hasBaseFeature}
          onClick={() => beginChamfer(part.id)}
          testId="add-chamfer"
        />
        <AddBtn
          label="+ Hole"
          disabled={!hasBaseFeature}
          onClick={() => beginHole(part.id)}
          testId="add-hole"
        />
      </div>
      {!hasBaseFeature ? (
        <div className="font-technical text-[11px] text-muted-foreground italic leading-snug">
          Add an Extrude or Revolve first; modifier features need an upstream
          shape.
        </div>
      ) : null}
      {onRequestDelete ? (
        <button
          type="button"
          onClick={() => onRequestDelete(part.id)}
          data-testid="part-delete"
          className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition mt-2"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}

function AddBtn({
  label,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={[
        "h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-left px-3 transition",
        disabled
          ? "text-muted-foreground bg-secondary/30 cursor-not-allowed"
          : "text-foreground bg-secondary hover:bg-secondary/80 active:bg-secondary",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
