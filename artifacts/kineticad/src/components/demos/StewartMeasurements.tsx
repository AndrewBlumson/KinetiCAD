import { useKinetiCADStore } from '@/state/store';
import { usePoseMeasurements } from '@/physics/poseMeasurements';
import { STEWART_MOTION_PRESETS, STEWART_CONTROL_LIMITS, stewartEulerDeg, type StewartMotionConfig, type StewartPoseTarget } from '@/physics/stewartKinematics';
import { CommittedNumberInput } from '@/components/ui/committed-number-input';

const labels = ['Slide X', 'Slide Y', 'Lift Z', 'Roll', 'Pitch', 'Twist'];

export function StewartControls({ completed }: { completed: boolean }) {
  const simulation = useKinetiCADStore(s => s.simulation);
  const config = simulation.stewartMotion;
  const locked = simulation.running && !completed;
  const apply = (target?: StewartPoseTarget, preserveTiming = false) => {
    const store = useKinetiCADStore.getState();
    store.setSimulationRunning(false);
    store.resetSimulation();
    const stewartMotion: StewartMotionConfig | undefined = target ? {
      kind: 'six-axis', target,
      moveDurationMs: preserveTiming && config ? config.moveDurationMs : 4000,
      settleDurationMs: preserveTiming && config ? config.settleDurationMs : 2000,
    } : undefined;
    useKinetiCADStore.setState(s => ({ simulation: { ...s.simulation, stewartMotion } }));
  };
  return <section aria-label="Stewart movement controls" className="px-3 py-3 text-xs space-y-3 border-b border-border">
    <div><h2 className="font-semibold text-sm">Move the platform</h2>
      <p className="mt-1 text-muted-foreground leading-relaxed">Choose a movement, then press Run motion. Six powered legs work together to position the deck.</p></div>
    <label className="block">Movement
      <select className="mt-1 w-full border border-border rounded bg-background p-2 disabled:opacity-50" disabled={locked}
        value={!config ? 'reference' : STEWART_MOTION_PRESETS.find(p => JSON.stringify(p.target) === JSON.stringify(config.target))?.id ?? 'custom'}
        onChange={e => apply(STEWART_MOTION_PRESETS.find(p => p.id === e.target.value)?.target)}>
        <option value="reference">Original vertical lift</option>
        {STEWART_MOTION_PRESETS.map(p => <option key={p.id} value={p.id}>{p.title === 'Yaw' ? 'Twist' : p.title}</option>)}
        {config && <option value="custom" disabled>Custom position</option>}
      </select></label>
    {config && <fieldset disabled={locked} className="space-y-2 disabled:opacity-50">
      <legend className="text-muted-foreground mb-2">Target relative to the starting position</legend>
      {labels.map((label, index) => {
        const rotation = index > 2, axis = index % 3;
        const value = (rotation ? config.target.rotationDeg : config.target.translationMm)[axis];
        const limit = rotation ? STEWART_CONTROL_LIMITS.rotationDeg : STEWART_CONTROL_LIMITS.translationMm;
        return <label key={label} className="grid grid-cols-[1fr_5rem] items-center gap-2">{label} ({rotation ? '°' : 'mm'})
          <CommittedNumberInput label={`${label} target (${rotation ? 'degrees' : 'mm'})`} min={-limit} max={limit} step={rotation ? 0.25 : 0.5} value={value}
            className="w-full rounded border border-border bg-background px-2 py-1 tabular-nums"
            onCommit={n => {
              const target = structuredClone(config.target);
              (rotation ? target.rotationDeg : target.translationMm)[axis] = n; apply(target, true);
            }} />
        </label>;
      })}
    </fieldset>}
    <p className="text-[11px] text-muted-foreground leading-relaxed">{config ? `Move for ${config.moveDurationMs / 1000} seconds, settle for ${config.settleDurationMs / 1000}. Bounds: ±5 mm and ±2° per axis. These controls use the original demo geometry.` : 'The original reference extends all six legs at 2 mm/s for 6 seconds.'} {locked && 'Reset to change the movement.'}</p>
  </section>;
}

