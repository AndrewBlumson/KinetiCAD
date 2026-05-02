// Phase 7 — 3D mate icon overlay.
//
// Imperative class that maintains one tiny "icon" per mate in the scene:
//
//   - Revolute  → thin orange cylinder (3mm long, 1mm radius) along axis
//   - Prismatic → small double-arrow (two cones tip-to-tip) along axis
//   - Spherical → orange sphere (1.5mm radius) at pivot
//   - Fixed     → small filled cube at partA centroid
//   - Planar    → two short parallel line segments on the shared face
//
// All materials run with `depthTest: false` and `renderOrder: 999` so the
// glyphs always read clearly in front of the parts they decorate. The
// selected mate scales 1.5× and renders at full opacity (1.0); unselected
// mates render at 0.6 opacity. Lifecycle and disposal are owned by Scene.tsx
// (sync on every assembly/selection change, dispose on unmount).
//
// Pivot resolution: we read PartMeshLayer's cached topology to look up the
// face/edge centroid, then compose with the part's rigid-body transform so
// the icon stays attached when the part moves.

import * as THREE from "three";
import type { Assembly, Mate, Part } from "@/state/schemas";
import type { PartMeshLayer } from "./PartMeshLayer";
import {
  getFaceCentroidWorld,
  getEdgeAxisWorld,
  localToWorldDir,
  localToWorldPoint,
} from "./MatePickerCoordinator";

const ICON_COLOR = 0xff6b1a;
const RENDER_ORDER = 999;
const SELECTED_SCALE = 1.5;
const SELECTED_OPACITY = 1;
const UNSELECTED_OPACITY = 0.6;

/**
 * One icon entry per mate. The `Object3D` is added to the visualizer's
 * group; geometry/material are owned by it and disposed on rebuild.
 */
