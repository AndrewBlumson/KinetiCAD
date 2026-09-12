/** Editable, zero-offset crank-slider. Geometry is native per-part CAD; only
 * the crank has an ideal motor. The slider is never assigned an animated pose. */
import type { Assembly, ExtrudeDirection, ExtrudeMode, Mate, Part, SketchPlane, SketchPrimitive } from '../state/schemas';

export type CrankSliderParams = { radiusMm: number; rodLengthMm: number; rpm: number };
export const DEFAULT_CRANK_SLIDER_PARAMS: Readonly<CrankSliderParams> = Object.freeze({ radiusMm: 25, rodLengthMm: 100, rpm: 15 });
export const CRANK_SLIDER_DURATION_MS = 8000;
export const CRANK_SLIDER_TIME_STEP_MS = 1000 / 120;
export const CRANK_SLIDER_LIMITS = Object.freeze({ minRadiusMm: 15, maxRadiusMm: 40, minRodLengthMm: 75, maxRodLengthMm: 180, minRodRadiusRatio: 3, maxAbsRpm: 30 });
export const CRANK_SLIDER_IDS = Object.freeze({ ground: 'crank-slider-ground', crank: 'crank-slider-crank', rod: 'crank-slider-rod', slider: 'crank-slider-slider', drive: 'crank-slider-drive', crankPin: 'crank-slider-crank-pin', sliderPin: 'crank-slider-slider-pin', guide: 'crank-slider-guide' });

export function validateCrankSliderParams(value: unknown): CrankSliderParams {
  if (!value || typeof value !== 'object') throw new Error('Crank-slider parameters are missing.');
  const p = value as CrankSliderParams;
  for (const name of ['radiusMm', 'rodLengthMm', 'rpm'] as const) {
    if (typeof p[name] !== 'number' || !Number.isFinite(p[name])) throw new Error(`Crank-slider ${name} must be a finite number.`);
  }
  if (p.radiusMm < 15 || p.radiusMm > 40) throw new Error('Crank radius must be 15–40 mm.');
  if (p.rodLengthMm < 75 || p.rodLengthMm > 180 || p.rodLengthMm < 3 * p.radiusMm) throw new Error('Rod length must be 75–180 mm and at least three times the crank radius.');
  if (Math.abs(p.rpm) > 30) throw new Error('Crank speed must be between −30 and +30 RPM.');
  return { radiusMm: p.radiusMm, rodLengthMm: p.rodLengthMm, rpm: p.rpm };
}

/** Exact rigid-link geometry and chain-rule derivatives, world X in mm.
 * Pass measured omega/alpha for an instantaneous geometric comparison, or
 * omit them for the nominal constant-speed programme. */
export function crankSliderReferenceAtAngle(params: CrankSliderParams, thetaRad: number,
  omegaRadPerSec = params.rpm * Math.PI / 30, alphaRadPerSec2 = 0) {
  const { radiusMm: r, rodLengthMm: l } = validateCrankSliderParams(params);
  if (![thetaRad, omegaRadPerSec, alphaRadPerSec2].every(Number.isFinite)) throw new Error('Crank angle, speed and acceleration must be finite.');
  const s = Math.sin(thetaRad), c = Math.cos(thetaRad), q = Math.sqrt(l * l - r * r * s * s);
  const dXdTheta = -r * s - r * r * s * c / q;
  const d2XdTheta2 = -r * c - r * r * (c * c - s * s) / q - r ** 4 * s * s * c * c / q ** 3;
  return {
    thetaRad, omegaRadPerSec, alphaRadPerSec2,
    sliderPositionMm: r * c + q,
    sliderVelocityMmPerSec: dXdTheta * omegaRadPerSec,
    sliderAccelerationMmPerSec2: d2XdTheta2 * omegaRadPerSec ** 2 + dXdTheta * alphaRadPerSec2,
    rodAngleRad: Math.atan2(-r * s, q),
    crankPinPositionMm: [r * c, r * s, 42] as [number, number, number],
  };
}
export function crankSliderReference(params: CrankSliderParams, timeSeconds: number) {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) throw new Error('Crank-slider time must be finite and nonnegative.');
  const p = validateCrankSliderParams(params), omega = p.rpm * Math.PI / 30;
  return crankSliderReferenceAtAngle(p, omega * timeSeconds, omega);
}

const circle = (radius: number, centre: [number, number] = [0, 0]): SketchPrimitive => ({ type: 'circle', radius, centre });
const rectangle = (x: number, y: number, width: number, height: number): SketchPrimitive => ({ type: 'rectangle', corner: [x, y], width, height });
function part(id: string, name: string, materialId: string, positionMm: [number, number, number]): Part {
  return { id, name, materialId, visible: true, transform: { positionMm, rotationDeg: [0, 0, 0] }, sketches: [], features: [] };
}
function extrusion(target: Part, name: string, primitive: SketchPrimitive, depthMm: number,
  mode: ExtrudeMode = 'add', plane: SketchPlane = 'XY', direction: ExtrudeDirection = 'forward') {
  const n = target.features.length + 1, sketchId = `${target.id}-profile-${n}`;
  target.sketches.push({ id: sketchId, name, plane, primitives: [primitive] });
  target.features.push({ id: `${target.id}-feature-${n}`, type: 'extrude', sketchId, depthMm, direction, extrudeMode: n === 1 ? 'new-body' : mode });
}
const pivot = (id: string, localPoint: [number, number, number]) => ({ kind: 'edge' as const, edgeId: `${id}-axis`, localPoint });

