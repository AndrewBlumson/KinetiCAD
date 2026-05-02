import { create } from 'zustand';
import type { Assembly, SimulationState, AppMode } from './schemas';

export type KinetiCADStore = {
  mode: AppMode;
  assembly: Assembly;
  simulation: SimulationState;

  setMode: (mode: AppMode) => void;
  setSimulationRunning: (running: boolean) => void;
  resetSimulation: () => void;
};

const defaultAssembly: Assembly = {
  id: 'default-assembly',
  name: 'Assembly 1',
  parts: [],
  mates: [],
  groundPartId: '',
};

const defaultSimulation: SimulationState = {
  running: false,
  timeStepMs: 1000 / 60,
  gravity: [0, -9.81, 0],
};

export const useKinetiCADStore = create<KinetiCADStore>((set) => ({
  mode: 'modeller',
  assembly: defaultAssembly,
  simulation: defaultSimulation,

  setMode: (mode) => set({ mode }),
  setSimulationRunning: (running) =>
    set((s) => ({ simulation: { ...s.simulation, running } })),
  resetSimulation: () =>
    set((s) => ({ simulation: { ...s.simulation, running: false } })),
}));
