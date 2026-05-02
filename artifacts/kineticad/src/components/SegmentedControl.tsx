// Three-button segmented toggle. Used for direction (forward/backward/symmetric)
// and revolve axis (X/Y/Z) pickers in the feature inspectors. Generic over the
// option value type so callers get type-safe `onChange` callbacks.

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Optional title tooltip. */
  title?: string;
};

export type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  ariaLabel?: string;
  testId?: string;
  disabled?: boolean;
};

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  testId,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      className={[
        "flex h-8 rounded border border-[#1F2942] overflow-hidden bg-[#0F1424]",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      {options.map((opt, i) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.title ?? opt.label}
            data-testid={
              testId ? `${testId}-${opt.value}` : undefined
            }
            className={[
              "flex-1 font-technical text-[10px] uppercase tracking-widest transition-colors",
              i > 0 ? "border-l border-[#1F2942]" : "",
              isActive
                ? "bg-[#FF6B1A] text-[#0A0E1A] font-semibold"
                : "text-foreground hover:bg-[#FF6B1A]/10",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
