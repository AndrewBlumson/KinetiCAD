// Phase 6 — single row in the Parts panel. Renders:
//   - eye icon that toggles `part.visible`
//   - part name (click selects, double-click inline rename, hidden parts
//     muted #7A8599)
//   - ⋮ context menu (Rename / Hide-Show / Duplicate / Delete)
//   - child rows for the part's sketches and features (same selection /
//     muting rules as the previous PartTree)
//
// The cascade-aware delete confirmation is owned by Modeller.tsx; this
// component just calls `onRequestDelete(partId)` to surface it.

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useKinetiCADStore } from "@/state/store";
import type { Feature, Part, SketchPlane } from "@/state/schemas";
import PartContextMenu from "./PartContextMenu";

export type PartsPanelItemProps = {
  part: Part;
  selection: ReturnType<typeof useKinetiCADStore.getState>["selection"];
  onPartClick: (partId: string) => void;
  onSketchClick: (partId: string, sketchId: string) => void;
  onFeatureClick: (partId: string, featureId: string) => void;
  onRequestDelete: (partId: string) => void;
};

const HIDDEN_COLOR = "#7A8599";

export default function PartsPanelItem({
  part,
  selection,
  onPartClick,
  onSketchClick,
  onFeatureClick,
  onRequestDelete,
}: PartsPanelItemProps) {
  const renamePart = useKinetiCADStore((s) => s.renamePart);
  const setPartVisible = useKinetiCADStore((s) => s.setPartVisible);
  const duplicatePart = useKinetiCADStore((s) => s.duplicatePart);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(part.name);

  const isPartSelected =
    selection?.kind === "part" && selection.partId === part.id;
  const hidden = !part.visible;

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
    <div className="flex flex-col">
      {/* Part row */}
      <div
        className={[
          "group flex items-center gap-1 mx-1 px-2 py-1 rounded border-l-2 transition-colors cursor-default",
          isPartSelected
            ? "border-l-[#FF6B1A] bg-[#FF6B1A]/[0.08]"
            : "border-l-transparent hover:bg-secondary",
        ].join(" ")}
        data-testid={`tree-part-${part.id}`}
        onClick={() => {
          if (!editingName) onPartClick(part.id);
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPartVisible(part.id, !part.visible);
          }}
          title={part.visible ? "Hide part" : "Show part"}
          data-testid={`part-visibility-${part.id}`}
          className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition shrink-0"
        >
          {part.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setEditingName(false);
            }}
            data-testid={`part-rename-input-${part.id}`}
            className="flex-1 min-w-0 font-technical text-xs bg-background border border-border rounded px-1 py-0 focus:outline-none focus:border-[#FF6B1A] text-foreground"
          />
        ) : (
          <span
            className={[
              "flex-1 min-w-0 truncate font-technical text-xs select-none",
              isPartSelected && !hidden ? "text-foreground" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={hidden ? { color: HIDDEN_COLOR } : undefined}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            {part.name}
          </span>
        )}
        <PartContextMenu
          partId={part.id}
          partName={part.name}
          visible={part.visible}
          onRename={startRename}
          onToggleVisible={() => setPartVisible(part.id, !part.visible)}
          onDuplicate={() => duplicatePart(part.id)}
          onDelete={() => onRequestDelete(part.id)}
        />
      </div>

      {/* Children: sketches + features (muted, indented). When the parent
          part is hidden, the rows are rendered in the same #7A8599 muted
          tone so the whole branch reads as inactive. */}
      {part.sketches.map((s) => {
        const isSelected =
          selection?.kind === "sketch" && selection.sketchId === s.id;
        return (
          <ChildRow
            key={s.id}
            label={`${s.name} (${planeLabel(s.plane)})`}
            selected={isSelected}
            hidden={hidden}
            onClick={() => onSketchClick(part.id, s.id)}
            testId={`tree-sketch-${s.id}`}
          />
        );
      })}
      {part.features.map((f, idx) => {
        const isSelected =
          selection?.kind === "feature" && selection.featureId === f.id;
        return (
          <ChildRow
            key={f.id}
            label={featureName(f, part, idx)}
            selected={isSelected}
            hidden={hidden}
            onClick={() => onFeatureClick(part.id, f.id)}
            testId={`tree-feature-${f.id}`}
          />
        );
      })}
    </div>
  );
}

function ChildRow({
  label,
  selected,
  hidden,
  onClick,
  testId,
}: {
  label: string;
  selected: boolean;
  hidden: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={[
        "text-left pl-7 pr-3 py-1 text-xs font-technical hover:bg-secondary transition-colors rounded mx-1 border-l-2",
        selected
          ? "border-l-[#FF6B1A] bg-[#FF6B1A]/[0.08] text-foreground"
          : "border-l-transparent",
        !selected && !hidden ? "text-muted-foreground" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={hidden && !selected ? { color: HIDDEN_COLOR } : undefined}
    >
      {label}
    </button>
  );
}

function planeLabel(plane: SketchPlane): string {
  if (typeof plane === "string") return plane;
  return "Custom";
}

function featureName(feature: Feature, part: Part, _idx: number): string {
  if (feature.type === "extrude") {
    const sameKind = part.features.filter((f) => f.type === "extrude");
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Extrude ${n}`;
  }
  if (feature.type === "revolve") {
    const sameKind = part.features.filter((f) => f.type === "revolve");
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Revolve ${n}`;
  }
  if (feature.type === "fillet") {
    const sameKind = part.features.filter((f) => f.type === "fillet");
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Fillet ${n}`;
  }
  if (feature.type === "chamfer") {
    const sameKind = part.features.filter((f) => f.type === "chamfer");
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Chamfer ${n}`;
  }
  if (feature.type === "hole") {
    const sameKind = part.features.filter((f) => f.type === "hole");
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Hole ${n}`;
  }
  // Exhaustive — every Feature variant is handled above. Fallback keeps
  // TS happy without leaning on the (now-`never`) `feature.type`.
  return "Feature";
}
