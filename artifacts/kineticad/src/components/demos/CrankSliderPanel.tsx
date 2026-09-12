import { useEffect, useMemo, useRef, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import { usePoseMeasurements } from '@/physics/poseMeasurements';
import { validateCrankSliderParams, type CrankSliderParams } from '@/mechanisms/crankSlider';
import { matchesCrankSliderAssembly, matchesCrankSliderConfiguration } from '@/mechanisms/crankSliderWorkspace';
import { readCrankSliderSample, selectCrankSliderIntervalSample, type CrankSliderSample } from '@/mechanisms/crankSliderReadout';
import { CommittedNumberInput } from '@/components/ui/committed-number-input';
import { useDemoWorkspace } from './DemoWorkspace';

const inputClass = 'mt-1 w-full rounded border border-border bg-background px-2 py-2 tabular-nums disabled:opacity-40';
const format = (v: number | undefined, digits = 3) => v == null ? '—' : v.toFixed(digits);

export function CrankSliderControls() {
  const params = useKinetiCADStore(s => s.simulation.crankSlider)!;
  const assembly = useKinetiCADStore(s => s.assembly);
  const running = useKinetiCADStore(s => s.simulation.running);
  const { applyCrankSlider } = useDemoWorkspace();
  const [draft, setDraft] = useState<CrankSliderParams>(params);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(params); setError(''); }, [params]);
  const intact = useMemo(() => matchesCrankSliderAssembly(assembly, params), [assembly, params]);
  const changed = draft.radiusMm !== params.radiusMm || draft.rodLengthMm !== params.rodLengthMm || draft.rpm !== params.rpm;
  const locked = running || !intact;
  const field = (label: string, key: keyof CrankSliderParams, min: number, max: number, step: number) => <label className="block">{label}
    <CommittedNumberInput label={label} value={draft[key]} min={min} max={max} step={step} disabled={locked} className={inputClass}
      onCommit={value => { setDraft(p => ({ ...p, [key]: value })); setError(''); }} />
  </label>;
  return <section aria-label="Crank-slider settings" className="space-y-4 p-3 text-xs">
    <h2 className="text-sm font-semibold">Turn rotation into a straight stroke</h2>
    <p className="leading-relaxed text-muted-foreground">The motor turns the crank. The connecting rod pushes and pulls the slider along its guide.</p>
    {field('Crank radius (mm)', 'radiusMm', 15, 40, 1)}
    {field('Connecting rod length (mm)', 'rodLengthMm', 75, 180, 5)}
    {field('Crank speed (RPM)', 'rpm', -30, 30, 1)}
    <p className="leading-relaxed text-muted-foreground">Stroke = twice the crank radius. The rod must be at least three times that radius. Negative RPM reverses the motor; zero releases it.</p>
    <button disabled={locked} onClick={() => {
      if (!changed) return;
      try { applyCrankSlider(validateCrankSliderParams(draft)); setError(''); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'The dimensions could not be applied.'); }
    }} className="w-full rounded bg-orange-500 px-3 py-2 font-medium text-white disabled:opacity-40">Apply dimensions & speed</button>
    {error && <p role="alert" className="leading-relaxed text-orange-300">{error} The current mechanism is unchanged.</p>}
    {running && <p className="text-muted-foreground">Press Reset above to change dimensions.</p>}
    {!intact && <p role="status" className="leading-relaxed text-orange-300">This assembly has manual edits. Parameter replacement and reference comparisons are disabled to preserve them. Open a fresh crank-slider or use Reset demo to restore its original geometry.</p>}
    {intact && <div className="rounded border border-border p-3 leading-relaxed">
      <p>Current stroke <strong className="text-orange-300">{(2 * params.radiusMm).toFixed(1)} mm</strong></p>
      <p className="mt-1 text-muted-foreground">Slider pin travels between {(params.rodLengthMm - params.radiusMm).toFixed(1)} and {(params.rodLengthMm + params.radiusMm).toFixed(1)} mm from the crank centre.</p>
    </div>}
    <p className="text-muted-foreground leading-relaxed">The four parts contain editable native sketches and features. Switch to Modeller to inspect or export them; Save project retains these settings.</p>
  </section>;
}

