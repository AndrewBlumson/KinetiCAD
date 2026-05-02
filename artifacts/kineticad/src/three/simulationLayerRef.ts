// Phase 8 — module-level handle to the live SimulationLayer instance.
// Mirrors partMeshLayerRef. Lets the Phase 8 simulation runner reach
// into the Three.js scene graph without coupling Scene.tsx to the
// physics worker.

import type { SimulationLayer } from "./SimulationLayer";

let current: SimulationLayer | null = null;

export function setSimulationLayer(layer: SimulationLayer | null): void {
  current = layer;
}

export function getSimulationLayer(): SimulationLayer | null {
  return current;
}
