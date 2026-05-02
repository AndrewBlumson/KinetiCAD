// Imperative manager that turns the current `Assembly` into one Three.js Mesh
// per part, driven by the regen pipeline.
//
// Lifecycle is owned by Scene.tsx: it constructs one layer once the kernel is
// ready, calls `sync(...)` on every relevant store change, and `dispose()`s
// the layer when the scene unmounts.
//
// Concurrency:
// - `sync` is async because `regeneratePart` is async (worker round-trip).
// - Multiple sync calls may overlap if the user makes rapid changes. Each
//   call carries an incrementing token; a stale call's results are dropped
//   on completion so the most recent state wins.
// - The token is also bumped on every transition that should preempt a
//   pending regen (hide, empty-features, remove, dispose), otherwise a late
//   resolve could resurrect a hidden part or leak geometry into a detached
//   mesh.
// - Phase 3 has at most one feature per part, so a single in-flight regen
//   per part is the realistic upper bound.
//
// Phase 4 Split A: each entry now also caches the tip mesh's edge + face
// topology so the topology picker (TopologyPicker.ts) can resolve raycaster
// hits to face ids and compute screen-space proximity for edges. The cache is
// invalidated on every transition that drops `lastHash` (failure, hide,
// empty-features, remove).

import * as THREE from "three";
import type { Remote } from "comlink";
import type { Assembly, Part } from "@/state/schemas";
import type {
  CadKernelApi,
  EdgeMetadata,
  FaceMetadata,
  TessellatedMesh,
} from "@/cad/types";
import { regeneratePart } from "@/features/featureRegen";
import { COLOURS } from "./sceneSetup";

/**
 * Per-part topology cached on the main thread alongside its Three.js mesh.
 *
 * `faceForTriangle[k]` is the index into `faces[]` for triangle k (the same
 * triangle index Three.js's raycaster reports as `intersection.faceIndex`).
 * Built once after each successful regen and disposed alongside the mesh.
 */
export type PartTopology = {
  edges: EdgeMetadata[];
  faces: FaceMetadata[];
  /** Length = total triangle count. Indices into `faces[]`. */
  faceForTriangle: Uint32Array;
};

export type PartMeshLayer = {
  group: THREE.Group;
  /**
   * Reconcile the layer with the given assembly. Every part id in
   * `hiddenPartIds` is suppressed from rendering — used both by the active
   * feature editor's live preview (replaces a single part) and by Phase 5
   * booleans that hide their input parts in favour of the result mesh.
   * `kernel` is the remote CAD kernel used by `regeneratePart`.
   */
  sync: (
    assembly: Assembly,
    hiddenPartIds: Set<string>,
    kernel: Remote<CadKernelApi>,
  ) => void;
  /** Total tracked part meshes (for diagnostics / tests). */
  size: () => number;
  /** Returns the live Three.js mesh for a part, or null if not visible. */
  getPartMesh: (partId: string) => THREE.Mesh | null;
  /**
   * Returns cached topology for the part, or null if the part has never
   * regenerated successfully or is currently hidden / empty.
   */
  getPartTopology: (partId: string) => PartTopology | null;
  /**
   * Iterate over all parts that currently have visible meshes + topology.
   * Used by the topology picker to scan all candidates per mouse event.
   */
  forEachVisible: (
    fn: (partId: string, mesh: THREE.Mesh, topology: PartTopology) => void,
  ) => void;
  /**
   * Bump on every successful regen so reactive consumers (Scene.tsx selection
   * subscriber) know to re-resolve highlight geometry.
   */
  topologyVersion: () => number;
  dispose: () => void;
};

type Entry = {
  /** The mesh added to the layer's group (always present, even if empty geometry). */
  mesh: THREE.Mesh;
  /** Hash of the part's last-rendered tip mesh, so we can skip pointless rebuilds. */
  lastHash: string | null;
  /** Token of the most recent sync started for this part. */
  inFlightToken: number;
  /** Cleared by removeEntry — late async completions check this before mutating. */
  alive: boolean;
  /** Cached topology for picking. Null when the mesh is hidden / empty / failed. */
  topology: PartTopology | null;
};

function buildFaceForTriangle(
  triangleCount: number,
  faces: FaceMetadata[],
): Uint32Array {
  const out = new Uint32Array(triangleCount);
  // Sentinel for "no face" — picker treats out-of-range face indices as a
  // no-hit. We pick 0xFFFFFFFF so any legitimate face index (≪ 4 billion)
  // contrasts cleanly.
  out.fill(0xffffffff);
  for (let f = 0; f < faces.length; f++) {
    const tris = faces[f].triangles;
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      if (t < triangleCount) out[t] = f;
    }
  }
  return out;
}

