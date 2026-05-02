import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Assembly,
  BooleanFeature,
  BooleanOperation,
  ExtrudeDirection,
  ExtrudeFeature,
  Feature,
  FixedMate,
  Mate,
  MatePivot,
  Part,
  PlanarMate,
  PlanarPivot,
  PrismaticMate,
  RevoluteMate,
  RevolveAxis,
  RevolveFeature,
  SimulationState,
  SphericalMate,
  AppMode,
  Sketch,
  SketchPrimitive,
  Transform,
} from "./schemas";
import type { CardinalPlane } from "@/sketch/plane";
import type { EdgeType, FaceType } from "@/cad/types";

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

function arrEq<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

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
  /** Phase 7: a mate joint on the assembly. */
  | { kind: "mate"; mateId: string }
  | null;

/**
 * Picker modes driven by the active inspector. 'idle' (the default) disables
 * the picker entirely. The Fillet/Chamfer inspectors set 'edges'; the Hole
 * inspector sets 'point-on-face' (the picker handles both face-pick and
 * subsequent UV-pick stages internally).
 */
export type PickingMode = "idle" | "edges" | "faces" | "point-on-face";

/**
 * Phase 9.5 — picker geometry filter. When set, the topology picker only
 * hovers / clicks geometry whose `type` is in the corresponding allowlist.
 * Driven by the active mate inspector (e.g. Revolute → circular edges).
 *
 * Without this, mouseup-jitter on a cylinder could pick a side seam
 * (line edge) right next to the circular top edge that hover highlighted,
 * and the inspector would reject the click as "non-circular" — visible to
 * the user as "click does nothing, banner appears".
 */
export type PickFilter = {
  edgeTypes?: EdgeType[];
  faceTypes?: FaceType[];
};

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
 * Phase 7 — in-flight mate editor. Lives outside `assembly` so the user can
 * pick pivots step-by-step (stage 'pick-a' → 'pick-b' → 'ready') and either
 * Apply (push into `assembly.mates`) or Cancel (discard).
 *
 * `params` carries every field every mate type might need — the per-type
 * inspectors only read the fields that apply. The validator+geometry
 * helpers in `three/MatePickerCoordinator.ts` derive `axisLocal` from the
 * picked geometry before Apply.
 *
 * Not persisted: a half-edited mate should not survive a reload.
 */
export type MateType = Mate["type"];

export type MateEditorStage = "pick-a" | "pick-b" | "ready";

export type MateEditorParams = {
  type: MateType;
  partA: string | null;
  partB: string | null;
  pivotA: MatePivot | PlanarPivot | null;
  pivotB: MatePivot | PlanarPivot | null;
  /** Unit vector in partA's local frame; populated once both pivots picked. */
  axisLocal: [number, number, number] | null;
  /** Optional display name; falls back to "<Type> N" on Apply. */
  name: string;
  // Motor params (revolute/prismatic only — stored only, Phase 9 wires Rapier).
  motorSpeedRpm: number | null;
  motorTorqueNm: number | null;
  motorForceN: number | null;
  motorVelocityMmPerSec: number | null;
};

export type MateEditor =
  | { open: false }
  | {
      open: true;
      mode: "create" | "edit";
      /** Present only when mode === 'edit'. */
      mateId?: string;
      stage: MateEditorStage;
      params: MateEditorParams;
      error: string | null;
    };

const defaultMateEditor: MateEditor = { open: false };

