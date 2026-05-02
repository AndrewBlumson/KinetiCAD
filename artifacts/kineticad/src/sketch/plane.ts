// Plane math and view definitions for sketch mode.
//
// Sketch primitives are stored as 2D coordinates [u, v] on a chosen plane.
// This module is the single source of truth for converting between the 2D
// "plane-local" frame and 3D world coordinates, and for positioning the
// camera so that it looks straight down the plane normal during sketching.

import * as THREE from "three";
import type { SketchPlane } from "@/state/schemas";

export type CardinalPlane = "XY" | "XZ" | "YZ";

export type PlaneView = {
  /** Camera world position when entering this plane. */
  cameraPosition: readonly [number, number, number];
  /** Camera "up" vector to use during the animation and sketch. */
  cameraUp: readonly [number, number, number];
  /** Plane normal in world space. */
  normal: readonly [number, number, number];
  /** Human-readable label shown in the picker. */
  label: string;
};

// Camera positions per the spec: 120mm offset along the plane normal, looking
// straight at the origin so the chosen plane fills the viewport face-on.
export const PLANE_VIEWS: Record<CardinalPlane, PlaneView> = {
  XY: {
    cameraPosition: [0, 0, 120],
    cameraUp: [0, 1, 0],
    normal: [0, 0, 1],
    label: "Top",
  },
  XZ: {
    cameraPosition: [0, 120, 0],
    cameraUp: [0, 0, 1],
    normal: [0, 1, 0],
    label: "Front",
  },
  YZ: {
    cameraPosition: [120, 0, 0],
    cameraUp: [0, 1, 0],
    normal: [1, 0, 0],
    label: "Right",
  },
};

export const DEFAULT_CAMERA_POSITION: readonly [number, number, number] = [
  80, 60, 80,
];
export const DEFAULT_CAMERA_UP: readonly [number, number, number] = [0, 1, 0];
export const DEFAULT_CAMERA_TARGET: readonly [number, number, number] = [
  0, 0, 0,
];

/**
 * Convert a 2D point on the given plane to world coordinates.
 * - XY: (u, v) → (u, v, 0)
 * - XZ: (u, v) → (u, 0, v)
 * - YZ: (u, v) → (0, u, v)
 */
export function planeToWorld(
  plane: CardinalPlane,
  uv: readonly [number, number],
): THREE.Vector3 {
  const [u, v] = uv;
  switch (plane) {
    case "XY":
      return new THREE.Vector3(u, v, 0);
    case "XZ":
      return new THREE.Vector3(u, 0, v);
    case "YZ":
      return new THREE.Vector3(0, u, v);
  }
}

/**
 * Project a world-space point onto the given plane's 2D frame.
 */
export function worldToPlane(
  plane: CardinalPlane,
  world: THREE.Vector3,
): [number, number] {
  switch (plane) {
    case "XY":
      return [world.x, world.y];
    case "XZ":
      return [world.x, world.z];
    case "YZ":
      return [world.y, world.z];
  }
}

/**
 * Type guard: is this stored plane one of the three cardinal planes?
 * Custom planes (added in later phases) are excluded.
 */
export function isCardinalPlane(plane: SketchPlane): plane is CardinalPlane {
  return plane === "XY" || plane === "XZ" || plane === "YZ";
}
