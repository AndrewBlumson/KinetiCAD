// Phase 6 — three-dot context menu shown on each row in the Parts panel
// and (optionally) anywhere a part needs the Rename / Hide-Show / Duplicate
// / Delete actions. Built on the existing Radix dropdown-menu primitives
// so it inherits the project's keyboard nav, focus management, and
// outside-click handling for free.

import { Anchor, Eye, EyeOff, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PartContextMenuProps = {
  partId: string;
  partName: string;
  visible: boolean;
  /** True when this part is the current ground anchor. Disables the item. */
  isGround: boolean;
  onRename: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onSetGround: () => void;
  /** Caller is expected to surface the cascade-aware confirm dialog. */
  onDelete: () => void;
};

export default function PartContextMenu({
  partId,
  partName,
  visible,
  isGround,
  onRename,
  onToggleVisible,
  onDuplicate,
  onSetGround,
  onDelete,
}: PartContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${partName}`}
          data-testid={`part-menu-${partId}`}
          // Stop the click from bubbling up to the row's selection handler.
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
        // Same stop-propagation guard as the trigger so menu interactions
        // don't bleed back into the row.
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          data-testid={`part-menu-rename-${partId}`}
          onSelect={onRename}
          className="font-technical text-[11px] uppercase tracking-wider"
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={`part-menu-visibility-${partId}`}
          onSelect={onToggleVisible}
          className="font-technical text-[11px] uppercase tracking-wider gap-2"
        >
          {visible ? <EyeOff size={12} /> : <Eye size={12} />}
          {visible ? "Hide" : "Show"}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={`part-menu-duplicate-${partId}`}
          onSelect={onDuplicate}
          className="font-technical text-[11px] uppercase tracking-wider"
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid={`part-menu-set-ground-${partId}`}
          onSelect={() => {
            if (!isGround) onSetGround();
          }}
          disabled={isGround}
          className="font-technical text-[11px] uppercase tracking-wider gap-2"
        >
          <Anchor size={12} />
          {isGround ? "Ground" : "Set as Ground"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid={`part-menu-delete-${partId}`}
          onSelect={onDelete}
          className="font-technical text-[11px] uppercase tracking-wider text-[#FF6B6B] focus:text-[#FF6B6B] focus:bg-[#FF6B6B]/10"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