export function buildCrankSliderAssembly(input: CrankSliderParams = DEFAULT_CRANK_SLIDER_PARAMS): Assembly {
  const p = validateCrankSliderParams(input), r = p.radiusMm, l = p.rodLengthMm, ids = CRANK_SLIDER_IDS;
  const ground = part(ids.ground, 'Base, bored spindle support and twin guide rails', 'steel-1018', [0, 0, 0]);
  const crank = part(ids.crank, `Brass crank · ${r} mm throw`, 'brass-c36000', [0, 0, 30]);
  const rod = part(ids.rod, `Connecting rod · ${l} mm between pins`, 'aluminium-6061', [r, 0, 39]);
  const slider = part(ids.slider, 'Guided slider and connecting pin', 'steel-1018', [r + l, 0, 20]);

  const xMin = -r - 16, xMax = l + r + 25, railStart = l - r - 16, railLength = 2 * r + 32;
  extrusion(ground, 'Continuous steel bed', rectangle(xMin, -r - 15, xMax - xMin, 2 * r + 30), 6);
  extrusion(ground, 'Spindle bearing pedestal', circle(9), 24);
  extrusion(ground, 'Spindle bore · 0.5 mm radial clearance', circle(4.5), 26, 'subtract');
  for (const y of [-14, 10]) extrusion(ground, 'Raised linear guide rail', rectangle(railStart, y, railLength, 4), 28);
  for (const x of [xMin + 8, xMax - 8]) for (const y of [-r - 7, r + 7]) extrusion(ground, 'Bed mounting hole · Ø5 mm', circle(2.5, [x, y]), 8, 'subtract');

  extrusion(crank, 'Crank centre boss', circle(8), 6, 'add', 'XY', 'symmetric');
  extrusion(crank, 'Radial crank arm', rectangle(0, -6, r, 12), 6, 'add', 'XY', 'symmetric');
  extrusion(crank, 'Outer crank boss', circle(7, [r, 0]), 6, 'add', 'XY', 'symmetric');
  extrusion(crank, 'Main spindle · Ø8 mm', circle(4), 22, 'add', 'XY', 'backward');
  extrusion(crank, 'Connecting pin · Ø6 mm', circle(3, [r, 0]), 17);

  extrusion(rod, 'Connecting strap', rectangle(0, -5, l, 10), 6);
  extrusion(rod, 'Crank-end bearing eye', circle(7), 6);
  extrusion(rod, 'Slider-end bearing eye', circle(7, [l, 0]), 6);
  for (const x of [0, l]) extrusion(rod, 'Pin bore · 0.5 mm radial clearance', circle(3.5, [x, 0]), 8, 'subtract');

  extrusion(slider, 'Slider block stock', rectangle(-10, 0, 20, 16), 36, 'add', 'XZ', 'symmetric');
  extrusion(slider, 'Connecting pin · Ø6 mm', circle(3), 27);
  for (const y of [-14.5, 9.5]) extrusion(slider, 'Open guide groove · 0.5 mm side and roof clearance', rectangle(y, -1, 5, 9.5), 24, 'subtract', 'YZ', 'symmetric');

  const mates: Mate[] = [
    { id: ids.drive, name: 'Powered crank spindle', type: 'revolute', partA: ground.id, partB: crank.id,
      pivotA: pivot(ids.drive, [0, 0, 30]), pivotB: pivot(ids.drive, [0, 0, 0]), axisLocal: [0, 0, 1], motorSpeedRpm: p.rpm },
    { id: ids.crankPin, name: 'Crank to connecting rod', type: 'revolute', partA: crank.id, partB: rod.id,
      pivotA: pivot(ids.crankPin, [r, 0, 12]), pivotB: pivot(ids.crankPin, [0, 0, 3]), axisLocal: [0, 0, 1] },
    { id: ids.sliderPin, name: 'Connecting rod to slider', type: 'revolute', partA: rod.id, partB: slider.id,
      pivotA: pivot(ids.sliderPin, [l, 0, 3]), pivotB: pivot(ids.sliderPin, [0, 0, 22]), axisLocal: [0, 0, 1] },
    { id: ids.guide, name: 'Passive straight guide', type: 'prismatic', partA: ground.id, partB: slider.id,
      pivotA: pivot(ids.guide, [0, 0, 20]), pivotB: pivot(ids.guide, [0, 0, 0]), axisLocal: [1, 0, 0] },
  ];
  return { id: 'crank-slider-assembly', name: 'Adjustable crank-slider', parts: [ground, crank, rod, slider], mates, booleanFeatures: [], groundPartId: ground.id };
}
