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
// Pivots use the same stored local anchors as the physics joints. Each glyph
// lives in a part-local frame whose pose follows the rendered rigid body.

import * as THREE from "three";
// Use the WebGPU-native NodeMaterial variants. The classic
// `THREE.MeshBasicMaterial` / `THREE.LineBasicMaterial` log
// `THREE.NodeBuilder: Material "<X>" is not compatible.` once per frame
// per material under WebGPURenderer (Phase 7 regression — was previously
// fixed in EdgeHighlightLayer / FaceHighlightLayer / sketchPrimitiveRenderer
// and reintroduced by the new MateVisualizer).
import {
  MeshBasicNodeMaterial,
  LineBasicNodeMaterial,
} from "three/webgpu";
import type { Assembly, Mate } from "@/state/schemas";
import type { PartMeshLayer } from "./PartMeshLayer";

const ICON_COLOR = 0xff6b1a;
const RENDER_ORDER = 999;
const SELECTED_SCALE = 1.5;
const SELECTED_OPACITY = 1;
const UNSELECTED_OPACITY = 0.6;

/**
 * One icon entry per mate. The `Object3D` is added to the visualizer's
 * group; geometry/material are owned by it and disposed on rebuild.
 */
type IconGlyph = {
  object: THREE.Object3D;
  /** All materials we created — disposed on icon teardown. */
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
};

type IconEntry = {
  glyph: IconGlyph;
  frame: THREE.Group;
  partId: string;
  signature: string;
};

export type MateVisualizer = {
  group: THREE.Group;
  sync: (
    assembly: Assembly,
    selectedMateId: string | null,
    layer: PartMeshLayer,
  ) => void;
  /** Follow the same world-space poses as the rendered modelling/simulation bodies. */
  updatePoses: (getPartObject: (partId: string) => THREE.Object3D | null) => void;
  dispose: () => void;
};

export function createMateVisualizer(): MateVisualizer {
  const group = new THREE.Group();
  group.name = "mate-visualizer";

  const entries = new Map<string, IconEntry>();

  const disposeEntry = (entry: IconEntry) => {
    for (const m of entry.glyph.materials) m.dispose();
    for (const g of entry.glyph.geometries) g.dispose();
    entry.frame.parent?.remove(entry.frame);
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

    // Body motion only changes the parent frame. Reuse glyph geometry across
    // simulation ticks instead of allocating/discarding GPU buffers every frame.
    for (const mate of assembly.mates) {
      const part = assembly.parts.find((p) => p.id === mate.partA);
      if (!part) continue;
      const signature = JSON.stringify(mate) + (mate.type === 'planar' ? layer.topologyVersion() : '');
      let entry = entries.get(mate.id);
      if (entry && entry.signature !== signature) {
        disposeEntry(entry);
        entries.delete(mate.id);
        entry = undefined;
      }
      if (!entry) {
        const glyph = buildIcon(mate, layer);
        if (!glyph) continue;
        const frame = new THREE.Group();
        frame.name = `mate:${mate.id}`;
        frame.add(glyph.object);
        entry = { glyph, frame, partId: part.id, signature };
        group.add(frame);
        entries.set(mate.id, entry);
      }
      entry.frame.visible = part.visible;
      entry.frame.position.fromArray(part.transform.positionMm);
      const [rx, ry, rz] = part.transform.rotationDeg.map(THREE.MathUtils.degToRad);
      entry.frame.rotation.set(rx, ry, rz, 'XYZ');
      applySelectionStyle(entry.glyph, mate.id === selectedMateId);
    }
  };

  const updatePoses: MateVisualizer['updatePoses'] = (getPartObject) => {
    for (const entry of entries.values()) {
      const body = getPartObject(entry.partId);
      if (!body) {
        entry.frame.visible = false;
        continue;
      }
      body.getWorldPosition(entry.frame.position);
      body.getWorldQuaternion(entry.frame.quaternion);
      entry.frame.visible = body.visible;
    }
  };

  const dispose = () => {
    for (const [, entry] of entries) disposeEntry(entry);
    entries.clear();
    group.parent?.remove(group);
  };

  return { group, sync, updatePoses, dispose };
}

/* -------------------------------------------------------------------------- */
/*  Icon builders                                                             */
/* -------------------------------------------------------------------------- */

function buildIcon(
  mate: Mate,
  layer: PartMeshLayer,
): IconGlyph | null {
  const topologyA = layer.getPartTopology(mate.partA);

  switch (mate.type) {
    case "revolute": {
      return buildAxisCylinder(mate.pivotA.localPoint, mate.axisLocal);
    }
    case "prismatic": {
      return buildDoubleArrow(mate.pivotA.localPoint, mate.axisLocal);
    }
    case "spherical": {
      return buildSphere(mate.pivotA.localPoint);
    }
    case "fixed": {
      // Fixed mates have no pivot — anchor the icon to part-A's transform
      // origin (the part's local origin in world coords).
      return buildCube([0, 0, 0]);
    }
    case "planar": {
      if (!topologyA) return null;
      const face = topologyA.faces.find((f) => f.id === mate.pivotA.faceId);
      if (!face) return null;
      return buildParallelBars(face.centroid, face.normalAtCentroid);
    }
  }
}

