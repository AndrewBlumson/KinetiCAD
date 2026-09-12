import { getCadKernel } from '@/cad/cadClient';
import { regenerateBooleanBody } from '@/features/booleanBodies';
import { getMaterial } from '@/cad/materials';
import { planAssemblySimulation, assemblyPhysicsSignature } from '@/physics/assemblySimulation';
import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useKinetiCADStore } from '@/state/store';
import { CrankSliderButton, DemoButton, DemoWorkspaceBar, useDemoWorkspace } from '@/components/demos/DemoWorkspace';
import { ForceExperimentControls, ForceExperimentMeasurements } from '@/components/demos/ForceExperimentPanel';
import { useForceMeasurements } from '@/physics/forceMeasurements';
import { StewartMeasurements, StewartControls } from '@/components/demos/StewartMeasurements';
import { EngineeringTestsButton } from '@/components/engineering/EngineeringTests';
import { CrankSliderControls, CrankSliderMeasurements } from '@/components/demos/CrankSliderPanel';

// Phase 8 — same Scene component as the Modeller. The simulation
// subsystem is wired into Scene at mount; the Simulator view just
// hides the Modeller-only inspectors and surfaces the play controls.
const Scene = lazy(() => import('@/three/Scene'));

const SPEEDS: Array<{ label: string; value: number }> = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
];

