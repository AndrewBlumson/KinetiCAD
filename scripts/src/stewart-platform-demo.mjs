/**
 * Parametric Stewart platform: six telescopic legs close the base/deck loop.
 * Geometry is authored as editable extrudes and revolved turning profiles.
 * The initial programme is a six-second symmetric lift, not a six-axis controller.
 * Units: millimetres, degrees, seconds; actuator speeds are mm/s.
 */
import assert from 'node:assert/strict';

export const STEWART_DEFAULTS = Object.freeze({
  baseRadiusMm: 130,
  baseInnerRadiusMm: 72,
  baseThicknessMm: 12,
  baseAnchorRadiusMm: 110,
  baseAnchorAnglesDeg: Object.freeze([15, 105, 135, 225, 255, 345]),
  platformRadiusMm: 94,
  platformInnerRadiusMm: 42,
  platformThicknessMm: 10,
  platformAnchorRadiusMm: 75,
  platformAnchorAnglesDeg: Object.freeze([45, 75, 165, 195, 285, 315]),
  platformHeightMm: 160,
  ballRadiusMm: 6,
  bearingSeatRadiusMm: 6.6,
  barrelRadiusMm: 8,
  collarRadiusMm: 9,
  barrelLengthMm: 96,
  boreRadiusMm: 4.5,
  rodRadiusMm: 4,
  initialRodInsertionMm: 32,
  maximumStrokeMm: 20,
  motorVelocityMmPerSec: 2,
  durationMs: 6000,
});

const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (angle) => angle * 180 / Math.PI;
const circle = (radius, centre = [0, 0]) => ({ type: 'circle', radius, centre });
const line = (start, end) => ({ type: 'line', start, end });

function parameters(overrides = {}) {
  const p = { ...STEWART_DEFAULTS, ...overrides };
  for (const [key, value] of Object.entries(p)) {
    if (Array.isArray(value)) {
      assert.equal(value.length, 6, `${key} requires six anchor angles`);
      assert(value.every(Number.isFinite), `${key} must be finite`);
    } else assert(Number.isFinite(value) && value > 0, `${key} must be positive and finite`);
  }
  assert(p.bearingSeatRadiusMm > p.ballRadiusMm);
  assert(p.ballRadiusMm > p.rodRadiusMm);
  assert(p.boreRadiusMm > p.rodRadiusMm && p.barrelRadiusMm > p.boreRadiusMm);
  assert(p.collarRadiusMm >= p.barrelRadiusMm);
  assert(p.platformHeightMm > p.baseThicknessMm + p.barrelLengthMm);
  assert(p.motorVelocityMmPerSec * p.durationMs / 1000 <= p.maximumStrokeMm, 'Motion exceeds the designed stroke');
  assert(p.initialRodInsertionMm - p.maximumStrokeMm >= 10, 'At least 10 mm of rod must remain inside the barrel');
  assert(p.barrelLengthMm - p.initialRodInsertionMm > 18, 'Rod must clear the closed barrel bottom');
  return p;
}

/** Exact initial anchors, oblique leg frames and equal-length lift reference. */
export function stewartLegGeometry(overrides = {}) {
  const p = parameters(overrides);
  return p.baseAnchorAnglesDeg.map((angle, i) => {
    const baseAngle = radians(angle);
    const deckAngle = radians(p.platformAnchorAnglesDeg[i]);
    const baseAnchor = [p.baseAnchorRadiusMm * Math.cos(baseAngle), p.baseAnchorRadiusMm * Math.sin(baseAngle), p.baseThicknessMm];
    const platformAnchorLocal = [p.platformAnchorRadiusMm * Math.cos(deckAngle), p.platformAnchorRadiusMm * Math.sin(deckAngle), 0];
    const platformAnchor = [platformAnchorLocal[0], platformAnchorLocal[1], p.platformHeightMm];
    const delta = platformAnchor.map((value, j) => value - baseAnchor[j]);
    const lengthMm = Math.hypot(...delta);
    const direction = delta.map((value) => value / lengthMm);
    // Intrinsic XYZ: Rx(a) Ry(b) Rz(0) transforms local Z to direction.
    const rotationDeg = [degrees(Math.atan2(-direction[1], direction[2])), degrees(Math.asin(direction[0])), 0];
    return { baseAnchor, platformAnchorLocal, platformAnchor, lengthMm, direction, rotationDeg };
  });
}