type IconEntry = {
  object: THREE.Object3D;
  /** All materials we created — disposed on icon teardown. */
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

export type MateVisualizer = {
  group: THREE.Group;
  sync: (
    assembly: Assembly,
    selectedMateId: string | null,
    layer: PartMeshLayer,
  ) => void;
  dispose: () => void;
};

export function createMateVisualizer(): MateVisualizer {
  const group = new THREE.Group();
  group.name = "mate-visualizer";

  const entries = new Map<string, IconEntry>();

  const disposeEntry = (entry: IconEntry) => {
    for (const m of entry.materials) m.dispose();
    for (const g of entry.geometries) g.dispose();
    entry.object.parent?.remove(entry.object);
  };

  const sync = (
    assembly: Assembly,
    selectedMateId: string | null,
    layer: PartMeshLayer,
  ) => {
    const liveIds = new Set(assembly.mates.map((m) => m.id));

    // Drop entries for deleted mates.
    for (const [id, entry] of entries) {
      if (!liveIds.has(id)) {
        disposeEntry(entry);
        entries.delete(id);
      }
    }

    // Rebuild every live mate on every sync — the geometry depends on
    // part transforms which change frequently and the icons are cheap.
    for (const mate of assembly.mates) {
      const existing = entries.get(mate.id);
      if (existing) {
        disposeEntry(existing);
        entries.delete(mate.id);
      }
      const built = buildIcon(mate, assembly, layer);
      if (!built) continue;
      const selected = mate.id === selectedMateId;
      applySelectionStyle(built, selected);
      group.add(built.object);
      entries.set(mate.id, built);
    }
  };

  const dispose = () => {
    for (const [, entry] of entries) disposeEntry(entry);
    entries.clear();
    group.parent?.remove(group);
  };

  return { group, sync, dispose };
}

/* -------------------------------------------------------------------------- */
/*  Icon builders                                                             */
/* -------------------------------------------------------------------------- */

function buildIcon(
  mate: Mate,
  assembly: Assembly,
  layer: PartMeshLayer,
): IconEntry | null {
  const partA = assembly.parts.find((p) => p.id === mate.partA);
  if (!partA) return null;
  const topologyA = layer.getPartTopology(mate.partA);

  switch (mate.type) {
    case "revolute": {
      if (!topologyA) return null;
      const pivotWorld = resolvePivotWorld(partA, mate.pivotA, topologyA);
      if (!pivotWorld) return null;
      const axisWorld = localToWorldDir(mate.axisLocal, partA.transform);
      return buildAxisCylinder(pivotWorld, axisWorld);
    }
    case "prismatic": {
      if (!topologyA) return null;
      const pivotWorld = resolvePivotWorld(partA, mate.pivotA, topologyA);
      if (!pivotWorld) return null;
      const axisWorld = localToWorldDir(mate.axisLocal, partA.transform);
      return buildDoubleArrow(pivotWorld, axisWorld);
    }
    case "spherical": {
      if (!topologyA) return null;
      const pivotWorld = resolvePivotWorld(partA, mate.pivotA, topologyA);
      if (!pivotWorld) return null;
      return buildSphere(pivotWorld);
    }
    case "fixed": {
      // Fixed mates have no pivot — anchor the icon to part-A's transform
      // origin (the part's local origin in world coords).
      const center = localToWorldPoint([0, 0, 0], partA.transform);
      return buildCube(center);
    }
    case "planar": {
      if (!topologyA) return null;
      const centroidA = getFaceCentroidWorld(partA, mate.pivotA.faceId, topologyA);
      const face = topologyA.faces.find((f) => f.id === mate.pivotA.faceId);
      if (!centroidA || !face) return null;
      const normalWorld = localToWorldDir(face.normalAtCentroid, partA.transform);
      return buildParallelBars(centroidA, normalWorld);
    }
  }
}

/**
 * Resolve a MatePivot to world-space coordinates by composing its
 * `localPoint` with the part's transform. For face pivots, the kernel-
 * supplied centroid is the natural anchor; for edge pivots, the midpoint.
 * This helper just transforms the stored `localPoint` (which captures
 * either of the above at pick time).
 */
function resolvePivotWorld(
  part: Part,
  pivot:
    | { kind: "face"; faceId: string; localPoint: [number, number, number] }
    | { kind: "edge"; edgeId: string; localPoint: [number, number, number] },
  topology: import("./PartMeshLayer").PartTopology,
): [number, number, number] | null {
  if (pivot.kind === "edge") {
    // Re-derive from polyline if available so the icon tracks regen-driven
    // edge geometry edits; fall back to stored localPoint otherwise.
    const ax = getEdgeAxisWorld(part, pivot.edgeId, topology);
    if (ax) return ax.centroid;
  } else {
    const c = getFaceCentroidWorld(part, pivot.faceId, topology);
    if (c) return c;
  }
  return localToWorldPoint(pivot.localPoint, part.transform);
}

/* ---- Glyph builders ------------------------------------------------------ */

function makeMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: ICON_COLOR,
    transparent: true,
    opacity: UNSELECTED_OPACITY,
    depthTest: false,
    depthWrite: false,
  });
}

function makeLineMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: ICON_COLOR,
    transparent: true,
    opacity: UNSELECTED_OPACITY,
    depthTest: false,
    depthWrite: false,
  });
}

function setRenderOrder(obj: THREE.Object3D) {
  obj.renderOrder = RENDER_ORDER;
  obj.traverse((c) => {
    c.renderOrder = RENDER_ORDER;
  });
}

