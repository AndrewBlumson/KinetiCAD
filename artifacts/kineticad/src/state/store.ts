import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Assembly,
  BooleanFeature,
  BooleanOperation,
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
 * picker (Phase 4 Split A). The 'part' kind is produced by clicking the
 * part name in the tree (Phase 4 Split B) and surfaces the PartInspector
 * which exposes "+ Add Fillet/Chamfer/Hole" buttons.
 */
export type Selection =
  | { kind: "part"; partId: string }
  | { kind: "sketch"; partId: string; sketchId: string }
  | { kind: "feature"; partId: string; featureId: string }
  | { kind: "edges"; partId: string; edgeIds: string[] }
  | { kind: "face"; partId: string; faceId: string }
  | { kind: "point-on-face"; partId: string; faceId: string; uv: [number, number] }
  /** Phase 5: a boolean feature on the assembly. */
  | { kind: "boolean"; booleanId: string }
  | null;

/**
 * Picker modes driven by the active inspector. 'idle' (the default) disables
 * the picker entirely. The Fillet/Chamfer inspectors set 'edges'; the Hole
 * inspector sets 'point-on-face' (the picker handles both face-pick and
 * subsequent UV-pick stages internally).
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

export type FilletParams = {
  /** Stable canonical-geometry edge ids on the upstream shape. */
  targetEdges: string[];
  radiusMm: number;
};

export type ChamferParams = {
  targetEdges: string[];
  sizeMm: number;
};

export type HoleParams = {
  /** Stable canonical-geometry face id on the upstream shape (planar only). */
  targetFace: string | null;
  /** UV coordinates in mm in the face's plane basis. Null until the user picks. */
  positionUV: [number, number] | null;
  diameterMm: number;
  /** 0 = through-all. */
  depthMm: number;
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
    }
  | {
      open: true;
      partId: string;
      /** Modifier features have no source sketch; field is empty for shape parity. */
      sketchId: "";
      mode: "create" | "edit";
      featureId?: string;
      type: "fillet";
      params: FilletParams;
      livePreview: boolean;
    }
  | {
      open: true;
      partId: string;
      sketchId: "";
      mode: "create" | "edit";
      featureId?: string;
      type: "chamfer";
      params: ChamferParams;
      livePreview: boolean;
    }
  | {
      open: true;
      partId: string;
      sketchId: "";
      mode: "create" | "edit";
      featureId?: string;
      type: "hole";
      params: HoleParams;
      livePreview: boolean;
    };

const defaultFeatureEditor: FeatureEditor = { open: false };

/**
 * Phase 5 — in-flight boolean editor. Lives outside `assembly` so the user
 * can tweak parameters live (with debounced regen) and either Apply (push
 * into `assembly.booleanFeatures`) or Cancel (discard).
 *
 * `operation` carries Subtract's tool-part id directly (matches the
 * persisted BooleanOperation shape). `inputPartIds` is the user-picked
 * order; the orchestrator re-orders to `[body, tool]` for Subtract before
 * calling the worker.
 *
 * Not persisted: a half-edited boolean should not survive a reload.
 */
export type BooleanEditorParams = {
  operation: BooleanOperation;
  inputPartIds: string[];
  resultPartName: string;
  hideInputs: boolean;
};

export type BooleanEditor =
  | { open: false }
  | {
      open: true;
      mode: "create" | "edit";
      /** Present only when mode === 'edit'. */
      featureId?: string;
      params: BooleanEditorParams;
      livePreview: boolean;
    };

const defaultBooleanEditor: BooleanEditor = { open: false };

const DEFAULT_BOOLEAN_PARAMS: BooleanEditorParams = {
  operation: { type: "union" },
  inputPartIds: [],
  resultPartName: "",
  hideInputs: true,
};

/**
 * Live-preview status for the currently-open feature editor. Driven by
 * `Scene.tsx` after each debounced regen attempt, read by the inspector to
 * surface error messages in red. Not persisted.
 */
