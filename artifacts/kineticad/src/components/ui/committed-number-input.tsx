import { useEffect, useId, useState } from 'react';

/** Keep incomplete keyboard input local; only complete, valid edits change a model. */
export function CommittedNumberInput({ value, min, max, step, label, disabled, className, onCommit }: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  disabled?: boolean;
  className?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const errorId = useId();
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  const commit = () => {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) || next < min || next > max) {
      setDraft(String(value));
      setError(`Enter a number from ${min} to ${max}. Kept ${value}.`);
      return;
    }
    setError(''); setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return <>
    <input type="number" aria-label={label} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} value={draft}
      min={min} max={max} step={step} disabled={disabled} className={className}
      onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
    {error && <span id={errorId} role="status" className="col-span-full block mt-1 text-[11px] text-destructive">{error}</span>}
  </>;
}
