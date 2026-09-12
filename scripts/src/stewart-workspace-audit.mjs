// Independent geometric certificate for the current parametric Stewart fixture.
// This module never assigns poses to simulated bodies or imports controller math.
import { STEWART_DEFAULTS, stewartLegGeometry } from './stewart-platform-demo.mjs';

const p = STEWART_DEFAULTS;
const homeLegs = stewartLegGeometry();
const rad = (v) => v * Math.PI / 180;
const deg = (v) => v * 180 / Math.PI;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(...a);
const clamp = (v, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const angle = (a, b) => Math.acos(clamp(dot(a, b) / (norm(a) * norm(b))));
export function rotateXYZ([x, y, z], degrees) {
  const [a, b, c] = degrees.map(rad);
  const x1 = Math.cos(c) * x - Math.sin(c) * y, y1 = Math.sin(c) * x + Math.cos(c) * y;
  const x2 = Math.cos(b) * x1 + Math.sin(b) * z, z2 = -Math.sin(b) * x1 + Math.cos(b) * z;
  return [x2, Math.cos(a) * y1 - Math.sin(a) * z2, Math.sin(a) * y1 + Math.cos(a) * z2];
}
function matrixXYZ(degrees) {
  const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => rotateXYZ(v, degrees));
  return Array.from({ length: 9 }, (_, i) => columns[i % 3][Math.floor(i / 3)]);
}
export function segmentDistance(p0, p1, q0, q1) {
  const u = sub(p1, p0), v = sub(q1, q0), w = sub(p0, q0);
  const a = dot(u, u), b = dot(u, v), c = dot(u, w), e = dot(v, v), f = dot(v, w), denominator = a * e - b * b;
  let s = denominator > 1e-10 ? clamp((b * f - c * e) / denominator, 0, 1) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
  else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
  return norm(sub(add(p0, scale(u, s)), add(q0, scale(v, t))));
}
function matrixNormAndInverseNorm(rows) {
  const a = rows.map((row, i) => [...row, ...Array.from({ length: 6 }, (_, j) => Number(i === j))]);
  for (let col = 0; col < 6; col++) {
    let pivot = col;
    for (let row = col + 1; row < 6; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) return { norm: Infinity, inverseNorm: Infinity };
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col]; a[col] = a[col].map((v) => v / divisor);
    for (let row = 0; row < 6; row++) if (row !== col) {
      const factor = a[row][col]; a[row] = a[row].map((v, i) => v - factor * a[col][i]);
    }
  }
  return { norm: Math.max(...rows.map((row) => row.reduce((sum, v) => sum + Math.abs(v), 0))),
    inverseNorm: Math.max(...a.map((row) => row.slice(6).reduce((sum, v) => sum + Math.abs(v), 0))) };
}

export function analyseStewartPose({ translationMm, rotationDeg, rotationMatrix }) {
  const rotate = rotationMatrix ? (v) => [0, 1, 2].map((i) => dot(rotationMatrix.slice(i * 3, i * 3 + 3), v)) : (v) => rotateXYZ(v, rotationDeg);
  const normal = rotate([0, 0, 1]);
  const position = add([0, 0, p.platformHeightMm], translationMm);
  const rows = [];
  const legs = homeLegs.map((leg) => {
    const offset = rotate(leg.platformAnchorLocal), top = add(position, offset);
    const delta = sub(top, leg.baseAnchor), length = norm(delta), direction = scale(delta, 1 / length);
    rows.push([...direction, ...scale(cross(offset, direction), 1 / p.platformAnchorRadiusMm)]);
    // Compare in the world frame; rotating both reference and actual local
    // vectors preserves angle and avoids sharing the production quaternion code.
    const initialDeckDirectionWorld = rotate(leg.direction);
    return { base: leg.baseAnchor, top, lengthMm: length, extensionMm: length - leg.lengthMm, direction,
      baseDeflectionRad: angle(direction, leg.direction), deckDeflectionRad: angle(direction, initialDeckDirectionWorld),
      baseInclinationRad: angle(direction, [0, 0, 1]), deckInclinationRad: angle(direction, normal) };
  });
  let capsuleGapMm = Infinity;
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
    capsuleGapMm = Math.min(capsuleGapMm, segmentDistance(legs[a].base, legs[a].top, legs[b].base, legs[b].top) - 2 * p.collarRadiusMm);
  }
  return { legs, capsuleGapMm, jacobian: matrixNormAndInverseNorm(rows) };
}

export const WORKSPACE_LIMITS = Object.freeze({ translationMm: 5, rotationDeg: 2,
  minStrokeMm: -12, maxStrokeMm: 20, maxRelativeBearingDeg: 8, maxJacobianCondition: 100 });

