import { lazy, Suspense } from 'react';
import { useKinetiCADStore } from '@/state/store';

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
  const simulation = useKinetiCADStore((s) => s.simulation);
  const setSimulationRunning = useKinetiCADStore((s) => s.setSimulationRunning);
  const setSimulationPaused = useKinetiCADStore((s) => s.setSimulationPaused);
  const setSimulationSpeed = useKinetiCADStore((s) => s.setSimulationSpeed);
  const resetSimulation = useKinetiCADStore((s) => s.resetSimulation);
  const parts = useKinetiCADStore((s) => s.assembly.parts);
  const mates = useKinetiCADStore((s) => s.assembly.mates);

  const canPlay = parts.length > 0;
  const isRunning = simulation.running;
  const isPaused = simulation.paused;

  const onPlayPause = () => {
    if (!canPlay) return;
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
            label={isRunning ? (isPaused ? 'Resume' : 'Pause') : 'Play'}
            active={isRunning && !isPaused}
            disabled={!canPlay}
            onClick={onPlayPause}
          >
            {isRunning && !isPaused ? '⏸' : '▶'}
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

        <SimStatus running={isRunning} paused={isPaused} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden">
          <SidebarSection title="Rigid Bodies">
            {parts.length === 0 ? (
              <EmptyState text="No parts in assembly" />
            ) : (
              parts.map((p) => (
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
        </aside>

        <main className="flex-1 relative overflow-hidden" style={{ background: '#0A0E1A' }}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center font-technical text-xs text-muted-foreground">Loading scene…</div>}>
            <Scene />
          </Suspense>
          <SimDashboard
            simulationTimeMs={simulation.simulationTimeMs}
            bodyCount={parts.length}
            jointCount={mates.length}
          />
        </main>

        <aside className="w-60 shrink-0 border-l border-border bg-sidebar flex flex-col overflow-hidden">
          <SidebarSection title="Gravity (mm/s²)">
            <div className="px-3 py-2 font-technical text-xs text-muted-foreground space-y-1">
              <KvRow label="X" value={simulation.gravity[0].toFixed(0)} />
              <KvRow label="Y" value={simulation.gravity[1].toFixed(0)} />
              <KvRow label="Z" value={simulation.gravity[2].toFixed(0)} />
            </div>
          </SidebarSection>
          <SidebarSection title="Time Step">
            <div className="px-3 py-2 font-technical text-xs text-muted-foreground">
              <KvRow label="dt" value={`${simulation.timeStepMs.toFixed(2)} ms`} />
            </div>
          </SidebarSection>
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
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
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

function SimStatus({ running, paused }: { running: boolean; paused: boolean }) {
  const text = !running ? 'Stopped' : paused ? 'Paused' : 'Simulating';
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
