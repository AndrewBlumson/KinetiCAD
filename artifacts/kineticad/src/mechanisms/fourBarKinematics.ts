/** Planar, continuously rotating crank-rocker geometry. No dynamics are prescribed here. */
export type Point2 = [number, number];
export type FourBarParams = {
  groundLengthMm: number; crankLengthMm: number; couplerLengthMm: number; rockerLengthMm: number;
  couplerPointLocalMm: Point2; branch: 1 | -1; originMm: Point2;
  rotationDeg: number; initialCrankAngleDeg: number; rpm: number;
};
export const FOUR_BAR_LIMITS = Object.freeze({ ground: [60, 160], crank: [15, 50], coupler: [35, 200], rocker: [35, 200],
  minTriangleMarginMm: 2, minTransmissionAngleDeg: 20, minGroundCrankDifferenceMm: 22, markerPinDistanceMm: 6 });
const rad = Math.PI / 180;
const cross = (a: Point2, b: Point2) => a[0] * b[1] - a[1] * b[0];

export function fourBarMargins(p: FourBarParams) {
  const d = p.groundLengthMm, a = p.crankLengthMm, b = p.couplerLengthMm, c = p.rockerLengthMm;
  const sorted = [d, a, b, c].sort((x, y) => x - y);
  const cosAt = (r: number) => (b * b + c * c - r * r) / (2 * b * c);
  const maxAbsCos = Math.max(Math.abs(cosAt(d - a)), Math.abs(cosAt(d + a)));
  const minTransmissionAngleDeg = Math.acos(Math.min(1, maxAbsCos)) / rad;
  return { grashofMarginMm: sorted[1] + sorted[2] - sorted[0] - sorted[3],
    triangleMarginMm: Math.min(d - a - Math.abs(b - c), b + c - d - a), minTransmissionAngleDeg,
    pinRockerClearanceLowerBoundMm: b * Math.sin(minTransmissionAngleDeg * rad) - 10,
    pedestalCrankClearanceLowerBoundMm: d - a - 16 };
}

export function validateFourBarParams(value: unknown): FourBarParams {
  if (!value || typeof value !== 'object') throw new Error('Four-bar parameters are missing.');
  const p = value as FourBarParams;
  for (const key of ['groundLengthMm', 'crankLengthMm', 'couplerLengthMm', 'rockerLengthMm', 'rotationDeg', 'initialCrankAngleDeg', 'rpm'] as const) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key])) throw new Error(`Four-bar ${key} must be finite.`);
  }
  for (const key of ['originMm', 'couplerPointLocalMm'] as const) {
    if (!Array.isArray(p[key]) || p[key].length !== 2 || p[key].some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error(`Four-bar ${key} must contain two finite coordinates.`);
  }
  for (const [key, lo, hi] of [['groundLengthMm', 60, 160], ['crankLengthMm', 15, 50], ['couplerLengthMm', 35, 200], ['rockerLengthMm', 35, 200]] as const) {
    if (p[key] < lo - 1e-8 || p[key] > hi + 1e-8) throw new Error(`Four-bar ${key} must be ${lo}–${hi} mm.`);
  }
  if (p.branch !== 1 && p.branch !== -1) throw new Error('Four-bar assembly branch must be +1 or −1.');
  if (Math.abs(p.rpm) > 30 || Math.abs(p.rotationDeg) > 360000 || Math.abs(p.initialCrankAngleDeg) > 360000 || p.originMm.some(v => Math.abs(v) > 1000)) throw new Error('Four-bar placement, angle or speed exceeds its supported range.');
  const a = p.crankLengthMm, b = p.couplerLengthMm, c = p.rockerLengthMm, d = p.groundLengthMm;
  if (Math.min(d, b, c) - a < 2 - 1e-8) throw new Error('The input crank must be the uniquely shortest link with a 2 mm margin.');
  const [u, v] = p.couplerPointLocalMm;
  if (u < -0.25 * b - 1e-8 || u > 1.25 * b + 1e-8 || Math.abs(v) > 0.5 * b + 1e-8) throw new Error('The tracer point lies outside the supported coupler region.');
  if (Math.min(Math.hypot(u, v), Math.hypot(u - b, v)) < 6 - 1e-8) throw new Error('The tracer must remain at least 6 mm from either pin centre.');
  const m = fourBarMargins(p);
  if (m.grashofMarginMm < 2 - 1e-8 || m.triangleMarginMm < 2 - 1e-8 || d - a < 22 - 1e-8) throw new Error('The linkage lacks the full-cycle closure or support clearance margin.');
  if (m.minTransmissionAngleDeg < 20 - 1e-8) throw new Error('The transmission angle must stay between 20° and 160° throughout the cycle.');
  return { groundLengthMm: d, crankLengthMm: a, couplerLengthMm: b, rockerLengthMm: c,
    couplerPointLocalMm: [u, v], branch: p.branch, originMm: [...p.originMm], rotationDeg: p.rotationDeg, initialCrankAngleDeg: p.initialCrankAngleDeg, rpm: p.rpm };
}

