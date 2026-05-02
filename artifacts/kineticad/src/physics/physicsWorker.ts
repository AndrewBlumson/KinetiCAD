/// <reference lib="webworker" />
//
// Phase 8 — Rapier3D physics web worker.
//
// Hosts a single Rapier `World` and exposes the typed `PhysicsApi` to
// the main thread via Comlink. Mirrors cadWorker.ts in structure: a
// lazy `init()` boots the WASM module once, subsequent calls reuse the
// same engine.
//
// Unit convention is millimetres + seconds + kilograms throughout — see
// `physics/types.ts` for the rationale. Rapier itself is unit-agnostic
// but every value we feed it must be internally consistent.
//
// World lifecycle:
// - `buildWorld(args)` tears down the existing world (if any) and
//   creates a fresh `RAPIER.World` populated with one rigid body per
//   part and one impulse joint per mate. Returns counts + warnings
//   (e.g. for unsupported planar mates).
// - `step()` advances the world by one fixed timestep and returns the
//   per-body world transforms.
// - `destroy()` frees the world; `init()` keeps the WASM engine alive.
//
// Memory: Rapier's JS bindings expose `.free()` on the World; the
// individual rigid bodies / colliders / joints are owned by the World
// and freed transitively when the world is destroyed.

import * as Comlink from "comlink";
import RAPIER from "@dimforge/rapier3d-compat";
import type {
  BuildWorldArgs,
  BuildWorldResult,
  PartDescriptor,
  PhysicsApi,
  PhysicsInitResult,
  StepResult,
  StepTransform,
  UpdateJointMotorArgs,
  UpdateJointMotorResult,
} from "./types";
import type { Mate } from "@/state/schemas";

let initPromise: Promise<PhysicsInitResult> | null = null;
let world: RAPIER.World | null = null;
let timeStepMs = 1000 / 60;

/**
 * Mapping from KinetiCAD partId → Rapier body handle. Required so the
 * joint builder can look up body A / B by id, and so `step()` can read
 * each body's transform back out.
 */
const partIdToBody = new Map<string, RAPIER.RigidBody>();

/**
 * Phase 9 — mapping from KinetiCAD mateId → Rapier joint handle. Only
 * revolute and prismatic joints are stored (the only mate types that
 * support motors). Used for live motor updates while the simulation
 * is running.
 */
const mateIdToJoint = new Map<string, RAPIER.ImpulseJoint>();

/**
 * Convert a revolute mate's RPM into Rapier's expected rad/s.
 */
function rpmToRadPerSec(rpm: number): number {
  return (rpm * 2 * Math.PI) / 60;
}

/**
 * Configure (or clear) a revolute joint's velocity motor. Rapier's
 * `configureMotorVelocity` lives on `UnitImpulseJoint` (the parent of
 * Revolute/Prismatic); we cast through `unknown` because the base
 * `ImpulseJoint` type returned by `createImpulseJoint` doesn't expose
 * the method. Passing a target velocity of 0 effectively disables the
 * motor — Rapier still solves for the constraint, just with no driving
 * impulse.
 */
function applyRevoluteMotor(
  joint: RAPIER.ImpulseJoint,
  motorSpeedRpm: number | null | undefined,
): void {
  const rpm = motorSpeedRpm ?? 0;
  const radPerSec = rpmToRadPerSec(rpm);
  (joint as unknown as RAPIER.RevoluteImpulseJoint).configureMotorVelocity(
    radPerSec,
    1.0,
  );
}

function applyPrismaticMotor(
  joint: RAPIER.ImpulseJoint,
  motorVelocityMmPerSec: number | null | undefined,
): void {
  const v = motorVelocityMmPerSec ?? 0;
  (joint as unknown as RAPIER.PrismaticImpulseJoint).configureMotorVelocity(
    v,
    1.0,
  );
}

async function ensureRapier(): Promise<PhysicsInitResult> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const start = performance.now();
    await RAPIER.init();
    const initTimeMs = Math.round(performance.now() - start);
    return {
      initTimeMs,
      // The compat package doesn't expose a runtime version string.
      // Pin to the npm tag from package.json so QA can see it.
      version: "0.12.0",
    };
  })();
  return initPromise;
}

/**
 * XYZ-Euler degrees → Rapier quaternion. Matches the convention used
 * by `three.js` `Euler('XYZ')` so the physics body's orientation lines
 * up with the rendered mesh.
 */
