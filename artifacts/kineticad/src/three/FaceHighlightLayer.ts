// Phase 4 Split A — Face highlight overlay.
//
// Renders translucent overlay meshes on top of the part meshes for the hover
// and selected faces, plus a thicker outline (Line2) around the boundary of
// the selected face.
//
// Z-fighting is avoided by:
//   - polygonOffset:true / polygonOffsetFactor:-1 so the overlay always wins.
//   - depthWrite:false so the overlay doesn't pollute the depth buffer.
//   - renderOrder:998 (just below the edge layer at 999) so faces draw before
//     edges.

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { COLOURS } from "./sceneSetup";
import type { FaceMetadata } from "@/cad/types";

const HOVER_COLOR = new THREE.Color(COLOURS.highlightHover ?? 0xffaa00);
const SELECTED_COLOR = new THREE.Color(COLOURS.highlightSelected ?? 0xff7700);

export type FaceOverlayInput = {
  /** Triangle indices (k where the triangle is at indices[3k..3k+2]). */
  triangles: Uint32Array;
  /** Source positions buffer (the part's mesh.positions). */
  positions: Float32Array;
  /** Source indices buffer (the part's mesh.indices). */
  indices: Uint32Array;
};

export type FaceHighlightLayer = {
  group: THREE.Group;
  setResolution: (widthPx: number, heightPx: number) => void;
  setHover: (input: FaceOverlayInput | null) => void;
  /**
   * Show a selected face. `boundaryPolylines` are the world-space xyz
   * polylines of the face's bounding edges (drawn as Line2 outlines).
   */
  setSelected: (
    input: FaceOverlayInput | null,
    boundaryPolylines: Float32Array[],
  ) => void;
  dispose: () => void;
};

function buildOverlayGeometry(input: FaceOverlayInput): THREE.BufferGeometry {
  // Sub-mesh: copy only the triangles the face owns into a new buffer.
  // This is small (a few KB at most) and lets us reuse one BufferGeometry
  // pattern with no shader-side filtering.
  const tris = input.triangles;
  const subIndices = new Uint32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    subIndices[3 * i] = input.indices[3 * t];
    subIndices[3 * i + 1] = input.indices[3 * t + 1];
    subIndices[3 * i + 2] = input.indices[3 * t + 2];
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    "position",
    new THREE.BufferAttribute(input.positions, 3),
  );
  geom.setIndex(new THREE.BufferAttribute(subIndices, 1));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Convenience helper for callers (Scene.tsx): given a face's metadata + the
 * part mesh's positions/indices, build a FaceOverlayInput.
 */
export function faceOverlayFromMetadata(
  face: FaceMetadata,
  positions: Float32Array,
  indices: Uint32Array,
): FaceOverlayInput {
  return { triangles: face.triangles, positions, indices };
}

export function createFaceHighlightLayer(): FaceHighlightLayer {
  const group = new THREE.Group();
  group.name = "FaceHighlightLayer";

  const hoverMaterial = new THREE.MeshBasicMaterial({
    color: HOVER_COLOR.getHex(),
    transparent: true,
    opacity: 0.15,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  const selectedMaterial = new THREE.MeshBasicMaterial({
    color: SELECTED_COLOR.getHex(),
    transparent: true,
    opacity: 0.3,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
  const outlineMaterial = new LineMaterial({
    color: SELECTED_COLOR.getHex(),
    linewidth: 2,
    transparent: true,
    opacity: 1.0,
    depthTest: true,
    depthWrite: false,
  });
  outlineMaterial.resolution.set(window.innerWidth, window.innerHeight);

  let hoverMesh: THREE.Mesh | null = null;
  let selectedMesh: THREE.Mesh | null = null;
  const outlineLines: Line2[] = [];

  const clearHover = (): void => {
    if (hoverMesh) {
      group.remove(hoverMesh);
      hoverMesh.geometry.dispose();
      hoverMesh = null;
    }
  };

  const clearSelected = (): void => {
    if (selectedMesh) {
      group.remove(selectedMesh);
      selectedMesh.geometry.dispose();
      selectedMesh = null;
    }
    for (const l of outlineLines) {
      group.remove(l);
      l.geometry.dispose();
    }
    outlineLines.length = 0;
  };

  const setResolution = (widthPx: number, heightPx: number): void => {
    outlineMaterial.resolution.set(widthPx, heightPx);
  };

  const setHover = (input: FaceOverlayInput | null): void => {
    clearHover();
    if (!input || input.triangles.length === 0) return;
    const geom = buildOverlayGeometry(input);
    hoverMesh = new THREE.Mesh(geom, hoverMaterial);
    hoverMesh.renderOrder = 998;
    group.add(hoverMesh);
  };

  const setSelected = (
    input: FaceOverlayInput | null,
    boundaryPolylines: Float32Array[],
  ): void => {
    clearSelected();
    if (!input || input.triangles.length === 0) return;
    const geom = buildOverlayGeometry(input);
    selectedMesh = new THREE.Mesh(geom, selectedMaterial);
    selectedMesh.renderOrder = 998;
    group.add(selectedMesh);

    for (const poly of boundaryPolylines) {
      if (poly.length < 6) continue;
      const lg = new LineGeometry();
      lg.setPositions(Array.from(poly));
      const line = new Line2(lg, outlineMaterial);
      line.computeLineDistances();
      line.renderOrder = 999;
      outlineLines.push(line);
      group.add(line);
    }
  };

  const dispose = (): void => {
    clearHover();
    clearSelected();
    hoverMaterial.dispose();
    selectedMaterial.dispose();
    outlineMaterial.dispose();
    if (group.parent) group.parent.remove(group);
  };

  return {
    group,
    setResolution,
    setHover,
    setSelected,
    dispose,
  };
}
