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

// Worker→main-thread console bridge. 16/05/2026
// Mirrors the same bridge in cadWorker.ts -- see that file for rationale.
const __origLog   = console.log;
const __origInfo  = console.info;
const __origDebug = console.debug;
const __origWarn  = console.warn;
const __origError = console.error;
function __forward(level: string, args: unknown[]): void {
  try { self.postMessage({ __log: true, level, args }); } catch { /* swallow DataCloneError */ }
}
console.log   = (...a: unknown[]) => { __origLog(...a);   __forward('log',   a); };
console.info  = (...a: unknown[]) => { __origInfo(...a);  __forward('info',  a); };
console.debug = (...a: unknown[]) => { __origDebug(...a); __forward('debug', a); };
console.warn  = (...a: unknown[]) => { __origWarn(...a);  __forward('warn',  a); };
console.error = (...a: unknown[]) => { __origError(...a); __forward('error', a); };

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
 * Phase 9.5 diagnostic — keep the original `Mate` records alongside
 * their joints so the step-loop logger can read live `motorSpeedRpm`
 * back out without round-tripping through the main thread. Cleared in
 * `destroyWorld`.
 */
const mateById = new Map<string, Mate>();

/** Step counter for periodic diagnostic logging (every 60 frames ≈ 1s). */
let stepCount = 0;

/**
 * Convert a revolute mate's RPM into Rapier's expected rad/s.
 */
function rpmToRadPerSec(rpm: number): number {
  return (rpm * 2 * Math.PI) / 60;
}

/**
 * Velocity-tracking gain (Rapier's `factor` argument of
 * `configureMotorVelocity`). KinetiCAD operates in mm-units, so part
 * inertias land in the 50–500 kg·mm² range — much larger absolute
 * values than Rapier's SI-unit tutorials assume.
 *
 * History (Phase 9.5):
 *  - 1.0 (tutorial default): ~0.1 rad/s² → 60 s spin-up, body sleeps
 *    before the motor appears to do anything.
 *  - 100 (Follow-ups #4–#6): bodies visibly rotate but converge to
 *    only 0.5–1.1 rad/s against a 6.28 rad/s (60 RPM) target —
 *    well under any reasonable demo threshold.
 *  - 10000 (Follow-up #7): two orders of magnitude higher,
 *    enough headroom for the AccelerationBased velocity servo to
 *    converge to target within the 1 s acceptance window despite
 *    the inflated mm-unit inertias.
 *  - 40000 (Phase 5.1): 4× increase to reduce moon-induced wobble on
 *    mooned planets. Each moon is a rotating imbalance coupled to its
 *    parent planet via the shared revolute joint; two AccelerationBased
 *    velocity servos at the same gain under-damp the coupled chain and
 *    produce a ±6–10% sustained ripple on the mooned bodies. Raising
 *    the gain stiffens both servos so the planet motor has enough
 *    authority to reject the moon imbalance before the error grows.
 *
 * Same factor is reused for prismatic motors (mm/s tracking) — units
 * are different but the per-axis stiffness needed is comparable.
 */
const MOTOR_VELOCITY_GAIN = 40000;

/**
 * Phase 9.5 Follow-up #6 — switching back to `AccelerationBased`.
 *
 * Follow-up #5 reasoned that the default `AccelerationBased` model was
 * the cause of motor stalls and shipped `ForceBased` instead. QA's
 * diagnostic logs (`[step-diag]` from Follow-up #6 instrumentation)
 * proved that wrong: with `ForceBased` + gain=100, a 60 RPM target
 * (6.28 rad/s) reached only ~1.08 rad/s steady-state — a ~83 %
 * steady-state error. That's exactly what `ForceBased` is documented
 * to do: it applies a force proportional to the velocity error
 * (`gain × (target_v − current_v)`), so by construction it leaves a
 * non-zero residual unless gain → ∞.
 *
 * `AccelerationBased`, despite the name, behaves as a true velocity
 * servo in Rapier: the constraint solver computes the impulse needed
 * to reach the target velocity each step and applies it directly.
 * The "stall after one revolution" symptom we attributed to it in
 * Follow-up #5 was actually caused by the *other* problems we
 * subsequently fixed (mass-props NaN on inertia, canSleep, damping).
 * Now that those are resolved, the velocity-servo model is the right
 * one for a spinning-arm demo: it converges to the commanded RPM and
 * holds it.
 */
function applyRevoluteMotor(
  joint: RAPIER.ImpulseJoint,
  motorSpeedRpm: number | null | undefined,
): void {
  const rpm = motorSpeedRpm ?? 0;
  const radPerSec = rpmToRadPerSec(rpm);
  // eslint-disable-next-line no-console
  console.log("[motor-apply]", {
    rpm,
    radPerSec,
    gain: MOTOR_VELOCITY_GAIN,
    model: "AccelerationBased",
  });
  const revolute = joint as unknown as RAPIER.RevoluteImpulseJoint;
  revolute.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
  revolute.configureMotorVelocity(radPerSec, MOTOR_VELOCITY_GAIN);
}

