/** Native, editable four-bar crank-rocker. All motion comes from four actual
 * revolute joints; the coupler tracing point is on its connected solid tab. */
import type { Assembly, ExtrudeDirection, ExtrudeMode, Mate, Part, SketchPrimitive } from '../state/schemas';
import { fourBarReferenceAtAngle, validateFourBarParams, type FourBarParams, type Point2 } from './fourBarKinematics';

export const FOUR_BAR_IDS = Object.freeze({
  ground: 'four-bar-ground', crank: 'four-bar-crank', coupler: 'four-bar-coupler', rocker: 'four-bar-rocker',
  drive: 'four-bar-drive', crankPin: 'four-bar-crank-pin', rockerPin: 'four-bar-rocker-pin', outputBearing: 'four-bar-output-bearing',
});
export const FOUR_BAR_GEOMETRY = Object.freeze({
  bedThicknessMm: 6, inputPedestalHeightMm: 24, outputPedestalHeightMm: 36,
  crankOriginZMm: 30, rockerOriginZMm: 42, couplerOriginZMm: 51, traceZMm: 54,
  plateThicknessMm: 6, bearingBossRadiusMm: 7, pedestalRadiusMm: 9,
  spindleRadiusMm: 4, spindleBoreRadiusMm: 4.5, pinRadiusMm: 3, pinBoreRadiusMm: 3.5,
  tracerArmHalfWidthMm: 2, tracerBossRadiusMm: 2,
});

const circle = (radius: number, centre: Point2 = [0, 0]): SketchPrimitive => ({ type: 'circle', radius, centre });
const rectangle = (x: number, y: number, width: number, height: number): SketchPrimitive => ({ type: 'rectangle', corner: [x, y], width, height });
function part(id: string, name: string, materialId: string, positionMm: [number, number, number], angleDeg: number): Part {
  return { id, name, materialId, visible: true, transform: { positionMm, rotationDeg: [0, 0, angleDeg] }, sketches: [], features: [] };
}
function extrusion(target: Part, name: string, primitives: SketchPrimitive[], depthMm: number,
  mode: ExtrudeMode = 'add', direction: ExtrudeDirection = 'forward') {
  const n = target.features.length + 1, sketchId = `${target.id}-profile-${n}`;
  target.sketches.push({ id: sketchId, name, plane: 'XY', primitives });
  target.features.push({ id: `${target.id}-feature-${n}`, type: 'extrude', sketchId, depthMm, direction, extrudeMode: n === 1 ? 'new-body' : mode });
}
const pivot = (id: string, localPoint: [number, number, number]) => ({ kind: 'edge' as const, edgeId: `${id}-axis`, localPoint });

/** The four exact joint centres, each expressed in its own body's local frame. */
export function fourBarJointPivots(input: FourBarParams) {
  const p = validateFourBarParams(input), g = FOUR_BAR_GEOMETRY, ids = FOUR_BAR_IDS;
  return [
    { id: ids.drive, name: 'Powered input spindle', partA: ids.ground, partB: ids.crank,
      a: [0, 0, g.crankOriginZMm], b: [0, 0, 0] },
    { id: ids.crankPin, name: 'Input pin to coupler', partA: ids.crank, partB: ids.coupler,
      a: [p.crankLengthMm, 0, g.traceZMm - g.crankOriginZMm], b: [0, 0, g.traceZMm - g.couplerOriginZMm] },
    { id: ids.rockerPin, name: 'Coupler to output pin', partA: ids.coupler, partB: ids.rocker,
      a: [p.couplerLengthMm, 0, g.traceZMm - g.couplerOriginZMm], b: [p.rockerLengthMm, 0, g.traceZMm - g.rockerOriginZMm] },
    { id: ids.outputBearing, name: 'Passive output spindle', partA: ids.ground, partB: ids.rocker,
      a: [p.groundLengthMm, 0, g.rockerOriginZMm], b: [0, 0, 0] },
  ] as Array<{ id: string; name: string; partA: string; partB: string; a: [number, number, number]; b: [number, number, number] }>;
}