function defaultMateEditorParams(type: MateType): MateEditorParams {
  return {
    type,
    partA: null,
    partB: null,
    pivotA: null,
    pivotB: null,
    axisLocal: null,
    name: "",
    motorSpeedRpm: null,
    motorTorqueNm: null,
    motorForceN: null,
    motorVelocityMmPerSec: null,
  };
}

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
  /** Phase 7 mate editor (separate slice from feature/boolean editors). */
  mateEditor: MateEditor;
  featurePreview: FeaturePreview;
  /** Active picker mode. Not persisted. */
  pickingMode: PickingMode;
  /** Phase 9.5 picker filter. `null` = no filter (default). */
  pickFilter: PickFilter | null;

  setMode: (mode: AppMode) => void;
  /**
   * Phase 8 — simulation lifecycle. Run/pause/reset are mutually
   * exclusive transitions:
   *  - setSimulationRunning(true): begin or resume; clears `paused`
   *  - setSimulationRunning(false): stop; clears `paused` and zeroes
   *    `simulationTimeMs`
   *  - setSimulationPaused(true): freeze mid-step; `running` stays
   *    true so the world is kept built; resume via paused=false
   *  - resetSimulation(): same shape as stop — `running=false`,
   *    `paused=false`, `simulationTimeMs=0`
   */
  setSimulationRunning: (running: boolean) => void;
  setSimulationPaused: (paused: boolean) => void;
  /** 0.25 / 0.5 / 1 / 2. Clamped to those values via the inspector UI. */
  setSimulationSpeed: (multiplier: number) => void;
  setSimulationGravity: (gravity: [number, number, number]) => void;
  /** Per-frame accumulator update from the simulation runner. */
  tickSimulationTime: (deltaMs: number) => void;
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
  setPickFilter: (filter: PickFilter | null) => void;
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

  // ---- Phase 6: part-level CRUD + transform + visibility ----
  /** Create an empty part with a unique default name and select it. Returns the new part id. */
  createPart: () => string;
  /** Rename a part. No-op if the trimmed name is empty or the part doesn't exist. */
  renamePart: (partId: string, name: string) => void;
  /**
   * Deep-copy a part (sketches + features get fresh ids; transform copied with
   * a +30mm X-offset so the duplicate doesn't z-fight with its source).
   * Returns the new part id, or null if the source part doesn't exist.
   */
  duplicatePart: (partId: string) => string | null;
  /** Toggle a part's visibility flag. */
  setPartVisible: (partId: string, visible: boolean) => void;
  /** Replace a part's transform outright. */
  setPartTransform: (partId: string, transform: Transform) => void;
  /**
   * Patch a part's transform with optional position / rotation overrides.
   * Used by the gizmo (rAF-throttled) and the PartInspector NumericInputs.
   */
  setPartTransformPartial: (
    partId: string,
    patch: { positionMm?: [number, number, number]; rotationDeg?: [number, number, number] },
  ) => void;
  /** Reset a part's transform back to identity (zero position + zero rotation). */
  resetPartTransform: (partId: string) => void;

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

  // ---- Phase 7: mates + ground anchor ----
  /** Select a mate joint (drives the right inspector). */
  selectMate: (mateId: string) => void;
  /** Open the inspector to create a new mate of the given type. */
  beginCreateMate: (type: MateType) => void;
  /** Open the inspector to edit an existing mate, populating from current values. */
  beginEditMate: (mateId: string) => void;
  /** Replace the editor's params (caller supplies the full new params object). */
  setMateEditorParams: (params: MateEditorParams) => void;
  /** Advance the editor stage (pick-a → pick-b → ready). */
  setMateEditorStage: (stage: MateEditorStage) => void;
  /** Surface a validation error inline. Pass null to clear. */
  setMateEditorError: (err: string | null) => void;
  /** Commit the current editor state to `assembly.mates` (insert or replace). */
  applyMateEditor: () => void;
  /** Discard the in-flight mate editor without touching `assembly.mates`. */
  cancelMateEditor: () => void;
  /** Append a fully-formed mate (used by Apply; exposed for tests). */
  addMate: (mate: Mate) => void;
  /** Delete a mate outright. */
  removeMate: (mateId: string) => void;
  /** Rename a mate. No-op if the trimmed name is empty or the mate doesn't exist. */
  renameMate: (mateId: string, name: string) => void;
  /** Replace a mate with a patched copy (caller supplies the same `type`). */
  updateMate: (mateId: string, patch: Partial<Mate>) => void;
  /** Designate the ground anchor part. Pass `""` to fall back to first part. */
  setGroundPart: (partId: string) => void;
  /** Returns the mates that reference the given part on either side. */
  getMatesUsingPart: (partId: string) => Mate[];
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
  paused: false,
  timeStepMs: 1000 / 60,
  // Z-up world; gravity in mm/s² (= 9.81 m/s²) so that distances
  // measured in millimetres fall at the right rate. A 1-second drop
  // covers ~4905 mm.
  gravity: [0, 0, -9810],
  speedMultiplier: 1,
  simulationTimeMs: 0,
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

/**
 * Phase 8 — does the given value look like a fully-populated v7
 * SimulationState? Used by the v6→v7 migration to detect both
 * pre-v7 shapes (missing `paused` / `speedMultiplier` / `simulationTimeMs`)
 * and partially-migrated v7 shapes left over from interrupted dev sessions.
 */
