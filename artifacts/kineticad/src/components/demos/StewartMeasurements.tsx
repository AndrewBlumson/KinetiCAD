import { useKinetiCADStore } from '@/state/store';
import { usePoseMeasurements } from '@/physics/poseMeasurements';

export function StewartMeasurements() {
  const part = useKinetiCADStore((s) => s.assembly.parts.find((p) => p.id === 'stewart-platform'));
  const pose = usePoseMeasurements((s) => s.poses.find((p) => p.partId === 'stewart-platform'));
  if (!part) return null;
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
    <p className="px-3 pb-3 text-[11px] text-muted-foreground leading-relaxed">Read from the solver's deck pose. The supplied programme is a coordinated vertical lift; the six-axis architecture is not a six-axis motion controller.</p>
  </section>;
}
