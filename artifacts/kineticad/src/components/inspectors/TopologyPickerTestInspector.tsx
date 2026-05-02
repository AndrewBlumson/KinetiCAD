// Phase 4 Split A diagnostic panel.
//
// Toggled via Cmd/Ctrl+Shift+T. Lets a developer drive the topology picker
// independently of any feature inspector so we can verify it's wired up
// correctly. Replaced in Phase 4 Split B by per-feature inspectors that
// drive `pickingMode` themselves.

import { useKinetiCADStore, type PickingMode } from "@/state/store";

const MODES: { value: PickingMode; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "edges", label: "Edges" },
  { value: "faces", label: "Faces" },
  { value: "point-on-face", label: "Point on face" },
];

export default function TopologyPickerTestInspector() {
  const pickingMode = useKinetiCADStore((s) => s.pickingMode);
  const setPickingMode = useKinetiCADStore((s) => s.setPickingMode);
  const selection = useKinetiCADStore((s) => s.selection);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const togglePanel = useKinetiCADStore((s) => s.togglePickerTestPanel);

  const handleClear = () => {
    clearSelection();
    setPickingMode("idle");
  };

  return (
    <div
      className="border border-[#FF6B1A]/60 bg-card/95 rounded shadow-lg p-3 flex flex-col gap-2"
      data-testid="picker-test-inspector"
    >
      <div className="flex items-center justify-between">
        <span className="font-technical text-[11px] uppercase tracking-widest text-[#FF6B1A]">
          Picker · Diagnostic
        </span>
        <button
          type="button"
          onClick={togglePanel}
          className="font-technical text-[10px] text-muted-foreground hover:text-foreground"
          aria-label="Close picker diagnostic"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-technical text-[10px] uppercase tracking-wider text-muted-foreground">
          Mode
        </span>
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPickingMode(m.value)}
              data-testid={`picker-mode-${m.value}`}
              className={[
                "px-2 py-1 rounded text-[11px] font-technical transition-colors",
                pickingMode === m.value
                  ? "bg-[#FF6B1A] text-white"
                  : "bg-secondary text-foreground hover:bg-secondary/80",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-technical text-[10px] uppercase tracking-wider text-muted-foreground">
          Selection
        </span>
        <SelectionReadout selection={selection} />
      </div>

      <button
        type="button"
        onClick={handleClear}
        className="self-start font-technical text-[11px] px-2 py-1 rounded bg-secondary text-foreground hover:bg-secondary/80"
        data-testid="picker-clear"
      >
        Clear
      </button>

      <p className="font-technical text-[10px] text-muted-foreground italic mt-1">
        Cmd/Ctrl+Shift+T to toggle.
      </p>
    </div>
  );
}

function SelectionReadout({
  selection,
}: {
  selection: ReturnType<typeof useKinetiCADStore.getState>["selection"];
}) {
  if (!selection) {
    return (
      <span className="font-technical text-[11px] text-muted-foreground italic">
        nothing selected
      </span>
    );
  }
  if (selection.kind === "edges") {
    return (
      <div className="font-technical text-[11px] text-foreground break-all leading-relaxed">
        <div>edges ({selection.edgeIds.length}) on {short(selection.partId)}</div>
        {selection.edgeIds.slice(0, 4).map((id) => (
          <div key={id} className="text-muted-foreground pl-2">· {id}</div>
        ))}
        {selection.edgeIds.length > 4 && (
          <div className="text-muted-foreground pl-2">…</div>
        )}
      </div>
    );
  }
  if (selection.kind === "face") {
    return (
      <div className="font-technical text-[11px] text-foreground break-all leading-relaxed">
        face {selection.faceId} on {short(selection.partId)}
      </div>
    );
  }
  if (selection.kind === "point-on-face") {
    const [u, v] = selection.uv;
    return (
      <div className="font-technical text-[11px] text-foreground break-all leading-relaxed">
        <div>point-on-face {selection.faceId}</div>
        <div className="text-muted-foreground pl-2">
          u={u.toFixed(2)} v={v.toFixed(2)} (mm)
        </div>
      </div>
    );
  }
  return (
    <span className="font-technical text-[11px] text-muted-foreground italic">
      {selection.kind}
    </span>
  );
}

function short(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
