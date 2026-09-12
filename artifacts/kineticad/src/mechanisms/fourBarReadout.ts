import type { StepTransform, BodyMeasurement } from '../physics/types';
import { fourBarReferenceAtAngle, validateFourBarParams } from './fourBarKinematics';
import type { FourBarDesign } from './fourBarSynthesis';
import { FOUR_BAR_GEOMETRY, FOUR_BAR_IDS, fourBarJointPivots } from './fourBarAssembly';

export type FourBarSample = {
  timeSeconds: number;
  /** Actual solver pose of the material point on the coupler; never predicted. */
  positionMm: [number, number, number];
  /** Independent geometric closure at the measured crank angle. */
  referencePositionMm: [number, number, number];
  /** Constant-RPM schedule; separate from the angle-conditioned comparison. */
  nominalPositionMm: [number, number, number];
  positionErrorMm: number;
  nominalPositionErrorMm: number;
  crankAngleDeg: number;
  crankRpm?: number;
  maxJointClosureMm: number;
  heightErrorMm: number;
};
const finite = (value: unknown, size: number): value is number[] => Array.isArray(value) && value.length === size && value.every(Number.isFinite);
function unitQuaternion(value: unknown): [number, number, number, number] | undefined {
  if (!finite(value, 4)) return;
  const norm = Math.hypot(...value);
  if (!(norm > 0) || !Number.isFinite(norm)) return;
  return value.map(component => component / norm) as [number, number, number, number];
}
function point(pose: StepTransform, local: readonly number[]): [number, number, number] {
  const [x, y, z, w] = unitQuaternion(pose.rotationQuat)!;
  const [vx, vy, vz] = local;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [pose.positionMm[0] + vx + w * tx + y * tz - z * ty,
    pose.positionMm[1] + vy + w * ty + z * tx - x * tz,
    pose.positionMm[2] + vz + w * tz + x * ty - y * tx];
}
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, i) => value - b[i]));

/** Read the same actual poses sent to the renderer. Body linear velocity is at
 * COM, so it must NOT be reused as the velocity of this offset tracing point.
 * This initial path comparison intentionally reports measured positions only. */
export function readFourBarSample(design: FourBarDesign, timeMs: number, poses: StepTransform[], bodies: BodyMeasurement[]): FourBarSample | undefined {
  try {
    const params = validateFourBarParams(design.params);
    if (!Number.isFinite(timeMs) || timeMs < 0) return;
    const required = [FOUR_BAR_IDS.ground, FOUR_BAR_IDS.crank, FOUR_BAR_IDS.coupler, FOUR_BAR_IDS.rocker];
    const map = new Map<string, StepTransform>();
    for (const id of required) {
      const matches = poses.filter(pose => pose.partId === id);
      if (matches.length !== 1 || !finite(matches[0].positionMm, 3) || !unitQuaternion(matches[0].rotationQuat)) return;
      map.set(id, matches[0]);
    }
    const crank = map.get(FOUR_BAR_IDS.crank)!;
    const [x, y, z, w] = unitQuaternion(crank.rotationQuat)!;
    const theta = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) - params.rotationDeg * Math.PI / 180;
    const positionMm = point(map.get(FOUR_BAR_IDS.coupler)!, [...params.couplerPointLocalMm, FOUR_BAR_GEOMETRY.traceZMm - FOUR_BAR_GEOMETRY.couplerOriginZMm]);
    const reference = fourBarReferenceAtAngle(params, theta);
    const nominal = fourBarReferenceAtAngle(params, params.initialCrankAngleDeg * Math.PI / 180 + params.rpm * Math.PI / 30 * timeMs / 1000);
    const referencePositionMm: [number, number, number] = [...reference.tracePointMm, FOUR_BAR_GEOMETRY.traceZMm];
    const nominalPositionMm: [number, number, number] = [...nominal.tracePointMm, FOUR_BAR_GEOMETRY.traceZMm];
    const maxJointClosureMm = Math.max(...fourBarJointPivots(params).map(joint =>
      distance(point(map.get(joint.partA)!, joint.a), point(map.get(joint.partB)!, joint.b))));
    const angular = bodies.find(body => body.partId === FOUR_BAR_IDS.crank)?.angularVelocityRadPerSec;
    const crankRpm = finite(angular, 3) ? angular[2] * 30 / Math.PI : undefined;
    return { timeSeconds: timeMs / 1000, positionMm, referencePositionMm, nominalPositionMm,
      positionErrorMm: distance(positionMm, referencePositionMm), nominalPositionErrorMm: distance(positionMm, nominalPositionMm),
      crankAngleDeg: theta * 180 / Math.PI, crankRpm, maxJointClosureMm, heightErrorMm: Math.abs(positionMm[2] - FOUR_BAR_GEOMETRY.traceZMm) };
  } catch { return; }
}
