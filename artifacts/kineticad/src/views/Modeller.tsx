import { lazy, Suspense, useEffect, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import PlanePicker from '@/components/PlanePicker';
import SketchToolbar from '@/components/SketchToolbar';
import SketchCursor from '@/components/SketchCursor';
import SketchInspector from '@/components/inspectors/SketchInspector';
import FeatureInspector from '@/components/inspectors/FeatureInspector';
import TopologyPickerTestInspector from '@/components/inspectors/TopologyPickerTestInspector';
import type { CardinalPlane } from '@/sketch/plane';
import type { Feature, Part, SketchPlane } from '@/state/schemas';

const Scene = lazy(() => import('@/three/Scene'));

export default function Modeller() {
  const assembly = useKinetiCADStore((s) => s.assembly);
  const sketchSession = useKinetiCADStore((s) => s.sketchSession);
  const beginSketch = useKinetiCADStore((s) => s.beginSketch);
  const selection = useKinetiCADStore((s) => s.selection);
  const featureEditor = useKinetiCADStore((s) => s.featureEditor);
  const selectSketch = useKinetiCADStore((s) => s.selectSketch);
  const selectFeature = useKinetiCADStore((s) => s.selectFeature);
  const beginEditFeature = useKinetiCADStore((s) => s.beginEditFeature);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);
  const showPickerTestPanel = useKinetiCADStore((s) => s.showPickerTestPanel);
  const togglePickerTestPanel = useKinetiCADStore(
    (s) => s.togglePickerTestPanel,
  );

  const [planePickerOpen, setPlanePickerOpen] = useState(false);

  // Phase 4 Split A diagnostic: Cmd/Ctrl+Shift+T toggles the picker test
  // panel. Removed once Split B's per-feature inspectors take over.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      // Match by KeyboardEvent.code so non-QWERTY layouts still work.
      if (e.code !== 'KeyT') return;
      // Don't fire when the user is typing in an input — most CAD inspectors
      // include numeric inputs we don't want to swallow.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      togglePickerTestPanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePickerTestPanel]);

  const handlePlanePicked = (plane: CardinalPlane) => {
    setPlanePickerOpen(false);
    beginSketch(plane);
  };

  const onSketchClick = (partId: string, sketchId: string) => {
    selectSketch(partId, sketchId);
  };
  const onFeatureClick = (partId: string, featureId: string) => {
    // Selecting a feature also opens the editor on it, per the spec.
    selectFeature(partId, featureId);
    beginEditFeature(partId, featureId);
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
                <PartTree
                  key={p.id}
                  part={p}
                  selection={selection}
                  onSketchClick={onSketchClick}
                  onFeatureClick={onFeatureClick}
                />
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
          // The SketchCursor's CSS hides the system cursor inside this host
          // while sketch mode is active, scoped to this attribute selector.
          data-kineticad-canvas-host="true"
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
          <PlanePicker
            open={planePickerOpen}
            onPick={handlePlanePicked}
            onCancel={() => setPlanePickerOpen(false)}
          />
          {showPickerTestPanel && (
            <div
              className="absolute top-3 right-3 z-30 w-64 pointer-events-auto"
              data-testid="picker-test-panel-container"
            >
              <TopologyPickerTestInspector />
            </div>
          )}
        </main>
        <SketchCursor />

        {/* Right Inspector */}
        <aside
          className="w-60 shrink-0 border-l border-border bg-sidebar flex flex-col overflow-hidden panel-transition"
          // Click on the inspector's empty area clears any selection. Buttons
          // and inputs inside child components stop propagation by virtue of
          // their own click handlers.
          onClick={(e) => {
            if (e.target === e.currentTarget) clearSelection();
          }}
        >
          <SidebarSection title="Inspector">
            <RightInspectorBody
              sketchActive={sketchSession.active}
              sketchPlane={sketchSession.plane}
              sketchPrimitiveCount={sketchSession.committedPrimitives.length}
              editorOpen={featureEditor.open}
              selection={selection}
              parts={assembly.parts}
            />
          </SidebarSection>

          <SidebarSection title="Feature Tree">
            <FeatureTree
              parts={assembly.parts}
              selection={selection}
              onSketchClick={onSketchClick}
              onFeatureClick={onFeatureClick}
            />
          </SidebarSection>
        </aside>
      </div>
    </div>
  );
}

/**
 * Render the left-sidebar tree under a single part: the part name plus its
 * sketches and applied features as clickable, selectable rows.
 */
