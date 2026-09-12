// Independent oracle: the cosine-law triangle in the line-of-centres frame.
export function independentFourBar(p, theta) {
  const d = p.groundLengthMm, a = p.crankLengthMm, b = p.couplerLengthMm, c = p.rockerLengthMm;
  const A = [a * Math.cos(theta), a * Math.sin(theta)];
  const dx = d - A[0], dy = -A[1], r = Math.hypot(dx, dy);
  const beta = Math.atan2(dy, dx) + p.branch * Math.acos((b * b + r * r - c * c) / (2 * b * r));
  const B = [A[0] + b * Math.cos(beta), A[1] + b * Math.sin(beta)];
  const gamma = Math.atan2(B[1], B[0] - d), [u, v] = p.couplerPointLocalMm;
  const P = [A[0] + u * Math.cos(beta) - v * Math.sin(beta), A[1] + u * Math.sin(beta) + v * Math.cos(beta)];
  const phi = p.rotationDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const world = ([x, y]) => [p.originMm[0] + cp * x - sp * y, p.originMm[1] + sp * x + cp * y];
  return { A: world(A), B: world(B), P: [...world(P), 54],
    positions: [[...p.originMm, 0], [...p.originMm, 30], [...world(A), 51], [...world([d, 0]), 42]],
    angles: [phi, phi + theta, phi + beta, phi + gamma] };
}
export const independentFourBarParams = {
  groundLengthMm: 100, crankLengthMm: 25, couplerLengthMm: 90, rockerLengthMm: 70,
  couplerPointLocalMm: [45, 20], branch: 1, originMm: [0, 0], rotationDeg: 0, initialCrankAngleDeg: 0, rpm: 10,
};
export function independentFourBarPoses(p, theta) {
  const state = independentFourBar(p, theta);
  return ['four-bar-ground', 'four-bar-crank', 'four-bar-coupler', 'four-bar-rocker'].map((partId, i) => ({
    partId, positionMm: state.positions[i], rotationQuat: [0, 0, Math.sin(state.angles[i] / 2), Math.cos(state.angles[i] / 2)],
  }));
}
