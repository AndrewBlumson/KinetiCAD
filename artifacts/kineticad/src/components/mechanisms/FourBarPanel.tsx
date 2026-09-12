import { useEffect, useMemo, useRef, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import { usePoseMeasurements } from '@/physics/poseMeasurements';
import { sampleFourBarPath, fourBarMargins, type Point2 } from '@/mechanisms/fourBarKinematics';
import { scoreFourBarPath } from '@/mechanisms/fourBarSynthesis';
import { matchesFourBarConfiguration } from '@/mechanisms/fourBarWorkspace';
import { readFourBarSample, type FourBarSample } from '@/mechanisms/fourBarReadout';
import { useDemoWorkspace } from '../demos/DemoWorkspace';

const format = (v: number | undefined, digits = 3) => v === undefined ? '—' : v.toFixed(digits);
export function FourBarControls() {
  const design = useKinetiCADStore(s => s.simulation.fourBar)!;
  const { openPathDesigner, editing, loadingId } = useDemoWorkspace();
  const assembly = useKinetiCADStore(s => s.assembly);
  const simulation = useKinetiCADStore(s => s.simulation);
  const valid = useMemo(() => matchesFourBarConfiguration(assembly, simulation), [assembly, design, simulation.gravity, simulation.durationMs, simulation.timeStepMs, simulation.forceExperiment, simulation.stewartMotion, simulation.crankSlider, simulation.sketchGeometryEdited]);
  const p = design.params;
  const margins = useMemo(() => fourBarMargins(p), [p]);
  return <section aria-label="Path linkage settings" className="space-y-4 p-3 text-xs leading-relaxed">
    <h2 className="text-sm font-semibold">Your path, made by moving bars</h2>
    {!valid && <p role="status" className="text-orange-300">This mechanism has manual edits. The dimensions below describe the original generated design; its motion comparison is disabled.</p>}
    <p className="text-muted-foreground">In the generated design, the brass crank turns. It pushes a connecting bar, while a third bar swings around the other fixed pivot. The point labelled “Trace point” on the connecting bar traces the path.</p>
    <button type="button" onClick={openPathDesigner} disabled={editing || !!loadingId} className="w-full rounded bg-orange-500 px-3 py-2 font-medium text-white disabled:opacity-40">Edit drawing / find another linkage</button>
    {valid && <p className="text-muted-foreground">Run one cycle above to see the actual mechanism move. The motor requests {Math.abs(p.rpm)} RPM: one turn in six seconds.</p>}
    <dl className="space-y-2 rounded border border-border p-3 tabular-nums">
      {([['Fixed pivot spacing',p.groundLengthMm],['Crank length',p.crankLengthMm],['Connecting bar length',p.couplerLengthMm],['Swinging bar length',p.rockerLengthMm]] as [string,number][]).map(([label,value]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd className="text-orange-300">{value.toFixed(2)} mm</dd></div>)}
    </dl>
    {valid && <details><summary className="cursor-pointer">What the local search checks</summary>
      <p className="mt-2 text-muted-foreground">The crank can turn all the way around without the joint geometry locking straight. Minimum transmission angle: {margins.minTransmissionAngleDeg.toFixed(2)}°. The search keeps a 20° minimum.</p>
      <p className="mt-2 text-muted-foreground">This is the best candidate found in a bounded search of one mechanism family. Some drawings need a different mechanism. Fit errors describe sampled paths, not manufacturing accuracy.</p>
    </details>}
    <p className="text-muted-foreground">Switch to Modeller to inspect the four native CAD parts. Save project retains the drawing and design. Manual geometry, material or joint changes disable the original comparison.</p>
  </section>;
}

export function FourBarMeasurements() {
  const design = useKinetiCADStore(s => s.simulation.fourBar)!;
  const assembly = useKinetiCADStore(s => s.assembly);
  const simulation = useKinetiCADStore(s => s.simulation);
  const poses = usePoseMeasurements();
  const { revision } = useDemoWorkspace();
  const valid = useMemo(() => matchesFourBarConfiguration(assembly, simulation), [assembly, design, simulation.gravity, simulation.durationMs,
    simulation.timeStepMs, simulation.forceExperiment, simulation.stewartMotion, simulation.crankSlider, simulation.sketchGeometryEdited]);
  const geometry = useMemo(() => {
    try { return { prediction: sampleFourBarPath(design.params,512), fit: scoreFourBarPath(design.params,design.targetPathMm) }; }
    catch { return null; }
  },[design]);
  const [history,setHistory] = useState<FourBarSample[]>([]);
  const last = useRef<FourBarSample | undefined>(undefined);
  const source = `${revision}:${poses.runGeneration}:${JSON.stringify(design)}`;
  const historyKey = useRef(source);
  useEffect(() => {
    if (historyKey.current !== source) { historyKey.current = source; last.current = undefined; }
    if (!valid || poses.poses.length === 0) { last.current = undefined; setHistory([]); return; }
    if (last.current && poses.simulatedTimeMs < last.current.timeSeconds * 1000) last.current = undefined;
    if (last.current?.timeSeconds === poses.simulatedTimeMs / 1000) return;
    if (last.current && poses.simulatedTimeMs / 1000 - last.current.timeSeconds < 1/60 - 1e-8 && poses.simulatedTimeMs < (simulation.durationMs ?? Infinity) - 1e-8) return;
    const sample = readFourBarSample(design,poses.simulatedTimeMs,poses.poses,poses.bodies);
    if (!sample) { last.current = undefined; setHistory([]); return; }
    const restart = !last.current;
    last.current = sample;
    setHistory(rows => [...(restart ? [] : rows.slice(-719)),sample]);
  },[design,source,poses,valid,simulation.durationMs]);
  const sample = valid ? history.at(-1) : undefined;
  return <section aria-label="Measured linkage path" className="space-y-3 border-b border-border p-3 text-xs leading-relaxed">
    <h2 className="text-sm font-semibold">Drawing / calculated / measured</h2>
    {!valid ? <p role="status" className="text-orange-300">The model or motion settings have changed. The original path comparison is disabled. Reset the demo or build another linkage to restore it.</p> : geometry && <>
      <PathPlot target={design.targetPathMm} predicted={geometry.prediction} measured={history.map(row => [row.positionMm[0],row.positionMm[1]])} />
      <dl className="tabular-nums space-y-1">
        <div className="flex justify-between gap-2"><dt>Drawing fit, RMS</dt><dd>{format(geometry.fit.rmsMm)} mm</dd></div>
        <div className="flex justify-between gap-2"><dt>Largest sampled fit gap</dt><dd>{format(geometry.fit.maxGapMm)} mm</dd></div>
      </dl>
      <p className="text-muted-foreground">Fit compares {geometry.fit.sampleCount} points spaced evenly along each complete path. Run one cycle to add the orange trace read from the physics solver.</p>
      <table aria-label="Linkage measured position" className="w-full tabular-nums text-[11px]">
        <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Marker position</th><th className="text-right font-normal">Measured</th><th className="text-right font-normal">Calculated</th></tr></thead>
        <tbody>{['X mm','Y mm','Z mm'].map((label,index) => <tr key={label}><th className="text-left font-normal py-1.5">{label}</th><td className="text-right text-orange-300">{format(sample?.positionMm[index])}</td><td className="text-right text-teal-300">{format(sample?.referencePositionMm[index])}</td></tr>)}</tbody>
      </table>
      <dl className="tabular-nums space-y-1">
        {([['Solver / geometry error',sample?.positionErrorMm,'mm'],['Joint closure error',sample?.maxJointClosureMm,'mm'],['Crank speed',sample?.crankRpm,'RPM'],['Constant-speed timing error',sample?.nominalPositionErrorMm,'mm']] as [string,number|undefined,string][]).map(([label,value,unit]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd className="text-orange-300">{format(value)} {unit}</dd></div>)}
      </dl>
      <details><summary className="cursor-pointer text-muted-foreground">How these readings are checked</summary><p className="mt-2 text-muted-foreground">Measured positions come from the actual connecting bar pose. Calculated positions use independent joint-closure equations at the measured crank angle. The separate timing error compares with a perfect constant-speed motor; startup can differ. These errors are distinct from the drawing fit.</p><p className="mt-2 text-muted-foreground">Zero gravity, rigid parts and ideal joints. Contact, friction, flexing and motor torque limits are outside this comparison.</p></details>
    </>}
  </section>;
}

function PathPlot({ target,predicted,measured }:{target:Point2[];predicted:Point2[];measured:Point2[]}) {
  const all = [...target,...predicted,...measured];
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX-minX,maxY-minY,1)*1.12;
  const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
  const screen = (p:Point2) => [(p[0]-cx)/span*240+130,130-(p[1]-cy)/span*240];
  const points = (p:Point2[]) => p.map(q => screen(q).join(',')).join(' ');
  const marker = measured.at(-1);
  return <figure className="rounded border border-border p-2">
    <svg viewBox="0 0 260 260" role="img" aria-label="Top view of the drawn target, calculated linkage path and actual measured trace" className="w-full">
      <rect x="10" y="10" width="240" height="240" fill="none" stroke="#29364a" />
      <polyline points={points(target)} fill="none" stroke="#a7b4c9" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={points(predicted)} fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
      {measured.length > 1 && <polyline points={points(measured)} fill="none" stroke="#fb923c" strokeWidth="2" />}
      {marker && <circle cx={screen(marker)[0]} cy={screen(marker)[1]} r="3" fill="#fb923c" />}
      <text x="14" y="249" fill="#94a3b8" fontSize="9">{span.toFixed(1)} mm across · top view</text>
    </svg>
    <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]"><span className="text-slate-400">┄ Drawing</span><span className="text-teal-300">― Calculated</span><span className="text-orange-300">― Measured</span></figcaption>
  </figure>;
}
