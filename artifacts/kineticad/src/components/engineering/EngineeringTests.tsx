import { lazy, Suspense, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useKinetiCADStore } from '@/state/store';
import { useEngineeringBench } from './useEngineeringBench';
import type { ActuatorBenchConfig } from '@/physics/actuatorBench';
import type { ContactBenchConfig } from '@/physics/contactBench';
import type { BenchSnapshot } from '@/physics/engineeringBenchWorker';
import { CommittedNumberInput } from '@/components/ui/committed-number-input';

const BeamPanel = lazy(() => import('./BeamAnalysisPanel').then(m => ({ default: m.BeamAnalysisPanel })));
const inputClass = 'mt-1 w-full rounded border border-border bg-background px-2 py-2 tabular-nums disabled:opacity-50';
const format = (value: number | undefined | null, digits = 3) => value == null ? '—' : value.toFixed(digits);
type Kind = 'actuator' | 'contact' | 'beam';

export function EngineeringTestsButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('actuator');
  return <Dialog open={open} onOpenChange={value => { if (value) useKinetiCADStore.getState().resetSimulation(); setOpen(value); }}>
    <button title="Measured motor loads, sliding contact and elastic beam analysis" onClick={() => { useKinetiCADStore.getState().resetSimulation(); setOpen(true); }}
      className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:bg-secondary"><FlaskConical size={14} />Engineering tests</button>
    <DialogContent className="flex h-[88vh] w-[calc(100vw-32px)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
      <header className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle>Engineering tests</DialogTitle>
        <DialogDescription className="mt-2">Change one assumption and measure the result. These focused experiments run locally and keep your CAD project open.</DialogDescription>
      </header>
      <nav aria-label="Engineering experiments" className="flex gap-2 border-b border-border px-6 py-3">
        {([['actuator','Motor & load'],['contact','Friction & contact'],['beam','Elastic beam']] as const).map(([id,label]) => <button key={id} aria-pressed={kind === id} onClick={() => setKind(id)} className={`rounded px-3 py-2 text-sm ${kind === id ? 'bg-orange-500 text-white' : 'bg-secondary text-muted-foreground'}`}>{label}</button>)}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">{kind === 'beam' ? <div className="p-6"><Suspense fallback={<p>Loading analysis…</p>}><BeamPanel /></Suspense></div> : <DynamicsBench key={kind} kind={kind} />}</div>
    </DialogContent>
  </Dialog>;
}

