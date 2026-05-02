// Phase 6 — "+ New Part" button shown above the Parts list in the left
// sidebar. Calls `createPart` which auto-picks a unique default name and
// selects the new part so subsequent sketches/features land on it.

import { Plus } from "lucide-react";
import { useKinetiCADStore } from "@/state/store";

export default function NewPartButton() {
  const createPart = useKinetiCADStore((s) => s.createPart);

  return (
    <button
      type="button"
      onClick={() => createPart()}
      data-testid="new-part-button"
      className="mx-1 mb-1 mt-1 h-7 px-2 flex items-center gap-1.5 rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition border border-dashed border-border hover:border-[#FF6B1A]/60"
    >
      <Plus size={12} />
      New Part
    </button>
  );
}
