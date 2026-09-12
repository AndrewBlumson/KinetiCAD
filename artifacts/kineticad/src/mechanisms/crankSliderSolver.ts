import type { PhysicsSolverSettings } from '../physics/types';

/** Calibrated numerical profile for this four-body closed loop. Ordinary
 * assemblies retain their existing defaults; this is not a motor rating. */
export const CRANK_SLIDER_SOLVER_SETTINGS: Readonly<PhysicsSolverSettings> = Object.freeze({
  numSolverIterations: 8,
  numInternalPgsIterations: 16,
  motorVelocityGain: 100000,
});
