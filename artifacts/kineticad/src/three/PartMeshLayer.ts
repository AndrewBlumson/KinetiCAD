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
//
// Phase 4 Split A: each entry now also caches the tip mesh's edge + face
// topology so the topology picker (TopologyPicker.ts) can resolve raycaster
// hits to face ids and compute screen-space proximity for edges.
//
// Phase 10: per-materialId MeshStandardMaterial pairs (opaque + dimmed) are
// created lazily and cached for the layer's lifetime. The `sync` loop applies
// the correct pair immediately (no regen required) so colour changes are
// instantaneous. After each successful regen (or material change), the layer
// fetches mass properties from the CAD worker and fires `onMassPropsUpdate`
// so Scene.tsx can dispatch `updatePartMassProps` to the store for the
// PartInspector readout.

import * as THREE from "three";
import type { Remote } from "comlink";
import type { Assembly, Part } from "@/state/schemas";
import type {
  CadKernelApi,
  EdgeMetadata,
  FaceMetadata,
  TessellatedMesh,
} from "@/cad/types";
import { getMaterial } from "@/cad/materials";
import { regeneratePart } from "@/features/featureRegen";
import { getVolumeData, setVolumeData } from "@/features/volumeCache";
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
   * Reconcile the layer with the given assembly. Per-part visibility is
   * driven by two disjoint id sets:
   *
   *  - `hiddenPartIds`: suppressed from rendering entirely. Used by base-
   *    feature CREATE editors (extrude/revolve from sketch) where the
   *    preview mesh REPLACES the body, and by Phase 5 booleans that hide
   *    their input parts in favour of the result mesh.
   *
   *  - `dimmedPartIds`: rendered at reduced opacity (0.4) instead of full.
   *    Used during EDIT mode on any feature so the user sees the original
   *    body underneath while the live-preview overlay shows the modified
   *    state at 0.85 opacity. CREATE mode on a MODIFICATION feature
   *    (fillet/chamfer/hole) leaves the part out of both sets, so the
   *    body stays at full opacity and the user can hover edges/faces to
   *    pick them.
   *
   * If a part id appears in both sets, `hiddenPartIds` wins (it's the
   * stronger constraint).
   *
   * `kernel` is the remote CAD kernel used by `regeneratePart`.
   *
   * `onMassPropsUpdate` is called after each successful regen (or material
   * change) with the computed volume and mass. Scene.tsx dispatches these
   * to the store so the PartInspector can display them.
   */
  sync: (
    assembly: Assembly,
    hiddenPartIds: Set<string>,
    dimmedPartIds: Set<string>,
    kernel: Remote<CadKernelApi>,
    onMassPropsUpdate?: (
      partId: string,
      volumeCm3: number,
      massKg: number,
    ) => void,
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
  /**
   * MaterialId that was in effect during the last mass-properties fetch.
   * When the user changes material, this diverges from `part.materialId` and
   * triggers a new getMassProperties call (density changed) even if geometry
   * is unchanged.
   */
  lastMaterialId: string | null;
  /** Token of the most recent sync started for this part. */
  inFlightToken: number;
  /** Cleared by removeEntry — late async completions check this before mutating. */
  alive: boolean;
  /** Cached topology for picking. Null when the mesh is hidden / empty / failed. */
  topology: PartTopology | null;
};