function buildAxisCylinder(
  pivot: [number, number, number],
  axisWorld: [number, number, number],
): IconEntry {
  // Cylinder centred at pivot, oriented along axisWorld. THREE's cylinder
  // defaults to a +Y axis; rotate the unit Y to axisWorld via quaternion.
  const geom = new THREE.CylinderGeometry(1, 1, 3, 24, 1, false);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(axisWorld[0], axisWorld[1], axisWorld[2]).normalize(),
  );
  mesh.quaternion.copy(q);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildDoubleArrow(
  pivot: [number, number, number],
  axisWorld: [number, number, number],
): IconEntry {
  // Two cones tip-to-tip along axis. Each cone is 2mm tall, 1mm base
  // radius. Bases are 0.5mm apart so the silhouette reads as ↔.
  const grp = new THREE.Group();
  const dir = new THREE.Vector3(axisWorld[0], axisWorld[1], axisWorld[2]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir,
  );

  const matA = makeMaterial();
  const matB = makeMaterial();
  const geom = new THREE.ConeGeometry(1, 2, 16);

  const coneA = new THREE.Mesh(geom, matA);
  // Cone defaults to point at +Y; offset it +Y by 1.25 (half its height +
  // a 0.25mm gap) BEFORE applying the orientation quaternion.
  coneA.position.set(0, 1.25, 0);
  const wrapA = new THREE.Group();
  wrapA.add(coneA);
  wrapA.position.set(pivot[0], pivot[1], pivot[2]);
  wrapA.quaternion.copy(q);

  const coneB = new THREE.Mesh(geom, matB);
  coneB.rotation.set(Math.PI, 0, 0); // Flip so it points -Y.
  coneB.position.set(0, -1.25, 0);
  const wrapB = new THREE.Group();
  wrapB.add(coneB);
  wrapB.position.set(pivot[0], pivot[1], pivot[2]);
  wrapB.quaternion.copy(q);

  grp.add(wrapA);
  grp.add(wrapB);
  setRenderOrder(grp);
  return { object: grp, materials: [matA, matB], geometries: [geom] };
}

function buildSphere(pivot: [number, number, number]): IconEntry {
  const geom = new THREE.SphereGeometry(1.5, 16, 12);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildCube(pivot: [number, number, number]): IconEntry {
  const geom = new THREE.BoxGeometry(2.5, 2.5, 2.5);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildParallelBars(
  centroid: [number, number, number],
  normalWorld: [number, number, number],
): IconEntry {
  // Two short line segments parallel to one in-plane direction, separated
  // by a 1mm gap perpendicular to it. The plane is defined by `normalWorld`.
  const n = new THREE.Vector3(
    normalWorld[0],
    normalWorld[1],
    normalWorld[2],
  ).normalize();
  // Pick any in-plane axis — start from world X, fall back to Y if X is
  // nearly parallel to the normal.
  let inPlaneA = new THREE.Vector3(1, 0, 0);
  if (Math.abs(n.dot(inPlaneA)) > 0.9) inPlaneA.set(0, 1, 0);
  inPlaneA = inPlaneA.sub(n.clone().multiplyScalar(n.dot(inPlaneA))).normalize();
  const inPlaneB = new THREE.Vector3().crossVectors(n, inPlaneA).normalize();

  const halfLen = 1.5;
  const offset = 0.6;
  const c = new THREE.Vector3(centroid[0], centroid[1], centroid[2]);

  const buildSegment = (sign: number): { line: THREE.Line; geom: THREE.BufferGeometry } => {
    const start = c
      .clone()
      .add(inPlaneB.clone().multiplyScalar(sign * offset))
      .add(inPlaneA.clone().multiplyScalar(-halfLen));
    const end = c
      .clone()
      .add(inPlaneB.clone().multiplyScalar(sign * offset))
      .add(inPlaneA.clone().multiplyScalar(halfLen));
    const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
    return { line: new THREE.Line(geom, makeLineMaterial()), geom };
  };

  const a = buildSegment(+1);
  const b = buildSegment(-1);
  const grp = new THREE.Group();
  grp.add(a.line);
  grp.add(b.line);
  setRenderOrder(grp);
  return {
    object: grp,
    materials: [a.line.material as THREE.Material, b.line.material as THREE.Material],
    geometries: [a.geom, b.geom],
  };
}

function applySelectionStyle(entry: IconEntry, selected: boolean) {
  const opacity = selected ? SELECTED_OPACITY : UNSELECTED_OPACITY;
  for (const m of entry.materials) {
    (m as THREE.MeshBasicMaterial | THREE.LineBasicMaterial).opacity = opacity;
  }
  const scale = selected ? SELECTED_SCALE : 1;
  entry.object.scale.set(scale, scale, scale);
}
