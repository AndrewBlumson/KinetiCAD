import { useKinetiCADStore } from '@/state/store';

export default function Simulator() {
  const { simulation, setSimulationRunning, resetSimulation } = useKinetiCADStore();

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Top Toolbar */}
      <header className="flex items-center gap-2 px-3 h-11 border-b border-border bg-card shrink-0 select-none">
        <span className="font-technical text-xs font-semibold tracking-widest uppercase text-[#FF6B1A]">
          KinetiCAD
        </span>
        <div className="w-px h-5 bg-border mx-1" />

        <span className="font-technical text-xs text-muted-foreground uppercase tracking-wider">
          Simulator
        </span>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <PlaybackBtn
            label="Play"
            active={simulation.running}
            onClick={() => setSimulationRunning(!simulation.running)}
          >
            {simulation.running ? '⏸' : '▶'}
          </PlaybackBtn>
          <PlaybackBtn label="Reset" onClick={resetSimulation}>
            ⏹
          </PlaybackBtn>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        <SpeedSelector />

        <div className="flex-1" />

        <SimStatus running={simulation.running} />
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Simulation objects */}
        <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden">
          <SidebarSection title="Rigid Bodies">
            <EmptyState text="No parts in assembly" />
          </SidebarSection>
          <SidebarSection title="Joints">
            <EmptyState text="No joints defined" />
          </SidebarSection>
        </aside>

        {/* Central Physics Canvas */}
        <main className="flex-1 relative overflow-hidden" style={{ background: '#0A0E1A' }}>
          <PhysicsCanvasPlaceholder running={simulation.running} />
        </main>

        {/* Right Inspector */}
        <aside className="w-60 shrink-0 border-l border-border bg-sidebar flex flex-col overflow-hidden">
          <SidebarSection title="Physics Properties">
            <EmptyState text="Select a rigid body" />
          </SidebarSection>
          <SidebarSection title="Gravity">
            <div className="px-3 py-2 font-technical text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>X</span>
                <span>{simulation.gravity[0].toFixed(2)} m/s²</span>
              </div>
              <div className="flex justify-between">
                <span>Y</span>
                <span>{simulation.gravity[1].toFixed(2)} m/s²</span>
              </div>
              <div className="flex justify-between">
                <span>Z</span>
                <span>{simulation.gravity[2].toFixed(2)} m/s²</span>
              </div>
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
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={[
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        active
          ? 'bg-[#FF6B1A] text-white'
          : 'text-foreground hover:bg-secondary active:bg-secondary/80',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SpeedSelector() {
  const speeds = ['0.25x', '0.5x', '1x', '2x'];
  return (
    <div className="flex items-center gap-1">
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        Speed
      </span>
      {speeds.map((s) => (
        <button
          key={s}
          className={[
            'px-2 h-6 rounded font-technical text-[10px] transition-colors',
            s === '1x'
              ? 'bg-[#FF6B1A] text-white'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          ].join(' ')}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function SimStatus({ running }: { running: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={[
          'w-1.5 h-1.5 rounded-full',
          running ? 'bg-[#FF6B1A] animate-pulse' : 'bg-muted-foreground',
        ].join(' ')}
      />
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider">
        {running ? 'Simulating' : 'Paused'}
      </span>
    </div>
  );
}

function PhysicsCanvasPlaceholder({ running }: { running: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pgSmall" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#141B2E" strokeWidth="0.5" />
          </pattern>
          <pattern id="pgLarge" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#pgSmall)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#141B2E" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pgLarge)" />
      </svg>

      <div className="relative flex flex-col items-center gap-3">
        <div
          className={[
            'w-16 h-16 rounded border flex items-center justify-center transition-colors',
            running ? 'border-[#FF6B1A]/60' : 'border-[#FF6B1A]/20',
          ].join(' ')}
        >
          <span
            className={[
              'text-2xl transition-colors',
              running ? 'text-[#FF6B1A]' : 'text-[#FF6B1A] opacity-30',
            ].join(' ')}
          >
            ⚙
          </span>
        </div>
        <p className="font-technical text-xs text-muted-foreground text-center leading-relaxed">
          Physics canvas<br />
          <span className="text-[10px] opacity-60">(Rapier3D engine — Phase 8)</span>
        </p>
      </div>
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

function EmptyState({ text }: { text: string }) {
  return (
    <p className="px-3 py-2 text-xs font-technical text-muted-foreground italic">
      {text}
    </p>
  );
}
