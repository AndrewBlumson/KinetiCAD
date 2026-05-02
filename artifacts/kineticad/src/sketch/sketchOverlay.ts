// Imperative builder for the in-sketch 3D overlay: the translucent plane
// rectangle and the three-tier (1mm / 5mm / 10mm) emphasis grid.
//
// Note: the spec lists this file as `SketchOverlay.tsx`, but the rest of the
// scene is driven imperatively rather than through React Three Fiber, so we
// stay consistent with sceneSetup.ts and expose a builder/disposer pair.

import * as THREE from "three";
import type { CardinalPlane } from "./plane";

const PLANE_RECT_SIZE_MM = 400;
const PLANE_RECT_COLOUR = 0x141b2e;
const PLANE_RECT_OPACITY = 0.15;

// Distinct minor (1mm + 5mm) vs major (10mm) colours so the eye groups the
// sketch grid into 10mm cells at a glance.
const SKETCH_GRID_COLOUR_MINOR = 0x252d42;
const SKETCH_GRID_COLOUR_MAJOR = 0x3a4560;
const SKETCH_GRID_LEVELS: ReadonlyArray<{
  spacingMm: number;
  opacity: number;
  colour: number;
  // RenderOrder so finer/dimmer lines draw under coarser/brighter ones.
  renderOrder: number;
}> = [
  { spacingMm: 1, opacity: 0.2, colour: SKETCH_GRID_COLOUR_MINOR, renderOrder: 1 },
  { spacingMm: 5, opacity: 0.5, colour: SKETCH_GRID_COLOUR_MINOR, renderOrder: 2 },
  { spacingMm: 10, opacity: 0.9, colour: SKETCH_GRID_COLOUR_MAJOR, renderOrder: 3 },
];

export type SketchOverlay = {
  /** Top-level group; add to the scene and toggle visibility. */
  group: THREE.Group;
  /** Reorient overlay onto a different plane without rebuilding. */
  setPlane: (plane: CardinalPlane) => void;
  /** Free all GPU resources owned by the overlay. */
  dispose: () => void;
};

/**
 * Build the sketch overlay for the given plane. Caller is responsible for
 * adding `overlay.group` to the scene and disposing on unmount.
 */
export function createSketchOverlay(initialPlane: CardinalPlane): SketchOverlay {
  const group = new THREE.Group();
  group.name = "SketchOverlay";
  // Make sure the overlay paints on top of the world grid even though Z values
  // are similar.
  group.renderOrder = 10;

  // Plane indicator rectangle. PlaneGeometry naturally lies in the XY plane
  // (normal +Z); we re-orient it per chosen sketch plane below.
  const rectGeom = new THREE.PlaneGeometry(
    PLANE_RECT_SIZE_MM,
    PLANE_RECT_SIZE_MM,
  );
  const rectMat = new THREE.MeshBasicMaterial({
    color: PLANE_RECT_COLOUR,
    transparent: true,
    opacity: PLANE_RECT_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rect = new THREE.Mesh(rectGeom, rectMat);
  rect.name = "SketchPlaneRect";
  group.add(rect);

  // Tiered grid. Each tier is its own GridHelper rotated to lie on the chosen
  // plane. They share a single colour but step opacity from 0.2 → 0.9.
  const gridTiers: Array<{ helper: THREE.GridHelper; material: THREE.Material }> =
    [];
  for (const level of SKETCH_GRID_LEVELS) {
    const divisions = Math.round(PLANE_RECT_SIZE_MM / level.spacingMm);
    const helper = new THREE.GridHelper(
      PLANE_RECT_SIZE_MM,
      divisions,
      level.colour,
      level.colour,
    );
    helper.name = `SketchGrid_${level.spacingMm}mm`;
    helper.renderOrder = level.renderOrder;
    const material = helper.material as THREE.Material;
    material.transparent = true;
    material.opacity = level.opacity;
    material.depthWrite = false;
    group.add(helper);
    gridTiers.push({ helper, material });
  }

  // Apply the requested plane orientation.
  applyOrientation(rect, gridTiers, initialPlane);

  return {
    group,
    setPlane: (plane) => applyOrientation(rect, gridTiers, plane),
    dispose: () => {
      rectGeom.dispose();
      rectMat.dispose();
      for (const tier of gridTiers) {
        tier.helper.geometry.dispose();
        tier.material.dispose();
      }
    },
  };
}

/**
 * Rotate the plane rect and grid stack so they lie on the requested plane.
 *
 * Defaults:
 * - PlaneGeometry sits in XY (normal +Z)
 * - GridHelper sits in XZ (normal +Y)
 *
 * We rotate each independently so both end up coincident with the chosen
 * sketch plane.
 */
function applyOrientation(
  rect: THREE.Mesh,
  grids: ReadonlyArray<{ helper: THREE.GridHelper }>,
  plane: CardinalPlane,
): void {
  rect.rotation.set(0, 0, 0);
  for (const tier of grids) {
    tier.helper.rotation.set(0, 0, 0);
  }

  switch (plane) {
    case "XY":
      // Rect already in XY. Grid is in XZ → rotate +90° around X to land on XY.
      for (const tier of grids) {
        tier.helper.rotation.x = Math.PI / 2;
      }
      break;
    case "XZ":
      // Grid already in XZ. Rect in XY → rotate -90° around X to land on XZ.
      rect.rotation.x = -Math.PI / 2;
      break;
    case "YZ":
      // Rect in XY → rotate +90° around Y so its plane normal flips to +X.
      rect.rotation.y = Math.PI / 2;
      // Grid in XZ → rotate +90° around Z so its plane normal flips to +X.
      for (const tier of grids) {
        tier.helper.rotation.z = Math.PI / 2;
      }
      break;
  }
}