export function stewartHeaveReference(timeSeconds, overrides = {}) {
  const p = parameters(overrides);
  assert(Number.isFinite(timeSeconds) && timeSeconds >= 0 && timeSeconds <= p.durationMs / 1000);
  const legs = stewartLegGeometry(p);
  const initialLengthMm = legs[0].lengthMm;
  assert(legs.every((leg) => Math.abs(leg.lengthMm - initialLengthMm) < 1e-8), 'Pure-heave reference requires equal initial leg lengths');
  const height = p.platformHeightMm - p.baseThicknessMm;
  const horizontalSquared = initialLengthMm ** 2 - height ** 2;
  const extensionMm = p.motorVelocityMmPerSec * timeSeconds;
  return {
    extensionMm,
    legLengthMm: initialLengthMm + extensionMm,
    platformPositionMm: [0, 0, p.baseThicknessMm + Math.sqrt((initialLengthMm + extensionMm) ** 2 - horizontalSquared)],
    platformRotationDeg: [0, 0, 0],
    remainingRodInsertionMm: p.initialRodInsertionMm - extensionMm,
  };
}

function part(id, name, materialId, positionMm = [0, 0, 0], rotationDeg = [0, 0, 0]) {
  return { id, name, visible: true, materialId, transform: { positionMm: [...positionMm], rotationDeg: [...rotationDeg] }, sketches: [], features: [] };
}

function extrude(target, name, primitive, depthMm, mode = 'subtract') {
  const n = target.features.length + 1;
  const sketchId = `sk-${target.id}-${n}`;
  target.sketches.push({ id: sketchId, name, plane: 'XY', primitives: [primitive] });
  target.features.push({ id: `feat-${target.id}-${n}`, type: 'extrude', sketchId, depthMm,
    direction: 'forward', extrudeMode: n === 1 ? 'new-body' : mode });
}

function revolve(target, name, primitives) {
  const sketchId = `sk-${target.id}-turning`;
  target.sketches.push({ id: sketchId, name, plane: 'XZ', primitives });
  target.features.push({ id: `feat-${target.id}-turning`, type: 'revolve', sketchId, axis: 'Z', angleDeg: 360 });
}

function plate(target, radius, innerRadius, thickness, anchors, fixingRadius, p) {
  extrude(target, 'Machined annular plate stock', circle(radius), thickness);
  extrude(target, 'Central access aperture', circle(innerRadius), thickness + 2);
  anchors.forEach((anchor, i) => {
    extrude(target, `Spherical-end seat ${i + 1} · ${Number((p.bearingSeatRadiusMm - p.ballRadiusMm).toFixed(4))} mm radial clearance`,
      circle(p.bearingSeatRadiusMm, anchor.slice(0, 2)), thickness + 2);
    const angle = Math.atan2(anchor[1], anchor[0]);
    extrude(target, `Mounting hole ${i + 1} · Ø4.4 mm`,
      circle(2.2, [fixingRadius * Math.cos(angle), fixingRadius * Math.sin(angle)]), thickness + 2);
  });
}

function barrelProfile(p) {
  const neckTop = Math.sqrt(p.ballRadiusMm ** 2 - p.rodRadiusMm ** 2);
  const arc = { type: 'arc', centre: [0, 0], radius: p.ballRadiusMm,
    startAngle: -Math.PI / 2, endAngle: Math.acos(p.rodRadiusMm / p.ballRadiusMm) };
  const points = [
    [p.rodRadiusMm, neckTop], [p.rodRadiusMm, 10],
    [p.barrelRadiusMm, 10], [p.barrelRadiusMm, p.barrelLengthMm - 6],
    [p.collarRadiusMm, p.barrelLengthMm - 6], [p.collarRadiusMm, p.barrelLengthMm],
    [p.boreRadiusMm, p.barrelLengthMm], [p.boreRadiusMm, 16],
    [0, 16], [0, -p.ballRadiusMm],
  ];
  return [arc, ...points.slice(1).map((point, i) => line(points[i], point))];
}

