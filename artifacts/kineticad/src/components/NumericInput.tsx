// Numeric input with up/down step buttons.
//
// - Local string state for the typed value so users can type freely
//   (including transient invalid states like "" or "-") without external
//   churn. The clamped numeric value is reported to `onChange` only after
//   a 200ms idle window, or immediately on step / keyboard arrow.
// - Hold-to-repeat on the step buttons: 100ms initial cadence, accelerating
//   to 50ms after 1 second of holding.
// - Arrow up/down on the input steps by `step` (Shift = ×10).
// - On blur: parse, clamp to [min, max], format to `decimals`.
// - Display formatting: 1 decimal for mm fields, 0 decimals for integer
//   fields. Caller picks via `decimals`.

import { useCallback, useEffect, useRef, useState } from "react";

export type NumericInputProps = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  /** Optional unit label rendered greyed-out to the right of the input. */
  unit?: string;
  /** Pulled through to the input for tests. */
  testId?: string;
  /** Pulled through to the input for accessibility. */
  ariaLabel?: string;
  disabled?: boolean;
};

const DEBOUNCE_MS = 200;
const REPEAT_INITIAL_MS = 100;
const REPEAT_FAST_MS = 50;
const REPEAT_ACCELERATE_AFTER_MS = 1000;

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function format(n: number, decimals: number): string {
  return n.toFixed(decimals);
}

export default function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 1,
  unit,
  testId,
  ariaLabel,
  disabled = false,
}: NumericInputProps) {
  // Local "draft" string so the user can type freely; the parsed/clamped
  // value is committed via onChange after a debounce.
  const [draft, setDraft] = useState<string>(() => format(value, decimals));
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedRef = useRef<number>(value);

  // Re-sync draft from external value changes only when the user isn't
  // actively editing — otherwise an external update would clobber typing.
  useEffect(() => {
    if (focused) return;
    if (value === lastReportedRef.current) return;
    setDraft(format(value, decimals));
    lastReportedRef.current = value;
  }, [value, decimals, focused]);

  const commit = useCallback(
    (raw: number) => {
      const next = clamp(
        Number.isFinite(raw) ? raw : lastReportedRef.current,
        min,
        max,
      );
      lastReportedRef.current = next;
      onChange(next);
    },
    [min, max, onChange],
  );

  const scheduleDebounced = useCallback(
    (raw: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit(raw);
        debounceRef.current = null;
      }, DEBOUNCE_MS);
    },
    [commit],
  );

  // Cleanup any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const stepBy = useCallback(
    (delta: number) => {
      const parsed = parseFloat(draft);
      const base = Number.isFinite(parsed) ? parsed : lastReportedRef.current;
      const next = clamp(base + delta, min, max);
      setDraft(format(next, decimals));
      // Step buttons / arrow keys flush immediately — no debounce.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      commit(next);
    },
    [draft, min, max, decimals, commit],
  );

  // Hold-to-repeat for the step buttons. We use a ref-based timer so the
  // accelerating cadence doesn't suffer from React state lag.
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatStartRef = useRef<number>(0);

  const startRepeat = useCallback(
    (delta: number) => {
      // First press fires immediately, then enter the repeat loop.
      stepBy(delta);
      repeatStartRef.current = performance.now();
      const tick = () => {
        const elapsed = performance.now() - repeatStartRef.current;
        const cadence =
          elapsed >= REPEAT_ACCELERATE_AFTER_MS
            ? REPEAT_FAST_MS
            : REPEAT_INITIAL_MS;
        stepBy(delta);
        repeatTimerRef.current = setTimeout(tick, cadence);
      };
      repeatTimerRef.current = setTimeout(tick, REPEAT_INITIAL_MS);
    },
    [stepBy],
  );

  const stopRepeat = useCallback(() => {
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  // Make sure we don't leak a repeat timer if the component unmounts mid-press.
  useEffect(() => {
    return () => {
      if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepBy(step * mult);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      stepBy(-step * mult);
    } else if (e.key === "Enter") {
      // Flush whatever is in the draft right now.
      e.preventDefault();
      const parsed = parseFloat(draft);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      commit(parsed);
      setDraft(format(clamp(parsed, min, max), decimals));
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(draft);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!Number.isFinite(parsed)) {
      // Restore last known good value.
      setDraft(format(lastReportedRef.current, decimals));
      return;
    }
    const clamped = clamp(parsed, min, max);
    setDraft(format(clamped, decimals));
    if (clamped !== lastReportedRef.current) {
      commit(clamped);
    }
  };

  return (
    <div
      className={[
        "flex items-stretch h-8 rounded border border-[#1F2942] bg-[#0F1424] text-foreground",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = parseFloat(next);
          if (Number.isFinite(parsed)) {
            scheduleDebounced(parsed);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        data-testid={testId}
        aria-label={ariaLabel}
        className="flex-1 bg-transparent px-2 font-technical text-xs outline-none focus:outline-none focus:ring-1 focus:ring-[#FF6B1A] focus:ring-inset rounded-l"
      />
      {unit ? (
        <span className="self-center pr-1 font-technical text-[10px] uppercase tracking-wider text-muted-foreground select-none pointer-events-none">
          {unit}
        </span>
      ) : null}
      <div className="flex flex-col border-l border-[#1F2942]">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            startRepeat(step);
          }}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={(e) => {
            e.preventDefault();
            startRepeat(step);
          }}
          onTouchEnd={stopRepeat}
          aria-label="Increment"
          className="flex-1 px-1 text-[10px] text-muted-foreground hover:text-[#FF6B1A] hover:bg-[#FF6B1A]/10 transition-colors leading-none"
        >
          ▲
        </button>
        <div className="h-px bg-[#1F2942]" />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault();
            startRepeat(-step);
          }}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={(e) => {
            e.preventDefault();
            startRepeat(-step);
          }}
          onTouchEnd={stopRepeat}
          aria-label="Decrement"
          className="flex-1 px-1 text-[10px] text-muted-foreground hover:text-[#FF6B1A] hover:bg-[#FF6B1A]/10 transition-colors leading-none"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
