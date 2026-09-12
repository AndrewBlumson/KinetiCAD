// Phase 5 — assembly-level boolean result meshes.
//
// Mirrors PartMeshLayer's lifecycle, but keyed by `BooleanFeature.id` and
// driven by `regenerateBoolean` (which round-trips the worker via
// `kernel.booleanOp`). Geometry and topology are already in assembly world
// coordinates; each result body therefore has an identity transform.
//
// Concurrency: each in-flight regen carries an incrementing token; stale
// returns are dropped. The token is bumped on every transition that should
// preempt a pending regen (hide, removed, dispose) so a late completion
// can't resurrect stale geometry on a hidden / deleted boolean.

import * as THREE from "three";
import type { Remote } from "comlink";
import type { Assembly } from "@/state/schemas";
import type { CadKernelApi } from "@/cad/types";
import { computeBooleanHash, regenerateBoolean } from "@/features/assemblyRegen";
import { getMaterial } from "@/cad/materials";
import { booleanBodyId, resolveBooleanMaterialId } from "@/state/assemblyBodies";
import type { PartTopology } from "./PartMeshLayer";

export type VisibleBooleanBody = {
  partId: string;
  mesh: THREE.Mesh;
  topology: PartTopology;
  hash: string;
  solidCount: number | undefined;
};

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
  getPartMesh: (bodyId: string) => THREE.Mesh | null;
  getPartTopology: (bodyId: string) => PartTopology | null;
  getGeometryHash: (bodyId: string) => string | null;
  getVisiblePartMeshes: () => VisibleBooleanBody[];
  forEachVisible: (fn: (bodyId: string, mesh: THREE.Mesh, topology: PartTopology) => void) => void;
  topologyVersion: () => number;
  dispose: () => void;
};