/** A lazily-created pair of materials for one materialId. */
type MatPair = {
  opaque: THREE.MeshStandardMaterial;
  dimmed: THREE.MeshStandardMaterial;
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

  // Per-materialId material pairs, created lazily on first use and disposed
  // together in dispose(). Using a cache means all parts with the same
  // material share the same Three.js material object — saves GPU state
  // switches and avoids memory leaks from per-mesh material creation.
  const materialCache = new Map<string, MatPair>();

  const getOrCreatePair = (materialId: string): MatPair => {
    let pair = materialCache.get(materialId);
    if (pair) return pair;
    const mat = getMaterial(materialId);
    const colour = mat.colour;
    const opaque = new THREE.MeshStandardMaterial({
      color: colour !== undefined ? colour : COLOURS.defaultPart,
      metalness: mat.metalness,
      roughness: mat.roughness,
    });
    const dimmed = new THREE.MeshStandardMaterial({
      color: colour !== undefined ? colour : COLOURS.defaultPart,
      metalness: mat.metalness,
      roughness: mat.roughness,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    pair = { opaque, dimmed };
    materialCache.set(materialId, pair);
    return pair;
  };

  // Seed the default material pair immediately so `ensureEntry` has
  // something to reference before the first sync.
  getOrCreatePair("aluminium-6061");

  const entries = new Map<string, Entry>();
  let nextToken = 1;
  let isDisposed = false;
  let _topologyVersion = 0;

  // Latest callback passed by Scene.tsx. Updated by each sync() call so
  // in-flight regens always fire the current handler.
  let _onMassPropsUpdate:
    | ((partId: string, volumeCm3: number, massKg: number) => void)
    | undefined;

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

  const ensureEntry = (partId: string, materialId: string): Entry => {
    let entry = entries.get(partId);
    if (entry) return entry;
    const pair = getOrCreatePair(materialId);
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), pair.opaque);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Part:${partId}`;
    mesh.visible = false;
    group.add(mesh);
    entry = {
      mesh,
      lastHash: null,
      lastMaterialId: null,
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
    // Materials are owned by materialCache — do NOT dispose per-entry.
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
      if (isDisposed) return;
      if (!entry.alive) return;
      if (entry.inFlightToken !== token) return;

      const last = result.perFeature[result.perFeature.length - 1];
      if (!result.mesh || !last || !last.ok) {
        entry.mesh.visible = false;
        entry.lastHash = null;
        entry.lastMaterialId = null;
        entry.topology = null;
        _topologyVersion++;
        return;
      }

      const hashChanged = entry.lastHash !== last.hash;
      const materialChanged = part.materialId !== entry.lastMaterialId;

      // Skip geometry rebuild if the tip hash hasn't changed (cache hit).
      if (!hashChanged) {
        entry.mesh.visible = true;
      } else {
        const newGeom = buildGeometry(result.mesh);
        const oldGeom = entry.mesh.geometry;
        entry.mesh.geometry = newGeom;
        oldGeom.dispose();
        entry.mesh.visible = true;
        entry.lastHash = last.hash;
        // Build the triangle-to-face lookup.
        const triangleCount = result.mesh.indices.length / 3;
        entry.topology = {
          edges: result.mesh.edges,
          faces: result.mesh.faces,
          faceForTriangle: buildFaceForTriangle(
            triangleCount,
            result.mesh.faces,
          ),
        };
        _topologyVersion++;
      }

      // Update mass properties when geometry changed or material changed.
      // Volume + COM depend only on shape; mass = volume × density (arithmetic).
      // We cache { volumeMm3, comLocal } by tip hash so a material-only change
      // never needs an OCCT round-trip — just multiply by the new density.
      if ((hashChanged || materialChanged) && _onMassPropsUpdate) {
        entry.lastMaterialId = part.materialId;
        const cb = _onMassPropsUpdate;
        const mat = getMaterial(part.materialId);
        const tipHash = last.hash;
        const cachedVol = getVolumeData(tipHash);
        if (cachedVol) {
          // Warm cache — pure arithmetic, no worker call.
          const massKg = Math.max(
            cachedVol.volumeMm3 * mat.densityGcm3 * 1e-6,
            1e-6,
          );
          cb(part.id, cachedVol.volumeMm3 / 1000, massKg);
        } else {
          // Cold cache (first regen this session, or imported-step part).
          // Fall back to the OCCT worker; populate cache so the next
          // material change and the next Play press are free.
          try {
            const massResult = await kernel.getMassProperties({
              features: [...part.features],
              sketches: [...part.sketches],
              density: mat.densityGcm3,
            });
            // Re-check guards after the async round-trip.
            if (isDisposed || !entry.alive || entry.inFlightToken !== token)
              return;
            setVolumeData(tipHash, {
              volumeMm3: massResult.volumeMm3,
              comLocal: massResult.comLocal,
            });
            cb(part.id, massResult.volumeMm3 / 1000, massResult.massKg);
          } catch {
            // Mass-properties failure is non-fatal — geometry is still shown.
          }
        }
      } else if (materialChanged) {
        // No callback registered; still track the id so a future sync
        // with a callback doesn't skip the fetch.
        entry.lastMaterialId = part.materialId;
      }
    } catch {
      if (isDisposed || !entry.alive) return;
      if (entry.inFlightToken !== token) return;
      entry.mesh.visible = false;
      entry.lastHash = null;
      entry.lastMaterialId = null;
      entry.topology = null;
      _topologyVersion++;
    }
  };

  const sync = (
    assembly: Assembly,
    hiddenPartIds: Set<string>,
    dimmedPartIds: Set<string>,
    kernel: Remote<CadKernelApi>,
    onMassPropsUpdate?: (
      partId: string,
      volumeCm3: number,
      massKg: number,
    ) => void,
  ): void => {
    if (isDisposed) return;
    _onMassPropsUpdate = onMassPropsUpdate;
    const seen = new Set<string>();

    for (const part of assembly.parts) {
      seen.add(part.id);
      const entry = ensureEntry(part.id, part.materialId);

      if (hiddenPartIds.has(part.id)) {
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
        continue;
      }

      if (part.features.length === 0) {
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
        entry.lastHash = null;
        if (entry.topology) {
          entry.topology = null;
          _topologyVersion++;
        }
        continue;
      }

      // Apply the correct PBR material (opaque or dimmed) based on the
      // part's current materialId and dim flag. Synchronous — no regen
      // required — so colour changes take effect on the very next frame.
      const pair = getOrCreatePair(part.materialId);
      const desiredMaterial = dimmedPartIds.has(part.id)
        ? pair.dimmed
        : pair.opaque;
      if (entry.mesh.material !== desiredMaterial) {
        entry.mesh.material = desiredMaterial;
      }

      // Phase 6: apply the part's rigid-body transform to the mesh on
      // every sync. Cheap (assignment + dirty flag) and runs even on
      // hash-cached regens so a gizmo drag updates the visual position
      // without waiting for OCCT. Three.js consumes XYZ Euler with
      // 'XYZ' order; this matches the OCCT composition in cadWorker
      // (rotZ -> rotY -> rotX -> translate, i.e. M = T·Rx·Ry·Rz).
      const tx = part.transform;
      entry.mesh.position.set(
        tx.positionMm[0],
        tx.positionMm[1],
        tx.positionMm[2],
      );
      entry.mesh.rotation.set(
        (tx.rotationDeg[0] * Math.PI) / 180,
        (tx.rotationDeg[1] * Math.PI) / 180,
        (tx.rotationDeg[2] * Math.PI) / 180,
        "XYZ",
      );

      if (!part.visible) {
        entry.inFlightToken = ++nextToken;
        entry.mesh.visible = false;
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
    // Dispose all cached material pairs.
    for (const pair of materialCache.values()) {
      pair.opaque.dispose();
      pair.dimmed.dispose();
    }
    materialCache.clear();
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