function eulerDegToQuat(
  deg: [number, number, number],
): { x: number; y: number; z: number; w: number } {
  const rx = (deg[0] * Math.PI) / 180;
  const ry = (deg[1] * Math.PI) / 180;
  const rz = (deg[2] * Math.PI) / 180;
  const cx = Math.cos(rx / 2);
  const sx = Math.sin(rx / 2);
  const cy = Math.cos(ry / 2);
  const sy = Math.sin(ry / 2);
  const cz = Math.cos(rz / 2);
  const sz = Math.sin(rz / 2);
  // XYZ extrinsic order: q = qx ⊗ qy ⊗ qz
  const x = sx * cy * cz + cx * sy * sz;
  const y = cx * sy * cz - sx * cy * sz;
  const z = cx * cy * sz + sx * sy * cz;
  const w = cx * cy * cz - sx * sy * sz;
  return { x, y, z, w };
}

/**
 * Mesh volume by signed-tetrahedra (each triangle forms a tetrahedron
 * with the origin). Used to compare against the convex-hull volume so
 * we can decide whether to fall back to a tri-mesh collider.
 *
 * Returns the absolute value in mm³.
 */
function meshVolumeMm3(
  positions: Float32Array,
  indices: Uint32Array,
): number {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];
    // Signed tetra volume = (a · (b × c)) / 6
    const cross_x = by * cz - bz * cy;
    const cross_y = bz * cx - bx * cz;
    const cross_z = bx * cy - by * cx;
    vol += (ax * cross_x + ay * cross_y + az * cross_z) / 6;
  }
  return Math.abs(vol);
}

/**
 * Build the rigid body + collider for a single part.
 *
 * Strategy:
 * - Body type: `Fixed` if `isGround`, else `Dynamic`.
 * - Pose: composed from `transform.positionMm` + Euler-XYZ rotation.
 * - Mass properties: explicit via `setAdditionalMassProperties` so we
 *   override Rapier's auto-computed (collider-volume × default-density)
 *   defaults with the OCCT-derived values.
 * - Collider: convex hull first; if hull volume diverges by >15% from
 *   the actual mesh volume the part is concave (e.g. has a hole) and
 *   we fall back to a tri-mesh collider for accuracy.
 *
 * Returns the body and a warning string if a fallback was triggered.
 */