const actuatorPresets: Record<string, { label: string; config: ActuatorBenchConfig }> = {
  lift: {label:'Lift 1 kg', config:{payloadKg:1,maxForceN:16,initialHeightMm:300,targetHeightMm:380,durationMs:4000}},
  hold: {label:'Hold 1 kg', config:{payloadKg:1,maxForceN:16,initialHeightMm:300,targetHeightMm:300,durationMs:2000}},
  overload: {label:'Overload with 2 kg', config:{payloadKg:2,maxForceN:16,initialHeightMm:320,targetHeightMm:400,durationMs:500}},
};
function DynamicsBench({kind}: {kind:'actuator'|'contact'}) {
  const [actuator,setActuator] = useState<ActuatorBenchConfig>(actuatorPresets.lift.config);
  const [contact,setContact] = useState<ContactBenchConfig>({frictionCoefficient:0.25,massKg:2,initialVelocityMmPerSec:1000,timeStepMs:1000/120,durationMs:2000});
  const request = useMemo(() => kind === 'actuator' ? {kind,config:actuator} : {kind,config:contact},[kind,actuator,contact]);
  const bench = useEngineeringBench(request);
  const s = bench.snapshot;
  // Preparing a replacement world must not steal focus from the next input.
  // The hook cancels stale builds; only an actively running test locks edits.
  const locked = bench.running;
  const scalar = (name:string,value:number,min:number,max:number,step:number,change:(n:number)=>void) => <label className="block">{name}<CommittedNumberInput label={name} value={value} min={min} max={max} step={step} disabled={locked} className={inputClass} onCommit={change} /></label>;
  return <div className="grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
    <section className="space-y-4 text-xs" aria-label="Experiment settings">
      <h2 className="text-base font-semibold">{kind === 'actuator' ? 'Can the motor lift it?' : 'How far will it slide?'}</h2>
      <p className="text-muted-foreground leading-relaxed">{kind === 'actuator' ? 'A powered slider pushes upward against gravity. Add mass or reduce its strength and the result changes.' : 'A block starts with a push, then slows through contact with the floor. Higher friction makes it stop sooner.'}</p>
      {kind === 'actuator' ? <>
        <label className="block">Scenario<select aria-label="Motor scenario" disabled={locked} className={inputClass} value={Object.entries(actuatorPresets).find(([,p])=>JSON.stringify(p.config)===JSON.stringify(actuator))?.[0]??'custom'} onChange={e=>setActuator(actuatorPresets[e.target.value].config)}>{Object.entries(actuatorPresets).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}<option value="custom" disabled>Custom settings</option></select></label>
        {scalar('Moving mass (kg)',actuator.payloadKg,0.1,10,0.1,n=>setActuator(c=>({...c,payloadKg:n})))}
        {scalar('Motor strength (N)',actuator.maxForceN,0.1,200,1,n=>setActuator(c=>({...c,maxForceN:n})))}
        {scalar('Target height (mm)',actuator.targetHeightMm,100,500,10,n=>setActuator(c=>({...c,targetHeightMm:n})))}
        <p className="text-muted-foreground">Weight = mass × 9.81 N/kg. The motor force is physically capped; gravity can pull an overloaded slider down.</p>
      </> : <>
        <label className="block">Scenario<select aria-label="Contact scenario" disabled={locked} className={inputClass} value={(contact.initialVelocityMmPerSec??0)===0?'resting':contact.frictionCoefficient===0?'frictionless':'sliding'} onChange={e=>setContact(c=>({...c,frictionCoefficient:e.target.value==='frictionless'?0:0.25,initialVelocityMmPerSec:e.target.value==='resting'?0:1000}))}><option value="sliding">Sliding friction</option><option value="frictionless">Frictionless glide</option><option value="resting">Resting contact</option></select></label>
        {scalar('Friction coefficient μ',contact.frictionCoefficient??0.25,0,1,0.05,n=>setContact(c=>({...c,frictionCoefficient:n})))}
        {scalar('Block mass (kg)',contact.massKg??2,0.1,100,0.1,n=>setContact(c=>({...c,massKg:n})))}
        {scalar('Starting speed (mm/s)',contact.initialVelocityMmPerSec??1000,0,2000,100,n=>setContact(c=>({...c,initialVelocityMmPerSec:n})))}
        <label className="block">Solver frequency<select aria-label="Solver frequency" disabled={locked} className={inputClass} value={Math.round(1000/(contact.timeStepMs??1000/120))} onChange={e=>setContact(c=>({...c,timeStepMs:1000/Number(e.target.value)}))}><option value="60">60 Hz</option><option value="120">120 Hz</option><option value="240">240 Hz</option></select></label>
      </>}
      <div className="flex gap-2"><button onClick={bench.toggle} disabled={bench.busy||!!bench.error} className="rounded bg-orange-500 px-4 py-2 text-white disabled:opacity-50">{bench.running?'Pause test':s?.completed?'Run again':s&&s.simulatedTimeMs>0?'Resume test':'Run test'}</button><button className="rounded border border-border px-3 py-2" onClick={bench.reset}>Reset test</button></div>
      <p role="status" className="text-orange-300">{bench.busy?'Preparing physical model…':bench.error?bench.error:s?.completed?(s.kind==='actuator'&&s.stopReason==='travel-boundary'?'Stopped at the test travel boundary':'Complete · final measurements held'):bench.running?'Measuring…':s&&s.simulatedTimeMs>0?'Paused · measurements held':'Ready to run'}</p>
    </section>
    <section className="min-w-0 space-y-4" aria-label="Experiment results">
      <BenchDiagram snapshot={s} kind={kind} />
      <div className="grid gap-4 md:grid-cols-2">
        <Readings snapshot={s} />
        <MotionPlot rows={bench.history} kind={kind} />
      </div>
      <p className="rounded border border-border p-3 text-[11px] leading-relaxed text-muted-foreground">{kind==='actuator'?'Physical model: rigid block on an ideal straight guide, gravity and equal/opposite actuator forces. Contact, motor heating and structural flex are excluded. The 80–550 mm travel boundary stops the test before an impact; it does not model a hard stop. This bench does not set the lifting capacity of the Stewart demo.':'Physical model: exact cuboid contact with one Coulomb friction coefficient, zero restitution and a guide preventing rotation and sideways motion. Vertical support and forward sliding come from the contact solver. This experiment does not enable collisions for arbitrary CAD assemblies.'}</p>
    </section>
  </div>;
}