function enclosePose(result, endpointRadius, angularRadius, limits) {
  const shortest = Math.min(...result.legs.map((leg) => leg.lengthMm));
  const directionRadius = Math.asin(clamp(endpointRadius / shortest, 0, 1));
  const directionVectorRadius = 2 * Math.sin(directionRadius / 2);
  const jacobianDelta = Math.sqrt(3) * (angularRadius + 2 * directionVectorRadius);
  const neumann = result.jacobian.inverseNorm * jacobianDelta;
  const condition = neumann < 1 ? (result.jacobian.norm + jacobianDelta) * result.jacobian.inverseNorm / (1 - neumann) : Infinity;
  const minStroke = Math.min(...result.legs.map((leg) => leg.extensionMm)) - endpointRadius;
  const maxStroke = Math.max(...result.legs.map((leg) => leg.extensionMm)) + endpointRadius;
  const capsuleGap = result.capsuleGapMm - 2 * endpointRadius;
  const bearing = Math.max(...result.legs.map((leg) => Math.max(leg.baseDeflectionRad + directionRadius,
    leg.deckDeflectionRad + directionRadius + angularRadius)));
  const inclination = Math.max(...result.legs.map((leg) => Math.max(leg.baseInclinationRad + directionRadius,
    leg.deckInclinationRad + directionRadius + angularRadius)));
  const neck = Math.sqrt(p.ballRadiusMm ** 2 - p.rodRadiusMm ** 2);
  const neckGap = neck * Math.cos(inclination) - p.rodRadiusMm * Math.sin(inclination);
  const barrelBaseGap = 10 * Math.cos(inclination) - p.barrelRadiusMm * Math.sin(inclination);
  const barrelDeckGap = (shortest - endpointRadius - p.barrelLengthMm) * Math.cos(inclination) - p.collarRadiusMm * Math.sin(inclination);
  const accepted = endpointRadius < shortest && minStroke >= limits.minStrokeMm && maxStroke <= limits.maxStrokeMm && capsuleGap > 0
    && bearing <= rad(limits.maxRelativeBearingDeg) && inclination < Math.PI / 2 && neckGap > 0
    && barrelBaseGap > 0 && barrelDeckGap > 0 && condition <= limits.maxJacobianCondition;
  return { accepted, minStroke, maxStroke, capsuleGap, bearingDeg: deg(bearing), neckGap, barrelGap: Math.min(barrelBaseGap, barrelDeckGap), condition };
}
function emptyBounds() {
  return { minStrokeBoundMm: Infinity, maxStrokeBoundMm: -Infinity, minCapsuleGapBoundMm: Infinity,
    minPlateNeckGapBoundMm: Infinity, minBarrelPlateGapBoundMm: Infinity, maxRelativeBearingBoundDeg: 0, maxJacobianConditionBound: 0 };
}
function collectBounds(report, bounds) {
  for (const [key, value] of Object.entries({ minStrokeBoundMm: bounds.minStroke, maxStrokeBoundMm: bounds.maxStroke,
    minCapsuleGapBoundMm: bounds.capsuleGap, minPlateNeckGapBoundMm: bounds.neckGap,
    minBarrelPlateGapBoundMm: bounds.barrelGap, maxRelativeBearingBoundDeg: bounds.bearingDeg, maxJacobianConditionBound: bounds.condition })) {
    report[key] = key.startsWith('min') ? Math.min(report[key], value) : Math.max(report[key], value);
  }
}

/** Certify an entire six-dimensional pose box by adaptive enclosing cells.
 * Each cell uses its centre only as a reference. Triangle inequalities enclose
 * EVERY pose in the cell, including rotations between sampled centres:
 * δP ≤ ||δtranslation|| + R·sum|δEuler|; angle(leg, centreLeg) ≤ asin(δP/L).
 * Capsule distance is 2δP-Lipschitz. A Neumann bound on J⁻¹ encloses condition.
 * An unresolved cell fails instead of being mislabeled a certified workspace.
 */