export default function Simulator() {
  const { activeDemo, revision } = useDemoWorkspace();
  const [readyRevision, setReadyRevision] = useState(-1);
  const simulation = useKinetiCADStore((s) => s.simulation);
  const setSimulationRunning = useKinetiCADStore((s) => s.setSimulationRunning);
  const setSimulationPaused = useKinetiCADStore((s) => s.setSimulationPaused);
  const setSimulationSpeed = useKinetiCADStore((s) => s.setSimulationSpeed);
  const resetSimulation = useKinetiCADStore((s) => s.resetSimulation);
  const assembly = useKinetiCADStore((s) => s.assembly);
  const parts = assembly.parts;
  const physicalPlan = useMemo(() => { try { return { plan: planAssemblySimulation(assembly), error: null }; } catch (error) { return { plan: null, error: (error as Error).message }; } }, [assembly]);
  const booleanCheck = useBooleanPhysicalCheck(assembly);
  const bodyRows = [...(physicalPlan.plan?.parts ?? []), ...(physicalPlan.plan?.booleans.map(b => ({ id: b.id, name: b.feature.resultPartName })) ?? [])];
  const mates = useKinetiCADStore((s) => s.assembly.mates);
  const hasAssemblyBooleans = useKinetiCADStore((s) => s.assembly.booleanFeatures.length > 0);
  const forceCompleted = useForceMeasurements((s) => s.completed);
  const forceExperiment = simulation.forceExperiment;
  const isStewart = !simulation.sketchGeometryEdited && (activeDemo?.id === 'stewart-platform' || !!simulation.stewartMotion);
  const isCrankSlider = !simulation.sketchGeometryEdited && !!simulation.crankSlider;
  const duration = forceExperiment?.durationMs ?? (simulation.stewartMotion
    ? simulation.stewartMotion.moveDurationMs + simulation.stewartMotion.settleDurationMs : simulation.durationMs);
  const completed = forceCompleted || !!(duration && simulation.running && simulation.paused
    && simulation.simulationTimeMs >= Math.floor((duration + 1e-7) / simulation.timeStepMs) * simulation.timeStepMs - 1e-7);

  const preparingGeometry = readyRevision !== revision;
  const canPlay = bodyRows.length > 0 && !physicalPlan.error && !booleanCheck.error && !booleanCheck.loading && !preparingGeometry;
  const isRunning = simulation.running;
  const isPaused = simulation.paused;

  const onPlayPause = () => {
    if (!canPlay) return;
    if (completed) {
      resetSimulation();
      setSimulationRunning(true);
      return;
    }
    if (!isRunning) {
      setSimulationRunning(true);
    } else {
      setSimulationPaused(!isPaused);
    }
  };

  const onReset = () => {
    setSimulationRunning(false);
    resetSimulation();
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center gap-2 px-3 h-11 border-b border-border bg-card shrink-0 select-none">
        <span className="font-technical text-xs font-semibold tracking-widest uppercase text-[#FF6B1A]">
          KinetiCAD
        </span>
        <div className="w-px h-5 bg-border mx-1" />
        <span className="font-technical text-xs text-muted-foreground uppercase tracking-wider">
          Simulator
        </span>
        <div className="w-px h-5 bg-border mx-1" />

        <div className="flex items-center gap-1">
          <PlaybackBtn
            label={completed ? 'Run again' : isRunning ? (isPaused ? 'Resume' : 'Pause') : forceExperiment ? 'Run experiment' : isStewart || isCrankSlider ? 'Run motion' : 'Play'}
            active={isRunning && !isPaused}
            disabled={!canPlay}
            onClick={onPlayPause}
          >
            {isRunning && !isPaused ? '⏸' : '▶'}
            {(forceExperiment || isStewart || isCrankSlider) && <span className="text-xs ml-1.5">{completed ? 'Run again' : isRunning ? (isPaused ? 'Resume' : 'Pause') : forceExperiment ? 'Run experiment' : 'Run motion'}</span>}
          </PlaybackBtn>
          <PlaybackBtn label="Reset" onClick={onReset}>
            ⏹
          </PlaybackBtn>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <SpeedSelector
          value={simulation.speedMultiplier}
          onSelect={setSimulationSpeed}
        />

        <div className="flex-1" />

        <EngineeringTestsButton />
        <CrankSliderButton />
        <DemoButton />
        {(preparingGeometry || booleanCheck.loading) && <span role="status" className="text-xs text-orange-300">Preparing geometry…</span>}
        <SimStatus running={isRunning} paused={isPaused} completed={completed} />
      </header>
      <DemoWorkspaceBar />
      {(activeDemo?.id === 'stewart-platform' || activeDemo?.id === 'crank-slider') && simulation.sketchGeometryEdited && <p role="status" className="border-b border-orange-500/30 bg-orange-500/5 px-4 py-2 text-xs leading-relaxed text-orange-200">
        This demo’s sketch dimensions have changed. Its original motion presets and reference comparisons are disabled. Reset the demo to restore them.
      </p>}
      {(physicalPlan.error || booleanCheck.error) && <p role="alert" className="border-b border-orange-500/30 bg-orange-500/5 px-4 py-3 text-xs text-orange-200">{physicalPlan.error || booleanCheck.error}</p>}
      {hasAssemblyBooleans && !physicalPlan.error && !booleanCheck.error && <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Finished Boolean solids run directly. Construction inputs are excluded; materials and fixed-base choices come from each result’s Boolean editor.</p>}

      <div className="flex flex-1 overflow-hidden">
        <aside className={`${forceExperiment ? 'w-72 overflow-hidden' : isStewart || isCrankSlider ? 'w-64 overflow-y-auto' : 'w-56 overflow-y-auto'} shrink-0 border-r border-border bg-sidebar flex flex-col`}>
          {isCrankSlider ? <CrankSliderControls /> : forceExperiment ? <ForceExperimentMeasurements /> : isStewart ? <>
            <StewartControls completed={completed} />
            <details className="px-3 py-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Assembly · {parts.length} parts · {mates.length} joints</summary>
              <ul className="mt-2 space-y-1">{parts.map(p => <li key={p.id}>{p.name}</li>)}</ul>
            </details>
          </> : <>
          <SidebarSection title="Rigid Bodies">
            {bodyRows.length === 0 ? (
              <EmptyState text={physicalPlan.error ? "Resolve the simulation issue shown above" : "No parts in assembly"} />
            ) : (
              bodyRows.map((p) => (
                <SidebarRow key={p.id} primary={p.name} secondary={p.id.slice(0, 8)} />
              ))
            )}
          </SidebarSection>
          <SidebarSection title="Joints">
            {mates.length === 0 ? (
              <EmptyState text="No joints defined" />
            ) : (
              mates.map((m) => (
                <SidebarRow
                  key={m.id}
                  primary={m.name ?? m.type}
                  secondary={m.type}
                />
              ))
            )}
          </SidebarSection>
          </>}
        </aside>

        <main className="flex-1 relative overflow-hidden" style={{ background: '#0A0E1A' }}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center font-technical text-xs text-muted-foreground">Loading scene…</div>}>
            <Scene key={revision} frameOnLoad={!!activeDemo || isCrankSlider} showSketches={false} onAssemblyReady={(ready) => setReadyRevision(ready ? revision : -1)} />
          </Suspense>
          <SimDashboard
            simulationTimeMs={simulation.simulationTimeMs}
            bodyCount={bodyRows.length}
            jointCount={mates.length}
          />
        </main>

        <aside className={`${isStewart || isCrankSlider ? 'w-72' : 'w-60'} shrink-0 border-l border-border bg-sidebar flex flex-col overflow-y-auto`}>
          {hasAssemblyBooleans && <SidebarSection title="Finished solid properties">
            <div className="px-3 py-2 text-xs space-y-3">{booleanCheck.rows.map(row => <div key={row.id}>
              <p className="font-semibold">{row.name}</p>
              <p>{row.material} · {row.fixed ? 'Fixed to world' : 'Free / joint constrained'}</p>
              <p>Volume: {row.volume.toFixed(3)} mm³</p><p>Mass: {row.mass.toPrecision(6)} kg</p>
              <details><summary className="cursor-pointer">Centre of mass and inertia</summary>
                <p>COM (world at start): {row.com.map(v => v.toFixed(3)).join(', ')} mm</p>
                <p>Principal moments: {row.inertia.map(v => v.toPrecision(6)).join(', ')} kg·mm²</p>
              </details>
            </div>)}<p className="text-muted-foreground">Calculated from each finished OpenCascade solid with uniform material density.</p></div>
          </SidebarSection>}
          {isCrankSlider && <CrankSliderMeasurements />}
          {forceExperiment ? <ForceExperimentControls /> : <>
          {isStewart && <StewartMeasurements />}
          <SidebarSection title="Gravity (mm/s²)">
            <div className="px-3 py-2 font-technical text-xs text-muted-foreground space-y-1">
              <KvRow label="X" value={simulation.gravity[0].toFixed(0)} />
              <KvRow label="Y" value={simulation.gravity[1].toFixed(0)} />
              <KvRow label="Z" value={simulation.gravity[2].toFixed(0)} />
            </div>
          </SidebarSection>
          {duration && <SidebarSection title="Experiment window"><p className="px-3 py-2 text-xs text-muted-foreground">Runs for {duration / 1000} seconds, then holds the final pose. Press Play to repeat.</p></SidebarSection>}
          <SidebarSection title="Time Step">
            <div className="px-3 py-2 font-technical text-xs text-muted-foreground">
              <KvRow label="dt" value={`${simulation.timeStepMs.toFixed(2)} ms`} />
            </div>
          </SidebarSection>
          <SidebarSection title="Physical model">
            <div className="px-3 py-2 text-xs leading-relaxed text-muted-foreground space-y-2">
              <p>Rigid solids with ideal joints and velocity-controlled motors.</p>
              <p>Contact collisions, bearing friction and motor torque limits are not modelled.</p>
              <p>Switching modes stops the simulation and returns it to the starting pose at 0 s.</p>
            </div>
          </SidebarSection>
          </>}
        </aside>
      </div>
    </div>
  );
}

