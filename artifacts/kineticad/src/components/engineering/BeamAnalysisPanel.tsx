import { useMemo, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import { analyseCantilever, beamSectionFromAxes, rectangularPartDimensions, type BeamAxis } from '@/engineering/beamAnalysis';

const field = 'mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100';
const axes: BeamAxis[] = ['X', 'Y', 'Z'];
const display = (value: number, unit: string) => `${Number(value.toPrecision(6))} ${unit}`;

export function BeamAnalysisPanel() {
  const assembly = useKinetiCADStore((s) => s.assembly);
  const eligible = useMemo(() => assembly.parts.flatMap((part) => {
    const dimensions = rectangularPartDimensions(part, assembly);
    return dimensions ? [{ part, dimensions }] : [];
  }), [assembly]);
  const [source, setSource] = useState('benchmark');
  const [lengthAxis, setLengthAxis] = useState<BeamAxis>('X');
  const [forceAxis, setForceAxis] = useState<BeamAxis>('Z');
  const [length, setLength] = useState('300');
  const [width, setWidth] = useState('20');
  const [depth, setDepth] = useState('10');
  const [force, setForce] = useState('10');
  const [modulus, setModulus] = useState('');
  const [limit, setLimit] = useState('');
  const selected = eligible.find((entry) => entry.part.id === source);
  const section = selected ? beamSectionFromAxes(selected.dimensions, lengthAxis, forceAxis) : { lengthMm: Number(length), widthMm: Number(width), depthMm: Number(depth) };
  let result: ReturnType<typeof analyseCantilever> | undefined;
  let error: string | undefined;
  if (modulus.trim() && limit.trim()) {
    try {
      if (!force.trim()) throw new Error('Enter an explicit tip force in newtons; use 0 for an unloaded beam.');
      result = analyseCantilever({ ...section, forceN: Number(force), youngsModulusGPa: Number(modulus), elasticLimitMPa: Number(limit) });
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  const plotAmplitude = result ? Math.max(Math.abs(result.tipDeflectionMm), 1e-12) : 1;
  const visualScale = result && result.tipDeflectionMm !== 0 ? section.lengthMm * (45 / 430) / plotAmplitude : 1;
  const curve = result?.curve.map((p) => `${48 + p.xMm / section.lengthMm * 430},${80 - p.deflectionMm / plotAmplitude * 45}`).join(' ');

  return <section className="space-y-4 text-slate-200" aria-label="Cantilever elastic analysis">
    <div><h2 className="text-base font-semibold">Cantilever elastic analysis</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">A uniform rectangular beam, rigidly clamped at one end, with a transverse point force at the free end. The calculation is independent of the rigid-body simulation and does not deform the CAD model.</p></div>
    <label className="block text-xs">Geometry source
      <select className={field} value={selected ? source : 'benchmark'} onChange={(e) => setSource(e.target.value)}>
        <option value="benchmark">Rectangular beam benchmark — enter dimensions</option>
        {eligible.map(({ part }) => <option key={part.id} value={part.id}>{part.name} — native rectangle/extrude</option>)}
      </select>
    </label>
    {selected ? <>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label>Local length axis<select className={field} value={lengthAxis} onChange={(e) => { const axis = e.target.value as BeamAxis; setLengthAxis(axis); if (axis === forceAxis) setForceAxis(axes.find((a) => a !== axis)!); }}>{axes.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label>Local force / bending direction<select className={field} value={forceAxis} onChange={(e) => setForceAxis(e.target.value as BeamAxis)}>{axes.filter((a) => a !== lengthAxis).map((a) => <option key={a}>{a}</option>)}</select></label>
      </div>
      <p className="text-xs text-slate-400">Native section: L = {section.lengthMm} mm, b = {section.widthMm} mm, h = {section.depthMm} mm. Clamp the minimum end of local {lengthAxis}; apply signed force along local {forceAxis} at the opposite end. Placement in the assembly does not create a physical clamp.</p>
    </> : <div className="grid grid-cols-3 gap-3 text-xs">
      <label>Length L (mm)<input className={field} type="number" min="0" value={length} onChange={(e) => setLength(e.target.value)} /></label>
      <label>Width b (mm)<input className={field} type="number" min="0" value={width} onChange={(e) => setWidth(e.target.value)} /></label>
      <label>Bending depth h (mm)<input className={field} type="number" min="0" value={depth} onChange={(e) => setDepth(e.target.value)} /></label>
    </div>}
    <div className="grid grid-cols-3 gap-3 text-xs">
      <label>Tip force F (N)<input className={field} type="number" value={force} onChange={(e) => setForce(e.target.value)} /></label>
      <label>Young’s modulus E (GPa)<input className={field} type="number" min="0" placeholder="Enter a sourced value" value={modulus} onChange={(e) => setModulus(e.target.value)} /></label>
      <label>Elastic limit (MPa)<input className={field} type="number" min="0" placeholder="Enter a sourced value" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
    </div>
    <p className="text-xs leading-relaxed text-slate-400">Enter material properties from your specification or measurement. Density and the CAD material name do not supply these values. The elastic limit must suit your material and loading conditions; it is not a design safety factor.</p>
    <button type="button" className="rounded border border-slate-600 px-3 py-1.5 text-xs hover:bg-white/5" onClick={() => { setSource('benchmark'); setLength('300'); setWidth('20'); setDepth('10'); setForce('10'); setModulus('200'); setLimit('250'); }}>Use reference case: 300 × 20 × 10 mm, 10 N, E 200 GPa, limit 250 MPa</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {!result && !error && <p className="rounded border border-slate-700 p-3 text-xs text-slate-300">Enter Young’s modulus and the elastic limit, or select the explicitly defined reference case, to calculate.</p>}
    {result && <>
      <p className={`rounded border p-3 text-xs ${result.withinAssumptions ? 'border-emerald-600/40 text-emerald-200' : 'border-red-600/50 text-red-200'}`} role="status">
        {result.withinAssumptions ? 'Within this tool’s stated slenderness, deflection and elastic-stress bounds.' : 'Validity checks failed. The equation outputs below are not a valid prediction of physical elastic deformation.'}
      </p>
      {result.violations.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-red-200">{result.violations.map((v) => <li key={v}>{v}</li>)}</ul>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded border border-slate-700 p-3 text-xs tabular-nums">
        {[
          ['Tip deflection', display(result.tipDeflectionMm, 'mm')], ['Maximum bending stress', display(result.maxBendingStressMPa, 'MPa')],
          ['Second moment I = bh³/12', display(result.secondMomentMm4, 'mm⁴')], ['Tip slope', display(result.tipSlopeRad, 'rad')],
          ['Clamp force reaction', display(result.clampForceN, 'N')], ['Clamp moment reaction', display(result.clampMomentNmm / 1000, 'N·m')],
          ['Deflection / length', display(result.deflectionRatio * 100, '%')], ['Stress / supplied elastic limit', display(result.elasticUtilisation * 100, '%')],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-0.5 text-sm">{value}</dd></div>)}
      </dl>
      <figure className="rounded border border-slate-700 p-3">
        <svg viewBox="0 0 520 155" className="w-full" role="img" aria-label={`Calculated cantilever curve, tip deflection ${result.tipDeflectionMm} millimetres. Transverse scale is enlarged relative to length.`}>
          <line x1="48" y1="20" x2="48" y2="140" stroke="#94a3b8" strokeWidth="5" />
          <line x1="48" y1="80" x2="478" y2="80" stroke="#64748b" strokeDasharray="4 4" />
          <polyline points={curve} fill="none" stroke="#fb923c" strokeWidth="3" />
          <text x="52" y="151" fill="#94a3b8" fontSize="10">0 mm · rigid clamp</text>
          <text x="474" y="151" textAnchor="end" fill="#94a3b8" fontSize="10">{section.lengthMm} mm · free end</text>
          <text x="474" y={result.tipDeflectionMm >= 0 ? 16 : 138} textAnchor="end" fill="#fdba74" fontSize="10">δ = {Number(result.tipDeflectionMm.toPrecision(6))} mm</text>
        </svg>
        <figcaption className="text-[11px] text-slate-400">Calculated Euler–Bernoulli curve; transverse display scale is {Number(visualScale.toPrecision(4))}× the length scale. Dashed line is undeformed. Labels show physical millimetres. This is an analytical plot, not a deformed CAD mesh.</figcaption>
      </figure>
      <p className="text-[11px] leading-relaxed text-slate-400">δ = FL³/(3EI), σ = |F|Lh/(2I). Accepted bounds: L/max(b,h) ≥ 10, |δ|/L ≤ 2%, and stress ≤ your elastic limit. Homogeneous, isotropic linear elasticity; no self-weight, shear deformation, plasticity, buckling, contact or 3D stress concentrations. These checks do not certify a manufactured part or replace general finite-element analysis.</p>
    </>}
  </section>;
}
