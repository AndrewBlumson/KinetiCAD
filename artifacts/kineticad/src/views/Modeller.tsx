import { lazy, Suspense, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import PlanePicker from '@/components/PlanePicker';
import SketchToolbar from '@/components/SketchToolbar';
import type { CardinalPlane } from '@/sketch/plane';

const Scene = lazy(() => import('@/three/Scene'));

export default function Modeller() {
  const assembly = useKinetiCADStore((s) => s.assembly);
  const sketchSession = useKinetiCADStore((s) => s.sketchSession);
  const beginSketch = useKinetiCADStore((s) => s.beginSketch);

  const [planePickerOpen, setPlanePickerOpen] = useState(false);

  const handlePlanePicked = (plane: CardinalPlane) => {
    setPlanePickerOpen(false);
    beginSketch(plane);
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Top Toolbar */}
      <header className="flex items-center gap-2 px-3 h-11 border-b border-border bg-card shrink-0 select-none">
        <span className="font-technical text-xs font-semibold tracking-widest uppercase text-[#FF6B1A]">
          KinetiCAD
        </span>
        <div className="w-px h-5 bg-border mx-1" />

        {sketchSession.active ? (
          <SketchToolbar />
        ) : (
          <>
            <ToolbarGroup label="Sketch">
              <ToolbarBtn
                icon="▭"
                label="New Sketch"
                onClick={() => setPlanePickerOpen(true)}
                testId="new-sketch"
              />
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
          </>
        )}

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
                <div key={p.id} className="flex flex-col">
                  <SidebarItem label={p.name} />
                  {p.sketches.map((s) => (
                    <SidebarItem
                      key={s.id}
                      label={`  ${s.name} (${planeLabel(s.plane)})`}
                      muted
                    />
                  ))}
                </div>
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
        <main
          className="flex-1 relative overflow-hidden"
          style={{ background: '#0A0E1A' }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
          <PlanePicker
            open={planePickerOpen}
            onPick={handlePlanePicked}
            onCancel={() => setPlanePickerOpen(false)}
          />
        </main>

        {/* Right Inspector */}
        <aside className="w-60 shrink-0 border-l border-border bg-sidebar flex flex-col overflow-hidden panel-transition">
          <SidebarSection title="Inspector">
            {sketchSession.active && sketchSession.plane ? (
              <ActiveSketchInspector
                plane={sketchSession.plane}
                primitiveCount={sketchSession.committedPrimitives.length}
              />
            ) : (
              <EmptyState text="Select a part or feature" />
            )}
          </SidebarSection>

          <SidebarSection title="Feature Tree">
            {assembly.parts.length === 0 ||
            assembly.parts.every((p) => p.sketches.length === 0) ? (
              <EmptyState text="No features" />
            ) : (
              assembly.parts.flatMap((p) =>
                p.sketches.map((s) => (
                  <SidebarItem
                    key={s.id}
                    label={`${s.name} (${planeLabel(s.plane)}) — ${s.primitives.length} ${
                      s.primitives.length === 1 ? 'primitive' : 'primitives'
                    }`}
                  />
                )),
              )
            )}
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}

function ActiveSketchInspector({
  plane,
  primitiveCount,
}: {
  plane: CardinalPlane;
  primitiveCount: number;
}) {
  const assembly = useKinetiCADStore((s) => s.assembly);
  // Live preview of how the sketch will be named and counted once finished.
  const targetPart = assembly.parts[0];
  const nextIndex = (targetPart?.sketches.length ?? 0) + 1;
  return (
    <div className="px-3 py-2 flex flex-col gap-1">
      <div className="font-technical text-xs text-foreground">
        Sketch {nextIndex} ({plane})
      </div>
      <div
        className="font-technical text-[11px] text-muted-foreground"
        data-testid="sketch-primitive-count"
      >
        {primitiveCount} {primitiveCount === 1 ? 'primitive' : 'primitives'}
      </div>
    </div>
  );
}

function planeLabel(plane: import('@/state/schemas').SketchPlane): string {
  if (typeof plane === 'string') return plane;
  return 'Custom';
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
  onClick,
  testId,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      title={label}
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
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

function SidebarItem({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <button
      type="button"
      className={[
        'text-left px-3 py-1 text-xs font-technical hover:bg-secondary transition-colors rounded mx-1',
        muted ? 'text-muted-foreground' : 'text-foreground',
      ].join(' ')}
    >
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
