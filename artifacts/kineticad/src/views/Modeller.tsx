import { lazy, Suspense, useState } from 'react';
import { useKinetiCADStore } from '@/state/store';
import PlanePicker from '@/components/PlanePicker';
import SketchToolbar from '@/components/SketchToolbar';
import SketchCursor from '@/components/SketchCursor';
import SketchInspector from '@/components/inspectors/SketchInspector';
import FeatureInspector from '@/components/inspectors/FeatureInspector';
import PartInspector from '@/components/inspectors/PartInspector';
import BooleanInspector from '@/components/inspectors/BooleanInspector';
import type { CardinalPlane } from '@/sketch/plane';
import type {
  BooleanFeature,
  BooleanOperation,
  Feature,
  Part,
  SketchPlane,
} from '@/state/schemas';

const Scene = lazy(() => import('@/three/Scene'));

export default function Modeller() {
  const assembly = useKinetiCADStore((s) => s.assembly);
  const sketchSession = useKinetiCADStore((s) => s.sketchSession);
  const beginSketch = useKinetiCADStore((s) => s.beginSketch);
  const selection = useKinetiCADStore((s) => s.selection);
  const featureEditor = useKinetiCADStore((s) => s.featureEditor);
  const booleanEditor = useKinetiCADStore((s) => s.booleanEditor);
  const selectPart = useKinetiCADStore((s) => s.selectPart);
  const selectSketch = useKinetiCADStore((s) => s.selectSketch);
  const selectFeature = useKinetiCADStore((s) => s.selectFeature);
  const selectBoolean = useKinetiCADStore((s) => s.selectBoolean);
  const beginEditFeature = useKinetiCADStore((s) => s.beginEditFeature);
  const beginCreateBoolean = useKinetiCADStore((s) => s.beginCreateBoolean);
  const beginEditBoolean = useKinetiCADStore((s) => s.beginEditBoolean);
  const clearSelection = useKinetiCADStore((s) => s.clearSelection);

  const [planePickerOpen, setPlanePickerOpen] = useState(false);
  // When the user asks to delete a part that's referenced by booleans we
  // surface a small confirmation so they understand the cascade. The pending
  // partId doubles as the modal's open flag.
  const [cascadePartId, setCascadePartId] = useState<string | null>(null);

  const handlePlanePicked = (plane: CardinalPlane) => {
    setPlanePickerOpen(false);
    beginSketch(plane);
  };

  const onPartClick = (partId: string) => {
    selectPart(partId);
  };
  const onSketchClick = (partId: string, sketchId: string) => {
    selectSketch(partId, sketchId);
  };
  const onFeatureClick = (partId: string, featureId: string) => {
    // Selecting a feature also opens the editor on it, per the spec.
    selectFeature(partId, featureId);
    beginEditFeature(partId, featureId);
  };
  const onBooleanClick = (booleanId: string) => {
    selectBoolean(booleanId);
    beginEditBoolean(booleanId);
  };

  const canCreateBoolean =
    assembly.parts.length >= 2 && !sketchSession.active && !featureEditor.open;

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

            <div className="w-px h-5 bg-border mx-1" />

            <ToolbarGroup label="Boolean">
              <ToolbarBtn
                icon="∪"
                label="Union"
                disabled={!canCreateBoolean}
                onClick={() => beginCreateBoolean('union')}
                testId="boolean-union"
              />
              <ToolbarBtn
                icon="−"
                label="Subtract"
                disabled={!canCreateBoolean}
                onClick={() => beginCreateBoolean('subtract')}
                testId="boolean-subtract"
              />
              <ToolbarBtn
                icon="∩"
                label="Intersect"
                disabled={!canCreateBoolean}
                onClick={() => beginCreateBoolean('intersect')}
                testId="boolean-intersect"
              />
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
        {/* Left Sidebar: Parts / Booleans / Mates tree */}
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
                  onPartClick={onPartClick}
                  onSketchClick={onSketchClick}
                  onFeatureClick={onFeatureClick}
                />
              ))
            )}
          </SidebarSection>

          {(assembly.booleanFeatures ?? []).length > 0 ? (
            <SidebarSection title="Booleans">
              {(assembly.booleanFeatures ?? []).map((b) => (
                <BooleanRow
                  key={b.id}
                  feature={b}
                  parts={assembly.parts}
                  selected={
                    selection?.kind === 'boolean' &&
                    selection.booleanId === b.id
                  }
                  onClick={() => onBooleanClick(b.id)}
                />
              ))}
            </SidebarSection>
          ) : null}

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
          {cascadePartId ? (
            <CascadeDeleteDialog
              partId={cascadePartId}
              onClose={() => setCascadePartId(null)}
            />
          ) : null}
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
              booleanEditorOpen={booleanEditor.open}
              selection={selection}
              parts={assembly.parts}
              onRequestDeletePart={(partId) => setCascadePartId(partId)}
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
  onPartClick,
  onSketchClick,
  onFeatureClick,
}: {
  part: Part;
  selection: ReturnType<typeof useKinetiCADStore.getState>['selection'];
  onPartClick: (partId: string) => void;
  onSketchClick: (partId: string, sketchId: string) => void;
  onFeatureClick: (partId: string, featureId: string) => void;
}) {
  const isPartSelected =
    selection?.kind === 'part' && selection.partId === part.id;
  return (
    <div className="flex flex-col">
      <SidebarItem
        label={part.name}
        selected={isPartSelected}
        onClick={() => onPartClick(part.id)}
        testId={`tree-part-${part.id}`}
      />
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

function BooleanRow({
  feature,
  parts,
  selected,
  onClick,
}: {
  feature: BooleanFeature;
  parts: Part[];
  selected: boolean;
  onClick: () => void;
}) {
  const inputNames = feature.inputPartIds
    .map((id) => parts.find((p) => p.id === id)?.name ?? '?')
    .join(', ');
  const opGlyph = booleanOpGlyph(feature.operation);
  return (
    <SidebarItem
      label={`${opGlyph} ${feature.resultPartName} (${inputNames})`}
      selected={selected}
      onClick={onClick}
      testId={`tree-boolean-${feature.id}`}
    />
  );
}

function booleanOpGlyph(op: BooleanOperation): string {
  if (op.type === 'union') return '∪';
  if (op.type === 'subtract') return '−';
  return '∩';
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
 *  2. booleanEditor open      → BooleanInspector (assembly-level editor)
 *  3. featureEditor open      → FeatureInspector (per-part editor)
 *  4. selection.kind=boolean  → BooleanInspector (read-only-ish view)
 *  5. selection.kind=sketch   → SketchInspector
 *  6. selection.kind=feature  → FeatureInspector also handles this once the
 *     store action `selectFeature` + `beginEditFeature` opens the editor;
 *     we still fall through to a stub label if the feature type isn't yet
 *     editable.
 *  7. selection.kind=part     → PartInspector
 *  8. Empty state.
 */
function RightInspectorBody({
  sketchActive,
  sketchPlane,
  sketchPrimitiveCount,
  editorOpen,
  booleanEditorOpen,
  selection,
  parts,
  onRequestDeletePart,
}: {
  sketchActive: boolean;
  sketchPlane: CardinalPlane | null;
  sketchPrimitiveCount: number;
  editorOpen: boolean;
  booleanEditorOpen: boolean;
  selection: ReturnType<typeof useKinetiCADStore.getState>['selection'];
  parts: Part[];
  onRequestDeletePart: (partId: string) => void;
}) {
  if (sketchActive && sketchPlane) {
    return (
      <ActiveSketchInspector
        plane={sketchPlane}
        primitiveCount={sketchPrimitiveCount}
      />
    );
  }
  if (booleanEditorOpen) {
    return <BooleanInspector />;
  }
  if (editorOpen) {
    return <FeatureInspector />;
  }
  if (selection?.kind === 'boolean') {
    // Selecting a committed boolean opens the editor in `edit` mode via the
    // `selectBoolean` → `beginEditBoolean` chain in `onBooleanClick`. As a
    // fallback (e.g. selection arrived via picker), still render the
    // BooleanInspector — it gracefully no-ops when the editor is closed.
    return <BooleanInspector />;
  }
  if (selection?.kind === 'part') {
    return <PartInspector onRequestDelete={onRequestDeletePart} />;
  }
  if (selection?.kind === 'sketch') {
    const part = parts.find((p) => p.id === selection.partId);
    const sketch = part?.sketches.find((s) => s.id === selection.sketchId);
    if (part && sketch) {
      return <SketchInspector part={part} sketch={sketch} />;
    }
  }
  if (selection?.kind === 'feature') {
    // Feature-selection without an open editor is now an unusual transient:
    //   - applyFeatureEditor falls back to a part selection on save.
    //   - clicking a feature row in the sidebar opens the editor.
    //   - boolean/sketch flows have their own selection kinds.
    // If we still land here (e.g. selection survived a part being removed),
    // resolve the containing sketch when possible, otherwise show the
    // empty state.
    const part = parts.find((p) => p.id === selection.partId);
    const feature = part?.features.find((f) => f.id === selection.featureId);
    if (part && feature) {
      const sketchId =
        'sketchId' in feature ? (feature as { sketchId?: string }).sketchId : undefined;
      const sketch = sketchId
        ? part.sketches.find((s) => s.id === sketchId)
        : undefined;
      if (sketch) {
        return <SketchInspector part={part} sketch={sketch} />;
      }
    }
  }
  return <EmptyState text="Select a part or feature" />;
}

/**
 * Cascade-delete confirmation dialog. Shown when the user clicks Delete on a
 * part that's referenced by one or more booleans. Confirm dispatches
 * `deletePartCascade` (removes the part AND every dependent boolean) — a
 * quietly destructive action we don't want to perform without consent.
 */
function CascadeDeleteDialog({
  partId,
  onClose,
}: {
  partId: string;
  onClose: () => void;
}) {
  const assembly = useKinetiCADStore((s) => s.assembly);
  const getBooleansUsingPart = useKinetiCADStore(
    (s) => s.getBooleansUsingPart,
  );
  const deletePartCascade = useKinetiCADStore((s) => s.deletePartCascade);

  const part = assembly.parts.find((p) => p.id === partId);
  const dependents = getBooleansUsingPart(partId);

  if (!part) {
    // Part vanished out from under us (e.g. another action deleted it) —
    // close silently.
    onClose();
    return null;
  }

  const confirm = () => {
    deletePartCascade(partId);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Confirm delete"
        data-testid="cascade-delete-dialog"
        className="w-80 max-w-[90vw] rounded border border-border bg-card shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-border">
          <div className="font-technical text-xs uppercase tracking-widest text-foreground">
            Delete {part.name}?
          </div>
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          {dependents.length === 0 ? (
            <div className="font-technical text-[11px] text-muted-foreground leading-snug">
              This part is not used by any booleans. Are you sure you want to
              delete it?
            </div>
          ) : (
            <>
              <div className="font-technical text-[11px] text-foreground leading-snug">
                The following booleans use this part and will also be deleted:
              </div>
              <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                {dependents.map((b) => (
                  <li
                    key={b.id}
                    className="font-technical text-[11px] text-[#FF6B6B] truncate"
                  >
                    • {b.resultPartName}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="cascade-delete-cancel"
            className="h-8 px-3 rounded font-technical text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            data-testid="cascade-delete-confirm"
            className="h-8 px-3 rounded bg-[#FF6B6B] text-[#0A0E1A] font-technical text-[11px] uppercase tracking-widest font-semibold hover:brightness-110 transition"
          >
            Delete
          </button>
        </div>
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
