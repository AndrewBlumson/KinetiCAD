// Phase 5 — assembly-level boolean result meshes.
//
// Mirrors PartMeshLayer's lifecycle, but keyed by `BooleanFeature.id` and
// driven by `regenerateBoolean` (which round-trips the worker via
// `kernel.booleanOp`). Renders with a slightly warmer base colour so the
// user can tell a result mesh apart from a raw part mesh.
//
// Concurrency: each in-flight regen carries an incrementing token; stale
// returns are dropped. The token is bumped on every transition that should
// preempt a pending regen (hide, removed, dispose) so a late completion
// can't resurrect stale geometry on a hidden / deleted boolean.

import * as THREE from "three";
import type { Remote } from "comlink";
import type { Assembly } from "@/state/schemas";
import type { CadKernelApi } from "@/cad/types";
import { regenerateBoolean } from "@/features/assemblyRegen";

export type BooleanResultLayer = {
  group: THREE.Group;
  /**
   * Reconcile the layer with the given assembly. Per-result visibility is
   * driven by two disjoint id sets:
   *
   *  - `hiddenBooleanIds`: suppressed from rendering entirely. Reserved
   *    for cases where the result mesh must be fully replaced (none used
   *    today — see PartMeshLayer.sync for the same contract).
   *
   *  - `dimmedBooleanIds`: rendered at reduced opacity (0.4). Used while
   *    the boolean editor is editing this boolean with live-preview on,
   *    so the user sees the original result through the 0.85-opacity
   *    preview overlay (mirrors PartMeshLayer's edit-mode dim path).
   *
   * If a boolean id appears in both sets, `hiddenBooleanIds` wins.
   */
  sync: (
    assembly: Assembly,
    hiddenBooleanIds: Set<string>,
    dimmedBooleanIds: Set<string>,
    kernel: Remote<CadKernelApi>,
  ) => void;
  size: () => number;
  dispose: () => void;
};

type Entry = {
  mesh: THREE.Mesh;
  lastHash: string | null;
  inFlightToken: number;
  alive: boolean;
};

/** Slightly warmer than COLOURS.defaultPart so result meshes read distinctly. */
const RESULT_COLOR = 0xa8b0bc;

export function createBooleanResultLayer(): BooleanResultLayer {
  const group = new THREE.Group();
  group.name = "BooleanResultLayer";

  const sharedMaterial = new THREE.MeshStandardMaterial({
    color: RESULT_COLOR,
    metalness: 0.4,
    roughness: 0.5,
  });

  // Translucent variant for EDIT-mode dimming. Same rationale as
  // PartMeshLayer's dimmedMaterial: depthWrite disabled so the dimmed
  // result doesn't z-fight with the 0.85-opacity preview overlay.
  const dimmedMaterial = new THREE.MeshStandardMaterial({
    color: RESULT_COLOR,
    metalness: 0.4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });

  const entries = new Map<string, Entry>();
  let nextToken = 1;
  let isDisposed = false;

  const ensureEntry = (booleanId: string): Entry => {
    let entry = entries.get(booleanId);
    if (entry) return entry;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Boolean:${booleanId}`;
    mesh.visible = false;
    group.add(mesh);
    entry = { mesh, lastHash: null, inFlightToken: 0, alive: true };
    entries.set(booleanId, entry);
    return entry;
  };

  const removeEntry = (booleanId: string): void => {
    const entry = entries.get(booleanId);
    if (!entry) return;
    entry.alive = false;
    entry.inFlightToken = ++nextToken;
    group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entries.delete(booleanId);
  };

  const regenAndApply = async (
    feature: import("@/state/schemas").BooleanFeature,
    parts: ReadonlyArray<import("@/state/schemas").Part>,
    kernel: Remote<CadKernelApi>,
    entry: Entry,
    token: number,
  ): Promise<void> => {
    try {
      const result = await regenerateBoolean(feature, parts, kernel);
      if (isDisposed) return;
      if (!entry.alive) return;
      if (entry.inFlightToken !== token) return;

      if (!result.mesh || result.error) {
        entry.mesh.visible = false;
        entry.lastHash = null;
        return;
      }
      if (entry.lastHash === result.hash) {
        entry.mesh.visible = true;
        return;
      }
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(result.mesh.positions, 3),
      );
      newGeom.setAttribute(
        "normal",
        new THREE.BufferAttribute(result.mesh.normals, 3),
      );
      newGeom.setIndex(new THREE.BufferAttribute(result.mesh.indices, 1));
      newGeom.computeBoundingBox();
      newGeom.computeBoundingSphere();

      const oldGeom = entry.mesh.geometry;
      entry.mesh.geometry = newGeom;
      oldGeom.dispose();
      entry.mesh.visible = true;
      entry.lastHash = result.hash;
    } catch {
      if (isDisposed || !entry.alive) return;
      if (entry.inFlightToken !== token) return;
      entry.mesh.visible = false;
      entry.lastHash = null;
    }
  };

  const sync = (
    assembly: Assembly,
    hiddenBooleanIds: Set<string>,
    dimmedBooleanIds: Set<string>,
    kernel: Remote<CadKernelApi>,
  ): void => {
    if (isDisposed) return;
    const seen = new Set<string>();

    for (const feature of assembly.booleanFeatures) {
      seen.add(feature.id);
      const entry = ensureEntry(feature.id);

      if (hiddenBooleanIds.has(feature.id)) {
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
        continue;
      }

      // Apply dim/full material before regen so the swap takes effect even
      // when the regen short-circuits on a hash cache hit. Same pattern
      // as PartMeshLayer.sync.
      const desiredMaterial = dimmedBooleanIds.has(feature.id)
        ? dimmedMaterial
        : sharedMaterial;
      if (entry.mesh.material !== desiredMaterial) {
        entry.mesh.material = desiredMaterial;
      }

      const token = ++nextToken;
      entry.inFlightToken = token;
      void regenAndApply(feature, assembly.parts, kernel, entry, token);
    }

    for (const id of Array.from(entries.keys())) {
      if (!seen.has(id)) removeEntry(id);
    }
  };

  const size = (): number => entries.size;

  const dispose = (): void => {
    isDisposed = true;
    for (const id of Array.from(entries.keys())) {
      removeEntry(id);
    }
    sharedMaterial.dispose();
    dimmedMaterial.dispose();
    if (group.parent) group.parent.remove(group);
  };

  return { group, sync, size, dispose };
}
