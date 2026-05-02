export type SketchPlane = 'XY' | 'XZ' | 'YZ' | { customId: string };

export type SketchPrimitive =
  | { type: 'line'; start: [number, number]; end: [number, number] }
  | { type: 'arc'; centre: [number, number]; radius: number; startAngle: number; endAngle: number }
  | { type: 'circle'; centre: [number, number]; radius: number }
  | { type: 'rectangle'; corner: [number, number]; width: number; height: number };

export type Sketch = {
  id: string;
  name: string;
  plane: SketchPlane;
  primitives: SketchPrimitive[];
};

export type ExtrudeDirection = 'forward' | 'backward' | 'symmetric';
export type RevolveAxis = 'X' | 'Y' | 'Z';

export type ExtrudeFeature = {
  id: string;
  type: 'extrude';
  sketchId: string;
  depthMm: number;
  direction: ExtrudeDirection;
};

export type RevolveFeature = {
  id: string;
  type: 'revolve';
  sketchId: string;
  axis: RevolveAxis;
  angleDeg: number;
};

export type Feature =
  | ExtrudeFeature
  | RevolveFeature
  | { id: string; type: 'fillet'; targetEdges: string[]; radiusMm: number }
  | { id: string; type: 'chamfer'; targetEdges: string[]; sizeMm: number }
  | { id: string; type: 'hole'; targetFace: string; positionUV: [number, number]; diameterMm: number; depthMm: number }
  | { id: string; type: 'boolean'; operation: 'union' | 'subtract' | 'intersect'; targetIds: string[] };

export type Part = {
  id: string;
  name: string;
  sketches: Sketch[];
  features: Feature[];
  materialId: string;
  meshHash?: string;
  volumeCm3?: number;
  massKg?: number;
};

export type Mate =
  | { id: string; type: 'fixed'; partA: string; partB: string }
  | { id: string; type: 'revolute'; partA: string; partB: string; axisLocal: [number, number, number]; pivotLocal: [number, number, number]; motorSpeedRpm?: number }
  | { id: string; type: 'prismatic'; partA: string; partB: string; axisLocal: [number, number, number]; motorForceN?: number }
  | { id: string; type: 'spherical'; partA: string; partB: string; pivotLocal: [number, number, number] }
  | { id: string; type: 'planar'; partA: string; partB: string; planeLocal: [number, number, number, number] };

export type Assembly = {
  id: string;
  name: string;
  parts: Part[];
  mates: Mate[];
  groundPartId: string;
};

export type SimulationState = {
  running: boolean;
  timeStepMs: number;
  gravity: [number, number, number];
};

export type AppMode = 'modeller' | 'simulator';

/**
 * A reference to a specific edge on a part's tip mesh. `edgeId` is the stable
 * canonical-geometry hash returned by the topology enumerator; it survives
 * parameter edits whenever the underlying edge geometry is preserved.
 *
 * Used by the edges Selection, and by Fillet/Chamfer feature targets in
 * Split B.
 */
export type EdgeRef = {
  partId: string;
  edgeId: string;
};

/**
 * A reference to a specific face on a part's tip mesh. Same stable-hash
 * semantics as EdgeRef. Used by the face / point-on-face Selections, and by
 * the Hole feature target in Split B.
 */
export type FaceRef = {
  partId: string;
  faceId: string;
};
