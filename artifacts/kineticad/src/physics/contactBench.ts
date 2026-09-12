/** Isolated exact-cuboid contact bench. It never changes assembly collisions.
 * Geometry/velocities are mm, masses kg, forces N and energy J. Rotations and
 * lateral Y motion are guided; X sliding and vertical support remain dynamic. */
import RAPIER from '@dimforge/rapier3d-compat';

export type ContactBenchConfig = {
  frictionCoefficient?: number;
  massKg?: number;
  initialVelocityMmPerSec?: number;
  timeStepMs?: number;
  durationMs?: number;
  /** Diagnostic drop: continuous-contact analytic references are disabled. */
  initialGapMm?: number;
};
export type ContactBenchSnapshot = {
  kind: 'contact';
  config: Required<ContactBenchConfig>;
  simulatedTimeMs: number;
  dtMs: number;
  steps: number;
  completed: boolean;
  geometry: { blockSizeMm: [number, number, number]; floorSizeMm: [number, number, number]; floorPositionMm: [number, number, number] };
  body: { positionMm: [number, number, number]; rotationQuat: [number, number, number, number]; linearVelocityMmPerSec: [number, number, number]; massKg: number };
  /** Forces are means over the latest fixed step, even if step() advanced several. */
  contact: { active: boolean; count: number; normalForceN: number; frictionForceN: number;
    normalForceFromMomentumN: number; frictionForceXFromMomentumN: number; penetrationMm: number; geometricPenetrationMm: number };
  energy: { kineticJ: number; potentialJ: number; mechanicalJ: number; dissipatedJ: number; frictionWorkJ: number };
  reference: { valid: boolean; reason: string | null; positionXMm: number | null; velocityXMmPerSec: number | null;
    /** Validated numerical allowance for this scoped bench, not an exact trajectory claim. */
    positionErrorBoundMm: number | null;
    stopTimeMs: number | null; stoppingDistanceMm: number | null; normalForceN: number;
    frictionForceN: number | null; slidingFrictionForceN: number };
};
export const CONTACT_BENCH_PRESETS: ReadonlyArray<{ id: string; title: string; description: string; config: ContactBenchConfig }> = [
  { id: 'sliding', title: 'Sliding friction', description: 'A guided block slows and stops on a surface with μ = 0.25.', config: { frictionCoefficient: 0.25, initialVelocityMmPerSec: 1000 } },
  { id: 'frictionless', title: 'Frictionless glide', description: 'Vertical contact supports the block while horizontal speed remains constant.', config: { frictionCoefficient: 0, initialVelocityMmPerSec: 1000 } },
  { id: 'resting', title: 'Resting contact', description: 'The measured support force balances the block’s weight.', config: { frictionCoefficient: 0.5, initialVelocityMmPerSec: 0 } },
];
const GRAVITY_MM_S2 = 9810;
const BLOCK_SIZE: [number, number, number] = [100, 60, 40];
let ready: Promise<void> | undefined;
function validated(input: ContactBenchConfig): Required<ContactBenchConfig> {
  const config = { frictionCoefficient: 0.25, massKg: 2, initialVelocityMmPerSec: 1000,
    timeStepMs: 1000 / 60, durationMs: 2000, initialGapMm: 0, ...input };
  for (const [key, value] of Object.entries(config)) if (!Number.isFinite(value)) throw new Error(`Contact bench: ${key} must be finite.`);
  if (config.frictionCoefficient < 0 || config.frictionCoefficient > 1) throw new Error('Contact bench: friction must be between 0 and 1.');
  if (config.massKg < 0.1 || config.massKg > 100) throw new Error('Contact bench: mass must be 0.1–100 kg.');
  if (config.initialVelocityMmPerSec < 0 || config.initialVelocityMmPerSec > 2000) throw new Error('Contact bench: initial speed must be 0–2000 mm/s.');
  if (![60, 120, 240].some((hz) => Math.abs(config.timeStepMs - 1000 / hz) < 1e-8)) throw new Error('Contact bench: use a 60, 120 or 240 Hz fixed step.');
  if (config.durationMs < 100 || config.durationMs > 10000) throw new Error('Contact bench: duration must be 0.1–10 seconds.');
  if (config.initialGapMm < 0 || config.initialGapMm > 100) throw new Error('Contact bench: initial gap must be 0–100 mm.');
  if (Math.abs(config.durationMs / config.timeStepMs - Math.round(config.durationMs / config.timeStepMs)) > 1e-7) {
    throw new Error('Contact bench: duration must contain whole fixed steps.');
  }
  return config;
}

