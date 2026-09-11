import { getMaterial } from '@/cad/materials';
import { useKinetiCADStore } from '@/state/store';
import { useForceMeasurements } from '@/physics/forceMeasurements';

const display = (value: number | undefined | null, digits = 2) =>
  value == null ? '—' : value.toFixed(digits);

export function ForceExperimentMeasurements() {
  const parts = useKinetiCADStore((s) => s.assembly.parts);
  const config = useKinetiCADStore((s) => s.simulation.forceExperiment);
  const paused = useKinetiCADStore((s) => s.simulation.paused);
  const measurements = useForceMeasurements();
  if (!config) return null;
  return <section className="flex flex-col min-h-0" aria-label="Force experiment measurements">
    <div className="px-3 py-2 border-b border-border">
      <h2 className="text-sm font-semibold">Same force. Different mass.</h2>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Eight materials under equal force. Acceleration is measured from solver velocity.</p>
      <div role="status" className="text-xs text-orange-300 mt-2">
        {measurements.completed ? 'Complete · final positions held' : measurements.timeMs > 0 ? (paused ? 'Paused · measurements held' : 'Measuring…') : 'Press Run experiment to compare'}
      </div>
    </div>
    <div className="overflow-y-auto divide-y divide-border">
      {config.partIds.map((id, index) => {
        const part = parts.find((p) => p.id === id);
        if (!part) return null;
        const row = measurements.rows.find((r) => r.partId === id);
        const massKg = row?.massKg ?? part.massKg;
        const expected = row?.expectedAccelerationMmPerSec2 ?? (massKg ? config.forceN * 1000 / massKg : undefined);
        const material = getMaterial(part.materialId);
        return <div key={id} className="px-3 py-1 text-[11px] leading-none" data-testid={`force-reading-${id}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate"><span className="text-muted-foreground mr-2">{index + 1}</span>{material.name}</span>
            <span className="tabular-nums text-muted-foreground whitespace-nowrap">{display(massKg == null ? undefined : massKg * 1000)} g</span>
          </div>
          <div className="flex justify-between gap-2 mt-0.5 tabular-nums text-muted-foreground">
            <span>Expected a <b className="font-normal text-foreground">{display(expected)}</b></span>
            <span>Measured a <b className="font-normal text-orange-300">{display(row?.measuredAccelerationMmPerSec2)}</b></span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1 flex-1 rounded bg-secondary overflow-hidden"><div className="h-full bg-orange-400/70" style={{width:`${Math.min(100, Math.max(0, (row?.distanceMm ?? 0) / 220 * 100))}%`}} /></div>
            <span className="w-16 text-right text-muted-foreground tabular-nums">{display(row?.distanceMm)} mm</span>
          </div>
        </div>;
      })}
    </div>
    <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">Acceleration a in mm/s² · distance from the starting position.</p>
  </section>;
}

export function ForceExperimentControls() {
  const simulation = useKinetiCADStore((s) => s.simulation);
  const completed = useForceMeasurements((s) => s.completed);
  const config = simulation.forceExperiment;
  if (!config) return null;
  return <section className="px-3 py-3 text-xs space-y-4">
    <div>
      <label htmlFor="experiment-force" className="block font-medium mb-2">Force on every sample</label>
      <select id="experiment-force" value={config.forceN} disabled={simulation.running && !completed}
        onChange={(event) => {
          const forceN = Number(event.target.value);
          const store = useKinetiCADStore.getState();
          store.setSimulationRunning(false);
          useKinetiCADStore.setState((s) => ({ simulation: { ...s.simulation,
            forceExperiment: { ...config, forceN } } }));
        }}
        className="w-full rounded border border-border bg-background px-2 py-2 disabled:opacity-50">
        <option value={0.0005}>0.5 mN (0.0005 N)</option>
        <option value={0.001}>1 mN (0.001 N)</option>
        {![0.0005, 0.001].includes(config.forceN) && <option value={config.forceN}>{config.forceN} N (saved value)</option>}
      </select>
      <p className="text-muted-foreground mt-2">Constant force for {(config.durationMs / 1000).toFixed(1)} seconds, applied through each centre of mass.</p>
    </div>
    <div className="rounded border border-orange-400/20 bg-orange-400/5 px-3 py-3">
      <p className="text-lg font-mono text-orange-300">a = F / m</p>
      <p className="mt-2 leading-relaxed text-muted-foreground">With the same force, a lighter sample accelerates more. Halve the force and acceleration halves.</p>
    </div>
    <div className="space-y-2 text-muted-foreground leading-relaxed">
      <p>Ideal straight guides keep the samples in their lanes. Gravity, friction and contact forces are off.</p>
      <p>The rail geometry marks the lanes; the ideal joints constrain motion. Samples do not deform.</p>
      <p>This is a mass comparison under equal force. In free fall without air resistance, these materials would accelerate equally.</p>
    </div>
  </section>;
}