export function CrankSliderMeasurements() {
  const params = useKinetiCADStore(s => s.simulation.crankSlider)!;
  const assembly = useKinetiCADStore(s => s.assembly);
  const simulation = useKinetiCADStore(s => s.simulation);
  const readouts = usePoseMeasurements();
  const { revision } = useDemoWorkspace();
  const previous = useRef<CrankSliderSample | undefined>(undefined);
  const accelerationHistory = useRef<CrankSliderSample[]>([]);
  const [history, setHistory] = useState<CrankSliderSample[]>([]);
  const valid = useMemo(() => matchesCrankSliderConfiguration(assembly, simulation),
    [assembly, params, simulation.gravity, simulation.timeStepMs, simulation.durationMs,
      simulation.forceExperiment, simulation.stewartMotion]);
  const sourceKey = `${revision}:${readouts.runGeneration}:${params.radiusMm}:${params.rodLengthMm}:${params.rpm}`;
  const historyKey = useRef(sourceKey);
  useEffect(() => {
    const newRun = historyKey.current !== sourceKey;
    if (newRun) { historyKey.current = sourceKey; previous.current = undefined; accelerationHistory.current = []; }
    if (!valid || !readouts.poses.length) { previous.current = undefined; accelerationHistory.current = []; setHistory([]); return; }
    if (previous.current && previous.current.timeSeconds * 1000 > readouts.simulatedTimeMs) {
      previous.current = undefined; accelerationHistory.current = [];
    }
    // Average acceleration over at least 1/30 s; reporting every tiny solver
    // step would amplify float32 velocity noise without adding useful detail.
    if (previous.current && readouts.simulatedTimeMs / 1000 - previous.current.timeSeconds < 1 / 30 - 1e-8
      && readouts.simulatedTimeMs < (simulation.durationMs ?? Infinity) - 1e-8) return;
    if (previous.current?.timeSeconds === readouts.simulatedTimeMs / 1000) return;
    // The final pose is always published, but its acceleration still uses an
    // interval of at least 1/30 s rather than one short leftover solver step.
    const intervalStart = selectCrankSliderIntervalSample(accelerationHistory.current, readouts.simulatedTimeMs / 1000);
    const sample = readCrankSliderSample(params, readouts.simulatedTimeMs, readouts.poses, readouts.bodies, intervalStart);
    if (!sample) { previous.current = undefined; accelerationHistory.current = []; setHistory([]); return; }
    const restart = !previous.current;
    previous.current = sample;
    accelerationHistory.current = [...accelerationHistory.current.slice(-3), sample];
    setHistory(rows => [...(restart ? [] : rows.slice(-479)), sample]);
  }, [params, readouts, valid, sourceKey, simulation.durationMs]);
  const sample = history.at(-1);
  return <section aria-label="Measured crank-slider motion" className="space-y-3 border-b border-border p-3 text-xs">
    <h2 className="font-semibold">Measured / calculated</h2>
    {!valid ? <p className="leading-relaxed text-orange-300">Reference comparison is unavailable for this edited model or force configuration.</p> : <>
      <p className="leading-relaxed text-muted-foreground">Run the mechanism to compare actual motion with ideal constant-speed equations.</p>
      <table className="w-full text-[11px] tabular-nums" aria-label="Crank-slider comparison">
        <thead><tr className="text-muted-foreground"><th className="py-1 text-left font-normal">Quantity</th><th className="text-right font-normal">Measured</th><th className="text-right font-normal">Calculated</th></tr></thead>
        <tbody>{([
          ['Position mm', sample?.positionMm, sample?.referencePositionMm],
          ['Speed mm/s', sample?.velocityMmPerSec, sample?.referenceVelocityMmPerSec],
          ['Mean accel. mm/s²', sample?.averageAccelerationMmPerSec2, sample?.referenceAverageAccelerationMmPerSec2],
          ['Crank RPM', sample?.rpm, params.rpm],
        ] as Array<[string, number | undefined, number | undefined]>).map(([label, measured, reference]) => <tr key={label}><th className="py-2 text-left font-normal">{label}</th><td className="text-right text-orange-300">{format(measured)}</td><td className="text-right text-teal-300">{format(reference)}</td></tr>)}</tbody>
      </table>
      <p className="tabular-nums text-muted-foreground">Position error: {sample ? format(Math.abs(sample.positionMm - sample.referencePositionMm), 4) : '—'} mm</p>
      <CrankSliderPlot history={history} params={params} />
      <p className="text-[10px] leading-relaxed text-muted-foreground">Position and speed are read from the solver. Mean acceleration uses a measured speed change over at least 1/30 s; its reference uses the same interval. The motor starts from rest, so the initial acceleration differs from a constant-speed idealisation.</p>
    </>}
    <details className="text-[11px] text-muted-foreground"><summary className="cursor-pointer">What is being checked?</summary><p className="mt-2 leading-relaxed">For crank radius r, rod length L and crank angle θ: x = r cos θ + √(L² − r² sin² θ). The reference uses θ = RPM × 2πt/60. Only the crank has a motor; the rod and slider move through the four joint constraints. This is a rigid, zero-gravity mechanism with ideal bearings and no contact or load-capacity model.</p></details>
  </section>;
}

function CrankSliderPlot({ history, params }: { history: CrankSliderSample[]; params: CrankSliderParams }) {
  const end = Math.max(1, history.at(-1)?.timeSeconds ?? 0);
  const low = params.rodLengthMm - params.radiusMm, high = params.rodLengthMm + params.radiusMm;
  const point = (t: number, x: number) => `${34 + 220 * t / end},${120 - 95 * (x - low) / (high - low)}`;
  return <figure className="rounded border border-border p-2">
    <figcaption className="mb-2 text-[11px]">Slider position over time</figcaption>
    <svg viewBox="0 0 270 150" role="img" aria-label="Actual slider position compared with the calculated curve" className="w-full">
      <path d="M 34 20 V 120 H 258" fill="none" stroke="#55657a" />
      <polyline points={history.map(p => point(p.timeSeconds, p.referencePositionMm)).join(' ')} fill="none" stroke="#5eead4" strokeDasharray="4 3" strokeWidth="2" />
      <polyline points={history.map(p => point(p.timeSeconds, p.positionMm)).join(' ')} fill="none" stroke="#fb923c" strokeWidth="1.5" />
      <text x="1" y="25" fill="#94a3b8" fontSize="8">{high} mm</text><text x="1" y="122" fill="#94a3b8" fontSize="8">{low} mm</text>
      <text x="34" y="138" fill="#94a3b8" fontSize="9">0 s</text><text x="228" y="138" fill="#94a3b8" fontSize="9">{end.toFixed(1)} s</text>
    </svg><p className="text-[10px]"><span className="text-orange-300">━ Measured</span><span className="ml-2 text-teal-300">┄ Calculated</span></p>
  </figure>;
}
