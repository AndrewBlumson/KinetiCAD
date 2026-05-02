import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Assembly,
  Part,
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
   * Primitive currently being drawn (e.g. line awaiting its second click).
   * Wired in Split B.
   */
  inFlightPrimitive: SketchPrimitive | null;
  /**
   * Primitives finalised by the user during this session, before they have
   * been pushed into the assembly. Wired in Split B.
   */
  committedPrimitives: SketchPrimitive[];
};

const defaultSketchSession: SketchSession = {
  active: false,
  plane: null,
  tool: "idle",
  inFlightPrimitive: null,
  committedPrimitives: [],
};

export type KinetiCADStore = {
  mode: AppMode;
  assembly: Assembly;
  simulation: SimulationState;
  sketchSession: SketchSession;

  setMode: (mode: AppMode) => void;
  setSimulationRunning: (running: boolean) => void;
  resetSimulation: () => void;

  beginSketch: (plane: CardinalPlane) => void;
  setSketchTool: (tool: SketchTool) => void;
  commitInFlightPrimitive: () => void;
  finishSketch: () => void;
  cancelSketch: () => void;
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

export const useKinetiCADStore = create<KinetiCADStore>()(
  persist(
    (set, get) => ({
      mode: "modeller",
      assembly: defaultAssembly,
      simulation: defaultSimulation,
      sketchSession: defaultSketchSession,

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
            inFlightPrimitive: null,
            committedPrimitives: [],
          },
        }),

      setSketchTool: (tool) =>
        set((s) => ({
          sketchSession: { ...s.sketchSession, tool, inFlightPrimitive: null },
        })),

      commitInFlightPrimitive: () =>
        set((s) => {
          const { inFlightPrimitive, committedPrimitives } = s.sketchSession;
          if (!inFlightPrimitive) return s;
          return {
            sketchSession: {
              ...s.sketchSession,
              inFlightPrimitive: null,
              committedPrimitives: [...committedPrimitives, inFlightPrimitive],
            },
          };
        }),

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
    }),
    {
      name: "kineticad-state",
      version: 1,
      // Don't persist the active sketch session or live simulation flags.
      partialize: (state) => ({
        mode: state.mode,
        assembly: state.assembly,
        simulation: {
          ...state.simulation,
          running: false,
        },
      }),
    },
  ),
);
