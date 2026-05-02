// Single-mesh layer for the in-flight feature editor's live preview.
//
// Renders at 0.85 opacity so the user can tell it isn't yet committed. On
// Apply, Scene.tsx clears this layer and the new geometry shows up via
// PartMeshLayer at full opacity. On Cancel, this layer also clears and the
// original part mesh comes back.

import * as THREE from "three";
import type { TessellatedMesh } from "@/cad/types";
import { COLOURS } from "./sceneSetup";

export type PreviewMeshLayer = {
  group: THREE.Group;
  /** Replace (or clear, with `null`) the preview mesh. */
  setMesh: (mesh: TessellatedMesh | null) => void;
  dispose: () => void;
};

export function createPreviewMeshLayer(): PreviewMeshLayer {
  const group = new THREE.Group();
  group.name = "PreviewMeshLayer";

  const material = new THREE.MeshStandardMaterial({
    color: COLOURS.defaultPart,
    metalness: 0.4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.85,
    // depthWrite false avoids self-sort artefacts on the translucent surface.
    depthWrite: false,
  });

  let mesh: THREE.Mesh | null = null;

  const clear = (): void => {
    if (!mesh) return;
    group.remove(mesh);
    mesh.geometry.dispose();
    mesh = null;
  };

  const setMesh = (data: TessellatedMesh | null): void => {
    clear();
    if (!data) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geom.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    const next = new THREE.Mesh(geom, material);
    // No shadow: the preview is meant to read as ephemeral.
    next.castShadow = false;
    next.receiveShadow = false;
    next.name = "FeaturePreview";
    next.renderOrder = 5;
    group.add(next);
    mesh = next;
  };

  const dispose = (): void => {
    clear();
    material.dispose();
    if (group.parent) group.parent.remove(group);
  };

  return { group, setMesh, dispose };
}
