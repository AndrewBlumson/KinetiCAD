import { useKinetiCADStore } from '@/state/store';

export default function Modeller() {
  const assembly = useKinetiCADStore((s) => s.assembly);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Top Toolbar */}
      <header className="flex items-center gap-2 px-3 h-11 border-b border-border bg-card shrink-0 select-none">
        <span className="font-technical text-xs font-semibold tracking-widest uppercase text-[#FF6B1A]">
          KinetiCAD
        </span>
        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarGroup label="Sketch">
          <ToolbarBtn icon="▭" label="New Sketch" />
          <ToolbarBtn icon="╱" label="Line" disabled />
          <ToolbarBtn icon="○" label="Circle" disabled />
          <ToolbarBtn icon="□" label="Rectangle" disabled />
        </ToolbarGroup>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarGroup label="Features">
          <ToolbarBtn icon="⬆" label="Extrude" disabled />
          <ToolbarBtn icon="↻" label="Revolve" disabled />
          <ToolbarBtn icon="◎" label="Hole" disabled />
        </ToolbarGroup>

        <div className="flex-1" />

        <span className="font-technical text-xs text-muted-foreground">
          {assembly.name}
        </span>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Parts / Sketch tree */}
        <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col overflow-hidden panel-transition">
          <SidebarSection title="Parts">
            {assembly.parts.length === 0 ? (
              <EmptyState text="No parts yet" />
            ) : (
              assembly.parts.map((p) => (
                <SidebarItem key={p.id} label={p.name} />
              ))
            )}
          </SidebarSection>

          <SidebarSection title="Mates">
            {assembly.mates.length === 0 ? (
              <EmptyState text="No mates defined" />
            ) : (
              assembly.mates.map((m) => (
                <SidebarItem key={m.id} label={m.type} />
              ))
            )}
          </SidebarSection>
        </aside>

        {/* Central 3D Canvas */}
        <main className="flex-1 relative overflow-hidden" style={{ background: '#0A0E1A' }}>
          <CanvasPlaceholder />
        </main>

        {/* Right Inspector */}
        <aside className="w-60 shrink-0 border-l border-border bg-sidebar flex flex-col overflow-hidden panel-transition">
          <SidebarSection title="Inspector">
            <EmptyState text="Select a part or feature" />
          </SidebarSection>

          <SidebarSection title="Feature Tree">
            <EmptyState text="No features" />
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-technical text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
        {label}
      </span>
      {children}
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  disabled = false,
  active = false,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={label}
      disabled={disabled}
      className={[
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        disabled
          ? 'text-muted-foreground opacity-40 cursor-not-allowed'
          : active
          ? 'bg-[#FF6B1A] text-white'
          : 'text-foreground hover:bg-secondary active:bg-secondary/80',
      ].join(' ')}
    >
      {icon}
    </button>
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

function SidebarItem({ label }: { label: string }) {
  return (
    <button className="text-left px-3 py-1 text-xs font-technical text-foreground hover:bg-secondary transition-colors rounded mx-1">
      {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="px-3 py-2 text-xs font-technical text-muted-foreground italic">
      {text}
    </p>
  );
}

function CanvasPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      {/* Grid overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#141B2E" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#141B2E" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Origin axes */}
      <svg
        className="absolute"
        width="80"
        height="80"
        viewBox="-40 -40 80 80"
        style={{ left: 'calc(50% - 40px)', bottom: '80px' }}
      >
        <line x1="0" y1="0" x2="40" y2="0" stroke="#ef4444" strokeWidth="1.5" />
        <line x1="0" y1="0" x2="0" y2="-40" stroke="#22c55e" strokeWidth="1.5" />
        <text x="43" y="4" fill="#ef4444" fontSize="10" fontFamily="monospace">X</text>
        <text x="-4" y="-43" fill="#22c55e" fontSize="10" fontFamily="monospace">Y</text>
        <circle cx="0" cy="0" r="2.5" fill="#3b82f6" />
      </svg>

      {/* Centre label */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded border border-[#FF6B1A]/30 flex items-center justify-center">
          <span className="text-[#FF6B1A] text-2xl opacity-60">◱</span>
        </div>
        <p className="font-technical text-xs text-muted-foreground text-center leading-relaxed">
          3D canvas<br />
          <span className="text-[10px] opacity-60">(WebGPU renderer — Phase 1)</span>
        </p>
      </div>
    </div>
  );
}