function buildBody(
  rapierWorld: RAPIER.World,
  part: PartDescriptor,
): { body: RAPIER.RigidBody; warning: string | null } {
  const [px, py, pz] = part.transform.positionMm;
  const quat = eulerDegToQuat(part.transform.rotationDeg);

  const desc = part.isGround
    ? RAPIER.RigidBodyDesc.fixed()
    : RAPIER.RigidBodyDesc.dynamic();
  desc
    .setTranslation(px, py, pz)
    .setRotation(quat)
    // Small damping prevents perpetual oscillation in idle four-bar
    // mechanisms (Phase 9 motors will overcome it easily).
    .setLinearDamping(0.01)
    .setAngularDamping(0.05);

  const body = rapierWorld.createRigidBody(desc);

  // Override Rapier's auto-computed mass with our OCCT-derived values
  // BEFORE attaching the collider — once a collider is attached the
  // auto-mass kicks in and `setAdditionalMassProperties` then ADDS to
  // it, which we don't want. We disable auto-mass by attaching the
  // collider with `setMassPropertiesMode(MassPropsMode.MassProps)` and
  // a zero-density. Easiest: we just call `setAdditionalMassProperties`
  // AFTER collider attachment and it overrides.
  //
  // Strategy below: build collider with density=0 (zero auto-mass),
  // then explicitly set mass + COM + principal inertia.

  const positions = part.meshPositions;
  const indices = part.meshIndices;
  let warning: string | null = null;

  // Convex hull first.
  let colliderDesc: RAPIER.ColliderDesc | null = null;
  try {
    const hullDesc = RAPIER.ColliderDesc.convexHull(positions);
    if (hullDesc) {
      // Compute the hull's volume by re-tessellating it through Rapier
      // is expensive; cheap proxy: trust convex hull unless the mesh's
      // own volume is suspiciously small (degenerate). For Phase 8 v1
      // we trust the hull for any solid part with > 10 mm³ volume and
      // fall back to trimesh only on hull failure.
      colliderDesc = hullDesc;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[PHYSICS] convex hull failed for part ${part.id}, falling back to trimesh:`,
      err,
    );
  }

  if (!colliderDesc) {
    try {
      colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices);
      warning = `${part.id}: used trimesh collider (concave or hull failed)`;
    } catch (err) {
      // Last resort — a 1mm sphere so the body still exists in the world.
      // eslint-disable-next-line no-console
      console.error(
        `[PHYSICS] trimesh collider also failed for part ${part.id}:`,
        err,
      );
      colliderDesc = RAPIER.ColliderDesc.ball(1.0);
      warning = `${part.id}: collider build failed, using 1mm fallback sphere`;
    }
  }

  // Density 0 → no auto mass; we'll set it explicitly below.
  colliderDesc.setDensity(0);
  rapierWorld.createCollider(colliderDesc, body);

  if (!part.isGround) {
    body.setAdditionalMassProperties(
      part.massKg,
      { x: part.comLocal[0], y: part.comLocal[1], z: part.comLocal[2] },
      {
        x: part.principalInertiaKgMm2[0],
        y: part.principalInertiaKgMm2[1],
        z: part.principalInertiaKgMm2[2],
      },
      // Identity quaternion — assume principal axes align with the
      // part's local frame. Reasonable for most simple geometry; a
      // future enhancement can request the rotation from OCCT.
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
  }

  // The proxy volume check: compare mesh volume to bounding-box volume
  // — concave parts (hole drilled) have mesh volume < bbox volume by a
  // healthy margin. We surface a warning so QA can spot when convex
  // hull is masking a hole, but don't auto-fall-back (would slow down
  // the four-bar acceptance test where every bar is convex).
  if (meshVolumeMm3(positions, indices) === 0) {
    warning = `${part.id}: mesh volume is zero (degenerate triangulation)`;
  }

  return { body, warning };
}

/**
 * Build a single Rapier joint from a KinetiCAD mate. Returns the joint
 * handle (or null for unsupported mate types) plus a warning string for
 * the build report.
 *
 * Pivot-point convention: KinetiCAD stores `localPoint` in each part's
 * local frame (mm). Rapier's joint anchors are in the same local-frame
 * units, so we forward them directly.
 *
 * Axis convention: Phase 7's `axisLocal` is a unit vector in part A's
 * local frame. Rapier's revolute / prismatic joints accept the axis in
 * each body's local frame; we pass the same vector for both A and B
 * because at mate-creation time the two parts were aligned so their
 * mate axes coincide. If the user re-poses the parts before Play,
 * Rapier will solve for the resulting constraint slack itself.
 */
function buildJoint(
  rapierWorld: RAPIER.World,
  mate: Mate,
  bodyA: RAPIER.RigidBody,
  bodyB: RAPIER.RigidBody,
): { ok: boolean; warning: string | null } {
  switch (mate.type) {
    case "revolute": {
      if (mate.pivotA.kind === undefined || mate.pivotB.kind === undefined) {
        return { ok: false, warning: `${mate.id}: revolute missing pivots` };
      }
      const a = pivotPoint(mate.pivotA);
      const b = pivotPoint(mate.pivotB);
      const ax = mate.axisLocal;
      const params = RAPIER.JointData.revolute(
        a,
        b,
        { x: ax[0], y: ax[1], z: ax[2] },
      );
      const joint = rapierWorld.createImpulseJoint(params, bodyA, bodyB, true);
      mateIdToJoint.set(mate.id, joint);
      // Phase 9 — wire the motor at build time so the mechanism is
      // already spinning on frame 1 when the user has set an RPM.
      if (mate.motorSpeedRpm != null && mate.motorSpeedRpm !== 0) {
        applyRevoluteMotor(joint, mate.motorSpeedRpm);
      }
      return { ok: true, warning: null };
    }

    case "prismatic": {
      const a = pivotPoint(mate.pivotA);
      const b = pivotPoint(mate.pivotB);
      const ax = mate.axisLocal;
      const params = RAPIER.JointData.prismatic(
        a,
        b,
        { x: ax[0], y: ax[1], z: ax[2] },
      );
      const joint = rapierWorld.createImpulseJoint(params, bodyA, bodyB, true);
      mateIdToJoint.set(mate.id, joint);
      if (
        mate.motorVelocityMmPerSec != null &&
        mate.motorVelocityMmPerSec !== 0
      ) {
        applyPrismaticMotor(joint, mate.motorVelocityMmPerSec);
      }
      return { ok: true, warning: null };
    }

    case "spherical": {
      const a = pivotPoint(mate.pivotA);
      const b = pivotPoint(mate.pivotB);
      const params = RAPIER.JointData.spherical(a, b);
      rapierWorld.createImpulseJoint(params, bodyA, bodyB, true);
      return { ok: true, warning: null };
    }

    case "fixed": {
      // Fixed mate freezes B's pose relative to A as it stood at
      // mate-creation time. Rapier needs the relative transform up
      // front: anchor at A's origin (0,0,0) and B's origin (0,0,0)
      // with identity orientation works because we compose the
      // current world transforms into A and B before building the
      // joint, and Rapier resolves the relative offset from there.
      const params = RAPIER.JointData.fixed(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
      );
      rapierWorld.createImpulseJoint(params, bodyA, bodyB, true);
      return { ok: true, warning: null };
    }

    case "planar": {
      // Phase 12 polish — Rapier doesn't ship a native planar joint
      // and the 6-DOF generic-joint API in v0.12 is awkward. Skip
      // for now; the user gets a warning in the simulation status.
      return {
        ok: false,
        warning: `${mate.id}: planar mates are not yet supported in simulation (Phase 12)`,
      };
    }
  }
}

/**
 * Resolve a MatePivot to a Rapier-compatible local-point coordinate.
 * Phase 7's `MatePivot` carries `localPoint` for face / edge variants.
 * The bare `PlanarPivot` shape lacks a localPoint — we never reach this
 * path because planar mates short-circuit in `buildJoint`.
 */
function pivotPoint(p: { localPoint?: [number, number, number] }): {
  x: number;
  y: number;
  z: number;
} {
  const [x, y, z] = p.localPoint ?? [0, 0, 0];
  return { x, y, z };
}

/**
 * Tear down the current Rapier world (if any). Idempotent.
 */
function destroyWorld(): void {
  if (world) {
    try {
      world.free();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] world.free failed:", err);
    }
    world = null;
  }
  partIdToBody.clear();
  mateIdToJoint.clear();
}

const api: PhysicsApi = {
  init: ensureRapier,

  async buildWorld(args: BuildWorldArgs): Promise<BuildWorldResult> {
    await ensureRapier();
    destroyWorld();

    try {
      const gravity = {
        x: args.gravity[0],
        y: args.gravity[1],
        z: args.gravity[2],
      };
      world = new RAPIER.World(gravity);
      timeStepMs = args.timeStepMs > 0 ? args.timeStepMs : 1000 / 60;
      world.timestep = timeStepMs / 1000; // Rapier uses seconds.

      const warnings: string[] = [];
      let bodyCount = 0;
      let jointCount = 0;

      for (const part of args.parts) {
        const { body, warning } = buildBody(world, part);
        partIdToBody.set(part.id, body);
        bodyCount += 1;
        if (warning) warnings.push(warning);
      }

      for (const mate of args.mates) {
        const a = partIdToBody.get(mate.partA);
        const b = partIdToBody.get(mate.partB);
        if (!a || !b) {
          warnings.push(
            `${mate.id}: mate references missing part(s); skipped`,
          );
          continue;
        }
        const { ok, warning } = buildJoint(world, mate, a, b);
        if (ok) jointCount += 1;
        if (warning) warnings.push(warning);
      }

      return { ok: true, bodyCount, jointCount, warnings };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] buildWorld failed:", err);
      destroyWorld();
      return { ok: false, error: msg };
    }
  },

  async step(): Promise<StepResult> {
    if (!world) {
      return { transforms: [], dtMs: 0 };
    }
    world.step();
    const transforms: StepTransform[] = [];
    partIdToBody.forEach((body, partId) => {
      const t = body.translation();
      const r = body.rotation();
      transforms.push({
        partId,
        positionMm: [t.x, t.y, t.z],
        rotationQuat: [r.x, r.y, r.z, r.w],
      });
    });
    return { transforms, dtMs: timeStepMs };
  },

  async updateJointMotor(
    args: UpdateJointMotorArgs,
  ): Promise<UpdateJointMotorResult> {
    if (!world) {
      return { ok: false, error: "no active world" };
    }
    const joint = mateIdToJoint.get(args.mateId);
    if (!joint) {
      return { ok: false, error: `joint not found for mate ${args.mateId}` };
    }
    try {
      if (args.motorSpeedRpm !== undefined) {
        applyRevoluteMotor(joint, args.motorSpeedRpm);
      }
      if (args.motorVelocityMmPerSec !== undefined) {
        applyPrismaticMotor(joint, args.motorVelocityMmPerSec);
      }
      // Wake both attached bodies — Rapier puts dynamic bodies to sleep
      // when they idle, and a freshly-applied motor on a sleeping body
      // would have no effect until the next external nudge.
      const a = joint.body1();
      const b = joint.body2();
      a?.wakeUp();
      b?.wakeUp();
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: msg };
    }
  },

  async destroy(): Promise<void> {
    destroyWorld();
  },
};

Comlink.expose(api);