function applyPrismaticMotor(
  joint: RAPIER.ImpulseJoint,
  motorVelocityMmPerSec: number | null | undefined,
): void {
  const v = motorVelocityMmPerSec ?? 0;
  const prismatic = joint as unknown as RAPIER.PrismaticImpulseJoint;
  prismatic.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
  prismatic.configureMotorVelocity(v, MOTOR_VELOCITY_GAIN);
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

/** Hamilton product q = a ⊗ b. */
function quatMul(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** Rotate vector v by unit quaternion q: v' = q ⊗ v ⊗ q^(-1). */
function quatRotateVec(
  q: { x: number; y: number; z: number; w: number },
  v: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  // Standard expansion: v' = v + 2 q.w (q.xyz × v) + 2 q.xyz × (q.xyz × v)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
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
  desc.setTranslation(px, py, pz).setRotation(quat);

  if (!part.isGround) {
    // Damping is intentionally zero. Rapier's damping is a per-step
    // exponential drag; in mm-units, even a value of 0.05 produces a
    // torque of (0.05 × ω) every step which competes with the joint
    // motor and lets the velocity error settle into a low-magnitude
    // steady state. Rapier's sleep heuristic then flags the body as
    // idle and freezes it after ~1 s of sim-time — exactly the QA
    // symptom: "Part 2 spins briefly, then sticks". Joint motors
    // already enforce velocity tracking; passive idle mechanisms
    // (Phase 11+) can re-introduce damping per-mate if they need it.
    desc
      .setLinearDamping(0)
      .setAngularDamping(0)
      // Disable Rapier's auto-sleep. With a velocity motor wired to
      // the joint, a sleeping body never sees the motor's impulse
      // and the mechanism stalls. The cost of keeping bodies awake
      // is one extra solver iteration per body per step, negligible
      // for the < 50-body assemblies KinetiCAD targets.
      .setCanSleep(false);
  }

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

  // Suppress contact-force resolution between all part colliders. 16/05/2026.
  // KinetiCAD is a joint-driven kinematic simulator; part-to-part contact
  // impulses are unwanted noise. Joints still solve fully; only the contact
  // constraint rows are dropped from the solver.
  //
  // Root cause that prompted this: in a multi-body assembly two dynamic arm
  // bodies were jointed to a common Fixed parent but not to each other.
  // Their convex-hull colliders overlapped at the shared origin. Rapier only
  // auto-suppresses contacts for directly-jointed pairs, so Rapier generated
  // large contact-separation impulses that overwhelmed the revolute motors.
  //
  // Fix: set setSolverGroups so that no collider interacts with any other.
  //   High 16 bits = 0x0001  → membership in group 0.
  //   Low  16 bits = 0x0000  → filter matches nothing.
  // Neither fixed nor dynamic colliders resolve contacts with each other.
  colliderDesc.setSolverGroups(0x00010000);

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
      // Compute axisLocalB to detect frame skew between the two bodies.
      // Rapier 0.12 JointData.revolute applies ONE axis vector to BOTH
      // bodies' local frames identically — correct only when A and B share
      // the same world orientation.  For assemblies where they differ, the
      // proper fix requires JointData.generic with explicit frame quaternions
      // (which loses the RevoluteImpulseJoint motor API — deferred to a
      // future phase).  Logged here so rotated-part cases surface in QA.
      {
        const qa      = bodyA.rotation();
        const qb      = bodyB.rotation();
        const qbi     = { x: -qb.x, y: -qb.y, z: -qb.z, w: qb.w };
        const axisWorld  = quatRotateVec(qa, { x: ax[0], y: ax[1], z: ax[2] });
        const axisLocalB = quatRotateVec(qbi, axisWorld);
        const axisDrift  = Math.abs(
          1 - Math.abs(
            ax[0] * axisLocalB.x + ax[1] * axisLocalB.y + ax[2] * axisLocalB.z,
          ),
        );
        if (axisDrift > 0.01) {
          // eslint-disable-next-line no-console
          console.warn("[joint-build] axis-frame skew detected", {
            mateId: mate.id,
            axisLocalA: ax,
            axisLocalB,
            axisDrift,
          });
        }
      }
      // eslint-disable-next-line no-console
      console.log("[mate-read-pivot]", {
        mateId: mate.id,
        storedPivotA: mate.pivotA,
        storedPivotB: mate.pivotB,
        willPassToRapier_A: a,
        willPassToRapier_B: b,
      });
      // Phase 9.5 diagnostic — surfaces the axis vector + body types so
      // we can sanity-check (a) the axis is a unit vector pointing in
      // the expected direction, (b) bodyA is fixed (1) and bodyB is
      // dynamic (0), not accidentally both fixed.
      // eslint-disable-next-line no-console
      console.log("[joint-build]", {
        mateId: mate.id,
        axis: ax,
        axisLength: Math.sqrt(ax[0] ** 2 + ax[1] ** 2 + ax[2] ** 2),
        bodyAType: (bodyA as unknown as { bodyType?: () => number }).bodyType?.(),
        bodyBType: (bodyB as unknown as { bodyType?: () => number }).bodyType?.(),
        motorSpeedRpm: mate.motorSpeedRpm,
        pivotA: a,
        pivotB: b,
      });
      // eslint-disable-next-line no-console
      console.log("[joint-build-pivots]", {
        mateId: mate.id,
        pivotA_local: { x: a.x, y: a.y, z: a.z },
        pivotB_local: { x: b.x, y: b.y, z: b.z },
        partA_position: bodyA.translation(),
        partB_position: bodyB.translation(),
        pivotA_world_expected: "partA.position + partA.rotation * pivotA_local",
        pivotB_world_expected: "partB.position + partB.rotation * pivotB_local",
      });
      const params = RAPIER.JointData.revolute(
        a,
        b,
        { x: ax[0], y: ax[1], z: ax[2] },
      );
      const joint = rapierWorld.createImpulseJoint(params, bodyA, bodyB, true);
      mateIdToJoint.set(mate.id, joint);
      mateById.set(mate.id, mate);
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
      mateById.set(mate.id, mate);
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
      // play-time. Rapier's fixed joint locks bodyA·frame1 ≡ bodyB·frame2
      // in world space, so passing identity for both anchors would yank
      // B's origin onto A's origin. Instead we pick frame1 = identity
      // (in A's local) and compute frame2 = T_B^(-1) · T_A in B's local
      // — i.e. A's pose expressed in B's frame at the current instant.
      const pa = bodyA.translation();
      const qa = bodyA.rotation();
      const pb = bodyB.translation();
      const qb = bodyB.rotation();
      // q_B^(-1) (unit quat → conjugate)
      const qbi = { x: -qb.x, y: -qb.y, z: -qb.z, w: qb.w };
      // Δp in world frame
      const dpx = pa.x - pb.x;
      const dpy = pa.y - pb.y;
      const dpz = pa.z - pb.z;
      // Rotate Δp by q_B^(-1) → Δp expressed in B's local frame.
      // v' = q ⊗ v ⊗ q^(-1); using the standard expansion.
      const t = quatRotateVec(qbi, { x: dpx, y: dpy, z: dpz });
      // q_rel = q_B^(-1) ⊗ q_A   (A's orientation in B's local frame)
      const qrel = quatMul(qbi, qa);
      const params = RAPIER.JointData.fixed(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        t,
        qrel,
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
  mateById.clear();
  stepCount = 0;
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

  async step(scaledDtMs?: number): Promise<StepResult> {
    if (!world) {
      return { transforms: [], dtMs: 0 };
    }
    if (scaledDtMs != null && scaledDtMs > 0) {
      world.timestep = scaledDtMs / 1000;
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

    // Phase 9.5 diagnostic — once a second, dump bodyB's angular
    // velocity + sleep status for each motorised joint. If angvel
    // stays at zero with motorRpm non-zero, the motor is not firing
    // (constraint, axis, or model bug). If angvel ramps but the mesh
    // doesn't visibly rotate, it's a render-side bug.
    stepCount += 1;
    if (stepCount % 60 === 0) {
      mateIdToJoint.forEach((_joint, mateId) => {
        const mate = mateById.get(mateId);
        if (!mate) return;
        const bodyB = partIdToBody.get(mate.partB);
        if (!bodyB) return;
        const angvel = (
          bodyB as unknown as {
            angvel: () => { x: number; y: number; z: number };
          }
        ).angvel();
        const sleeping = (
          bodyB as unknown as { isSleeping?: () => boolean }
        ).isSleeping?.();
        const motorRpm =
          mate.type === "revolute"
            ? mate.motorSpeedRpm
            : mate.type === "prismatic"
              ? mate.motorVelocityMmPerSec
              : null;
        // eslint-disable-next-line no-console
        console.log("[step-diag]", {
          stepCount,
          mateId,
          mateType: mate.type,
          bodyBangvel: angvel,
          bodyBangvelMag: Math.sqrt(
            angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2,
          ),
          bodyBSleeping: sleeping,
          motorRpm,
        });
      });
    }

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

// Diagnostic: log the path array of every incoming Comlink call so the bad
// path that triggers the Array.reduce TypeError can be identified at runtime.
// Set COMLINK_TRACE to false once the offending call site is found.
// Added 16/05/2026.
const COMLINK_TRACE = true;
if (COMLINK_TRACE) {
  self.addEventListener('message', (msg) => {
    const d = (msg as MessageEvent).data;
    if (d && Array.isArray(d.path)) {
      // eslint-disable-next-line no-console
      console.log('[comlink-in]', { path: d.path, type: d.type });
    }
  });
}

Comlink.expose(api);
