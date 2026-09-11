import type { DemoDocument } from './demoDocument';

type Workspace = DemoDocument['state'];

/** Keep the original state and WASM worker alive; demos never write its storage. */
export function createDemoSession<T extends Workspace>(adapter: {
  read: () => T;
  initial: () => T;
  write: (state: T) => void;
  isolatePersistence: () => () => void;
}) {
  let original: T | null = null;
  let restorePersistence: (() => void) | null = null;

  return {
    enter(document: DemoDocument) {
      if (!original) {
        original = adapter.read();
        restorePersistence = adapter.isolatePersistence();
      }
      adapter.write({
        ...adapter.initial(),
        ...document.state,
        simulation: { ...document.state.simulation, running: false, paused: false, simulationTimeMs: 0 },
      });
    },
    leave() {
      if (!original) return;
      // Write the restore while still isolated, so even late demo state cannot
      // replace the original document. Its next normal edit resumes persistence.
      adapter.write({
        ...original,
        simulation: { ...original.simulation, running: false, paused: false, simulationTimeMs: 0 },
      });
      restorePersistence?.();
      original = null;
      restorePersistence = null;
    },
  };
}
