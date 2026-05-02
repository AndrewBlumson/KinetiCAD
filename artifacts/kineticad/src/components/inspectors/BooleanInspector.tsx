// Phase 5 — Boolean inspector for the assembly-level Union/Subtract/Intersect
// editor. Lives in its own store slice (`booleanEditor`) and routed by
// Modeller's RightInspectorBody when the editor is open OR when a committed
// boolean is selected.
//
// Layout:
//   - Heading ("Union" / "Subtract" / "Intersect" / "Edit <Name>")
//   - Operation SegmentedControl (Union / Subtract / Intersect)
//   - Input parts checkbox list (every assembly.parts row)
//   - Tool part radio (Subtract only — must be one of the picked inputs)
//   - Result name TextInput
//   - Hide inputs checkbox (default on)
//   - Live preview toggle, error region, Apply / Cancel
//   - Delete button (edit mode only)
//
// Validation hints render inline when the user can't apply yet.

import { useKinetiCADStore } from "@/state/store";
import SegmentedControl from "@/components/SegmentedControl";
import type { BooleanOperation } from "@/state/schemas";

const OP_OPTIONS: Array<{ value: BooleanOperation["type"]; label: string }> = [
  { value: "union", label: "Union" },
  { value: "subtract", label: "Subtract" },
  { value: "intersect", label: "Intersect" },
];

