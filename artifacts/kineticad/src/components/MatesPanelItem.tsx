// Phase 7 — single row in the Mates panel. Renders:
//   - mate label (e.g. "Revolute 1 (Crank ↔ Ground)")
//   - inline motor info beneath when present (e.g. "Motor: 60 RPM")
//   - ⋮ menu (Rename / Delete)
//   - inline rename via double-click

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKinetiCADStore } from "@/state/store";
import type { Mate, Part } from "@/state/schemas";

const MATE_GLYPH: Record<Mate["type"], string> = {
  revolute: "⊙",
  prismatic: "↔",
  spherical: "●",
  fixed: "⊞",
  planar: "║",
};

const MATE_TYPE_LABEL: Record<Mate["type"], string> = {
  revolute: "Revolute",
  prismatic: "Prismatic",
  spherical: "Spherical",
  fixed: "Fixed",
  planar: "Planar",
};

export type MatesPanelItemProps = {
  mate: Mate;
  parts: Part[];
  selected: boolean;
  /** Index within the same mate-type, used for the default "Revolute 1" label. */
  indexAmongType: number;
  onClick: () => void;
};

export default function MatesPanelItem({
  mate,
  parts,
  selected,
  indexAmongType,
  onClick,
}: MatesPanelItemProps) {
  const renameMate = useKinetiCADStore((s) => s.renameMate);
  const removeMate = useKinetiCADStore((s) => s.removeMate);

  const defaultName = `${MATE_TYPE_LABEL[mate.type]} ${indexAmongType + 1}`;
  const displayName = mate.name && mate.name.trim() ? mate.name : defaultName;
  const partA = parts.find((p) => p.id === mate.partA)?.name ?? "?";
  const partB = parts.find((p) => p.id === mate.partB)?.name ?? "?";
  const motorLine = motorSummary(mate);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);

  const startRename = () => {
    setDraft(displayName);
    setEditing(true);
  };
  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== displayName) renameMate(mate.id, trimmed);
    setEditing(false);
  };

  return (
    <div
      className={[
        "group flex flex-col mx-1 px-2 py-1 rounded border-l-2 transition-colors cursor-default",
        selected
          ? "border-l-[#FF6B1A] bg-[#FF6B1A]/[0.08]"
          : "border-l-transparent hover:bg-secondary",
      ].join(" ")}
      data-testid={`tree-mate-${mate.id}`}
      onClick={() => {
        if (!editing) onClick();
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-technical text-[11px] text-[#FF6B1A] shrink-0 leading-none">
          {MATE_GLYPH[mate.type]}
        </span>
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setEditing(false);
            }}
            data-testid={`mate-rename-input-${mate.id}`}
            className="flex-1 min-w-0 font-technical text-xs bg-background border border-border rounded px-1 py-0 focus:outline-none focus:border-[#FF6B1A] text-foreground"
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate font-technical text-xs select-none text-foreground"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            {displayName}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${displayName}`}
              data-testid={`mate-menu-${mate.id}`}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="right"
            sideOffset={4}
            className="min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              data-testid={`mate-menu-rename-${mate.id}`}
              onSelect={startRename}
              className="font-technical text-[11px] uppercase tracking-wider"
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid={`mate-menu-delete-${mate.id}`}
              onSelect={() => removeMate(mate.id)}
              className="font-technical text-[11px] uppercase tracking-wider text-[#FF6B6B] focus:text-[#FF6B6B] focus:bg-[#FF6B6B]/10"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="font-technical text-[10px] text-muted-foreground truncate ml-5">
        {partA} ↔ {partB}
      </div>
      {motorLine ? (
        <div
          className="font-technical text-[10px] text-[#FF6B1A]/80 truncate ml-5"
          data-testid={`mate-motor-${mate.id}`}
        >
          Motor: {motorLine}
        </div>
      ) : null}
    </div>
  );
}

function motorSummary(mate: Mate): string | null {
  if (mate.type === "revolute") {
    const parts: string[] = [];
    if (mate.motorSpeedRpm != null) parts.push(`${mate.motorSpeedRpm} RPM`);
    if (mate.motorTorqueNm != null) parts.push(`${mate.motorTorqueNm} Nm`);
    return parts.length ? parts.join(" / ") : null;
  }
  if (mate.type === "prismatic") {
    const parts: string[] = [];
    if (mate.motorForceN != null) parts.push(`${mate.motorForceN} N`);
    if (mate.motorVelocityMmPerSec != null)
      parts.push(`${mate.motorVelocityMmPerSec} mm/s`);
    return parts.length ? parts.join(" / ") : null;
  }
  return null;
}