function isFullSimulation(s: unknown): s is SimulationState {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.running === "boolean" &&
    typeof o.paused === "boolean" &&
    typeof o.timeStepMs === "number" &&
    Array.isArray(o.gravity) &&
    o.gravity.length === 3 &&
    o.gravity.every((g) => typeof g === "number") &&
    typeof o.speedMultiplier === "number" &&
    typeof o.simulationTimeMs === "number"
  );
}

/**
 * Phase 8 — gravity sanity check during migration. The Phase 6 default
 * was `[0, -9.81, 0]` (m/s², Y-up). The Phase 8 default is
 * `[0, 0, -9810]` (mm/s², Z-up). If the persisted gravity has any axis
 * larger than ~50 in magnitude we treat it as already mm-scaled and
 * keep it; otherwise we throw it out so the new mm-units default takes
 * over (any valid mm/s² gravity is at least ~50 mm/s² in magnitude on
 * one axis).
 */
function isMmGravity(g: unknown): boolean {
  if (!Array.isArray(g) || g.length !== 3) return false;
  for (const v of g) {
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  const max = Math.max(Math.abs(g[0]), Math.abs(g[1]), Math.abs(g[2]));
  return max >= 50;
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
      mateEditor: defaultMateEditor,
      featurePreview: defaultFeaturePreview,
      pickingMode: "idle",
      pickFilter: null,

      setMode: (mode) => set({ mode }),

      setSimulationRunning: (running) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            running,
            // Stopping always clears paused + elapsed; starting clears
            // paused so a stale pause flag doesn't freeze the new run.
            paused: false,
            simulationTimeMs: running ? s.simulation.simulationTimeMs : 0,
          },
        })),
      setSimulationPaused: (paused) =>
        set((s) => ({ simulation: { ...s.simulation, paused } })),
      setSimulationSpeed: (multiplier) =>
        set((s) => ({
          simulation: { ...s.simulation, speedMultiplier: multiplier },
        })),
      setSimulationGravity: (gravity) =>
        set((s) => ({ simulation: { ...s.simulation, gravity } })),
      tickSimulationTime: (deltaMs) =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            simulationTimeMs: s.simulation.simulationTimeMs + deltaMs,
          },
        })),
      resetSimulation: () =>
        set((s) => ({
          simulation: {
            ...s.simulation,
            running: false,
            paused: false,
            simulationTimeMs: 0,
          },
        })),

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
        const { sketchSession, assembly, selection } = state;
        if (!sketchSession.active || !sketchSession.plane) return;

        // Phase 6: pick the part the new sketch should land on.
        //   1. If the user selected a part, use that one.
        //   2. Otherwise fall back to the first existing part.
        //   3. If there are no parts at all, auto-create "Part 1".
        let parts: Part[] = assembly.parts;
        let targetPartId: string | null = null;
        if (
          selection?.kind === "part" &&
          parts.some((p) => p.id === selection.partId)
        ) {
          targetPartId = selection.partId;
        } else if (parts.length > 0) {
          targetPartId = parts[0].id;
        } else {
          const auto: Part = {
            id: newId("part"),
            name: "Part 1",
            visible: true,
            transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
            sketches: [],
            features: [],
            materialId: "default",
          };
          parts = [auto];
          targetPartId = auto.id;
        }

        const targetIndex = parts.findIndex((p) => p.id === targetPartId);
        const targetPart = parts[targetIndex];
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
        const updatedParts = parts.map((p, i) =>
          i === targetIndex ? updatedPart : p,
        );

        set({
          assembly: { ...assembly, parts: updatedParts },
          sketchSession: defaultSketchSession,
          // Promote the selection to the target part so subsequent
          // "+ Add Feature" actions and the next sketch land on the same one.
          selection: { kind: "part", partId: updatedPart.id },
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

      setPickFilter: (filter) =>
        set((s) => {
          // Equality guard so an effect that re-emits the same filter object
          // doesn't churn subscribers.
          const cur = s.pickFilter;
          if (cur === filter) return {};
          if (
            cur &&
            filter &&
            arrEq(cur.edgeTypes, filter.edgeTypes) &&
            arrEq(cur.faceTypes, filter.faceTypes)
          ) {
            return {};
          }
          return { pickFilter: filter };
        }),

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

      // ---- Phase 6: part-level CRUD + transform + visibility ----

      createPart: () => {
        const state = get();
        const existing = new Set(state.assembly.parts.map((p) => p.name));
        let n = state.assembly.parts.length + 1;
        let name = `Part ${n}`;
        while (existing.has(name)) {
          n++;
          name = `Part ${n}`;
        }
        const part: Part = {
          id: newId("part"),
          name,
          visible: true,
          transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
          sketches: [],
          features: [],
          materialId: "default",
        };
        // Phase 9.5 — auto-promote the first part to ground so the
        // persisted `groundPartId` is always populated. Previously the
        // UI relied on a `parts[0]` fallback for display, but that
        // fallback was never written back to the store, so reloads (or
        // re-orderings) silently moved the ground anchor.
        const groundPartId =
          state.assembly.groundPartId === ""
            ? part.id
            : state.assembly.groundPartId;
        set({
          assembly: {
            ...state.assembly,
            parts: [...state.assembly.parts, part],
            groundPartId,
          },
          selection: { kind: "part", partId: part.id },
        });
        return part.id;
      },

      renamePart: (partId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => {
          if (!s.assembly.parts.some((p) => p.id === partId)) return {};
          return {
            assembly: {
              ...s.assembly,
              parts: s.assembly.parts.map((p) =>
                p.id === partId ? { ...p, name: trimmed } : p,
              ),
            },
          };
        });
      },

      duplicatePart: (partId) => {
        const state = get();
        const src = state.assembly.parts.find((p) => p.id === partId);
        if (!src) return null;

        // Remap sketch ids consistently across features so an extrude/revolve
        // duplicated alongside its source sketch still references the copy,
        // not the original.
        const sketchIdMap = new Map<string, string>();
        const newSketches: Sketch[] = src.sketches.map((s) => {
          const id = newId("sketch");
          sketchIdMap.set(s.id, id);
          return {
            ...s,
            id,
            primitives: s.primitives.map((p) => ({ ...p })),
          };
        });

        const newFeatures: Feature[] = src.features.map((f) => {
          const fid = newId("feature");
          if (f.type === "extrude") {
            return {
              ...f,
              id: fid,
              sketchId: sketchIdMap.get(f.sketchId) ?? f.sketchId,
            };
          }
          if (f.type === "revolve") {
            return {
              ...f,
              id: fid,
              sketchId: sketchIdMap.get(f.sketchId) ?? f.sketchId,
            };
          }
          if (f.type === "fillet") {
            return { ...f, id: fid, targetEdges: [...f.targetEdges] };
          }
          if (f.type === "chamfer") {
            return { ...f, id: fid, targetEdges: [...f.targetEdges] };
          }
          // hole — copy positionUV tuple to avoid alias.
          return {
            ...f,
            id: fid,
            positionUV: [...f.positionUV] as [number, number],
          };
        });

        // Pick a unique "X (copy)" / "X (copy 2)" name.
        const existing = new Set(state.assembly.parts.map((p) => p.name));
        let candidate = `${src.name} (copy)`;
        let n = 2;
        while (existing.has(candidate)) {
          candidate = `${src.name} (copy ${n})`;
          n++;
        }

        const dup: Part = {
          id: newId("part"),
          name: candidate,
          visible: true,
          transform: {
            positionMm: [
              src.transform.positionMm[0] + 30,
              src.transform.positionMm[1],
              src.transform.positionMm[2],
            ],
            rotationDeg: [...src.transform.rotationDeg] as [number, number, number],
          },
          sketches: newSketches,
          features: newFeatures,
          materialId: src.materialId,
        };

        set({
          assembly: {
            ...state.assembly,
            parts: [...state.assembly.parts, dup],
          },
          selection: { kind: "part", partId: dup.id },
        });
        return dup.id;
      },

      setPartVisible: (partId, visible) =>
        set((s) => {
          if (!s.assembly.parts.some((p) => p.id === partId)) return {};
          return {
            assembly: {
              ...s.assembly,
              parts: s.assembly.parts.map((p) =>
                p.id === partId ? { ...p, visible } : p,
              ),
            },
          };
        }),

      setPartTransform: (partId, transform) =>
        set((s) => {
          if (!s.assembly.parts.some((p) => p.id === partId)) return {};
          return {
            assembly: {
              ...s.assembly,
              parts: s.assembly.parts.map((p) =>
                p.id === partId
                  ? {
                      ...p,
                      transform: {
                        positionMm: [...transform.positionMm] as [
                          number,
                          number,
                          number,
                        ],
                        rotationDeg: [...transform.rotationDeg] as [
                          number,
                          number,
                          number,
                        ],
                      },
                    }
                  : p,
              ),
            },
          };
        }),

      setPartTransformPartial: (partId, patch) =>
        set((s) => {
          const part = s.assembly.parts.find((p) => p.id === partId);
          if (!part) return {};
          const nextTransform: Transform = {
            positionMm: patch.positionMm
              ? ([...patch.positionMm] as [number, number, number])
              : part.transform.positionMm,
            rotationDeg: patch.rotationDeg
              ? ([...patch.rotationDeg] as [number, number, number])
              : part.transform.rotationDeg,
          };
          return {
            assembly: {
              ...s.assembly,
              parts: s.assembly.parts.map((p) =>
                p.id === partId ? { ...p, transform: nextTransform } : p,
              ),
            },
          };
        }),

      resetPartTransform: (partId) =>
        set((s) => {
          if (!s.assembly.parts.some((p) => p.id === partId)) return {};
          return {
            assembly: {
              ...s.assembly,
              parts: s.assembly.parts.map((p) =>
                p.id === partId
                  ? {
                      ...p,
                      transform: {
                        positionMm: [0, 0, 0],
                        rotationDeg: [0, 0, 0],
                      },
                    }
                  : p,
              ),
            },
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
          // Phase 7: cascade-delete every mate that references the deleted
          // part on either side.
          const remainingMates = s.assembly.mates.filter(
            (m) => m.partA !== partId && m.partB !== partId,
          );
          const removedMateIds = new Set(
            s.assembly.mates
              .filter((m) => m.partA === partId || m.partB === partId)
              .map((m) => m.id),
          );
          // Reset ground if it pointed to the deleted part.
          const groundPartId =
            s.assembly.groundPartId === partId ? "" : s.assembly.groundPartId;
          // Drop any selection / editor that targeted the deleted part or a
          // cascade-deleted boolean / mate.
          const sel = s.selection;
          let selection: Selection = sel;
          if (sel) {
            if ("partId" in sel && sel.partId === partId) selection = null;
            else if (
              sel.kind === "boolean" &&
              removedBooleanIds.has(sel.booleanId)
            ) {
              selection = null;
            } else if (
              sel.kind === "mate" &&
              removedMateIds.has(sel.mateId)
            ) {
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
          const mateEditor =
            s.mateEditor.open &&
            ((s.mateEditor.mateId &&
              removedMateIds.has(s.mateEditor.mateId)) ||
              s.mateEditor.params.partA === partId ||
              s.mateEditor.params.partB === partId)
              ? defaultMateEditor
              : s.mateEditor;
          return {
            assembly: {
              ...s.assembly,
              parts: remainingParts,
              booleanFeatures: remainingBooleans,
              mates: remainingMates,
              groundPartId,
            },
            selection,
            featureEditor,
            booleanEditor,
            mateEditor,
            featurePreview: defaultFeaturePreview,
          };
        }),

      getBooleansUsingPart: (partId) =>
        get().assembly.booleanFeatures.filter((b) =>
          b.inputPartIds.includes(partId),
        ),

      // ---- Phase 7: mates + ground anchor ----

      selectMate: (mateId) =>
        set({ selection: { kind: "mate", mateId } }),

      beginCreateMate: (type) => {
        const state = get();
        // Pick a unique default name like "Revolute 1".
        const base =
          type === "revolute"
            ? "Revolute"
            : type === "prismatic"
            ? "Prismatic"
            : type === "spherical"
            ? "Spherical"
            : type === "fixed"
            ? "Fixed"
            : "Planar";
        const existing = new Set(
          state.assembly.mates.map((m) => m.name).filter(Boolean) as string[],
        );
        let i = 1;
        while (existing.has(`${base} ${i}`)) i++;
        const name = `${base} ${i}`;
        set({
          mateEditor: {
            open: true,
            mode: "create",
            stage: "pick-a",
            params: { ...defaultMateEditorParams(type), name },
            error: null,
          },
          // Mate flow uses topology picker for revolute/prismatic/planar
          // (faces) and point-on-face for spherical. Inspectors set the
          // exact mode in their own useEffect; default is idle.
          pickingMode: "idle",
          selection: null,
          // Mutually exclusive with the other editors.
          featureEditor: defaultFeatureEditor,
          booleanEditor: defaultBooleanEditor,
        });
      },

      beginEditMate: (mateId) => {
        const state = get();
        const mate = state.assembly.mates.find((m) => m.id === mateId);
        if (!mate) return;
        const params: MateEditorParams = {
          type: mate.type,
          partA: mate.partA,
          partB: mate.partB,
          pivotA: "pivotA" in mate ? mate.pivotA : null,
          pivotB: "pivotB" in mate ? mate.pivotB : null,
          axisLocal:
            mate.type === "revolute" || mate.type === "prismatic"
              ? mate.axisLocal
              : null,
          name: mate.name ?? "",
          motorSpeedRpm:
            mate.type === "revolute" ? mate.motorSpeedRpm ?? null : null,
          motorTorqueNm:
            mate.type === "revolute" ? mate.motorTorqueNm ?? null : null,
          motorForceN:
            mate.type === "prismatic" ? mate.motorForceN ?? null : null,
          motorVelocityMmPerSec:
            mate.type === "prismatic"
              ? mate.motorVelocityMmPerSec ?? null
              : null,
        };
        set({
          mateEditor: {
            open: true,
            mode: "edit",
            mateId,
            stage: "ready",
            params,
            error: null,
          },
          selection: { kind: "mate", mateId },
          pickingMode: "idle",
          featureEditor: defaultFeatureEditor,
          booleanEditor: defaultBooleanEditor,
        });
      },

      setMateEditorParams: (params) =>
        set((s) => {
          if (!s.mateEditor.open) return {};
          if (s.mateEditor.params === params) return {};
          return { mateEditor: { ...s.mateEditor, params } };
        }),

      setMateEditorStage: (stage) =>
        set((s) => {
          if (!s.mateEditor.open) return {};
          // Equality guard: re-setting the same stage in a render-driven
          // effect was producing a fresh `mateEditor` reference and looping
          // the inspector validation effects (Phase 7 regression).
          if (s.mateEditor.stage === stage) return {};
          return { mateEditor: { ...s.mateEditor, stage } };
        }),

      setMateEditorError: (err) =>
        set((s) => {
          if (!s.mateEditor.open) return {};
          // Equality guard: see setMateEditorStage. Without this guard,
          // `setError("Pick a different part.")` called from a useEffect
          // that depends on `editor` would loop infinitely on every
          // re-render because the new `mateEditor` reference re-triggered
          // the same effect (Phase 7 regression — "Maximum update depth
          // exceeded" crash on Fixed mate, persistent banner on Revolute).
          if (s.mateEditor.error === err) return {};
          return { mateEditor: { ...s.mateEditor, error: err } };
        }),

      applyMateEditor: () => {
        const state = get();
        const editor = state.mateEditor;
        if (!editor.open) return;
        const { params } = editor;
        if (!params.partA || !params.partB) return;
        if (params.partA === params.partB) return;

        const id = editor.mateId ?? newId("mate");
        const trimmedName = params.name.trim();
        let mate: Mate;
        switch (params.type) {
          case "revolute": {
            if (!params.pivotA || !params.pivotB || !params.axisLocal) return;
            // Planar mate uses a different pivot shape — guard against it.
            if (params.pivotA.kind !== "face" && params.pivotA.kind !== "edge")
              return;
            if (params.pivotB.kind !== "face" && params.pivotB.kind !== "edge")
              return;
            const m: RevoluteMate = {
              id,
              type: "revolute",
              partA: params.partA,
              partB: params.partB,
              pivotA: params.pivotA as MatePivot,
              pivotB: params.pivotB as MatePivot,
              axisLocal: params.axisLocal,
            };
            if (trimmedName) m.name = trimmedName;
            if (params.motorSpeedRpm != null)
              m.motorSpeedRpm = params.motorSpeedRpm;
            if (params.motorTorqueNm != null)
              m.motorTorqueNm = params.motorTorqueNm;
            mate = m;
            break;
          }
          case "prismatic": {
            if (!params.pivotA || !params.pivotB || !params.axisLocal) return;
            if (params.pivotA.kind !== "face" && params.pivotA.kind !== "edge")
              return;
            if (params.pivotB.kind !== "face" && params.pivotB.kind !== "edge")
              return;
            const m: PrismaticMate = {
              id,
              type: "prismatic",
              partA: params.partA,
              partB: params.partB,
              pivotA: params.pivotA as MatePivot,
              pivotB: params.pivotB as MatePivot,
              axisLocal: params.axisLocal,
            };
            if (trimmedName) m.name = trimmedName;
            if (params.motorForceN != null) m.motorForceN = params.motorForceN;
            if (params.motorVelocityMmPerSec != null)
              m.motorVelocityMmPerSec = params.motorVelocityMmPerSec;
            mate = m;
            break;
          }
          case "spherical": {
            if (!params.pivotA || !params.pivotB) return;
            if (params.pivotA.kind !== "face" && params.pivotA.kind !== "edge")
              return;
            if (params.pivotB.kind !== "face" && params.pivotB.kind !== "edge")
              return;
            const m: SphericalMate = {
              id,
              type: "spherical",
              partA: params.partA,
              partB: params.partB,
              pivotA: params.pivotA as MatePivot,
              pivotB: params.pivotB as MatePivot,
            };
            if (trimmedName) m.name = trimmedName;
            mate = m;
            break;
          }
          case "fixed": {
            const m: FixedMate = {
              id,
              type: "fixed",
              partA: params.partA,
              partB: params.partB,
            };
            if (trimmedName) m.name = trimmedName;
            mate = m;
            break;
          }
          case "planar": {
            if (!params.pivotA || !params.pivotB) return;
            // Planar mates use bare {kind:'face',faceId} — both pivots must
            // be face refs (the inspector enforces this).
            if (params.pivotA.kind !== "face" || params.pivotB.kind !== "face")
              return;
            const m: PlanarMate = {
              id,
              type: "planar",
              partA: params.partA,
              partB: params.partB,
              pivotA: { kind: "face", faceId: params.pivotA.faceId },
              pivotB: { kind: "face", faceId: params.pivotB.faceId },
            };
            if (trimmedName) m.name = trimmedName;
            mate = m;
            break;
          }
        }

        const isEdit = editor.mode === "edit" && editor.mateId;
        const updatedMates: Mate[] = isEdit
          ? state.assembly.mates.map((m) => (m.id === editor.mateId ? mate : m))
          : [...state.assembly.mates, mate];

        set({
          assembly: { ...state.assembly, mates: updatedMates },
          mateEditor: defaultMateEditor,
          pickingMode: "idle",
          selection: { kind: "mate", mateId: mate.id },
        });
      },

      cancelMateEditor: () =>
        set({
          mateEditor: defaultMateEditor,
          pickingMode: "idle",
        }),

      addMate: (mate) =>
        set((s) => ({
          assembly: { ...s.assembly, mates: [...s.assembly.mates, mate] },
        })),

      removeMate: (mateId) =>
        set((s) => {
          const next = s.assembly.mates.filter((m) => m.id !== mateId);
          if (next.length === s.assembly.mates.length) return {};
          return {
            assembly: { ...s.assembly, mates: next },
            mateEditor:
              s.mateEditor.open && s.mateEditor.mateId === mateId
                ? defaultMateEditor
                : s.mateEditor,
            selection:
              s.selection?.kind === "mate" && s.selection.mateId === mateId
                ? null
                : s.selection,
          };
        }),

      renameMate: (mateId, name) =>
        set((s) => {
          const trimmed = name.trim();
          if (!trimmed) return {};
          const next = s.assembly.mates.map((m) =>
            m.id === mateId ? ({ ...m, name: trimmed } as Mate) : m,
          );
          return { assembly: { ...s.assembly, mates: next } };
        }),

      updateMate: (mateId, patch) =>
        set((s) => {
          const next = s.assembly.mates.map((m) => {
            if (m.id !== mateId) return m;
            // The caller supplies a same-`type` patch — cast through unknown
            // so TS doesn't reject the partial overlay across the union.
            return { ...m, ...(patch as object) } as Mate;
          });
          return { assembly: { ...s.assembly, mates: next } };
        }),

      setGroundPart: (partId) =>
        set((s) => ({
          assembly: { ...s.assembly, groundPartId: partId },
        })),

      getMatesUsingPart: (partId) =>
        get().assembly.mates.filter(
          (m) => m.partA === partId || m.partB === partId,
        ),
    }),
    {
      name: "kineticad-state",
      version: 7,
      // Don't persist the active sketch session, in-flight feature editor,
      // selection, or live simulation runtime fields.
      partialize: (state) => ({
        mode: state.mode,
        assembly: state.assembly,
        simulation: {
          ...state.simulation,
          // Phase 8 — never resume a runtime physics state across reload.
          // Configuration (gravity / timeStep / speedMultiplier) survives;
          // running / paused / elapsed are zeroed so the user always lands
          // in a stopped world ready to be played.
          running: false,
          paused: false,
          simulationTimeMs: 0,
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
        // v4 → v5: Phase 6 adds `visible` (default true) and `transform`
        // (default identity) to every Part. Legacy parts get the defaults so
        // the scene renders unchanged.
        if (version < 5 && state.assembly) {
          const migratedParts = state.assembly.parts.map((part) => {
            const p = part as Part & {
              visible?: boolean;
              transform?: Transform;
            };
            return {
              ...part,
              visible: typeof p.visible === "boolean" ? p.visible : true,
              transform:
                p.transform &&
                Array.isArray(p.transform.positionMm) &&
                Array.isArray(p.transform.rotationDeg)
                  ? p.transform
                  : {
                      positionMm: [0, 0, 0] as [number, number, number],
                      rotationDeg: [0, 0, 0] as [number, number, number],
                    },
            };
          });
          state.assembly = { ...state.assembly, parts: migratedParts };
        }
        // Defensive: same idea as the booleanFeatures guard above. Catches
        // partial v5 states (e.g. dev session bumped the version before the
        // fields were defaulted).
        if (state.assembly) {
          let needsPatch = false;
          for (const part of state.assembly.parts) {
            const p = part as Part & {
              visible?: boolean;
              transform?: Transform;
            };
            if (
              typeof p.visible !== "boolean" ||
              !p.transform ||
              !Array.isArray(p.transform.positionMm) ||
              !Array.isArray(p.transform.rotationDeg)
            ) {
              needsPatch = true;
              break;
            }
          }
          if (needsPatch) {
            state.assembly = {
              ...state.assembly,
              parts: state.assembly.parts.map((part) => {
                const p = part as Part & {
                  visible?: boolean;
                  transform?: Transform;
                };
                return {
                  ...part,
                  visible: typeof p.visible === "boolean" ? p.visible : true,
                  transform:
                    p.transform &&
                    Array.isArray(p.transform.positionMm) &&
                    Array.isArray(p.transform.rotationDeg)
                      ? p.transform
                      : {
                          positionMm: [0, 0, 0] as [number, number, number],
                          rotationDeg: [0, 0, 0] as [number, number, number],
                        },
                };
              }),
            };
          }
        }
        // v5 → v6: Phase 7 mates. No UI in earlier phases ever created mates,
        // so existing v5 states already have `mates: []` from the defaultAssembly.
        // Defensively coerce `mates` to `[]` if its shape is suspect, and
        // ensure `groundPartId` is a string (default `""` = "default to first
        // part" semantics handled by the UI layer).
        if (state.assembly) {
          const a = state.assembly as Assembly & {
            mates?: unknown;
            groundPartId?: unknown;
          };
          if (!Array.isArray(a.mates)) {
            state.assembly = { ...a, mates: [] as Mate[] };
          }
          if (typeof (state.assembly as Assembly).groundPartId !== "string") {
            state.assembly = { ...state.assembly, groundPartId: "" };
          }
          // Phase 9.5 — promote the first existing part to ground if the
          // persisted state predates the auto-promote behavior in
          // `createPart`. The UI / sim used to fall back to `parts[0]`
          // when groundPartId was "", which silently rewired the anchor
          // on re-orders / deletions.
          const asm = state.assembly as Assembly;
          if (asm.groundPartId === "" && asm.parts.length > 0) {
            state.assembly = { ...asm, groundPartId: asm.parts[0].id };
          }
        }
        // v6 → v7: Phase 8 simulation. The `simulation` field already
        // existed in v6 (running/timeStepMs/gravity); v7 widens it with
        // `paused`, `speedMultiplier`, `simulationTimeMs`, and switches
        // the default gravity to mm/s² (Z-up `[0, 0, -9810]`). We
        // overlay the existing fields onto the new defaults so any
        // user-tweaked gravity / timestep survives, then patch the new
        // fields if missing.
        const stateSim = persisted as { simulation?: unknown };
        if (version < 7 || !isFullSimulation(stateSim.simulation)) {
          const prev = (stateSim.simulation ?? {}) as Partial<SimulationState>;
          (state as { simulation?: SimulationState }).simulation = {
            running: false,
            paused: false,
            timeStepMs:
              typeof prev.timeStepMs === "number" && prev.timeStepMs > 0
                ? prev.timeStepMs
                : defaultSimulation.timeStepMs,
            // If the legacy gravity is in m/s² (any axis with |g| < 50)
            // it predates the mm-units convention — stomp it with the
            // mm/s² default so physics behaves correctly.
            gravity: isMmGravity(prev.gravity)
              ? (prev.gravity as [number, number, number])
              : defaultSimulation.gravity,
            speedMultiplier:
              typeof prev.speedMultiplier === "number" &&
              prev.speedMultiplier > 0
                ? prev.speedMultiplier
                : defaultSimulation.speedMultiplier,
            simulationTimeMs: 0,
          };
        }
        return state;
      },
    },
  ),
);
