import { lazy, Suspense } from 'react';
import { useKinetiCADStore } from '@/state/store';

const Scene = lazy(() => import('@/three/Scene'));

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
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
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

