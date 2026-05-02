import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Assembly,
  ExtrudeDirection,
  ExtrudeFeature,
  Feature,
  Part,
  RevolveAxis,
  RevolveFeature,
  SimulationState,
  AppMode,
  Sketch,
  SketchPrimitive,
} from "./schemas";
import type { CardinalPlane } from "@/sketch/plane";

export type SketchTool = "idle" | "line" | "rectangle" | "circle" | "arc";

export type SketchSession = {
  active: boolean;
  plane: CardinalPlane | null;
  tool: SketchTool;
  /**
   * Primitives committed by the user during this session, before they have
   * been pushed into the assembly. Updated by `commitPrimitive`.
   *
   * Note: the in-flight primitive is intentionally NOT in the store. It
   * changes 60×/s on mousemove and would re-render every store subscriber.
   * The `SketchSession` class (in `src/sketch/SketchSession.ts`) owns it
   * locally and renders it directly via Three.js without a React round-trip.
   */
  committedPrimitives: SketchPrimitive[];
};

const defaultSketchSession: SketchSession = {
  active: false,
  plane: null,
  tool: "idle",
  committedPrimitives: [],
};

/**
 * What the user currently has selected in the feature tree / scene.
 * Drives the right inspector content. Not persisted — the user starts a
 * fresh session with nothing selected.
 *
 * The 'edges' / 'face' / 'point-on-face' kinds are produced by the topology
 * picker (Phase 4 Split A). Each carries the part it lives on plus the
 * stable canonical-geometry id of the picked element.
 */
export type Selection =
  | { kind: "sketch"; partId: string; sketchId: string }
  | { kind: "feature"; partId: string; featureId: string }
  | { kind: "edges"; partId: string; edgeIds: string[] }
  | { kind: "face"; partId: string; faceId: string }
  | { kind: "point-on-face"; partId: string; faceId: string; uv: [number, number] }
  | null;

/**
 * Picker modes driven by the active inspector. 'idle' (the default) disables
 * the picker entirely. Phase 4 Split A populates the diagnostic test
 * inspector (Cmd/Ctrl+Shift+T); Split B will populate this from the
 * Fillet/Chamfer/Hole inspectors.
 */
export type PickingMode = "idle" | "edges" | "faces" | "point-on-face";

export type ExtrudeParams = {
  depthMm: number;
  direction: ExtrudeDirection;
};

export type RevolveParams = {
  axis: RevolveAxis;
  angleDeg: number;
};

/**
 * In-flight feature being created or edited via the right-panel inspector.
 * Lives outside `assembly` so the user can tweak parameters live (with
 * 200ms-debounced regen) and either Apply (push into `part.features`) or
 * Cancel (discard).
 *
 * Not persisted: a half-edited feature should not survive a reload.
 */
export type FeatureEditor =
  | { open: false }
  | {
      open: true;
      partId: string;
      sketchId: string;
      /** 'create' inserts a new feature on Apply; 'edit' replaces an existing one. */
      mode: "create" | "edit";
      /** Present only when mode === 'edit'. */
      featureId?: string;
      type: "extrude";
      params: ExtrudeParams;
      livePreview: boolean;
    }
  | {
      open: true;
      partId: string;
      sketchId: string;
      mode: "create" | "edit";
      featureId?: string;
      type: "revolve";
      params: RevolveParams;
      livePreview: boolean;
    };

const defaultFeatureEditor: FeatureEditor = { open: false };

/**
 * Live-preview status for the currently-open feature editor. Driven by
 * `Scene.tsx` after each debounced regen attempt, read by the inspector to
 * surface error messages in red. Not persisted.
 */
export type FeaturePreview = {
  status: "idle" | "computing" | "ok" | "error";
  /** Populated only when status === 'error'. */
  error: string | null;
};

const defaultFeaturePreview: FeaturePreview = {
  status: "idle",
  error: null,
};

const DEFAULT_EXTRUDE_PARAMS: ExtrudeParams = {
  depthMm: 10,
  direction: "forward",
};

const DEFAULT_REVOLVE_PARAMS: RevolveParams = {
  axis: "Y",
  angleDeg: 360,
};