/** Factory-envelope checks supplement kinematic closure. The inequalities
 * apply continuously to this construction, not arbitrary edited CAD parts. */
export function fourBarAssemblyClearances(input: FourBarParams) {
  const p = validateFourBarParams(input), g = FOUR_BAR_GEOMETRY;
  const rMin = p.groundLengthMm - p.crankLengthMm, rMax = p.groundLengthMm + p.crankLengthMm;
  const cosAt = (r: number) => (p.couplerLengthMm ** 2 + p.rockerLengthMm ** 2 - r ** 2) / (2 * p.couplerLengthMm * p.rockerLengthMm);
  const maxAbsCos = Math.max(Math.abs(cosAt(rMin)), Math.abs(cosAt(rMax)));
  const minSin = Math.sqrt(Math.max(0, 1 - maxAbsCos ** 2));
  const result = {
    inputPinToRockerMm: p.couplerLengthMm * minSin - g.pinRadiusMm - g.bearingBossRadiusMm,
    crankToOutputPedestalMm: rMin - g.bearingBossRadiusMm - g.pedestalRadiusMm,
    crankToRockerSlabMm: (g.rockerOriginZMm - 3) - (g.crankOriginZMm + 3),
    rockerToCouplerSlabMm: g.couplerOriginZMm - (g.rockerOriginZMm + 3),
    couplerToGroundSupportMm: g.couplerOriginZMm - g.outputPedestalHeightMm,
    inputPlateToPedestalMm: g.crankOriginZMm - 3 - g.inputPedestalHeightMm,
    outputPlateToPedestalMm: g.rockerOriginZMm - 3 - g.outputPedestalHeightMm,
    spindleRadialMm: g.spindleBoreRadiusMm - g.spindleRadiusMm,
    pinRadialMm: g.pinBoreRadiusMm - g.pinRadiusMm,
    traceBossToPinBoreMm: Math.min(Math.hypot(...p.couplerPointLocalMm),
      Math.hypot(p.couplerPointLocalMm[0] - p.couplerLengthMm, p.couplerPointLocalMm[1])) - g.pinBoreRadiusMm - g.tracerBossRadiusMm,
  };
  if (!Object.values(result).every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Four-bar dimensions do not preserve the supported plate, bearing and tracing-tab clearances.');
  }
  return result;
}