function Readings({snapshot:s}:{snapshot?:BenchSnapshot}) {
  const rows: Array<[string,string]> = !s ? [] : s.kind==='actuator' ? [
    ['Time',`${format(s.simulatedTimeMs/1000,3)} s`],['Height / Newton reference',`${format(s.positionMm[2])} / ${format(s.reference.valid?s.reference.positionMm:undefined)} mm`],
    ['Velocity',`${format(s.velocityMmPerSec[2])} mm/s`],['Weight',`${format(s.weightN)} N`],['Applied / inferred force',`${format(s.appliedForceN)} / ${format(s.inferredActuatorForceN)} N`],['Actuator reaction on base',`${format(s.reactionForceN)} N`],['Acceleration',`${format(s.accelerationMmPerSec2)} mm/s²`],['Motor at strength limit',s.saturated?'Yes':'No'],
  ] : [
    ['Time',`${format(s.simulatedTimeMs/1000)} s`],['Travel / analytical reference',`${format(s.body.positionMm[0])} / ${format(s.reference.valid?s.reference.positionXMm:undefined)} mm`],['Travel integration bound',s.reference.positionErrorBoundMm==null?'—':`±${format(s.reference.positionErrorBoundMm)} mm`],['Speed / reference',`${format(s.body.linearVelocityMmPerSec[0])} / ${format(s.reference.valid?s.reference.velocityXMmPerSec:undefined)} mm/s`],['Support force / weight',`${format(s.contact.normalForceN)} / ${format(s.reference.normalForceN)} N`],['Friction force',`${format(s.contact.frictionForceN)} N`],['Contact penetration',`${format(s.contact.geometricPenetrationMm,5)} mm`],['Energy lost / friction work',`${format(s.energy.dissipatedJ,5)} / ${format(s.energy.frictionWorkJ,5)} J`],
  ];
  return <div className="rounded border border-border p-3"><h3 className="mb-3 text-sm font-semibold">Solver measurements</h3><dl className="space-y-2 text-[11px] tabular-nums">{rows.map(([name,value])=><div key={name} className="flex justify-between gap-3"><dt className="text-muted-foreground">{name}</dt><dd className="text-right text-orange-300">{value}</dd></div>)}</dl>{s&&<p className="mt-3 text-[10px] text-muted-foreground leading-relaxed">{s.kind==='actuator'?'Inferred force is calculated from the measured velocity change. Newton reference integrates the applied force schedule independently of measured positions.':s.reference.valid?'Analytical sliding reference: a = −μg until rest. Impulses provide the measured support and friction forces.':s.reference.reason}</p>}</div>;
}