export type KinetiCADStore = {
  mode: AppMode;
  assembly: Assembly;
  simulation: SimulationState;
  sketchSession: SketchSession;
  selection: Selection;
  featureEditor: FeatureEditor;
  featurePreview: FeaturePreview;
  /** Active picker mode (Phase 4 Split A). Not persisted. */
  pickingMode: PickingMode;
  /** Cmd/Ctrl+Shift+T diagnostic panel toggle. Not persisted. */
  showPickerTestPanel: boolean;

  setMode: (mode: AppMode) => void;
  setSimulationRunning: (running: boolean) => void;
  resetSimulation: () => void;

  beginSketch: (plane: CardinalPlane) => void;
  setSketchTool: (tool: SketchTool) => void;
  commitPrimitive: (primitive: SketchPrimitive) => void;
  finishSketch: () => void;
  cancelSketch: () => void;

  selectSketch: (partId: string, sketchId: string) => void;
  selectFeature: (partId: string, featureId: string) => void;
  /**
   * Select one or more edges on a part. With `additive=true`, edges are
   * merged into an existing 'edges' selection on the same part (toggle
   * semantics: an already-selected edge id is removed). Otherwise the
   * selection is replaced.
   */
  selectEdges: (partId: string, edgeIds: string[], additive?: boolean) => void;
  selectFace: (partId: string, faceId: string) => void;
  selectPointOnFace: (
    partId: string,
    faceId: string,
    uv: [number, number],
  ) => void;
  setPickingMode: (mode: PickingMode) => void;
  togglePickerTestPanel: () => void;
  clearSelection: () => void;

  /** Open the inspector to create a new extrude/revolve from the given sketch. */
  beginCreateFeature: (
    partId: string,
    sketchId: string,
    type: "extrude" | "revolve",
  ) => void;
  /** Open the inspector to edit an existing feature, populating from its current params. */
  beginEditFeature: (partId: string, featureId: string) => void;
  /** Replace the editor's params (caller supplies the full new params object). */
  setFeatureEditorExtrudeParams: (params: ExtrudeParams) => void;
  setFeatureEditorRevolveParams: (params: RevolveParams) => void;
  setFeatureEditorLivePreview: (on: boolean) => void;
  /** Commit the current editor state to part.features (insert or replace). */
  applyFeatureEditor: () => void;
  /** Discard the in-flight editor without touching part.features. */
  cancelFeatureEditor: () => void;

  /** Scene.tsx pushes the regen status here after each preview attempt. */
  setFeaturePreview: (next: FeaturePreview) => void;
};

const defaultAssembly: Assembly = {
  id: "default-assembly",
  name: "Assembly 1",
  parts: [],
  mates: [],
  groundPartId: "",
};

const defaultSimulation: SimulationState = {
  running: false,
  timeStepMs: 1000 / 60,
  gravity: [0, -9.81, 0],
};

/**
 * Best-effort UUID. crypto.randomUUID is widely available, but fall back to a
 * Math.random-based ID in case we're somewhere it isn't (older Safari, etc.).
 */