function PartTree({
  part,
  selection,
  onSketchClick,
  onFeatureClick,
}: {
  part: Part;
  selection: ReturnType<typeof useKinetiCADStore.getState>['selection'];
  onSketchClick: (partId: string, sketchId: string) => void;
  onFeatureClick: (partId: string, featureId: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <SidebarItem label={part.name} />
      {part.sketches.map((s) => {
        const isSelected =
          selection?.kind === 'sketch' && selection.sketchId === s.id;
        return (
          <SidebarItem
            key={s.id}
            label={`  ${s.name} (${planeLabel(s.plane)})`}
            muted
            selected={isSelected}
            onClick={() => onSketchClick(part.id, s.id)}
            testId={`tree-sketch-${s.id}`}
          />
        );
      })}
      {part.features.map((f, idx) => {
        const isSelected =
          selection?.kind === 'feature' && selection.featureId === f.id;
        return (
          <SidebarItem
            key={f.id}
            label={`  ${featureName(f, part, idx)}`}
            muted
            selected={isSelected}
            onClick={() => onFeatureClick(part.id, f.id)}
            testId={`tree-feature-${f.id}`}
          />
        );
      })}
    </div>
  );
}

/** Human label for a feature row, e.g. "Extrude 1" or "Revolve 2". */
function featureName(feature: Feature, part: Part, _idx: number): string {
  if (feature.type === 'extrude') {
    const sameKind = part.features.filter((f) => f.type === 'extrude');
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Extrude ${n}`;
  }
  if (feature.type === 'revolve') {
    const sameKind = part.features.filter((f) => f.type === 'revolve');
    const n = sameKind.findIndex((f) => f.id === feature.id) + 1;
    return `Revolve ${n}`;
  }
  // Other feature kinds aren't created yet but we still want a stable label.
  return feature.type;
}

/**
 * Right-panel "Feature Tree" section: same items as the left sidebar's
 * sketches+features list, kept here too because the spec calls for it.
 */
function FeatureTree({
  parts,
  selection,
  onSketchClick,
  onFeatureClick,
}: {
  parts: Part[];
  selection: ReturnType<typeof useKinetiCADStore.getState>['selection'];
  onSketchClick: (partId: string, sketchId: string) => void;
  onFeatureClick: (partId: string, featureId: string) => void;
}) {
  const isEmpty =
    parts.length === 0 ||
    parts.every(
      (p) => p.sketches.length === 0 && p.features.length === 0,
    );
  if (isEmpty) return <EmptyState text="No features" />;

  return (
    <>
      {parts.flatMap((p) => [
        ...p.sketches.map((s) => {
          const isSelected =
            selection?.kind === 'sketch' && selection.sketchId === s.id;
          return (
            <SidebarItem
              key={`s-${s.id}`}
              label={`${s.name} (${planeLabel(s.plane)}) — ${s.primitives.length} ${
                s.primitives.length === 1 ? 'primitive' : 'primitives'
              }`}
              selected={isSelected}
              onClick={() => onSketchClick(p.id, s.id)}
              testId={`featuretree-sketch-${s.id}`}
            />
          );
        }),
        ...p.features.map((f, idx) => {
          const isSelected =
            selection?.kind === 'feature' && selection.featureId === f.id;
          return (
            <SidebarItem
              key={`f-${f.id}`}
              label={featureName(f, p, idx)}
              selected={isSelected}
              onClick={() => onFeatureClick(p.id, f.id)}
              testId={`featuretree-feature-${f.id}`}
            />
          );
        }),
      ])}
    </>
  );
}

/**
 * Pick the inspector body based on the current store state. Order matters:
 *  1. Active sketch session   → ActiveSketchInspector
 *  2. featureEditor open      → FeatureInspector
 *  3. selection.kind=sketch   → SketchInspector
 *  4. selection.kind=feature  → FeatureInspector also handles this once the
 *     store action `selectFeature` + `beginEditFeature` opens the editor;
 *     we still fall through to a stub label if the feature type isn't yet
 *     editable.
 *  5. Empty state.
 */
function RightInspectorBody({
  sketchActive,
  sketchPlane,
  sketchPrimitiveCount,
  editorOpen,
  selection,
  parts,
}: {
  sketchActive: boolean;
  sketchPlane: CardinalPlane | null;
  sketchPrimitiveCount: number;
  editorOpen: boolean;
  selection: ReturnType<typeof useKinetiCADStore.getState>['selection'];
  parts: Part[];
}) {
  if (sketchActive && sketchPlane) {
    return (
      <ActiveSketchInspector
        plane={sketchPlane}
        primitiveCount={sketchPrimitiveCount}
      />
    );
  }
  if (editorOpen) {
    return <FeatureInspector />;
  }
  if (selection?.kind === 'sketch') {
    const part = parts.find((p) => p.id === selection.partId);
    const sketch = part?.sketches.find((s) => s.id === selection.sketchId);
    if (part && sketch) {
      return <SketchInspector part={part} sketch={sketch} />;
    }
  }
  if (selection?.kind === 'feature') {
    // Feature types beyond extrude/revolve don't open the editor yet — show
    // a minimal placeholder so the user still sees something on click.
    const part = parts.find((p) => p.id === selection.partId);
    const feature = part?.features.find((f) => f.id === selection.featureId);
    if (part && feature) {
      return (
        <div className="px-3 py-3">
          <div className="font-technical text-xs text-foreground">
            {featureName(feature, part, 0)}
          </div>
          <div className="font-technical text-[11px] text-muted-foreground mt-1">
            This feature type isn't editable yet.
          </div>
        </div>
      );
    }
  }
  return <EmptyState text="Select a part or feature" />;
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

function planeLabel(plane: SketchPlane): string {
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

function SidebarItem({
  label,
  muted = false,
  selected = false,
  onClick,
  testId,
}: {
  label: string;
  muted?: boolean;
  selected?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={[
        'text-left px-3 py-1 text-xs font-technical hover:bg-secondary transition-colors rounded mx-1 border-l-2',
        selected
          ? 'border-l-[#FF6B1A] bg-[#FF6B1A]/[0.08] text-foreground'
          : 'border-l-transparent',
        !selected && (muted ? 'text-muted-foreground' : 'text-foreground'),
      ]
        .filter(Boolean)
        .join(' ')}
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