function rodProfile(lengthMm, p) {
  const start = p.barrelLengthMm - p.initialRodInsertionMm;
  const sphereJoin = lengthMm - Math.sqrt(p.ballRadiusMm ** 2 - p.rodRadiusMm ** 2);
  assert(sphereJoin > p.barrelLengthMm + p.ballRadiusMm, 'Rod must extend visibly beyond its sleeve');
  return [
    line([0, start], [p.rodRadiusMm, start]),
    line([p.rodRadiusMm, start], [p.rodRadiusMm, sphereJoin]),
    { type: 'arc', centre: [0, lengthMm], radius: p.ballRadiusMm,
      startAngle: -Math.acos(p.rodRadiusMm / p.ballRadiusMm), endAngle: Math.PI / 2 },
    line([0, lengthMm + p.ballRadiusMm], [0, start]),
  ];
}

const pivot = (id, localPoint) => ({ kind: 'edge', edgeId: id, localPoint: [...localPoint] });
function spherical(id, name, a, b, anchorA, anchorB) {
  return { id, name, type: 'spherical', partA: a.id, partB: b.id,
    pivotA: pivot(`${id}-a`, anchorA), pivotB: pivot(`${id}-b`, anchorB) };
}

export function buildStewartPlatformDemo(overrides = {}) {
  const p = parameters(overrides);
  const legs = stewartLegGeometry(p);
  // This bundled motion programme deliberately keeps all six leg lengths equal.
  stewartHeaveReference(p.durationMs / 1000, p);
  const base = part('stewart-base', 'Steel base · six spherical bearing seats', 'steel-1018');
  const deck = part('stewart-platform', 'Moving aluminium payload deck', 'aluminium-6061', [0, 0, p.platformHeightMm]);
  plate(base, p.baseRadiusMm, p.baseInnerRadiusMm, p.baseThicknessMm, legs.map((leg) => leg.baseAnchor), p.baseRadiusMm - 6, p);
  plate(deck, p.platformRadiusMm, p.platformInnerRadiusMm, p.platformThicknessMm, legs.map((leg) => leg.platformAnchorLocal), p.platformRadiusMm - 7, p);
  const parts = [base, deck];
  const mates = [];
  legs.forEach((leg, i) => {
    const n = i + 1;
    const barrel = part(`stewart-barrel-${n}`, `Actuator ${n} · bored barrel and lower ball`, i % 2 === 0 ? 'brass-c36000' : 'aluminium-6061', leg.baseAnchor, leg.rotationDeg);
    const rod = part(`stewart-rod-${n}`, `Actuator ${n} · steel piston rod and upper ball`, 'steel-1018', leg.baseAnchor, leg.rotationDeg);
    revolve(barrel, 'Turned hollow barrel, guide collar and spherical lower end', barrelProfile(p));
    revolve(rod, 'Piston rod and integral spherical upper end', rodProfile(leg.lengthMm, p));
    parts.push(barrel, rod);
    mates.push(spherical(`stewart-base-ball-${n}`, `Leg ${n} · base spherical bearing`, base, barrel, leg.baseAnchor, [0, 0, 0]));
    mates.push({ id: `stewart-slider-${n}`, name: `Leg ${n} · +${p.motorVelocityMmPerSec} mm/s extension`, type: 'prismatic',
      partA: barrel.id, partB: rod.id, pivotA: pivot(`stewart-slider-${n}-a`, [0, 0, p.barrelLengthMm]),
      pivotB: pivot(`stewart-slider-${n}-b`, [0, 0, p.barrelLengthMm]), axisLocal: [0, 0, 1],
      motorVelocityMmPerSec: p.motorVelocityMmPerSec });
    mates.push(spherical(`stewart-deck-ball-${n}`, `Leg ${n} · deck spherical bearing`, rod, deck, [0, 0, leg.lengthMm], leg.platformAnchorLocal));
  });
  return { version: 9, state: { mode: 'modeller',
    assembly: { id: 'asm-stewart-platform', name: 'Stewart platform · six-actuator parallel mechanism',
      groundPartId: base.id, booleanFeatures: [], parts, mates },
    simulation: { running: false, paused: false, simulationTimeMs: 0,
      timeStepMs: 1000 / 60, gravity: [0, 0, 0], speedMultiplier: 1, durationMs: p.durationMs },
  } };
}

export default buildStewartPlatformDemo;
