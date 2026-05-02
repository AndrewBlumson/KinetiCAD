// Phase 8 — shared types between the physics web worker and the main
// thread. Mirrors the cad/types.ts pattern.
//
// All units are millimetres + seconds + kilograms. Rapier itself is
// unit-agnostic but the values we feed it must be internally consistent
// (gravity in mm/s², distances in mm, masses in kg, inertia in kg·mm²).

import type { Mate, Transform } from "@/state/schemas";

/**
 * A single rigid body descriptor sent to the physics worker.
 *
 * `meshPositions` and `meshIndices` are flat Float32 / Uint32 arrays of
 * the part's tessellated mesh in *local* coordinates (no transform
 * applied — Rapier composes the body pose itself). The collider builder
 * runs convex-hull first; if the hull's volume diverges from the mesh
 * volume by >15% it falls back to a triangle mesh.
 *
 * Mass properties are computed by the CAD worker via
 * `getMassProperties` and forwarded here without additional scaling.
 *
 * `isGround === true` produces a Rapier `RigidBodyType.Fixed` regardless
 * of mass: the part is anchored to the world frame and acts as the
 * mechanism's reference body.
 */
export type PartDescriptor = {
  id: string;
  transform: Transform;
  meshPositions: Float32Array;
  meshIndices: Uint32Array;
  massKg: number;
  comLocal: [number, number, number];
  principalInertiaKgMm2: [number, number, number];
  isGround: boolean;
};

/**
 * A single mate descriptor sent to the physics worker. The full Mate
 * schema is forwarded as-is; the worker does its own type-discrimination
 * and joint-builder dispatch. We don't pre-flatten in case Phase 9
 * (motor actuation) needs additional fields.
 */
export type MateDescriptor = Mate;

/**
 * Per-frame transform readout returned by `step()`. Rotation is a
 * normalised quaternion in `(x, y, z, w)` order so it can be passed
 * directly to `THREE.Quaternion.set(...)`.
 */
export type StepTransform = {
  partId: string;
  positionMm: [number, number, number];
  rotationQuat: [number, number, number, number];
};

export type StepResult = {
  transforms: StepTransform[];
  /** Physics-time advanced by this step, in milliseconds. */
  dtMs: number;
};

export type BuildWorldArgs = {
  parts: PartDescriptor[];
  mates: MateDescriptor[];
  /** mm/s², Z-up by default. */
  gravity: [number, number, number];
  /** Physics fixed timestep in milliseconds. Default 1000/60 ≈ 16.67. */
  timeStepMs: number;
};

export type BuildWorldResult =
  | { ok: true; bodyCount: number; jointCount: number; warnings: string[] }
  | { ok: false; error: string };

export type PhysicsInitResult = {
  initTimeMs: number;
  /** Rapier package version string (best-effort; falls back to "unknown"). */
  version: string;
};

/**
 * Phase 9 — live motor parameter update. Targets an existing joint by
 * mate ID and reconfigures its Rapier motor without rebuilding the
 * world. `motorSpeedRpm` is for revolute joints (converted to rad/s
 * inside the worker); `motorVelocityMmPerSec` is for prismatic joints
 * and forwarded as-is. Passing 0 (or null/undefined) disables the
 * motor by setting target velocity to zero.
 */
export type UpdateJointMotorArgs = {
  mateId: string;
  motorSpeedRpm?: number | null;
  motorVelocityMmPerSec?: number | null;
};

export type UpdateJointMotorResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Comlink-exposed API. All methods are async; the worker side may run
 * synchronous Rapier calls but Comlink wraps them in promises.
 */
export type PhysicsApi = {
  init: () => Promise<PhysicsInitResult>;
  buildWorld: (args: BuildWorldArgs) => Promise<BuildWorldResult>;
  step: () => Promise<StepResult>;
  /**
   * Phase 9 — update an existing joint's motor parameters live.
   * Used so users can dial RPM/velocity while the simulation is
   * running without paying the full buildWorld cost.
   */
  updateJointMotor: (
    args: UpdateJointMotorArgs,
  ) => Promise<UpdateJointMotorResult>;
  /**
   * Tear down the current world without re-creating it. The caller
   * must call `buildWorld` again before the next `step`.
   */
  destroy: () => Promise<void>;
};
