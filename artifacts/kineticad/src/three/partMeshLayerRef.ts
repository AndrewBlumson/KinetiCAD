// Phase 7 — module-level singleton ref for the active PartMeshLayer.
//
// React inspectors (e.g. mate inspectors) need access to per-part topology
// data (`PartTopology`) to validate picks and derive axes/centroids, but the
// `PartMeshLayer` instance is owned by `Scene.tsx` (which manages its
// lifecycle alongside the WebGPU renderer). We expose a tiny module-level
// ref so the React layer can look up topology without coupling to a global
// scene context. Scene.tsx publishes/clears the ref on mount/unmount.

import type { PartMeshLayer } from "./PartMeshLayer";

let _layer: PartMeshLayer | null = null;

export function setPartMeshLayer(layer: PartMeshLayer | null): void {
  _layer = layer;
}

export function getPartMeshLayer(): PartMeshLayer | null {
  return _layer;
}