type Entry = {
  mesh: THREE.Mesh;
  lastHash: string | null;
  requestedHash: string | null;
  topology: PartTopology | null;
  pending: boolean;
  solidCount: number | undefined;
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
  const materials = new Map<string, { opaque: THREE.MeshStandardMaterial; dimmed: THREE.MeshStandardMaterial }>();
  let nextToken = 1;
  let isDisposed = false;
  let version = 0;

  const materialFor = (materialId: string | undefined, dimmed: boolean): THREE.MeshStandardMaterial => {
    // Unresolved mixed materials remain neutral visually; they are not assigned
    // a default density. The simulation planner requires an explicit material.
    if (!materialId) return dimmed ? dimmedMaterial : sharedMaterial;
    let pair = materials.get(materialId);
    if (!pair) {
      const material = getMaterial(materialId);
      const properties = { color: material.colour, metalness: material.metalness, roughness: material.roughness };
      pair = {
        opaque: new THREE.MeshStandardMaterial(properties),
        dimmed: new THREE.MeshStandardMaterial({ ...properties, transparent: true, opacity: 0.4, depthWrite: false }),
      };
      materials.set(materialId, pair);
    }
    return dimmed ? pair.dimmed : pair.opaque;
  };

  const ensureEntry = (booleanId: string): Entry => {
    let entry = entries.get(booleanId);
    if (entry) return entry;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Boolean:${booleanId}`;
    mesh.userData.partId = booleanBodyId(booleanId);
    mesh.userData.booleanId = booleanId;
    mesh.visible = false;
    group.add(mesh);
    entry = { mesh, lastHash: null, requestedHash: null, topology: null, pending: false, solidCount: undefined, inFlightToken: 0, alive: true };
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
    version++;
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
        entry.topology = null;
        entry.pending = false;
        version++;
        return;
      }
      if (entry.lastHash === result.hash && entry.topology) {
        entry.mesh.visible = true;
        entry.pending = false;
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
      const faceForTriangle = new Uint32Array(result.mesh.indices.length / 3);
      faceForTriangle.fill(0xffffffff);
      result.mesh.faces.forEach((face, index) => {
        for (const triangle of face.triangles) {
          if (triangle < faceForTriangle.length) faceForTriangle[triangle] = index;
        }
      });
      entry.topology = { edges: result.mesh.edges, faces: result.mesh.faces, faceForTriangle };
      entry.solidCount = result.mesh.solidCount;
      entry.pending = false;
      version++;
    } catch {
      if (isDisposed || !entry.alive) return;
      if (entry.inFlightToken !== token) return;
      entry.mesh.visible = false;
      entry.lastHash = null;
      entry.topology = null;
      entry.pending = false;
      version++;
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
        if (entry.mesh.visible) version++;
        entry.mesh.visible = false;
        entry.pending = false;
        continue;
      }

      // Apply dim/full material before regen so the swap takes effect even
      // when the regen short-circuits on a hash cache hit. Same pattern
      // as PartMeshLayer.sync.
      const desiredMaterial = materialFor(resolveBooleanMaterialId(feature, assembly.parts), dimmedBooleanIds.has(feature.id));
      if (entry.mesh.material !== desiredMaterial) {
        entry.mesh.material = desiredMaterial;
      }

      const requestedHash = computeBooleanHash(feature, assembly.parts);
      if (entry.lastHash === requestedHash && entry.topology) {
        if (!entry.mesh.visible) version++;
        entry.mesh.visible = true;
        entry.requestedHash = requestedHash;
        continue;
      }
      if (entry.pending && entry.requestedHash === requestedHash) continue;
      // A source edit invalidates picking immediately, before async CAD returns.
      if (entry.mesh.visible || entry.topology) version++;
      entry.mesh.visible = false;
      entry.topology = null;
      entry.requestedHash = requestedHash;
      entry.pending = true;
      const token = ++nextToken;
      entry.inFlightToken = token;
      void regenAndApply(feature, assembly.parts, kernel, entry, token);
    }

    for (const id of Array.from(entries.keys())) {
      if (!seen.has(id)) removeEntry(id);
    }
  };

  const size = (): number => entries.size;

  const currentEntry = (bodyId: string): Entry | null => {
    if (isDisposed || !group.visible || !bodyId.startsWith('boolean:')) return null;
    const entry = entries.get(bodyId.slice('boolean:'.length));
    return entry?.alive && entry.mesh.visible && entry.topology && entry.lastHash === entry.requestedHash ? entry : null;
  };
  const getPartMesh = (bodyId: string): THREE.Mesh | null => currentEntry(bodyId)?.mesh ?? null;
  const getPartTopology = (bodyId: string): PartTopology | null => {
    const entry = currentEntry(bodyId);
    return entry?.solidCount === 1 ? entry.topology : null;
  };
  const getGeometryHash = (bodyId: string): string | null => currentEntry(bodyId)?.lastHash ?? null;
  const getVisiblePartMeshes = (): VisibleBooleanBody[] => {
    const result: VisibleBooleanBody[] = [];
    for (const id of entries.keys()) {
      const partId = booleanBodyId(id), entry = currentEntry(partId);
      if (entry?.topology && entry.lastHash) result.push({ partId, mesh: entry.mesh, topology: entry.topology, hash: entry.lastHash, solidCount: entry.solidCount });
    }
    return result;
  };
  const forEachVisible = (fn: (bodyId: string, mesh: THREE.Mesh, topology: PartTopology) => void): void => {
    for (const entry of getVisiblePartMeshes()) {
      if (entry.solidCount === 1) fn(entry.partId, entry.mesh, entry.topology);
    }
  };

  const dispose = (): void => {
    isDisposed = true;
    for (const id of Array.from(entries.keys())) {
      removeEntry(id);
    }
    sharedMaterial.dispose();
    dimmedMaterial.dispose();
    for (const pair of materials.values()) { pair.opaque.dispose(); pair.dimmed.dispose(); }
    materials.clear();
    if (group.parent) group.parent.remove(group);
  };

  return { group, sync, size, getPartMesh, getPartTopology, getGeometryHash, getVisiblePartMeshes, forEachVisible, topologyVersion: () => version, dispose };
}