export async function createContactBench(input: ContactBenchConfig = {}): Promise<{
  step: (requestedMs: number) => ContactBenchSnapshot;
  dispose: () => void;
}> {
  const config = validated(input);
  await (ready ??= RAPIER.init());
  const world = new RAPIER.World({ x: 0, y: 0, z: -GRAVITY_MM_S2 });
  const dt = config.timeStepMs / 1000;
  world.timestep = dt;
  // Rapier0.12 reports the final small-step contact impulse, not their sum.
  // One outer solver step +16 internal PGS iterations makes impulse/dt the
  // full fixed-step mean force. Tests calibrate both components to momentum.
  world.integrationParameters.numSolverIterations = 1;
  world.integrationParameters.numInternalPgsIterations = 16;
  world.integrationParameters.numAdditionalFrictionIterations = 8;
  world.integrationParameters.allowedLinearError = 0.001; // mm
  // For the optional drop diagnostic, cover the largest downward travel
  // before impact in one step so predictive contacts can prevent tunnelling.
  // This changes collision candidate reach, not the rendered cuboid surface.
  world.integrationParameters.predictionDistance = config.initialGapMm > 0
    ? Math.sqrt(2 * GRAVITY_MM_S2 * config.initialGapMm) * dt + GRAVITY_MM_S2 * dt * dt + 0.01
    : 0.01; // mm
  const travel = config.initialVelocityMmPerSec * config.durationMs / 1000;
  const floorSize: [number, number, number] = [Math.max(1000, travel + 1000), 600, 50];
  const floorPosition: [number, number, number] = [travel / 2, 0, -25];
  const ground = world.createCollider(RAPIER.ColliderDesc.cuboid(floorSize[0] / 2, floorSize[1] / 2, floorSize[2] / 2)
    .setTranslation(...floorPosition).setFriction(config.frictionCoefficient).setRestitution(0)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, BLOCK_SIZE[2] / 2 + config.initialGapMm)
    .setLinvel(config.initialVelocityMmPerSec, 0, 0).lockRotations().enabledTranslations(true, false, true)
    .setLinearDamping(0).setAngularDamping(0).setCanSleep(false));
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(BLOCK_SIZE[0] / 2, BLOCK_SIZE[1] / 2, BLOCK_SIZE[2] / 2)
    .setMass(config.massKg).setFriction(config.frictionCoefficient).setRestitution(0)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average), body);
  let accumulatorMs = 0, steps = 0, disposed = false, frictionWorkJ = 0;
  let lostSupport = config.initialGapMm > 0;
  const totalSteps = Math.round(config.durationMs / config.timeStepMs);
  const initialEnergy = 0.5 * config.massKg * (config.initialVelocityMmPerSec / 1000) ** 2
    + config.massKg * (GRAVITY_MM_S2 / 1000) * (BLOCK_SIZE[2] / 2 + config.initialGapMm) / 1000;
  let contact: ContactBenchSnapshot['contact'] = { active: false, count: 0, normalForceN: 0, frictionForceN: 0,
    normalForceFromMomentumN: 0, frictionForceXFromMomentumN: 0, penetrationMm: 0, geometricPenetrationMm: 0 };

  function snapshot(advancedMs: number): ContactBenchSnapshot {
    const position = body.translation(), velocity = body.linvel(), rotation = body.rotation();
    const timeMs = Math.min(config.durationMs, steps * config.timeStepMs), seconds = timeMs / 1000;
    const deceleration = config.frictionCoefficient * GRAVITY_MM_S2;
    const stopTime = deceleration > 0 ? config.initialVelocityMmPerSec / deceleration : Infinity;
    const slideTime = Math.min(seconds, stopTime);
    const kinetic = 0.5 * body.mass() * (velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) * 1e-6;
    const potential = body.mass() * (GRAVITY_MM_S2 / 1000) * position.z / 1000;
    const valid = steps > 0 && contact.active && !lostSupport;
    return { kind: 'contact', config: { ...config }, simulatedTimeMs: timeMs, dtMs: advancedMs, steps, completed: steps >= totalSteps,
      geometry: { blockSizeMm: [...BLOCK_SIZE], floorSizeMm: [...floorSize], floorPositionMm: [...floorPosition] },
      body: { positionMm: [position.x, position.y, position.z], rotationQuat: [rotation.x, rotation.y, rotation.z, rotation.w],
        linearVelocityMmPerSec: [velocity.x, velocity.y, velocity.z], massKg: body.mass() },
      contact: { ...contact }, energy: { kineticJ: kinetic, potentialJ: potential, mechanicalJ: kinetic + potential,
        dissipatedJ: initialEnergy - kinetic - potential, frictionWorkJ },
      reference: { valid, reason: valid ? null : lostSupport ? 'Continuous support was not maintained; the sliding reference does not apply.' : 'Contact has not yet been measured.',
        positionXMm: valid ? config.initialVelocityMmPerSec * slideTime - 0.5 * deceleration * slideTime ** 2 : null,
        positionErrorBoundMm: valid ? config.initialVelocityMmPerSec * dt / 2 + 0.5 : null,
        velocityXMmPerSec: valid ? Math.max(0, config.initialVelocityMmPerSec - deceleration * seconds) : null,
        stopTimeMs: Number.isFinite(stopTime) ? stopTime * 1000 : null,
        stoppingDistanceMm: deceleration > 0 ? config.initialVelocityMmPerSec ** 2 / (2 * deceleration) : null,
        normalForceN: config.massKg * GRAVITY_MM_S2 / 1000,
        frictionForceN: valid ? config.massKg * (Math.max(0, config.initialVelocityMmPerSec - deceleration * Math.max(0, seconds - dt))
          - Math.max(0, config.initialVelocityMmPerSec - deceleration * seconds)) / dt / 1000 : null,
        slidingFrictionForceN: config.frictionCoefficient * config.massKg * GRAVITY_MM_S2 / 1000 } };
  }
  return {
    step(requestedMs) {
      if (disposed) throw new Error('Contact bench has been disposed.');
      if (!Number.isFinite(requestedMs) || requestedMs < 0) throw new Error('Contact bench elapsed time must be finite and nonnegative.');
      accumulatorMs += Math.min(requestedMs, config.durationMs + config.timeStepMs);
      let advanced = 0;
      while (accumulatorMs + 1e-8 >= config.timeStepMs && steps < totalSteps) {
        const before = body.linvel();
        world.step(); steps++; advanced += config.timeStepMs; accumulatorMs = Math.max(0, accumulatorMs - config.timeStepMs);
        const after = body.linvel();
        let normalImpulse = 0, tangentImpulse = 0, count = 0, penetration = 0;
        world.contactPair(ground, collider, (manifold) => {
          count += manifold.numContacts();
          for (let i = 0; i < manifold.numContacts(); i++) {
            normalImpulse += manifold.contactImpulse(i);
            tangentImpulse += Math.hypot(manifold.contactTangentImpulseX(i), manifold.contactTangentImpulseY(i));
            penetration = Math.max(penetration, -manifold.contactDist(i));
          }
        });
        const frictionX = body.mass() * (after.x - before.x) / dt / 1000;
        contact = { active: normalImpulse > 1e-8, count, normalForceN: normalImpulse / dt / 1000,
          frictionForceN: tangentImpulse / dt / 1000,
          normalForceFromMomentumN: body.mass() * ((after.z - before.z) / dt + GRAVITY_MM_S2) / 1000,
          frictionForceXFromMomentumN: frictionX, penetrationMm: penetration,
          geometricPenetrationMm: Math.max(0, BLOCK_SIZE[2] / 2 - body.translation().z) };
        if (!contact.active) lostSupport = true;
        // Impulse-work identity uses average pre/post velocity; it is separate
        // from semi-implicit position integration and includes no gravity work.
        frictionWorkJ -= frictionX * (before.x + after.x) / 2 / 1000 * dt;
      }
      return snapshot(advanced);
    },
    dispose() { if (!disposed) { disposed = true; world.free(); } },
  };
}