function PlaybackBtn({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center min-w-7 px-2 h-7 rounded text-sm transition-colors',
        disabled
          ? 'opacity-30 cursor-not-allowed text-muted-foreground'
          : active
            ? 'bg-[#FF6B1A] text-white'
            : 'text-foreground hover:bg-secondary active:bg-secondary/80',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SpeedSelector({
  value,
  onSelect,
}: {
  value: number;
  onSelect: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        Speed
      </span>
      {SPEEDS.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.value)}
          className={[
            'px-2 h-6 rounded font-technical text-[10px] transition-colors',
            Math.abs(s.value - value) < 1e-6
              ? 'bg-[#FF6B1A] text-white'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          ].join(' ')}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function SimStatus({ running, paused, completed }: { running: boolean; paused: boolean; completed: boolean }) {
  const text = completed ? 'Complete' : !running ? 'Stopped' : paused ? 'Paused' : 'Simulating';
  const color = !running
    ? 'bg-muted-foreground'
    : paused
      ? 'bg-yellow-500'
      : 'bg-[#FF6B1A] animate-pulse';
  return (
    <div className="flex items-center gap-1.5">
      <span className={['w-1.5 h-1.5 rounded-full', color].join(' ')} />
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider">
        {text}
      </span>
    </div>
  );
}

function SimDashboard({
  simulationTimeMs,
  bodyCount,
  jointCount,
}: {
  simulationTimeMs: number;
  bodyCount: number;
  jointCount: number;
}) {
  return (
    <div className="absolute top-3 right-3 px-3 py-2 rounded bg-card/80 border border-border backdrop-blur-sm font-technical text-[10px] text-muted-foreground space-y-0.5 pointer-events-none">
      <KvRow label="t" value={`${(simulationTimeMs / 1000).toFixed(2)} s`} />
      <KvRow label="bodies" value={String(bodyCount)} />
      <KvRow label="joints" value={String(jointCount)} />
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-border last:border-b-0">
      <div className="px-3 py-1.5 font-technical text-[10px] uppercase tracking-widest text-muted-foreground bg-background/50">
        {title}
      </div>
      <div className="flex flex-col py-1">{children}</div>
    </div>
  );
}

function SidebarRow({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1 font-technical text-xs">
      <span className="truncate">{primary}</span>
      <span className="text-[10px] text-muted-foreground uppercase">{secondary}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="px-3 py-2 text-xs font-technical text-muted-foreground italic">
      {text}
    </p>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="uppercase tracking-wider">{label}</span>
      <span className="text-foreground/80 tabular-nums">{value}</span>
    </div>
  );
}


type BooleanPhysicalRow = { id: string; name: string; material: string; fixed: boolean; volume: number; mass: number; com: number[]; inertia: number[] };
function useBooleanPhysicalCheck(assembly: import('@/state/schemas').Assembly) {
  const signature = useMemo(() => assemblyPhysicsSignature(assembly), [assembly]);
  const [check, setCheck] = useState<{ signature: string; loading: boolean; error: string | null; rows: BooleanPhysicalRow[] }>({ signature: '', loading: false, error: null, rows: [] });
  useEffect(() => {
    let alive = true;
    if (!assembly.booleanFeatures.length) { setCheck({ signature, loading: false, error: null, rows: [] }); return; }
    setCheck({ signature, loading: true, error: null, rows: [] });
    void (async () => {
      const plan = planAssemblySimulation(assembly);
      const cad = await getCadKernel();
      const rows: BooleanPhysicalRow[] = [];
      for (const result of plan.booleans) {
        const body = await regenerateBooleanBody(result.feature, assembly.parts, cad);
        const material = getMaterial(result.materialId);
        rows.push({ id: result.id, name: result.feature.resultPartName, material: material.name,
          fixed: result.id === plan.groundId, volume: body.massProperties.volumeMm3,
          mass: body.massProperties.massKg * material.densityGcm3, com: body.massProperties.comLocal,
          inertia: body.massProperties.principalInertiaKgMm2.map(v => v * material.densityGcm3) });
      }
      if (alive) setCheck({ signature, loading: false, error: null, rows });
    })().catch(error => { if (alive) setCheck({ signature, loading: false, error: error.message, rows: [] }); });
    return () => { alive = false; };
    // Signature deliberately excludes per-frame state and derived native mass readouts.
  }, [signature]);
  if (!assembly.booleanFeatures.length) return { loading: false, error: null, rows: [] };
  return check.signature === signature ? check : { loading: true, error: null, rows: [] };
}
