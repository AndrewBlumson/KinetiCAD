// Part-level inspector: shown when `selection.kind === 'part'`. Phase 6
// surfaces inline rename, visibility toggle, position/rotation NumericInputs,
// reset transform, the "+ Add" buttons for modifier features, and Delete.
//
// NumericInputs:
//   - Position step 1mm (Shift × 10), 2 decimals shown.
//   - Rotation step 5deg (Shift × 10), 2 decimals shown.
//   - Arrow keys / ▲▼ buttons drive the step; raw typing commits on blur.

import { useEffect, useRef, useState } from "react";
import { Anchor, Eye, EyeOff } from "lucide-react";
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
  const renamePart = useKinetiCADStore((s) => s.renamePart);
  const setPartVisible = useKinetiCADStore((s) => s.setPartVisible);
  const setPartTransformPartial = useKinetiCADStore(
    (s) => s.setPartTransformPartial,
  );
  const resetPartTransform = useKinetiCADStore((s) => s.resetPartTransform);
  const setGroundPart = useKinetiCADStore((s) => s.setGroundPart);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (selection?.kind !== "part") return null;
  const part = assembly.parts.find((p) => p.id === selection.partId);
  if (!part) return null;

  const hasBaseFeature = part.features.some(
    (f) => f.type === "extrude" || f.type === "revolve",
  );
  const tx = part.transform;
  const effectiveGroundId =
    assembly.groundPartId || assembly.parts[0]?.id || "";
  const isGround = effectiveGroundId === part.id;

  const startRename = () => {
    setDraftName(part.name);
    setEditingName(true);
  };
  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== part.name) renamePart(part.id, trimmed);
    setEditingName(false);
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {/* Name + visibility toggle */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setEditingName(false);
            }}
            data-testid="part-rename-input"
            className="font-technical text-xs text-foreground bg-background border border-border rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-[#FF6B1A]"
          />
        ) : (
          <button
            type="button"
            className="font-technical text-xs text-foreground flex-1 text-left truncate hover:text-[#FF6B1A] transition"
            onDoubleClick={startRename}
            data-testid="part-name"
          >
            {part.name}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPartVisible(part.id, !part.visible)}
          title={part.visible ? "Hide part" : "Show part"}
          data-testid="part-visibility"
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          {part.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Transform: position */}
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        Position (mm)
      </div>
      <Vec3Input
        values={tx.positionMm}
        step={1}
        decimals={2}
        testIdPrefix="pos"
        onChange={(v) => setPartTransformPartial(part.id, { positionMm: v })}
      />

      {/* Transform: rotation */}
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        Rotation (deg)
      </div>
      <Vec3Input
        values={tx.rotationDeg}
        step={5}
        decimals={2}
        testIdPrefix="rot"
        onChange={(v) => setPartTransformPartial(part.id, { rotationDeg: v })}
      />

      <button
        type="button"
        onClick={() => resetPartTransform(part.id)}
        data-testid="part-reset-transform"
        className="h-7 w-full rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground bg-secondary/40 hover:bg-secondary/80 hover:text-foreground transition"
      >
        Reset Transform
      </button>

      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
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
      <button
        type="button"
        onClick={() => {
          if (!isGround) setGroundPart(part.id);
        }}
        disabled={isGround}
        data-testid="part-set-ground"
        className={[
          "h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest transition mt-2 flex items-center justify-center gap-1.5",
          isGround
            ? "text-[#FF6B1A] bg-[#FF6B1A]/[0.12] cursor-default"
            : "text-foreground bg-secondary hover:bg-secondary/80",
        ].join(" ")}
      >
        <Anchor size={12} />
        {isGround ? "Ground" : "Set as Ground"}
      </button>
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

function Vec3Input({
  values,
  step,
  decimals,
  testIdPrefix,
  onChange,
}: {
  values: [number, number, number];
  step: number;
  decimals: number;
  testIdPrefix: string;
  onChange: (next: [number, number, number]) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(["x", "y", "z"] as const).map((axis, i) => (
        <NumericField
          key={axis}
          label={axis.toUpperCase()}
          value={values[i]}
          step={step}
          decimals={decimals}
          testId={`${testIdPrefix}-${axis}`}
          onChange={(v) => {
            const next = [...values] as [number, number, number];
            next[i] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function NumericField({
  label,
  value,
  step,
  decimals,
  testId,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  decimals: number;
  testId?: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(formatNumber(value, decimals));
  const focusedRef = useRef(false);

  // Sync external value -> draft when the field isn't being edited (so a
  // gizmo drag updates the inspector live, but typing isn't clobbered).
  useEffect(() => {
    if (!focusedRef.current) setDraft(formatNumber(value, decimals));
  }, [value, decimals]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) {
      setDraft(formatNumber(value, decimals));
      return;
    }
    onChange(n);
    setDraft(formatNumber(n, decimals));
  };

  const bump = (dir: 1 | -1, shift: boolean) => {
    const mult = shift ? 10 : 1;
    const next = value + dir * step * mult;
    onChange(next);
    if (!focusedRef.current) setDraft(formatNumber(next, decimals));
  };

  return (
    <div className="flex flex-col items-stretch">
      <span className="font-technical text-[9px] uppercase text-muted-foreground text-center mb-0.5">
        {label}
      </span>
      <div className="flex items-stretch h-7 border border-border rounded overflow-hidden focus-within:border-[#FF6B1A]">
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={(e) => {
            focusedRef.current = false;
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              bump(1, e.shiftKey);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              bump(-1, e.shiftKey);
            }
          }}
          step={step}
          data-testid={testId}
          className="w-full bg-transparent font-technical text-[11px] text-foreground px-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="flex flex-col w-3 border-l border-border shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => bump(1, e.shiftKey)}
            data-testid={testId ? `${testId}-up` : undefined}
            className="flex-1 text-[7px] text-muted-foreground hover:text-foreground hover:bg-secondary leading-none"
          >
            ▲
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => bump(-1, e.shiftKey)}
            data-testid={testId ? `${testId}-down` : undefined}
            className="flex-1 text-[7px] text-muted-foreground hover:text-foreground hover:bg-secondary leading-none border-t border-border"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "0";
  // Trim trailing zeros after the decimal point, but keep at least the
  // integer part so users see "0" instead of an empty string.
  const fixed = n.toFixed(decimals);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed === "" || trimmed === "-" ? "0" : trimmed;
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
