// Phase 8 — Three.js layer that renders parts driven by the physics
// worker. Parallels `PartMeshLayer` but with three differences:
//
// 1. Geometry is *cloned* from the live PartMeshLayer at simulation
//    start so we don't rebuild meshes from scratch — saves OCCT
//    round-trips and keeps the part-tree visually identical to the
//    Modeller view.
// 2. Per-frame `setTransform(partId, posMm, quat)` is the only mutator;
//    geometry never changes during a sim run.
// 3. The whole layer is hidden whenever `simulation.running === false`,
//    and `PartMeshLayer` is shown in its place. Switching between the
//    two is instantaneous because both layers persist in the scene.
//
// Memory: clones share the underlying BufferGeometry + Material with
// the source PartMeshLayer entries (Three.js refcount via dispose() on
// the source layer; we never call dispose on the clones' geometry).

import * as THREE from "three";
import type { PartMeshLayer } from "./PartMeshLayer";

export type SimulationLayer = {
  group: THREE.Group;
  /**
   * Rebuild the layer from the current PartMeshLayer entries. Called
   * when the user clicks Play; gathers a snapshot of every visible
   * part's geometry and adds a clone to the layer's group. Subsequent
   * `setTransform` calls update the clones in-place.
   *
   * `excludePartIds` is honoured for symmetry with PartMeshLayer (so
   * e.g. parts hidden in the Modeller are also hidden in the Simulator),
   * but in practice the simulator builds the world from every visible
   * part anyway.
   */
  sync: (
    layer: PartMeshLayer,
    excludePartIds?: Set<string>,
  ) => void;
  /**
   * Apply a world-space transform to one part's clone. Position is in
   * mm; quaternion is `(x, y, z, w)`. Silently no-ops if the partId
   * isn't in the layer (race during teardown).
   */
  setTransform: (
    partId: string,
    posMm: [number, number, number],
    quat: [number, number, number, number],
  ) => void;
  /** Toggle the entire group. */
  setVisible: (visible: boolean) => void;
  /** Drop every clone and reset to an empty group. */
  clear: () => void;
  dispose: () => void;
};

type Entry = {
  mesh: THREE.Mesh;
};

export function createSimulationLayer(): SimulationLayer {
  const group = new THREE.Group();
  group.name = "SimulationLayer";
  group.visible = false;

  const entries = new Map<string, Entry>();

  const sync: SimulationLayer["sync"] = (layer, excludePartIds) => {
    // Clear existing clones, then rebuild from the source layer's
    // currently-visible parts. Geometry is shared with the source so
    // we don't dispose it — Three.js refcount lives on the source.
    for (const [, entry] of entries) {
      group.remove(entry.mesh);
    }
    entries.clear();

    layer.forEachVisible((partId, sourceMesh, _topology) => {
      void _topology;
      if (excludePartIds && excludePartIds.has(partId)) return;
      const clone = new THREE.Mesh(sourceMesh.geometry, sourceMesh.material);
      clone.name = `sim:${partId}`;
      clone.castShadow = sourceMesh.castShadow;
      clone.receiveShadow = sourceMesh.receiveShadow;
      // Seed the clone with the source's current world pose so the
      // first frame of physics doesn't appear to teleport the body.
      clone.position.copy(sourceMesh.position);
      clone.quaternion.copy(sourceMesh.quaternion);
      group.add(clone);
      entries.set(partId, { mesh: clone });
    });
  };

  const setTransform: SimulationLayer["setTransform"] = (
    partId,
    posMm,
    quat,
  ) => {
    const entry = entries.get(partId);
    if (!entry) return;
    entry.mesh.position.set(posMm[0], posMm[1], posMm[2]);
    entry.mesh.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
  };

  const setVisible: SimulationLayer["setVisible"] = (visible) => {
    group.visible = visible;
  };

  const clear: SimulationLayer["clear"] = () => {
    for (const [, entry] of entries) {
      group.remove(entry.mesh);
    }
    entries.clear();
  };

  const dispose: SimulationLayer["dispose"] = () => {
    clear();
    // Geometry + material are shared with PartMeshLayer; we don't
    // dispose them here.
  };

  return { group, sync, setTransform, setVisible, clear, dispose };
}