/* ---- Glyph builders ------------------------------------------------------ */

function makeMaterial(): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial({
    color: ICON_COLOR,
    transparent: true,
    opacity: UNSELECTED_OPACITY,
    depthTest: false,
    depthWrite: false,
  });
  // NodeMaterials default to NoBlending; force NormalBlending so the
  // transparent overlay actually composites against the scene.
  m.blending = THREE.NormalBlending;
  return m;
}

function makeLineMaterial(): LineBasicNodeMaterial {
  const m = new LineBasicNodeMaterial({
    color: ICON_COLOR,
    transparent: true,
    opacity: UNSELECTED_OPACITY,
    depthTest: false,
    depthWrite: false,
  });
  m.blending = THREE.NormalBlending;
  return m;
}

function setRenderOrder(obj: THREE.Object3D) {
  obj.renderOrder = RENDER_ORDER;
  obj.traverse((c) => {
    c.renderOrder = RENDER_ORDER;
  });
}

function buildAxisCylinder(
  pivot: [number, number, number],
  axisLocal: [number, number, number],
): IconGlyph {
  // Both the pivot and axis are part-local. The entry frame supplies the
  // body pose; orient THREE's +Y cylinder along the local joint axis here.
  const geom = new THREE.CylinderGeometry(1, 1, 3, 24, 1, false);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(...axisLocal).normalize(),
  );
  mesh.quaternion.copy(q);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildDoubleArrow(
  pivot: [number, number, number],
  axisLocal: [number, number, number],
): IconGlyph {
  // Two cones tip-to-tip along axis. Each cone is 2mm tall, 1mm base
  // radius. Bases are 0.5mm apart so the silhouette reads as ↔.
  const grp = new THREE.Group();
  const dir = new THREE.Vector3(...axisLocal).normalize();
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
  wrapA.quaternion.copy(q);

  const coneB = new THREE.Mesh(geom, matB);
  coneB.rotation.set(Math.PI, 0, 0); // Flip so it points -Y.
  coneB.position.set(0, -1.25, 0);
  const wrapB = new THREE.Group();
  wrapB.add(coneB);
  wrapB.quaternion.copy(q);

  grp.add(wrapA);
  grp.add(wrapB);
  grp.position.fromArray(pivot);
  setRenderOrder(grp);
  return { object: grp, materials: [matA, matB], geometries: [geom] };
}

function buildSphere(pivot: [number, number, number]): IconGlyph {
  const geom = new THREE.SphereGeometry(1.5, 16, 12);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildCube(pivot: [number, number, number]): IconGlyph {
  const geom = new THREE.BoxGeometry(2.5, 2.5, 2.5);
  const mat = makeMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pivot[0], pivot[1], pivot[2]);
  setRenderOrder(mesh);
  return { object: mesh, materials: [mat], geometries: [geom] };
}

function buildParallelBars(
  centroid: [number, number, number],
  normalLocal: [number, number, number],
): IconGlyph {
  // Two short line segments parallel to one in-plane direction, separated
  // by a 1mm gap perpendicular to it. All geometry is part-local.
  const n = new THREE.Vector3(...normalLocal).normalize();
  // Pick any in-plane axis — start from local X, fall back to Y if X is
  // nearly parallel to the normal.
  let inPlaneA = new THREE.Vector3(1, 0, 0);
  if (Math.abs(n.dot(inPlaneA)) > 0.9) inPlaneA.set(0, 1, 0);
  inPlaneA = inPlaneA.sub(n.clone().multiplyScalar(n.dot(inPlaneA))).normalize();
  const inPlaneB = new THREE.Vector3().crossVectors(n, inPlaneA).normalize();

  const halfLen = 1.5;
  const offset = 0.6;
  const c = new THREE.Vector3();

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
  grp.position.fromArray(centroid);
  grp.add(a.line);
  grp.add(b.line);
  setRenderOrder(grp);
  return {
    object: grp,
    materials: [a.line.material as THREE.Material, b.line.material as THREE.Material],
    geometries: [a.geom, b.geom],
  };
}

function applySelectionStyle(entry: IconGlyph, selected: boolean) {
  const opacity = selected ? SELECTED_OPACITY : UNSELECTED_OPACITY;
  for (const m of entry.materials) {
    (m as MeshBasicNodeMaterial | LineBasicNodeMaterial).opacity = opacity;
  }
  const scale = selected ? SELECTED_SCALE : 1;
  entry.object.scale.set(scale, scale, scale);
}
