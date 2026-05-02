// Shared types between the CAD worker and main thread.
//
// All units are millimetres unless stated otherwise.

import type { SketchPrimitive } from "@/state/schemas";
import type { CardinalPlane } from "@/sketch/plane";

export type TessellatedMesh = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
};

export type KernelInitResult = {
  initTimeMs: number;
  version: string;
};

export type ExtrudeArgs = {
  sketchPrimitives: SketchPrimitive[];
  plane: CardinalPlane;
  depthMm: number;
  direction: "forward" | "backward" | "symmetric";
};

export type RevolveArgs = {
  sketchPrimitives: SketchPrimitive[];
  plane: CardinalPlane;
  axis: "X" | "Y" | "Z";
  angleDeg: number;
};

export type CadKernelApi = {
  init: () => Promise<KernelInitResult>;
  createTestCube: (sizeMm: number) => Promise<TessellatedMesh>;
  /**
   * Build a closed wire from the given sketch, extrude into a 3D solid, and
   * return its tessellated mesh. Throws (rejects) with a descriptive message
   * if the sketch is not closed, has gaps, or OCCT fails on the operation.
   */
  extrude: (args: ExtrudeArgs) => Promise<TessellatedMesh>;
  /**
   * Build a closed wire from the given sketch, revolve around the given world
   * axis through the origin, and return the tessellated solid mesh.
   */
  revolve: (args: RevolveArgs) => Promise<TessellatedMesh>;
};