export function buildFourBarAssembly(input: FourBarParams): Assembly {
  const p = validateFourBarParams(input); fourBarAssemblyClearances(p);
  const ids = FOUR_BAR_IDS, g = FOUR_BAR_GEOMETRY;
  const a = p.crankLengthMm, b = p.couplerLengthMm, c = p.rockerLengthMm, d = p.groundLengthMm;
  const theta = p.initialCrankAngleDeg * Math.PI / 180, state = fourBarReferenceAtAngle(p, theta);
  const angle = p.rotationDeg * Math.PI / 180, [ox, oy] = p.originMm;
  const ground = part(ids.ground, 'Steel bed and two bored bearing supports', 'steel-1018', [ox, oy, 0], p.rotationDeg);
  const crank = part(ids.crank, 'Brass input crank', 'brass-c36000', [ox, oy, g.crankOriginZMm], p.rotationDeg + p.initialCrankAngleDeg);
  const coupler = part(ids.coupler, 'Coupler with supported tracing tab', 'aluminium-6061', [...state.crankPinMm, g.couplerOriginZMm], state.couplerAngleRad * 180 / Math.PI);
  const rocker = part(ids.rocker, 'Passive output rocker', 'brass-c36000', [ox + d * Math.cos(angle), oy + d * Math.sin(angle), g.rockerOriginZMm], state.rockerAngleRad * 180 / Math.PI);

  const left = -a - 16, right = d + 16, side = a + 20;
  extrusion(ground, 'Continuous steel bed', [rectangle(left, -side, right - left, 2 * side)], g.bedThicknessMm);
  extrusion(ground, 'Input bearing pedestal', [circle(g.pedestalRadiusMm)], g.inputPedestalHeightMm);
  extrusion(ground, 'Input spindle bore · 0.5 mm radial clearance', [circle(g.spindleBoreRadiusMm)], g.inputPedestalHeightMm + 2, 'subtract');
  extrusion(ground, 'Output bearing pedestal', [circle(g.pedestalRadiusMm, [d, 0])], g.outputPedestalHeightMm);
  extrusion(ground, 'Output spindle bore · 0.5 mm radial clearance', [circle(g.spindleBoreRadiusMm, [d, 0])], g.outputPedestalHeightMm + 2, 'subtract');
  for (const x of [left + 8, right - 8]) for (const y of [-side + 8, side - 8]) {
    extrusion(ground, 'Bed mounting hole · Ø5 mm', [circle(2.5, [x, y])], 8, 'subtract');
  }

  for (const [target, length] of [[crank, a], [rocker, c]] as const) {
    extrusion(target, 'Spindle boss', [circle(g.bearingBossRadiusMm)], g.plateThicknessMm, 'add', 'symmetric');
    extrusion(target, 'Rigid link strap', [rectangle(0, -5, length, 10)], g.plateThicknessMm, 'add', 'symmetric');
    extrusion(target, 'Coupler pin boss', [circle(g.bearingBossRadiusMm, [length, 0])], g.plateThicknessMm, 'add', 'symmetric');
    const originZ = target === crank ? g.crankOriginZMm : g.rockerOriginZMm;
    extrusion(target, 'Main spindle · Ø8 mm', [circle(g.spindleRadiusMm)], originZ - 8, 'add', 'backward');
    extrusion(target, 'Coupler pin · Ø6 mm', [circle(g.pinRadiusMm, [length, 0])], 58 - originZ);
  }

  extrusion(coupler, 'Main coupling strap', [rectangle(0, -5, b, 10)], g.plateThicknessMm);
  for (const x of [0, b]) extrusion(coupler, 'Coupler bearing eye', [circle(g.bearingBossRadiusMm, [x, 0])], g.plateThicknessMm);
  const start: Point2 = [b / 2, 0], end = p.couplerPointLocalMm;
  const dx = end[0] - start[0], dy = end[1] - start[1], distance = Math.hypot(dx, dy);
  if (distance > 1e-8 && !(end[0] >= 2 && end[0] <= b - 2 && Math.abs(end[1]) <= 3)) {
    const nx = -dy / distance * g.tracerArmHalfWidthMm, ny = dx / distance * g.tracerArmHalfWidthMm;
    const corners: Point2[] = [[start[0] + nx, start[1] + ny], [end[0] + nx, end[1] + ny],
      [end[0] - nx, end[1] - ny], [start[0] - nx, start[1] - ny]];
    const profile: SketchPrimitive[] = corners.map((point, i) => ({ type: 'line', start: point, end: corners[(i + 1) % 4] }));
    extrusion(coupler, 'Connected tracing arm', profile, g.plateThicknessMm);
  }
  extrusion(coupler, 'Tracing point boss · on the coupler solid', [circle(g.tracerBossRadiusMm, [...end])], g.plateThicknessMm);
  // Last: neither the strap nor an overlapping tracing tab can fill a bore.
  for (const x of [0, b]) extrusion(coupler, 'Pin bore · 0.5 mm radial clearance', [circle(g.pinBoreRadiusMm, [x, 0])], 8, 'subtract');

  const mates: Mate[] = fourBarJointPivots(p).map(joint => ({ id: joint.id, name: joint.name, type: 'revolute',
    partA: joint.partA, partB: joint.partB, pivotA: pivot(joint.id, joint.a), pivotB: pivot(joint.id, joint.b), axisLocal: [0, 0, 1],
    ...(joint.id === ids.drive ? { motorSpeedRpm: p.rpm } : {}) }));
  return { id: 'four-bar-path-assembly', name: 'Path-designed four-bar mechanism', parts: [ground, crank, coupler, rocker], mates, booleanFeatures: [], groundPartId: ids.ground };
}
