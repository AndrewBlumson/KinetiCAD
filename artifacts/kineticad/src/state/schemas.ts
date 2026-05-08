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

/**
 * How a new extrude solid interacts with the part's prior solid.
 *
 * - 'add'      → Boolean-Union the new extrude with the existing solid.
 *                This is the default for new features, enabling the classic
 *                "sketch → extrude → sketch → extrude" lollipop workflow.
 * - 'subtract' → Boolean-Cut (remove) the new extrude from the existing
 *                solid, equivalent to an Extrude-Cut / boss-base cut.
 * - 'new-body' → Replace the existing solid entirely (legacy behaviour,
 *                also used as the migration target for pre-v8 extrudes).
 */
export type ExtrudeMode = 'add' | 'subtract' | 'new-body';

export type ExtrudeFeature = {
  id: string;
  type: 'extrude';
  sketchId: string;
  depthMm: number;
  direction: ExtrudeDirection;
  extrudeMode: ExtrudeMode;
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
  /**
   * Flat B-rep shape imported from a STEP file. No parametric history is
   * preserved — STEP is boundary representation only. The `shapeId`
   * references a shape held in the CAD worker's in-memory registry; the
   * part must be re-imported after a page reload.
   */
  | { id: string; type: 'imported-step'; shapeId: string };

/**
 * Phase 5 boolean operations. Booleans are *assembly-level* features that
 * combine 2+ parts, not per-part features. Subtract carries the tool part
 * id (the cutter) on the operation itself; the body parts are the other
 * entries in `inputPartIds`.
 */
export type BooleanOperation =
  | { type: 'union' }
  | { type: 'subtract'; toolPartId: string }
  | { type: 'intersect' };

export type BooleanFeature = {
  id: string;
  type: 'boolean';
  operation: BooleanOperation;
  /** 2 to 8 part ids that participate in this boolean. */
  inputPartIds: string[];
  /** Display name shown in the BOOLEANS tree section. Unique within the assembly. */
  resultPartName: string;
  /** When true, the input parts are hidden from the scene; the result mesh stands in for them. */
  hideInputs: boolean;
};

/**
 * Phase 6 — rigid-body transform applied to a part's mesh and (in the
 * boolean kernel) to its OCCT shape before any boolean operation runs.
 *
 * - `positionMm` is a translation in millimetres in world coordinates
 *   (Z-up convention to match the rest of the modeller).
 * - `rotationDeg` is XYZ Euler angles in degrees, applied in XYZ order.
 *   Three.js consumes these with `mesh.rotation.set(x,y,z,'XYZ')`; OCCT
 *   composes three `gp_Trsf` rotations in the same XYZ order before
 *   translating.
 *
 * The default identity transform is `{ positionMm: [0,0,0], rotationDeg:
 * [0,0,0] }` and is what existing v4 parts get on migration to v5.
 */
export type Transform = {
  positionMm: [number, number, number];
  rotationDeg: [number, number, number];
};

export type Part = {
  id: string;
  name: string;
  /** Phase 6 — when false the part mesh is hidden in the scene. */
  visible: boolean;
  /** Phase 6 — rigid-body world transform applied to the part. */
  transform: Transform;
  sketches: Sketch[];
  features: Feature[];
  materialId: string;
  meshHash?: string;
  volumeCm3?: number;
  massKg?: number;
};

/**
 * Phase 7 — pivot reference for mates. Captures *which* face / edge on the
 * part the user picked plus the pick point in the part's *local* frame
 * (i.e. before `part.transform` is applied). Storing the local point keeps
 * the mate tied to the geometry even if the part's transform changes.
 *
 * - `face`: any face. `localPoint` is the face centroid (or the user's
 *   click for `point-on-face` picks like spherical mate).
 * - `edge`: any edge. `localPoint` is the edge midpoint (or computed
 *   centerline reference for circular edges).
 */
export type MatePivot =
  | { kind: 'face'; faceId: string; localPoint: [number, number, number] }
  | { kind: 'edge'; edgeId: string; localPoint: [number, number, number] };

/**
 * Planar mate uses bare face references — no localPoint, since the mate
 * constraint operates over the whole face plane.
 */
export type PlanarPivot = { kind: 'face'; faceId: string };

export type RevoluteMate = {
  id: string;
  type: 'revolute';
  /** Optional display name; falls back to "Revolute N" in the UI. */
  name?: string;
  partA: string;
  partB: string;
  pivotA: MatePivot;
  pivotB: MatePivot;
  /** Unit vector in partA's local frame; defines the rotation axis. */
  axisLocal: [number, number, number];
  motorSpeedRpm?: number;
  motorTorqueNm?: number;
};

export type PrismaticMate = {
  id: string;
  type: 'prismatic';
  name?: string;
  partA: string;
  partB: string;
  pivotA: MatePivot;
  pivotB: MatePivot;
  /** Unit vector in partA's local frame; direction of allowed sliding. */
  axisLocal: [number, number, number];
  motorForceN?: number;
  motorVelocityMmPerSec?: number;
};

export type SphericalMate = {
  id: string;
  type: 'spherical';
  name?: string;
  partA: string;
  partB: string;
  pivotA: MatePivot;
  pivotB: MatePivot;
};

/**
 * Fixed mates have no pivot — partB is rigidly bonded to partA at their
 * current relative transform.
 */
export type FixedMate = {
  id: string;
  type: 'fixed';
  name?: string;
  partA: string;
  partB: string;
};

export type PlanarMate = {
  id: string;
  type: 'planar';
  name?: string;
  partA: string;
  partB: string;
  pivotA: PlanarPivot;
  pivotB: PlanarPivot;
};

export type Mate =
  | RevoluteMate
  | PrismaticMate
  | SphericalMate
  | FixedMate
  | PlanarMate;

export type Assembly = {
  id: string;
  name: string;
  parts: Part[];
  mates: Mate[];
  groundPartId: string;
  /**
   * Phase 5 — assembly-level boolean features, regenerated in array order.
   * Each boolean references existing parts by id; deleting an input part
   * cascade-deletes the boolean (via the confirmation dialog).
   */
  booleanFeatures: BooleanFeature[];
};

/**
 * Phase 8 — physics simulation state.
 *
 * Units: gravity is in mm/s² because the entire app is millimetre-scaled
 * (a single 9.81 m/s² gravity in a metre-scaled world would be 1000× too
 * weak when applied to mm distances). Default Z-up gravity is therefore
 * `[0, 0, -9810]`.
 *
 * `paused` is distinct from `running=false`: when paused the world is
 * built and bodies hold their last computed transforms; resuming
 * advances from there. Stopping (`running=false`) tears down the world
 * and the Modeller view shows the original assembly transforms.
 *
 * `speedMultiplier` scales physics-time relative to wall-clock during
 * the RAF tick (0.25× / 0.5× / 1× / 2×). The fixed timestep stays at
 * `timeStepMs`; the multiplier feeds the accumulator.
 *
 * `simulationTimeMs` accumulates physics-time across step() calls so
 * the dashboard can show how long the mechanism has been running.
 *
 * Persistence rule (Phase 8): only `gravity`, `timeStepMs`, and
 * `speedMultiplier` survive a reload — the runtime fields (`running`,
 * `paused`, `simulationTimeMs`) are zeroed on every boot via
 * `partialize` so nothing tries to resume a dead world.
 */
export type SimulationState = {
  running: boolean;
  paused: boolean;
  timeStepMs: number;
  gravity: [number, number, number];
  speedMultiplier: number;
  simulationTimeMs: number;
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