export type FeaturePreview = {
  status: "idle" | "computing" | "ok" | "error";
  /** Populated only when status === 'error'. User-facing friendly copy. */
  error: string | null;
  /**
   * Raw OCCT / kernel exception text + stack (when available). Surfaced
   * in the inspector under a "Technical details" disclosure so QA can see
   * exactly what the kernel reported when the friendly copy is too vague.
   * Populated only when status === 'error'.
   */
  details: string | null;
};

const defaultFeaturePreview: FeaturePreview = {
  status: "idle",
  error: null,
  details: null,
};

const DEFAULT_EXTRUDE_PARAMS: ExtrudeParams = {
  depthMm: 10,
  direction: "forward",
};

const DEFAULT_REVOLVE_PARAMS: RevolveParams = {
  axis: "Y",
  angleDeg: 360,
};

const DEFAULT_FILLET_PARAMS: FilletParams = {
  targetEdges: [],
  radiusMm: 1,
};

const DEFAULT_CHAMFER_PARAMS: ChamferParams = {
  targetEdges: [],
  sizeMm: 1,
};

const DEFAULT_HOLE_PARAMS: HoleParams = {
  targetFace: null,
  positionUV: null,
  diameterMm: 5,
  depthMm: 0, // 0 = through-all
};

export type KinetiCADStore = {
  mode: AppMode;
  assembly: Assembly;
  simulation: SimulationState;
  sketchSession: SketchSession;
  selection: Selection;
  featureEditor: FeatureEditor;
  /** Phase 5 boolean editor (separate slice from featureEditor). */
  booleanEditor: BooleanEditor;
  featurePreview: FeaturePreview;
  /** Active picker mode. Not persisted. */
  pickingMode: PickingMode;

  setMode: (mode: AppMode) => void;
  setSimulationRunning: (running: boolean) => void;
  resetSimulation: () => void;

  beginSketch: (plane: CardinalPlane) => void;
  setSketchTool: (tool: SketchTool) => void;
  commitPrimitive: (primitive: SketchPrimitive) => void;
  finishSketch: () => void;
  cancelSketch: () => void;

  selectPart: (partId: string) => void;
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
  clearSelection: () => void;

  /** Open the inspector to create a new extrude/revolve from the given sketch. */
  beginCreateFeature: (
    partId: string,
    sketchId: string,
    type: "extrude" | "revolve",
  ) => void;
  /** Open the inspector to create a new fillet on the given part. */
  beginCreateFilletFeature: (partId: string) => void;
  /** Open the inspector to create a new chamfer on the given part. */
  beginCreateChamferFeature: (partId: string) => void;
  /** Open the inspector to create a new hole on the given part. */
  beginCreateHoleFeature: (partId: string) => void;
  /** Open the inspector to edit an existing feature, populating from its current params. */
  beginEditFeature: (partId: string, featureId: string) => void;
  /** Replace the editor's params (caller supplies the full new params object). */
  setFeatureEditorExtrudeParams: (params: ExtrudeParams) => void;
  setFeatureEditorRevolveParams: (params: RevolveParams) => void;
  setFeatureEditorFilletParams: (params: FilletParams) => void;
  setFeatureEditorChamferParams: (params: ChamferParams) => void;
  setFeatureEditorHoleParams: (params: HoleParams) => void;
  setFeatureEditorLivePreview: (on: boolean) => void;
  /** Commit the current editor state to part.features (insert or replace). */
  applyFeatureEditor: () => void;
  /** Discard the in-flight editor without touching part.features. */
  cancelFeatureEditor: () => void;

  /** Scene.tsx pushes the regen status here after each preview attempt. */
  setFeaturePreview: (next: FeaturePreview) => void;

  // ---- Phase 5: boolean selection / editor / cascade delete ----
  /** Select a boolean feature (drives the right inspector). */
  selectBoolean: (booleanId: string) => void;
  /**
   * Open the inspector to create a new boolean of the given operation
   * type. Pre-fills `inputPartIds` with empty, picks a unique default
   * `resultPartName` like "Union 1".
   */
  beginCreateBoolean: (op: BooleanOperation["type"]) => void;
  /** Open the inspector to edit an existing boolean, populating from current params. */
  beginEditBoolean: (booleanId: string) => void;
  /** Replace the editor's params (caller supplies the full new params object). */
  setBooleanEditorParams: (params: BooleanEditorParams) => void;
  setBooleanEditorLivePreview: (on: boolean) => void;
  /** Commit the current editor state to assembly.booleanFeatures (insert or replace). */
  applyBooleanEditor: () => void;
  /** Discard the in-flight boolean editor without touching assembly.booleanFeatures. */
  cancelBooleanEditor: () => void;
  /** Delete a boolean feature outright. */
  deleteBooleanFeature: (booleanId: string) => void;
  /**
   * Delete a part AND every boolean that uses it. Caller is expected to
   * confirm with the user first via the cascade-delete dialog.
   */
  deletePartCascade: (partId: string) => void;
  /** Returns the booleans that include the given part as an input. */
  getBooleansUsingPart: (partId: string) => BooleanFeature[];
};

