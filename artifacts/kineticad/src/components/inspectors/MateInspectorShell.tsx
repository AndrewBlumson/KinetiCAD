// Phase 7 — Shared layout/buttons for every per-type mate inspector.
// Owns the Heading + Stage indicator + error block + Apply/Cancel/Delete
// row. The per-type inspectors render their type-specific body inside the
// `children` slot.

import type { ReactNode } from "react";
import { useKinetiCADStore } from "@/state/store";
import type { MateEditor, MateEditorStage } from "@/state/store";

const STAGE_LABEL: Record<MateEditorStage, string> = {
  "pick-a": "Click first piece on Part A...",
  "pick-b": "Click second piece on a different part...",
  ready: "Ready to apply.",
};

export type MateInspectorShellProps = {
  heading: string;
  /**
   * Sub-inspector validation. When the editor is in `pick-*` stage we
   * disable Apply regardless. When it's in `ready` we still ask the
   * sub-inspector if everything's good (e.g. pivot pick succeeded but a
   * required name is missing).
   */
  canApply: boolean;
  /** Optional inline hint shown above the buttons (e.g. "Pick at least one"). */
  validationHint?: string | null;
  children: ReactNode;
};

export default function MateInspectorShell({
  heading,
  canApply,
  validationHint,
  children,
}: MateInspectorShellProps) {
  const editor = useKinetiCADStore((s) => s.mateEditor) as MateEditor;
  const apply = useKinetiCADStore((s) => s.applyMateEditor);
  const cancel = useKinetiCADStore((s) => s.cancelMateEditor);
  const remove = useKinetiCADStore((s) => s.removeMate);
  if (!editor.open) return null;

  const error = editor.error;
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <div className="font-technical text-[11px] text-muted-foreground italic leading-snug">
        {STAGE_LABEL[editor.stage]}
      </div>

      {children}

      {validationHint ? (
        <div className="font-technical text-[11px] text-muted-foreground italic leading-snug">
          {validationHint}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          data-testid="mate-error"
          className="flex items-start gap-1.5 px-2 py-1.5 rounded border border-[#FF6B6B]/40 bg-[#FF6B6B]/10"
        >
          <span className="text-[#FF6B6B] text-xs leading-none mt-0.5">⚠</span>
          <span className="font-technical text-[11px] text-[#FF6B6B] leading-snug">
            {error}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          data-testid="mate-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="mate-cancel"
          className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          Cancel
        </button>
        {editor.mode === "edit" && editor.mateId ? (
          <button
            type="button"
            onClick={() => {
              if (editor.mateId) remove(editor.mateId);
            }}
            data-testid="mate-delete"
            className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function NameField() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  const setParams = useKinetiCADStore((s) => s.setMateEditorParams);
  if (!editor.open) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        Name
      </div>
      <input
        type="text"
        value={editor.params.name}
        onChange={(e) =>
          setParams({ ...editor.params, name: e.target.value })
        }
        data-testid="mate-name"
        className="h-7 w-full px-2 rounded bg-secondary/60 border border-border text-foreground font-technical text-[11px] focus:outline-none focus:border-[#FF6B1A]"
      />
    </div>
  );
}

export function NumericField({
  label,
  value,
  onChange,
  testId,
  unit,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  testId?: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        {label} {unit ? <span className="opacity-60">({unit})</span> : null}
      </div>
      <input
        type="number"
        value={value == null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw.trim() === "") {
            onChange(null);
            return;
          }
          const n = parseFloat(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        placeholder="—"
        data-testid={testId}
        className="h-7 w-full px-2 rounded bg-secondary/60 border border-border text-foreground font-technical text-[11px] focus:outline-none focus:border-[#FF6B1A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
