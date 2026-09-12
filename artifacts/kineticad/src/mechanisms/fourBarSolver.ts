import type { PhysicsSolverSettings } from '../physics/types';

export const FOUR_BAR_TIME_STEP_MS = 1000 / 120;
export const FOUR_BAR_DURATION_MS = 6000;
/** Numerical convergence settings, not a motor force or torque rating. */
export const FOUR_BAR_SOLVER_SETTINGS: Readonly<PhysicsSolverSettings> = Object.freeze({
  numSolverIterations: 32,
  numInternalPgsIterations: 16,
  motorVelocityGain: 1000000,
});
