// Shared types between the CAD worker and main thread.
//
// All units are millimetres unless stated otherwise.

export type TessellatedMesh = {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
};

export type KernelInitResult = {
  initTimeMs: number;
  version: string;
};

export type CadKernelApi = {
  init: () => Promise<KernelInitResult>;
  createTestCube: (sizeMm: number) => Promise<TessellatedMesh>;
};