export function StewartMeasurements() {
  const part = useKinetiCADStore((s) => s.assembly.parts.find((p) => p.id === 'stewart-platform'));
  const pose = usePoseMeasurements((s) => s.poses.find((p) => p.partId === 'stewart-platform'));
  const motion = useKinetiCADStore(s => s.simulation.stewartMotion);
  const measurement = usePoseMeasurements(s => s.stewart);
  const paused = useKinetiCADStore(s => s.simulation.paused);
  if (!part) return null;
  if (motion) {
    const requested = measurement ? [...measurement.requestedPose.positionMm.map((v, i) => v - part.transform.positionMm[i]), ...stewartEulerDeg(measurement.requestedPose.rotationQuat)] : undefined;
    const actual = measurement ? [...measurement.actualTranslationMm, ...measurement.actualRotationDeg] : undefined;
    const display = (n?: number) => n === undefined ? '—' : n.toFixed(3);
    return <section className="border-b border-border px-3 py-3 text-xs" aria-label="Measured six-axis movement">
      <h2 className="font-semibold">Requested / measured</h2>
      <p role="status" className="mt-1 mb-2 text-orange-300">{!measurement ? 'Press Run motion to measure' : measurement.phase === 'complete' ? (measurement.reached ? 'Target reached · final pose held' : 'Complete · outside target tolerance') : paused ? 'Paused · measurements held' : measurement.phase === 'settling' ? 'Settling at the target…' : 'Moving towards the target…'}</p>
      <table className="w-full text-[11px] tabular-nums" aria-label="Deck pose comparison"><thead><tr className="text-muted-foreground"><th className="text-left font-normal">Axis</th><th className="text-right font-normal">Requested</th><th className="text-right font-normal">Measured</th></tr></thead><tbody>
        {labels.map((label, i) => <tr key={label}><th className="text-left font-normal py-1">{label} {i < 3 ? 'mm' : '°'}</th><td className="text-right">{display(requested?.[i])}</td><td className="text-right text-orange-300">{display(actual?.[i])}</td></tr>)}
      </tbody></table>
      <p className="my-2 text-[11px] text-muted-foreground">Pose error: {display(measurement?.positionErrorMm)} mm / {display(measurement?.orientationErrorDeg)}°. Settled target tolerance: 0.05 mm / 0.05°.</p>
      <details><summary className="cursor-pointer text-muted-foreground">Six leg travel readings</summary>
        <table className="w-full text-[10px] mt-2 tabular-nums" aria-label="Actuator travel"><thead><tr><th className="text-left">Leg</th><th>Target mm</th><th>Measured mm</th></tr></thead><tbody>{Array.from({length: 6}, (_, i) => <tr key={i}><td>{i + 1}</td><td className="text-center py-1">{display(measurement?.actuators[i]?.targetExtensionMm)}</td><td className="text-center text-orange-300">{display(measurement?.actuators[i]?.actualExtensionMm)}</td></tr>)}</tbody></table>
      </details>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">The measured values come from the physics solver. Requested values follow the motion programme; the deck is moved by its leg constraints.</p>
    </section>;
  }
  const position = pose?.positionMm;
  const rise = position ? position[2] - part.transform.positionMm[2] : undefined;
  const sideways = position ? Math.hypot(position[0] - part.transform.positionMm[0], position[1] - part.transform.positionMm[1]) : undefined;
  // Angle between the actual deck local Z axis and world vertical.
  const q = pose?.rotationQuat;
  const tilt = q ? Math.acos(Math.min(1, Math.max(-1, 1 - 2 * (q[0] ** 2 + q[1] ** 2)))) * 180 / Math.PI : undefined;
  const value = (n: number | undefined, unit: string) => n === undefined ? '—' : `${n.toFixed(3)} ${unit}`;
  return <section className="border-b border-border" aria-label="Measured deck motion">
    <h2 className="px-3 py-2 text-xs font-technical uppercase tracking-wider text-muted-foreground">Measured deck motion</h2>
    <dl className="px-3 pb-3 text-xs space-y-2 tabular-nums">
      {([['Height Z', value(position?.[2], 'mm')], ['Rise', value(rise, 'mm')], ['Sideways drift', value(sideways, 'mm')], ['Tilt from vertical', value(tilt, '°')]]).map(([label, reading]) => <div key={label} className="flex justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="text-orange-300">{reading}</dd></div>)}
    </dl>
    <p className="px-3 pb-3 text-[11px] text-muted-foreground leading-relaxed">Read from the solver's deck pose. This reference programme extends all six legs equally. Choose another movement to try six-axis control.</p>
  </section>;
}