export function createPartMeshLayer(): PartMeshLayer {
  const group = new THREE.Group();
  group.name = "PartMeshLayer";

  // One shared material across all parts until Phase 10 introduces the
  // material library. MeshStandardMaterial keeps the look consistent with
  // the Phase 1 test cube.
  const sharedMaterial = new THREE.MeshStandardMaterial({
    color: COLOURS.defaultPart,
    metalness: 0.4,
    roughness: 0.5,
  });

  const entries = new Map<string, Entry>();
  let nextToken = 1;
  let isDisposed = false;
  let _topologyVersion = 0;

  const buildGeometry = (mesh: TessellatedMesh): THREE.BufferGeometry => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(mesh.positions, 3),
    );
    geom.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    geom.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geom.computeBoundingBox();
    // Bounding sphere is required for the orbit controls' framing logic to
    // behave with off-origin geometry.
    geom.computeBoundingSphere();
    return geom;
  };

  const ensureEntry = (partId: string): Entry => {
    let entry = entries.get(partId);
    if (entry) return entry;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Part:${partId}`;
    mesh.visible = false;
    group.add(mesh);
    entry = {
      mesh,
      lastHash: null,
      inFlightToken: 0,
      alive: true,
      topology: null,
    };
    entries.set(partId, entry);
    return entry;
  };

  const removeEntry = (partId: string): void => {
    const entry = entries.get(partId);
    if (!entry) return;
    // Mark dead first so any pending regen completion bails out before
    // touching the mesh we're about to dispose.
    entry.alive = false;
    entry.inFlightToken = ++nextToken;
    entry.topology = null;
    group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    // Material is shared — do NOT dispose it here.
    entries.delete(partId);
    _topologyVersion++;
  };

  const regenAndApply = async (
    part: Part,
    kernel: Remote<CadKernelApi>,
    entry: Entry,
    token: number,
  ): Promise<void> => {
    try {
      const result = await regeneratePart(part, kernel);
      // Drop stale results in three cases:
      //  1. The layer was disposed.
      //  2. The entry was removed (alive=false).
      //  3. A newer sync started for this part (token mismatch).
      // The token check handles "hidden" / "no features" transitions because
      // sync() bumps inFlightToken in those branches too.
      if (isDisposed) return;
      if (!entry.alive) return;
      if (entry.inFlightToken !== token) return;

      const last = result.perFeature[result.perFeature.length - 1];
      if (!result.mesh || !last || !last.ok) {
        // Failure: hide the mesh. The inspector handles error messaging via
        // the live-preview path; PartMeshLayer just renders what succeeds.
        entry.mesh.visible = false;
        entry.lastHash = null;
        entry.topology = null;
        _topologyVersion++;
        return;
      }
      // Skip rebuild if the tip hash hasn't changed (cache hit).
      if (entry.lastHash === last.hash) {
        entry.mesh.visible = true;
        return;
      }
      const newGeom = buildGeometry(result.mesh);
      const oldGeom = entry.mesh.geometry;
      entry.mesh.geometry = newGeom;
      oldGeom.dispose();
      entry.mesh.visible = true;
      entry.lastHash = last.hash;
      // Build the triangle-to-face lookup. The mesh's index buffer is the
      // canonical source of triangle count (length / 3).
      const triangleCount = result.mesh.indices.length / 3;
      entry.topology = {
        edges: result.mesh.edges,
        faces: result.mesh.faces,
        faceForTriangle: buildFaceForTriangle(triangleCount, result.mesh.faces),
      };
      _topologyVersion++;
    } catch {
      if (isDisposed || !entry.alive) return;
      if (entry.inFlightToken !== token) return;
      entry.mesh.visible = false;
      entry.lastHash = null;
      entry.topology = null;
      _topologyVersion++;
    }
  };

  const sync = (
    assembly: Assembly,
    hiddenPartIds: Set<string>,
    kernel: Remote<CadKernelApi>,
  ): void => {
    if (isDisposed) return;
    const seen = new Set<string>();

    for (const part of assembly.parts) {
      seen.add(part.id);
      const entry = ensureEntry(part.id);

      if (hiddenPartIds.has(part.id)) {
        // Suppressed by the preview overlay. Bump the token so any pending
        // regen for this part is dropped before it can flip visibility back
        // on. Keep the entry alive — we still want it when the preview
        // clears.
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
        // Topology stays cached: when the preview clears we re-sync and the
        // hash check skips a rebuild. But the picker shouldn't see hidden
        // parts, so forEachVisible filters by mesh.visible.
        continue;
      }

      if (part.features.length === 0) {
        // Sketches-only parts have nothing to render. Same token-bump
        // reasoning as the hidden case: a stale extrude regen returning
        // here must not light the mesh back up.
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
        entry.lastHash = null;
        if (entry.topology) {
          entry.topology = null;
          _topologyVersion++;
        }
        continue;
      }

      // Kick off (or replace) an in-flight regen for this part.
      const token = ++nextToken;
      entry.inFlightToken = token;
      void regenAndApply(part, kernel, entry, token);
    }

    // Drop entries for parts that no longer exist in the assembly.
    for (const id of Array.from(entries.keys())) {
      if (!seen.has(id)) removeEntry(id);
    }
  };

  const size = (): number => entries.size;

  const getPartMesh = (partId: string): THREE.Mesh | null => {
    const e = entries.get(partId);
    if (!e || !e.mesh.visible) return null;
    return e.mesh;
  };

  const getPartTopology = (partId: string): PartTopology | null => {
    const e = entries.get(partId);
    if (!e) return null;
    return e.topology;
  };

  const forEachVisible = (
    fn: (partId: string, mesh: THREE.Mesh, topology: PartTopology) => void,
  ): void => {
    for (const [id, entry] of entries) {
      if (!entry.mesh.visible) continue;
      if (!entry.topology) continue;
      fn(id, entry.mesh, entry.topology);
    }
  };

  const topologyVersion = (): number => _topologyVersion;

  const dispose = (): void => {
    isDisposed = true;
    for (const id of Array.from(entries.keys())) {
      removeEntry(id);
    }
    sharedMaterial.dispose();
    if (group.parent) group.parent.remove(group);
  };

  return {
    group,
    sync,
    size,
    getPartMesh,
    getPartTopology,
    forEachVisible,
    topologyVersion,
    dispose,
  };
}
