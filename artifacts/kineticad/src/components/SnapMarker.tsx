// Snap marker visuals.
//
// Spec calls this `.tsx` but, like sketchOverlay, the rest of the scene is
// imperative. We expose a builder/disposer pair that hands back a single
// THREE.Group containing all three marker shapes (circle, diamond, triangle).
// Toggling visibility is cheaper than rebuilding meshes per snap event.

import * as THREE from "three";
import type { SnapResult, SnapType } from "@/sketch/snapEngine";
import { planeToWorld, type CardinalPlane, PLANE_VIEWS } from "@/sketch/plane";

const ORANGE = 0xff6b1a;

// Sizes per spec.
const GRID_DOT_RADIUS_MM = 0.4;
const ENDPOINT_DIAMOND_SIZE_MM = 0.8;
const MIDPOINT_TRIANGLE_SIZE_MM = 0.8;

export type SnapMarker = {
  group: THREE.Group;
  /**
   * Show the marker at the snap result. Pass `null` to hide. The marker is
   * positioned in world space using the active plane.
   */
  set: (snap: SnapResult | null, plane: CardinalPlane) => void;
  dispose: () => void;
};

export function createSnapMarker(): SnapMarker {
  const group = new THREE.Group();
  group.name = "SketchSnapMarker";
  // Always paint on top of everything else.
  group.renderOrder = 999;
  group.visible = false;

  const gridDot = makeGridDot();
  const endpointDiamond = makeEndpointDiamond();
  const midpointTriangle = makeMidpointTriangle();

  for (const child of [gridDot, endpointDiamond, midpointTriangle]) {
    child.visible = false;
    group.add(child.mesh);
  }

  const set = (snap: SnapResult | null, plane: CardinalPlane): void => {
    if (!snap || snap.type === "free") {
      group.visible = false;
      return;
    }

    gridDot.visible = false;
    endpointDiamond.visible = false;
    midpointTriangle.visible = false;
    gridDot.mesh.visible = false;
    endpointDiamond.mesh.visible = false;
    midpointTriangle.mesh.visible = false;

    let active: ReturnType<typeof makeGridDot> | null = null;
    switch (snap.type) {
      case "grid":
        active = gridDot;
        break;
      case "endpoint":
        active = endpointDiamond;
        break;
      case "midpoint":
        active = midpointTriangle;
        break;
    }
    if (!active) {
      group.visible = false;
      return;
    }
    active.visible = true;
    active.mesh.visible = true;

    const world = planeToWorld(plane, snap.position);
    group.position.copy(world);
    // Reorient so the marker faces the camera for this plane (its local frame
    // is in XY, normal +Z).
    orientGroupToPlane(group, plane);
    group.visible = true;
  };

  const dispose = (): void => {
    gridDot.dispose();
    endpointDiamond.dispose();
    midpointTriangle.dispose();
  };

  return { group, set, dispose };
}

// ---- shape builders ----

type ShapeHandle = {
  mesh: THREE.Mesh;
  visible: boolean;
  dispose: () => void;
};

function topMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: ORANGE,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
    depthTest: false,
    depthWrite: false,
  });
}

function makeGridDot(): ShapeHandle {
  const geometry = new THREE.CircleGeometry(GRID_DOT_RADIUS_MM, 16);
  const material = topMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  return {
    mesh,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

function makeEndpointDiamond(): ShapeHandle {
  // Square rotated 45° around the local Z (the plane normal in our local frame).
  const half = ENDPOINT_DIAMOND_SIZE_MM / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, half, 0, half, 0, 0, 0, -half, 0, -half, 0, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const material = topMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  return {
    mesh,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

function makeMidpointTriangle(): ShapeHandle {
  const s = MIDPOINT_TRIANGLE_SIZE_MM;
  // Equilateral triangle pointing up.
  const h = (s * Math.sqrt(3)) / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, h * 0.6, 0, -s / 2, -h * 0.4, 0, s / 2, -h * 0.4, 0],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const material = topMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  return {
    mesh,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Rotate the marker group so its local +Z (marker normal) aligns with the
 * sketch plane's world normal. Marker shapes are built in local XY (normal
 * +Z). Match the same rotation the plane indicator uses in sketchOverlay.
 */
function orientGroupToPlane(group: THREE.Group, plane: CardinalPlane): void {
  group.rotation.set(0, 0, 0);
  switch (plane) {
    case "XY":
      // Already correct.
      break;
    case "XZ":
      group.rotation.x = -Math.PI / 2;
      break;
    case "YZ":
      group.rotation.y = Math.PI / 2;
      break;
  }
  // Suppress unused-import warnings (PLANE_VIEWS may be useful for future
  // alignment refinements).
  void PLANE_VIEWS;
}