const defaultAssembly: Assembly = {
  id: "default-assembly",
  name: "Assembly 1",
  parts: [],
  mates: [],
  groundPartId: "",
  booleanFeatures: [],
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
      booleanEditor: defaultBooleanEditor,
      featurePreview: defaultFeaturePreview,
      pickingMode: "idle",

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

      selectPart: (partId) =>
        set({ selection: { kind: "part", partId } }),

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

      beginCreateFilletFeature: (partId) =>
        set({
          featureEditor: {
            open: true,
            partId,
            sketchId: "",
            mode: "create",
            type: "fillet",
            params: { ...DEFAULT_FILLET_PARAMS, targetEdges: [] },
            livePreview: true,
          },
          // Picker switches to edge-pick mode while the inspector is open.
          pickingMode: "edges",
          selection: null,
        }),

      beginCreateChamferFeature: (partId) =>
        set({
          featureEditor: {
            open: true,
            partId,
            sketchId: "",
            mode: "create",
            type: "chamfer",
            params: { ...DEFAULT_CHAMFER_PARAMS, targetEdges: [] },
            livePreview: true,
          },
          pickingMode: "edges",
          selection: null,
        }),

      beginCreateHoleFeature: (partId) =>
        set({
          featureEditor: {
            open: true,
            partId,
            sketchId: "",
            mode: "create",
            type: "hole",
            params: { ...DEFAULT_HOLE_PARAMS },
            livePreview: true,
          },
          // The hole inspector handles both stages of pick (face → UV)
          // through the 'point-on-face' picker mode.
          pickingMode: "point-on-face",
          selection: null,
        }),

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
        } else if (feature.type === "fillet") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId: "",
              mode: "edit",
              featureId: feature.id,
              type: "fillet",
              params: {
                targetEdges: [...feature.targetEdges],
                radiusMm: feature.radiusMm,
              },
              livePreview: true,
            },
            pickingMode: "edges",
            selection: { kind: "feature", partId, featureId },
          });
        } else if (feature.type === "chamfer") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId: "",
              mode: "edit",
              featureId: feature.id,
              type: "chamfer",
              params: {
                targetEdges: [...feature.targetEdges],
                sizeMm: feature.sizeMm,
              },
              livePreview: true,
            },
            pickingMode: "edges",
            selection: { kind: "feature", partId, featureId },
          });
        } else if (feature.type === "hole") {
          set({
            featureEditor: {
              open: true,
              partId,
              sketchId: "",
              mode: "edit",
              featureId: feature.id,
              type: "hole",
              params: {
                targetFace: feature.targetFace,
                positionUV: [...feature.positionUV] as [number, number],
                diameterMm: feature.diameterMm,
                depthMm: feature.depthMm,
              },
              livePreview: true,
            },
            pickingMode: "point-on-face",
            selection: { kind: "feature", partId, featureId },
          });
        }
        // (Booleans use beginEditBoolean — they live on the assembly, not on a part.)
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

      setFeatureEditorFilletParams: (params) =>
        set((s) => {
          if (!s.featureEditor.open || s.featureEditor.type !== "fillet") {
            return {};
          }
          return {
            featureEditor: { ...s.featureEditor, params },
          };
        }),

      setFeatureEditorChamferParams: (params) =>
        set((s) => {
          if (!s.featureEditor.open || s.featureEditor.type !== "chamfer") {
            return {};
          }
          return {
            featureEditor: { ...s.featureEditor, params },
          };
        }),

      setFeatureEditorHoleParams: (params) =>
        set((s) => {
          if (!s.featureEditor.open || s.featureEditor.type !== "hole") {
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
          set({
            featureEditor: defaultFeatureEditor,
            featurePreview: defaultFeaturePreview,
            pickingMode: "idle",
          });
          return;
        }

        let newFeature: Feature | null = null;
        if (editor.type === "extrude") {
          const base: ExtrudeFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "extrude",
            sketchId: editor.sketchId,
            depthMm: editor.params.depthMm,
            direction: editor.params.direction,
          };
          newFeature = base;
        } else if (editor.type === "revolve") {
          const base: RevolveFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "revolve",
            sketchId: editor.sketchId,
            axis: editor.params.axis,
            angleDeg: editor.params.angleDeg,
          };
          newFeature = base;
        } else if (editor.type === "fillet") {
          if (editor.params.targetEdges.length === 0) return;
          newFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "fillet",
            targetEdges: [...editor.params.targetEdges],
            radiusMm: editor.params.radiusMm,
          };
        } else if (editor.type === "chamfer") {
          if (editor.params.targetEdges.length === 0) return;
          newFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "chamfer",
            targetEdges: [...editor.params.targetEdges],
            sizeMm: editor.params.sizeMm,
          };
        } else if (editor.type === "hole") {
          if (!editor.params.targetFace || !editor.params.positionUV) return;
          newFeature = {
            id: editor.featureId ?? newId("feature"),
            type: "hole",
            targetFace: editor.params.targetFace,
            positionUV: [...editor.params.positionUV] as [number, number],
            diameterMm: editor.params.diameterMm,
            depthMm: editor.params.depthMm,
          };
        }
        if (!newFeature) return;

        let updatedFeatures: Feature[];
        if (editor.mode === "edit" && editor.featureId) {
          updatedFeatures = part.features.map((f) =>
            f.id === editor.featureId ? (newFeature as Feature) : f,
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
          pickingMode: "idle",
          // After Apply, fall back to the part-level selection. The previous
          // behaviour selected the feature itself which routed the inspector
          // to a "this feature type isn't editable yet" stub for modifier
          // features. Selecting the part instead surfaces the PartInspector
          // (with its "+ Add" buttons and Delete) which is what the user
          // typically wants next.
          selection: { kind: "part", partId: editor.partId },
        });
      },

      cancelFeatureEditor: () =>
        set({
          featureEditor: defaultFeatureEditor,
          featurePreview: defaultFeaturePreview,
          pickingMode: "idle",
        }),

      setFeaturePreview: (next) => set({ featurePreview: next }),

      // ---- Phase 5: boolean selection / editor / cascade delete ----

      selectBoolean: (booleanId) =>
        set({ selection: { kind: "boolean", booleanId } }),

      beginCreateBoolean: (op) => {
        const state = get();
        // Pick a unique default name like "Union 1", "Subtract 2", etc.
        const base =
          op === "union"
            ? "Union"
            : op === "subtract"
            ? "Subtract"
            : "Intersect";
        const existing = new Set(
          state.assembly.booleanFeatures.map((b) => b.resultPartName),
        );
        let i = 1;
        while (existing.has(`${base} ${i}`)) i++;
        const name = `${base} ${i}`;

        const operation: BooleanOperation =
          op === "subtract"
            ? { type: "subtract", toolPartId: "" }
            : op === "intersect"
            ? { type: "intersect" }
            : { type: "union" };

        set({
          booleanEditor: {
            open: true,
            mode: "create",
            params: {
              ...DEFAULT_BOOLEAN_PARAMS,
              operation,
              inputPartIds: [],
              resultPartName: name,
            },
            livePreview: true,
          },
          // Booleans don't use the topology picker; clear any stale state.
          pickingMode: "idle",
          selection: null,
          // A separate editor is mutually exclusive with featureEditor.
          featureEditor: defaultFeatureEditor,
        });
      },

      beginEditBoolean: (booleanId) => {
        const state = get();
        const feature = state.assembly.booleanFeatures.find(
          (b) => b.id === booleanId,
        );
        if (!feature) return;
        set({
          booleanEditor: {
            open: true,
            mode: "edit",
            featureId: feature.id,
            params: {
              operation: feature.operation,
              inputPartIds: [...feature.inputPartIds],
              resultPartName: feature.resultPartName,
              hideInputs: feature.hideInputs,
            },
            livePreview: true,
          },
          selection: { kind: "boolean", booleanId },
          pickingMode: "idle",
          featureEditor: defaultFeatureEditor,
        });
      },

      setBooleanEditorParams: (params) =>
        set((s) => {
          if (!s.booleanEditor.open) return {};
          return {
            booleanEditor: { ...s.booleanEditor, params },
          };
        }),

      setBooleanEditorLivePreview: (on) =>
        set((s) => {
          if (!s.booleanEditor.open) return {};
          return {
            booleanEditor: { ...s.booleanEditor, livePreview: on },
          };
        }),

      applyBooleanEditor: () => {
        const state = get();
        const editor = state.booleanEditor;
        if (!editor.open) return;
        const { params } = editor;

        // Validation: ≥2 inputs, ≤8 inputs, unique non-empty name,
        // Subtract requires exactly 2 inputs and a tool that's in the list.
        if (params.inputPartIds.length < 2 || params.inputPartIds.length > 8) {
          return;
        }
        const trimmed = params.resultPartName.trim();
        if (!trimmed) return;

        // Name must be unique (excluding self when editing).
        const nameClash = state.assembly.booleanFeatures.some(
          (b) => b.resultPartName === trimmed && b.id !== editor.featureId,
        );
        if (nameClash) return;

        if (params.operation.type === "subtract") {
          if (params.inputPartIds.length !== 2) return;
          if (!params.operation.toolPartId) return;
          if (!params.inputPartIds.includes(params.operation.toolPartId)) {
            return;
          }
        }

        const newFeature: BooleanFeature = {
          id: editor.featureId ?? newId("boolean"),
          type: "boolean",
          operation: params.operation,
          inputPartIds: [...params.inputPartIds],
          resultPartName: trimmed,
          hideInputs: params.hideInputs,
        };

        let updatedBooleans: BooleanFeature[];
        if (editor.mode === "edit" && editor.featureId) {
          updatedBooleans = state.assembly.booleanFeatures.map((b) =>
            b.id === editor.featureId ? newFeature : b,
          );
        } else {
          updatedBooleans = [...state.assembly.booleanFeatures, newFeature];
        }

        set({
          assembly: { ...state.assembly, booleanFeatures: updatedBooleans },
          booleanEditor: defaultBooleanEditor,
          featurePreview: defaultFeaturePreview,
          selection: { kind: "boolean", booleanId: newFeature.id },
        });
      },

      cancelBooleanEditor: () =>
        set({
          booleanEditor: defaultBooleanEditor,
          featurePreview: defaultFeaturePreview,
        }),

      deleteBooleanFeature: (booleanId) =>
        set((s) => {
          const next = s.assembly.booleanFeatures.filter(
            (b) => b.id !== booleanId,
          );
          if (next.length === s.assembly.booleanFeatures.length) return {};
          return {
            assembly: { ...s.assembly, booleanFeatures: next },
            booleanEditor:
              s.booleanEditor.open && s.booleanEditor.featureId === booleanId
                ? defaultBooleanEditor
                : s.booleanEditor,
            selection:
              s.selection?.kind === "boolean" &&
              s.selection.booleanId === booleanId
                ? null
                : s.selection,
          };
        }),

      deletePartCascade: (partId) =>
        set((s) => {
          const remainingParts = s.assembly.parts.filter(
            (p) => p.id !== partId,
          );
          // Remove every boolean that references the deleted part.
          const remainingBooleans = s.assembly.booleanFeatures.filter(
            (b) => !b.inputPartIds.includes(partId),
          );
          const removedBooleanIds = new Set(
            s.assembly.booleanFeatures
              .filter((b) => b.inputPartIds.includes(partId))
              .map((b) => b.id),
          );
          // Reset ground if it pointed to the deleted part.
          const groundPartId =
            s.assembly.groundPartId === partId ? "" : s.assembly.groundPartId;
          // Drop any selection / editor that targeted the deleted part or a
          // cascade-deleted boolean.
          const sel = s.selection;
          let selection: Selection = sel;
          if (sel) {
            if ("partId" in sel && sel.partId === partId) selection = null;
            else if (sel.kind === "boolean" && removedBooleanIds.has(sel.booleanId)) {
              selection = null;
            }
          }
          const featureEditor =
            s.featureEditor.open && s.featureEditor.partId === partId
              ? defaultFeatureEditor
              : s.featureEditor;
          const booleanEditor =
            s.booleanEditor.open &&
            s.booleanEditor.featureId &&
            removedBooleanIds.has(s.booleanEditor.featureId)
              ? defaultBooleanEditor
              : s.booleanEditor;
          return {
            assembly: {
              ...s.assembly,
              parts: remainingParts,
              booleanFeatures: remainingBooleans,
              groundPartId,
            },
            selection,
            featureEditor,
            booleanEditor,
            featurePreview: defaultFeaturePreview,
          };
        }),

      getBooleansUsingPart: (partId) =>
        get().assembly.booleanFeatures.filter((b) =>
          b.inputPartIds.includes(partId),
        ),
    }),
    {
      name: "kineticad-state",
      version: 4,
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
      // v2 → v3: HoleFeature renamed `positionXY` → `positionUV`. Phase 4
      // Split A never created hole features, but we still re-key safely if
      // any stray data exists.
      // v3 → v4: Phase 5 booleans. Add `booleanFeatures: []` to the
      // assembly and strip any legacy per-part `boolean` Feature stubs
      // (booleans are now assembly-level).
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
        if (version < 3 && state.assembly) {
          const migratedParts = state.assembly.parts.map((part) => ({
            ...part,
            features: part.features.map((f) => {
              if (f.type !== "hole") return f;
              const legacy = f as Feature & { positionXY?: [number, number] };
              if ((legacy as { positionUV?: [number, number] }).positionUV)
                return f;
              if (!legacy.positionXY) return f;
              return {
                ...(f as object),
                positionUV: legacy.positionXY,
              } as Feature;
            }),
          }));
          state.assembly = { ...state.assembly, parts: migratedParts };
        }
        if (version < 4 && state.assembly) {
          const a = state.assembly as Assembly & {
            booleanFeatures?: unknown;
          };
          // Strip any legacy per-part `boolean` stubs (Phase 5 moves
          // booleans to the assembly level).
          const migratedParts = a.parts.map((part) => ({
            ...part,
            features: part.features.filter(
              (f) => (f as { type: string }).type !== "boolean",
            ),
          }));
          state.assembly = {
            ...a,
            parts: migratedParts,
            booleanFeatures: Array.isArray(a.booleanFeatures)
              ? (a.booleanFeatures as Assembly["booleanFeatures"])
              : [],
          };
        }
        // Defensive: ensure `booleanFeatures` is always an array regardless of
        // the recorded version. Catches partially-migrated v4 states left
        // behind by an interrupted in-session upgrade (e.g. the persist
        // version was bumped before the field was added in the same dev
        // session, leaving a v4 row without the new field).
        if (
          state.assembly &&
          !Array.isArray(
            (state.assembly as { booleanFeatures?: unknown }).booleanFeatures,
          )
        ) {
          state.assembly = {
            ...state.assembly,
            booleanFeatures: [],
          };
        }
        return state;
      },
    },
  ),
);
