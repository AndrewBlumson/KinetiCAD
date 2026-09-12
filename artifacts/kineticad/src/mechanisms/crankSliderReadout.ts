import { CRANK_SLIDER_IDS, crankSliderReference, type CrankSliderParams } from './crankSlider';
import type { BodyMeasurement, StepTransform } from '../physics/types';

export type CrankSliderSample = {
  timeSeconds: number;
  positionMm: number;
  referencePositionMm: number;
  velocityMmPerSec: number;
  referenceVelocityMmPerSec: number;
  angleDeg: number;
  rpm: number;
  averageAccelerationMmPerSec2?: number;
  referenceAverageAccelerationMmPerSec2?: number;
};

function finiteVector(value: unknown, size: number): value is number[] {
  return Array.isArray(value) && value.length === size && value.every(Number.isFinite);
}

/** Select a measured endpoint at least 1/30 s earlier, allowing 1e-8 s
 * floating-point roundoff. A backward clock belongs to a different run;
 * callers must clear that history rather than join the two trajectories. */
export function selectCrankSliderIntervalSample(samples: readonly CrankSliderSample[], timeSeconds: number): CrankSliderSample | undefined {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return;
  let selected: CrankSliderSample | undefined;
  for (const sample of samples) {
    if (sample.timeSeconds < 0 || ![
      sample.timeSeconds, sample.positionMm, sample.referencePositionMm,
      sample.velocityMmPerSec, sample.referenceVelocityMmPerSec,
      sample.angleDeg, sample.rpm,
    ].every(Number.isFinite)
      || (sample.averageAccelerationMmPerSec2 !== undefined && !Number.isFinite(sample.averageAccelerationMmPerSec2))
      || (sample.referenceAverageAccelerationMmPerSec2 !== undefined && !Number.isFinite(sample.referenceAverageAccelerationMmPerSec2))) continue;
    if (sample.timeSeconds > timeSeconds) return;
    if (timeSeconds - sample.timeSeconds >= 1 / 30 - 1e-8
      && (!selected || sample.timeSeconds > selected.timeSeconds)) selected = sample;
  }
  return selected;
}

/** Compare actual solver readbacks with independent constant-speed kinematics. */
export function readCrankSliderSample(params: CrankSliderParams, timeMs: number, poses: StepTransform[], bodies: BodyMeasurement[], previous?: CrankSliderSample): CrankSliderSample | undefined {
  const crankPose = poses.find(p => p.partId === CRANK_SLIDER_IDS.crank);
  const crank = bodies.find(p => p.partId === CRANK_SLIDER_IDS.crank);
  const slider = bodies.find(p => p.partId === CRANK_SLIDER_IDS.slider);
  // An absent/invalid readback must stay absent, never be filled from the
  // theoretical curve or a previous frame. Callers clear their display here.
  if (!crankPose || !crank || !slider || !Number.isFinite(timeMs) || timeMs < 0
    || !finiteVector(crankPose.rotationQuat, 4)
    || !finiteVector(crank.angularVelocityRadPerSec, 3)
    || !finiteVector(slider.positionMm, 3)
    || !finiteVector(slider.linearVelocityMmPerSec, 3)) return;
  const norm = Math.hypot(...crankPose.rotationQuat);
  if (norm === 0 || !Number.isFinite(norm)) return;
  const t = timeMs / 1000;
  const reference = crankSliderReference(params, t);
  const [x, y, z, w] = crankPose.rotationQuat.map(component => component / norm);
  const sample: CrankSliderSample = {
    timeSeconds: t, positionMm: slider.positionMm[0], referencePositionMm: reference.sliderPositionMm,
    velocityMmPerSec: slider.linearVelocityMmPerSec[0], referenceVelocityMmPerSec: reference.sliderVelocityMmPerSec,
    angleDeg: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * 180 / Math.PI,
    rpm: crank.angularVelocityRadPerSec[2] * 30 / Math.PI,
  };
  if (previous && Number.isFinite(previous.timeSeconds) && previous.timeSeconds >= 0
    && Number.isFinite(previous.velocityMmPerSec) && t > previous.timeSeconds) {
    const dt = t - previous.timeSeconds;
    sample.averageAccelerationMmPerSec2 = (sample.velocityMmPerSec - previous.velocityMmPerSec) / dt;
    sample.referenceAverageAccelerationMmPerSec2 = (reference.sliderVelocityMmPerSec - crankSliderReference(params, previous.timeSeconds).sliderVelocityMmPerSec) / dt;
  }
  return sample;
}