function BenchDiagram({snapshot:s,kind}:{snapshot?:BenchSnapshot;kind:'actuator'|'contact'}) {
  const actuator=s?.kind==='actuator'?s:undefined,contact=s?.kind==='contact'?s:undefined;
  const height=actuator?.positionMm[2]??300;
  const travel=contact?.body.positionMm[0]??0;
  const maxTravel=contact?Math.max(500,contact.config.initialVelocityMmPerSec*contact.config.durationMs/1000):2000;
  const x=100+travel/(maxTravel+100)*640;
  return <div className="overflow-hidden rounded-lg border border-border bg-[#080e19]">
    <svg viewBox="0 0 800 300" role="img" aria-label={kind==='actuator'?'Powered vertical slider, positioned from the physics solver':'Sliding block and floor, positioned from the contact solver'} className="w-full max-h-[280px]">
      <defs><pattern id={`grid-${kind}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#172338" strokeWidth="1"/></pattern></defs>
      <rect width="800" height="300" fill={`url(#grid-${kind})`}/>
      {kind==='actuator'?<>
        <path d="M 350 260 V 30 M 450 260 V 30" stroke="#445469" strokeWidth="5"/>
        <rect x="330" y="255" width="140" height="15" fill="#8796a8"/>
        <path d={`M 400 250 V ${250-height*.35}`} stroke="#f8b34b" strokeWidth="8"/>
        <rect x="380" y={250-height*.35-7} width="40" height="14" rx="2" fill="#c7d8e8" stroke="#edf6ff"/>
        <path d={`M 470 ${250-(actuator?.parameters.targetHeightMm??380)*.35} h 150`} stroke="#62d5c0" strokeDasharray="5 5"/>
        <text x="630" y={254-(actuator?.parameters.targetHeightMm??380)*.35} fill="#62d5c0" fontSize="12">Target</text>
        <text x="40" y="40" fill="#b6c5d5" fontSize="13">Vertical slider · height {format(height,2)} mm</text>
        <text x="40" y="64" fill="#f8b34b" fontSize="12">Motor {format(actuator?Math.abs(actuator.appliedForceN):undefined,2)} N {actuator?.appliedForceN ? actuator.appliedForceN>0?'↑':'↓' : ''}</text>
        <text x="40" y="86" fill="#b6c5d5" fontSize="12">Weight {format(actuator?.weightN,2)} N ↓</text>
        <text x="40" y="278" fill="#71839a" fontSize="11">Schematic guide and force arrows. Slider height comes from the solver.</text>
      </>:<>
        <rect x="40" y="200" width="720" height="24" fill="#47566c"/>
        <rect x={x-50/(maxTravel+100)*640} y={200-((contact?.body.positionMm[2]??20)+20)*0.65} width={100/(maxTravel+100)*640} height="26" fill="#f8b34b" stroke="#ffdaa0"/>
        {(contact?.body.linearVelocityMmPerSec[0]??0)>0.001 && <path d={`M ${x+30} 181 h 50 l -9 -5 m 9 5 l -9 5`} stroke="#c9d5e4" fill="none"/>}
        <text x="40" y="40" fill="#b6c5d5" fontSize="13">Guided sliding block · travel {format(travel,2)} mm</text>
        <text x="40" y="64" fill="#f8b34b" fontSize="12">Speed {format(contact?.body.linearVelocityMmPerSec[0],2)} mm/s</text>
        <text x="40" y="260" fill="#71839a" fontSize="11">Horizontal position is to scale. Vertical section enlarged to show contact.</text>
      </>}
    </svg>
  </div>;
}

function MotionPlot({rows,kind}:{rows:BenchSnapshot[];kind:'actuator'|'contact'}) {
  const values=rows.map(s=>({t:s.simulatedTimeMs/1000,y:s.kind==='actuator'?s.positionMm[2]:s.body.positionMm[0],r:s.kind==='actuator'?(s.reference.valid?s.reference.positionMm:null):s.reference.positionXMm}));
  const all=values.flatMap(v=>[v.y,...(v.r==null?[]:[v.r])]);
  const lo=Math.min(0,...all),hi=Math.max(1,...all),duration=Math.max(0.5,...values.map(v=>v.t));
  const point=(t:number,y:number)=>`${42+t/duration*260},${140-(y-lo)/(hi-lo)*110}`;
  return <div className="rounded border border-border p-3"><h3 className="text-sm font-semibold">{kind==='actuator'?'Height':'Travel'} over time</h3>
    <svg viewBox="0 0 330 176" className="w-full" role="img" aria-label="Measured position and analytical reference plot"><path d="M 42 20 V 140 H 310" stroke="#546377" fill="none"/>
      <polyline points={values.filter(v=>v.r!=null).map(v=>point(v.t,v.r!)).join(' ')} fill="none" stroke="#62d5c0" strokeWidth="2" strokeDasharray="4 3"/>
      <polyline points={values.map(v=>point(v.t,v.y)).join(' ')} fill="none" stroke="#fb923c" strokeWidth="2"/>
      <text x="2" y="24" fill="#91a2b8" fontSize="9">{hi.toFixed(1)} mm</text><text x="4" y="142" fill="#91a2b8" fontSize="9">{lo.toFixed(0)}</text>
      <text x="42" y="156" fill="#91a2b8" fontSize="9">0 s</text><text x="279" y="156" fill="#91a2b8" fontSize="9">{duration.toFixed(2)} s</text>
    </svg><p className="text-[10px]"><span className="text-orange-300">━ Measured</span><span className="ml-3 text-teal-300">┄ Reference</span></p>
  </div>;
}