/** Fast canonical XY geometry, also used for dimensionless search candidates after their own guard. */
export function solveFourBarLocal(d: number, a: number, b: number, c: number, u: number, v: number, branch: 1 | -1, theta: number) {
  const A: Point2 = [a * Math.cos(theta), a * Math.sin(theta)];
  const dx = d - A[0], dy = -A[1], r = Math.hypot(dx, dy);
  if (!(r > 0) || !Number.isFinite(r)) throw new Error('Four-bar circle centres are degenerate.');
  const x = (b * b - c * c + r * r) / (2 * r), h2 = b * b - x * x;
  if (!(h2 > 0)) throw new Error('Four-bar circles do not have two distinct intersections.');
  const h = Math.sqrt(h2), ex = dx / r, ey = dy / r;
  const B: Point2 = [A[0] + x * ex - branch * h * ey, A[1] + x * ey + branch * h * ex];
  const bx = B[0] - A[0], by = B[1] - A[1];
  const P: Point2 = [A[0] + (u * bx - v * by) / b, A[1] + (u * by + v * bx) / b];
  return { A, B, P };
}

export function fourBarReferenceAtAngle(input: FourBarParams, thetaRad: number, omegaRadPerSec = input.rpm * Math.PI / 30, alphaRadPerSec2 = 0) {
  const p = validateFourBarParams(input);
  if (![thetaRad, omegaRadPerSec, alphaRadPerSec2].every(Number.isFinite)) throw new Error('Four-bar angle and derivatives must be finite.');
  const { groundLengthMm: d, crankLengthMm: a, couplerLengthMm: b, rockerLengthMm: c } = p;
  const [u, v] = p.couplerPointLocalMm;
  const { A, B, P } = solveFourBarLocal(d, a, b, c, u, v, p.branch, thetaRad);
  const bv: Point2 = [B[0] - A[0], B[1] - A[1]], cv: Point2 = [B[0] - d, B[1]], det = cross(bv, cv);
  const dA: Point2 = [-a * Math.sin(thetaRad), a * Math.cos(thetaRad)], ddA: Point2 = [-A[0], -A[1]];
  const solve = (r1: number, r2: number): Point2 => [(r1 * cv[1] - bv[1] * r2) / det, (bv[0] * r2 - r1 * cv[0]) / det];
  const dB = solve(bv[0] * dA[0] + bv[1] * dA[1], 0);
  const ddB = solve(bv[0] * ddA[0] + bv[1] * ddA[1] - (dB[0] - dA[0]) ** 2 - (dB[1] - dA[1]) ** 2, -(dB[0] ** 2) - dB[1] ** 2);
  const tracerDerivative = (da: Point2, db: Point2): Point2 => [da[0] + (u * (db[0] - da[0]) - v * (db[1] - da[1])) / b,
    da[1] + (u * (db[1] - da[1]) + v * (db[0] - da[0])) / b];
  const dP = tracerDerivative(dA, dB), ddP = tracerDerivative(ddA, ddB);
  const phi = p.rotationDeg * rad, co = Math.cos(phi), si = Math.sin(phi);
  const rotate = (q: Point2): Point2 => [co * q[0] - si * q[1], si * q[0] + co * q[1]];
  const world = (q: Point2): Point2 => { const z = rotate(q); return [z[0] + p.originMm[0], z[1] + p.originMm[1]]; };
  const tracePointMm = world(P), vel = rotate([dP[0] * omegaRadPerSec, dP[1] * omegaRadPerSec]);
  const acc = rotate([ddP[0] * omegaRadPerSec ** 2 + dP[0] * alphaRadPerSec2, ddP[1] * omegaRadPerSec ** 2 + dP[1] * alphaRadPerSec2]);
  return { thetaRad, omegaRadPerSec, crankPinMm: world(A), rockerPinMm: world(B), outputPivotMm: world([d, 0]), tracePointMm,
    tracePointWorldMm: [tracePointMm[0], tracePointMm[1], 54] as [number, number, number],
    couplerAngleRad: phi + Math.atan2(bv[1], bv[0]), rockerAngleRad: phi + Math.atan2(cv[1], cv[0]),
    traceVelocityMmPerSec: [vel[0], vel[1], 0] as [number, number, number], traceAccelerationMmPerSec2: [acc[0], acc[1], 0] as [number, number, number],
    couplerAngularVelocityRadPerSec: cross(bv, [dB[0] - dA[0], dB[1] - dA[1]]) / (b * b) * omegaRadPerSec,
    rockerAngularVelocityRadPerSec: cross(cv, dB) / (c * c) * omegaRadPerSec, margins: fourBarMargins(p) };
}

export function sampleFourBarPath(input: FourBarParams, count = 256): Point2[] {
  const p = validateFourBarParams(input);
  if (!Number.isInteger(count) || count < 16 || count > 4096) throw new Error('Four-bar sampling requires 16–4096 points.');
  const phi = p.rotationDeg * rad, co = Math.cos(phi), si = Math.sin(phi), points: Point2[] = [];
  for (let i = 0; i < count; i++) {
    const q = solveFourBarLocal(p.groundLengthMm, p.crankLengthMm, p.couplerLengthMm, p.rockerLengthMm, ...p.couplerPointLocalMm, p.branch, p.initialCrankAngleDeg * rad + i * 2 * Math.PI / count).P;
    points.push([p.originMm[0] + co * q[0] - si * q[1], p.originMm[1] + si * q[0] + co * q[1]]);
  }
  points.push([...points[0]]); return points;
}