export function certifyStewartWorkspace(limits = WORKSPACE_LIMITS, maxDepth = 30) {
  const pending = [{ centre: [0, 0, 0, 0, 0, 0], half: [limits.translationMm, limits.translationMm, limits.translationMm,
    limits.rotationDeg, limits.rotationDeg, limits.rotationDeg], depth: 0 }];
  const report = { certified: true, evaluatedCells: 0, acceptedCells: 0, maximumDepth: 0, ...emptyBounds(), unresolvedCells: [] };
  while (pending.length) {
    const cell = pending.pop(); report.evaluatedCells++; report.maximumDepth = Math.max(report.maximumDepth, cell.depth);
    if (report.evaluatedCells > 1_000_000) throw new Error('Workspace certificate exceeded its explicit cell budget.');
    const result = analyseStewartPose({ translationMm: cell.centre.slice(0, 3), rotationDeg: cell.centre.slice(3) });
    const angularRadius = cell.half.slice(3).reduce((sum, v) => sum + rad(v), 0);
    const endpointRadius = norm(cell.half.slice(0, 3)) + p.platformAnchorRadiusMm * angularRadius;
    const bounds = enclosePose(result, endpointRadius, angularRadius, limits);
    if (bounds.accepted) {
      report.acceptedCells++;
      collectBounds(report, bounds);
    } else if (cell.depth >= maxDepth) {
      report.certified = false; report.unresolvedCells.push({ ...cell, ...bounds });
      if (report.unresolvedCells.length >= 32) break;
    } else {
      const weights = cell.half.map((v, i) => i < 3 ? v : p.platformAnchorRadiusMm * rad(v));
      const dimension = weights.indexOf(Math.max(...weights));
      const half = [...cell.half]; half[dimension] /= 2;
      for (const sign of [-1, 1]) {
        const centre = [...cell.centre]; centre[dimension] += sign * half[dimension];
        pending.push({ centre, half: [...half], depth: cell.depth + 1 });
      }
    }
  }
  return report;
}

/** Independent Rodrigues construction of the shortest home→target rotation. */
export function poseAtProgress(target, progress) {
  const rotation = matrixXYZ(target.rotationDeg);
  const theta = Math.acos(clamp((rotation[0] + rotation[4] + rotation[8] - 1) / 2));
  const axis = theta < 1e-9 ? [0, 0, 1] : scale([rotation[7] - rotation[5], rotation[2] - rotation[6], rotation[3] - rotation[1]], 1 / (2 * Math.sin(theta)));
  const a = theta * progress, c = Math.cos(a), s = Math.sin(a);
  const columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c))));
  return { translationMm: scale(target.translationMm, progress), rotationAngleRad: theta,
    rotationMatrix: Array.from({ length: 9 }, (_, i) => columns[i % 3][Math.floor(i / 3)]) };
}

/** Bound all progress values, including between samples. Quintic time is
 * monotone in [0,1], so its entire sweep is this same certified pose path. */
export function certifyStewartMotion(target, intervals = 128, moveSeconds = 4) {
  const theta = poseAtProgress(target, 1).rotationAngleRad;
  const pointTravelBound = norm(target.translationMm) + p.platformAnchorRadiusMm * theta;
  const report = { certified: true, intervals, ...emptyBounds(), failures: [], maxActuatorSpeedBoundMmPerSec: 1.875 * pointTravelBound / moveSeconds };
  for (let i = 0; i < intervals; i++) {
    const halfProgress = 1 / (2 * intervals);
    const pose = poseAtProgress(target, (i + 0.5) / intervals);
    const bounds = enclosePose(analyseStewartPose(pose), pointTravelBound * halfProgress, theta * halfProgress, WORKSPACE_LIMITS);
    collectBounds(report, bounds);
    if (!bounds.accepted) { report.certified = false; report.failures.push({ interval: i, ...bounds }); }
  }
  if (report.maxActuatorSpeedBoundMmPerSec > 8) { report.certified = false; report.failures.push({ speedBound: report.maxActuatorSpeedBoundMmPerSec }); }
  return report;
}

/** Exact target B-rep placement for geometric spot checks. Actuator solids are
 * surfaces of revolution, so any axial roll has the same occupied volume. */
export function stewartPoseTransforms(target) {
  const result = analyseStewartPose(target);
  const transforms = [{ partId: 'stewart-base', positionMm: [0, 0, 0], rotationMatrix: matrixXYZ([0, 0, 0]) },
    { partId: 'stewart-platform', positionMm: add([0, 0, p.platformHeightMm], target.translationMm), rotationMatrix: target.rotationMatrix ?? matrixXYZ(target.rotationDeg) }];
  result.legs.forEach((leg, i) => {
    const degrees = [deg(Math.atan2(-leg.direction[1], leg.direction[2])), deg(Math.asin(leg.direction[0])), 0];
    const rotationMatrix = matrixXYZ(degrees);
    transforms.push({ partId: `stewart-barrel-${i + 1}`, positionMm: leg.base, rotationMatrix },
      { partId: `stewart-rod-${i + 1}`, positionMm: add(leg.base, scale(leg.direction, leg.extensionMm)), rotationMatrix });
  });
  return transforms;
}