export default function BooleanInspector() {
  const editor = useKinetiCADStore((s) => s.booleanEditor);
  const assembly = useKinetiCADStore((s) => s.assembly);
  const featurePreview = useKinetiCADStore((s) => s.featurePreview);
  const setParams = useKinetiCADStore((s) => s.setBooleanEditorParams);
  const setLivePreview = useKinetiCADStore(
    (s) => s.setBooleanEditorLivePreview,
  );
  const apply = useKinetiCADStore((s) => s.applyBooleanEditor);
  const cancel = useKinetiCADStore((s) => s.cancelBooleanEditor);
  const deleteBoolean = useKinetiCADStore((s) => s.deleteBooleanFeature);

  if (!editor.open) return null;

  const { params } = editor;
  const opType = params.operation.type;
  const error =
    featurePreview.status === "error" ? featurePreview.error : null;

  // Validation helpers.
  const inputCount = params.inputPartIds.length;
  const trimmedName = params.resultPartName.trim();
  const nameClash = assembly.booleanFeatures.some(
    (b) => b.resultPartName === trimmedName && b.id !== editor.featureId,
  );
  let validationHint: string | null = null;
  let canApply = false;
  if (opType === "subtract") {
    const tool =
      params.operation.type === "subtract" ? params.operation.toolPartId : "";
    if (inputCount !== 2) {
      validationHint = "Subtract needs exactly 2 inputs (body and tool).";
    } else if (!tool || !params.inputPartIds.includes(tool)) {
      validationHint = "Pick which of the two parts is the tool (cutter).";
    } else if (!trimmedName) {
      validationHint = "Result name is required.";
    } else if (nameClash) {
      validationHint = "Result name is already used by another boolean.";
    } else {
      canApply = true;
    }
  } else {
    if (inputCount < 2) {
      validationHint = "Pick at least 2 input parts.";
    } else if (inputCount > 8) {
      validationHint = "At most 8 inputs are supported.";
    } else if (!trimmedName) {
      validationHint = "Result name is required.";
    } else if (nameClash) {
      validationHint = "Result name is already used by another boolean.";
    } else {
      canApply = true;
    }
  }

  // Op switch: when moving to/from Subtract, fix up operation and tool.
  const handleOpChange = (next: BooleanOperation["type"]) => {
    if (next === opType) return;
    if (next === "subtract") {
      // Auto-pick first input as tool; drop extra inputs beyond 2 so the
      // user can still apply without manual pruning.
      const firstTool = params.inputPartIds[0] ?? "";
      const trimmedInputs = params.inputPartIds.slice(0, 2);
      setParams({
        ...params,
        operation: { type: "subtract", toolPartId: firstTool },
        inputPartIds: trimmedInputs,
      });
      return;
    }
    setParams({
      ...params,
      operation: next === "intersect" ? { type: "intersect" } : { type: "union" },
    });
  };

  const togglePartInput = (partId: string) => {
    const has = params.inputPartIds.includes(partId);
    let nextInputs: string[];
    if (has) {
      nextInputs = params.inputPartIds.filter((id) => id !== partId);
    } else {
      // Subtract caps at 2 inputs — replace the older slot rather than block.
      if (opType === "subtract" && params.inputPartIds.length >= 2) {
        nextInputs = [params.inputPartIds[1], partId];
      } else {
        nextInputs = [...params.inputPartIds, partId];
      }
    }

    let nextOp: BooleanOperation = params.operation;
    if (params.operation.type === "subtract") {
      const tool = params.operation.toolPartId;
      if (!nextInputs.includes(tool)) {
        nextOp = { type: "subtract", toolPartId: nextInputs[0] ?? "" };
      }
    }

    setParams({ ...params, operation: nextOp, inputPartIds: nextInputs });
  };

  const setTool = (partId: string) => {
    if (params.operation.type !== "subtract") return;
    setParams({
      ...params,
      operation: { type: "subtract", toolPartId: partId },
    });
  };

  const heading =
    editor.mode === "edit"
      ? `Edit ${trimmedName || "Boolean"}`
      : opType === "union"
      ? "Union"
      : opType === "subtract"
      ? "Subtract"
      : "Intersect";

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="font-technical text-xs text-foreground">{heading}</div>

      <Field label="Operation">
        <SegmentedControl
          value={opType}
          onChange={(v) => handleOpChange(v as BooleanOperation["type"])}
          options={OP_OPTIONS}
          ariaLabel="Boolean operation"
          testId="boolean-op"
        />
      </Field>

      <Field label={`Input parts (${inputCount})`}>
        {assembly.parts.length === 0 ? (
          <div className="font-technical text-[11px] text-muted-foreground italic">
            No parts in the assembly.
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {assembly.parts.map((p) => {
              const checked = params.inputPartIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 h-6 rounded bg-secondary/40 cursor-pointer select-none"
                  data-testid={`boolean-input-${p.id}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePartInput(p.id)}
                    className="accent-[#FF6B1A] w-3.5 h-3.5"
                  />
                  <span className="font-technical text-[11px] text-foreground truncate">
                    {p.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </Field>

      {opType === "subtract" ? (
        <Field label="Tool (cutter)">
          {params.inputPartIds.length === 0 ? (
            <div className="font-technical text-[11px] text-muted-foreground italic">
              Pick the body and the tool above first.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {params.inputPartIds.map((id) => {
                const p = assembly.parts.find((pp) => pp.id === id);
                if (!p) return null;
                const checked =
                  params.operation.type === "subtract" &&
                  params.operation.toolPartId === id;
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 px-2 h-6 rounded bg-secondary/40 cursor-pointer select-none"
                    data-testid={`boolean-tool-${id}`}
                  >
                    <input
                      type="radio"
                      name="boolean-tool"
                      checked={checked}
                      onChange={() => setTool(id)}
                      className="accent-[#FF6B1A] w-3.5 h-3.5"
                    />
                    <span className="font-technical text-[11px] text-foreground truncate">
                      {p.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>
      ) : null}

      <Field label="Result name">
        <input
          type="text"
          value={params.resultPartName}
          onChange={(e) =>
            setParams({ ...params, resultPartName: e.target.value })
          }
          placeholder="e.g. Union 1"
          data-testid="boolean-name"
          className="h-7 w-full px-2 rounded bg-secondary/60 border border-border text-foreground font-technical text-[11px] focus:outline-none focus:border-[#FF6B1A]"
        />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={params.hideInputs}
          onChange={(e) =>
            setParams({ ...params, hideInputs: e.target.checked })
          }
          data-testid="boolean-hide-inputs"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Hide inputs
        </span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={editor.livePreview}
          onChange={(e) => setLivePreview(e.target.checked)}
          data-testid="boolean-live-preview"
          className="accent-[#FF6B1A] w-3.5 h-3.5"
        />
        <span className="font-technical text-[11px] text-foreground">
          Live preview
        </span>
      </label>

      {validationHint ? (
        <div className="font-technical text-[11px] text-muted-foreground italic leading-snug">
          {validationHint}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          data-testid="boolean-error"
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
          data-testid="boolean-apply"
          className="h-8 w-full rounded bg-[#FF6B1A] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={cancel}
          data-testid="boolean-cancel"
          className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          Cancel
        </button>
        {editor.mode === "edit" && editor.featureId ? (
          <button
            type="button"
            onClick={() => {
              if (editor.featureId) deleteBoolean(editor.featureId);
            }}
            data-testid="boolean-delete"
            className="h-8 w-full rounded font-technical text-[11px] uppercase tracking-widest text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