function newId(prefix: string): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    return `${prefix}-${c.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Look up a feature within a part by id. */
function findFeature(
  part: Part,
  featureId: string,
): Feature | undefined {
  return part.features.find((f) => f.id === featureId);
}

/** Look up a part within the assembly by id. */
function findPart(assembly: Assembly, partId: string): Part | undefined {
  return assembly.parts.find((p) => p.id === partId);
}

export const useKinetiCADStore = create<KinetiCADStore>()(
  persist(
    (set, get) => ({
      mode: "modeller",
      assembly: defaultAssembly,
      simulation: defaultSimulation,
      sketchSession: defaultSketchSession,
      selection: null,
      featureEditor: defaultFeatureEditor,
      featurePreview: defaultFeaturePreview,
      pickingMode: "idle",
      showPickerTestPanel: false,

      setMode: (mode) => set({ mode }),

      setSimulationRunning: (running) =>
        set((s) => ({ simulation: { ...s.simulation, running } })),
      resetSimulation: () =>
        set((s) => ({ simulation: { ...s.simulation, running: false } })),

      beginSketch: (plane) =>
        set({
          sketchSession: {
            active: true,
            plane,
            tool: "idle",
            committedPrimitives: [],
          },
        }),

      setSketchTool: (tool) =>
        set((s) => ({
          sketchSession: { ...s.sketchSession, tool },
        })),

      commitPrimitive: (primitive) =>
        set((s) => ({
          sketchSession: {
            ...s.sketchSession,
            committedPrimitives: [
              ...s.sketchSession.committedPrimitives,
              primitive,
            ],
          },
        })),

      finishSketch: () => {
        const state = get();
        const { sketchSession, assembly } = state;
        if (!sketchSession.active || !sketchSession.plane) return;

        // Ensure there is at least one part to attach the sketch to. We auto-
        // create "Part 1" the first time a user finishes a sketch.
        let parts: Part[] = assembly.parts;
        if (parts.length === 0) {
          parts = [
            {
              id: newId("part"),
              name: "Part 1",
              sketches: [],
              features: [],
              materialId: "default",
            },
          ];
        }

        // Append the new sketch to the first part.
        const targetPart = parts[0];
        const sketchIndex = targetPart.sketches.length + 1;
        const sketch: Sketch = {
          id: newId("sketch"),
          name: `Sketch ${sketchIndex}`,
          plane: sketchSession.plane,
          primitives: [...sketchSession.committedPrimitives],
        };
        const updatedPart: Part = {
          ...targetPart,
          sketches: [...targetPart.sketches, sketch],
        };
        const updatedParts = [updatedPart, ...parts.slice(1)];

        set({
          assembly: { ...assembly, parts: updatedParts },
          sketchSession: defaultSketchSession,
        });
      },

      cancelSketch: () => set({ sketchSession: defaultSketchSession }),

      selectSketch: (partId, sketchId) =>
        set({ selection: { kind: "sketch", partId, sketchId } }),

      selectFeature: (partId, featureId) =>
        set({ selection: { kind: "feature", partId, featureId } }),

      selectEdges: (partId, edgeIds, additive = false) =>
        set((s) => {
          if (
            additive &&
            s.selection?.kind === "edges" &&
            s.selection.partId === partId
          ) {
            // Toggle: remove if present, add if not.
            const current = new Set(s.selection.edgeIds);
            for (const id of edgeIds) {
              if (current.has(id)) current.delete(id);
              else current.add(id);
            }
            const merged = Array.from(current);
            if (merged.length === 0) return { selection: null };
            return {
              selection: { kind: "edges", partId, edgeIds: merged },
            };
          }
          return {
            selection: { kind: "edges", partId, edgeIds: [...edgeIds] },
          };
        }),

      selectFace: (partId, faceId) =>
        set({ selection: { kind: "face", partId, faceId } }),

      selectPointOnFace: (partId, faceId, uv) =>
        set({
          selection: { kind: "point-on-face", partId, faceId, uv },
        }),

      setPickingMode: (mode) => set({ pickingMode: mode }),

      togglePickerTestPanel: () =>
        set((s) => ({ showPickerTestPanel: !s.showPickerTestPanel })),

      clearSelection: () => set({ selection: null }),

      beginCreateFeature: (partId, sketchId, type) => {
        if (type === "extrude") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId,
              mode: "create",
              type: "extrude",
              params: { ...DEFAULT_EXTRUDE_PARAMS },
              livePreview: true,
            },
          });
        } else {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId,
              mode: "create",
              type: "revolve",
              params: { ...DEFAULT_REVOLVE_PARAMS },
              livePreview: true,
            },
          });
        }
      },

      beginEditFeature: (partId, featureId) => {
        const part = findPart(get().assembly, partId);
        if (!part) return;
        const feature = findFeature(part, featureId);
        if (!feature) return;

        if (feature.type === "extrude") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId: feature.sketchId,
              mode: "edit",
              featureId: feature.id,
              type: "extrude",
              params: {
                depthMm: feature.depthMm,
                direction: feature.direction,
              },
              livePreview: true,
            },
            selection: { kind: "feature", partId, featureId },
          });
        } else if (feature.type === "revolve") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId: feature.sketchId,
              mode: "edit",
              featureId: feature.id,
              type: "revolve",
              params: { axis: feature.axis, angleDeg: feature.angleDeg },
              livePreview: true,
            },
            selection: { kind: "feature", partId, featureId },
          });
        }
        // Other feature types (fillet/chamfer/hole/boolean) are deferred to
        // later phases; the editor doesn't open for them yet.
      },

      setFeatureEditorExtrudeParams: (params) =>
        set((s) => {
          if (!s.featureEditor.open || s.featureEditor.type !== "extrude") {
            return {};
          }
          return {
            featureEditor: { ...s.featureEditor, params },
          };
        }),

      setFeatureEditorRevolveParams: (params) =>
        set((s) => {
          if (!s.featureEditor.open || s.featureEditor.type !== "revolve") {
            return {};
          }
          return {
            featureEditor: { ...s.featureEditor, params },
          };
        }),

      setFeatureEditorLivePreview: (on) =>
        set((s) => {
          if (!s.featureEditor.open) return {};
          return {
            featureEditor: { ...s.featureEditor, livePreview: on },
          };
        }),

      applyFeatureEditor: () => {
        const state = get();
        const editor = state.featureEditor;
        if (!editor.open) return;

        const part = findPart(state.assembly, editor.partId);
        if (!part) {
          set({ featureEditor: defaultFeatureEditor });
          return;
        }

        let newFeature: Feature;
        if (editor.type === "extrude") {
          const base: ExtrudeFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "extrude",
            sketchId: editor.sketchId,
            depthMm: editor.params.depthMm,
            direction: editor.params.direction,
          };
          newFeature = base;
        } else {
          const base: RevolveFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "revolve",
            sketchId: editor.sketchId,
            axis: editor.params.axis,
            angleDeg: editor.params.angleDeg,
          };
          newFeature = base;
        }

        let updatedFeatures: Feature[];
        if (editor.mode === "edit" && editor.featureId) {
          updatedFeatures = part.features.map((f) =>
            f.id === editor.featureId ? newFeature : f,
          );
        } else {
          updatedFeatures = [...part.features, newFeature];
        }

        const updatedPart: Part = { ...part, features: updatedFeatures };
        const updatedParts = state.assembly.parts.map((p) =>
          p.id === editor.partId ? updatedPart : p,
        );

        set({
          assembly: { ...state.assembly, parts: updatedParts },
          featureEditor: defaultFeatureEditor,
          featurePreview: defaultFeaturePreview,
          selection: {
            kind: "feature",
            partId: editor.partId,
            featureId: newFeature.id,
          },
        });
      },

      cancelFeatureEditor: () =>
        set({
          featureEditor: defaultFeatureEditor,
          featurePreview: defaultFeaturePreview,
        }),

      setFeaturePreview: (next) => set({ featurePreview: next }),
    }),
    {
      name: "kineticad-state",
      version: 2,
      // Don't persist the active sketch session, in-flight feature editor,
      // selection, or live simulation flags.
      partialize: (state) => ({
        mode: state.mode,
        assembly: state.assembly,
        simulation: {
          ...state.simulation,
          running: false,
        },
      }),
      // v1 → v2: legacy extrude features stored `symmetric: boolean`. Map
      // to the new `direction` field so old persisted state still loads.
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const state = persisted as { assembly?: Assembly };
        if (version < 2 && state.assembly) {
          const migratedParts = state.assembly.parts.map((part) => ({
            ...part,
            features: part.features.map((f) => {
              if (f.type !== "extrude") return f;
              const legacy = f as ExtrudeFeature & { symmetric?: boolean };
              if (legacy.direction) return f;
              const direction: ExtrudeDirection = legacy.symmetric
                ? "symmetric"
                : "forward";
              return {
                id: legacy.id,
                type: "extrude" as const,
                sketchId: legacy.sketchId,
                depthMm: legacy.depthMm,
                direction,
              };
            }),
          }));
          state.assembly = { ...state.assembly, parts: migratedParts };
        }
        return state;
      },
    },
  ),
);
