// Independent fixture-frame, inverse-kinematic and conservative clearance checks.
// These do not replace real OCCT solid validation or Rapier motion measurements.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStewartPlatformDemo, STEWART_DEFAULTS, stewartHeaveReference } from '../../../scripts/src/stewart-platform-demo.mjs';
import { parseDemoDocument } from '../src/demos/demoDocument.ts';

const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const scale = (a, value) => a.map((x) => x * value);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(...a);
const near = (a, b, tolerance = 1e-9) => assert.ok(norm(sub(a, b)) < tolerance, `${a} differs from ${b}`);

// Independent scalar Rx Ry Rz composition matches the application's XYZ contract.
function rotate(point, rotationDeg) {
  const [a, b, c] = rotationDeg.map((value) => value * Math.PI / 180);
  const [x, y, z] = point;
  const x1 = Math.cos(c) * x - Math.sin(c) * y;
  const y1 = Math.sin(c) * x + Math.cos(c) * y;
  const x2 = Math.cos(b) * x1 + Math.sin(b) * z;
  const z2 = -Math.sin(b) * x1 + Math.cos(b) * z;
  return [x2, Math.cos(a) * y1 - Math.sin(a) * z2, Math.sin(a) * y1 + Math.cos(a) * z2];
}
const world = (part, point) => add(part.transform.positionMm, rotate(point, part.transform.rotationDeg));

function fixtureLegs(document) {
  const { parts, mates } = document.state.assembly;
  const byId = new Map(parts.map((part) => [part.id, part]));
  return Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    const baseMate = mates.find((mate) => mate.id === `stewart-base-ball-${n}`);
    const deckMate = mates.find((mate) => mate.id === `stewart-deck-ball-${n}`);
    return {
      base: world(byId.get(baseMate.partA), baseMate.pivotA.localPoint),
      deckLocal: deckMate.pivotB.localPoint,
      deck: world(byId.get(deckMate.partB), deckMate.pivotB.localPoint),
    };
  });
}

test('the editable v9 fixture forms one connected 14-body, 18-joint mechanism', () => {
  const d = buildStewartPlatformDemo();
  parseDemoDocument(d);
  const { parts, mates, groundPartId } = d.state.assembly;
  assert.equal(parts.length, 14);
  assert.equal(mates.length, 18);
  assert.equal(new Set(parts.map((part) => part.id)).size, 14);
  assert.equal(new Set(mates.map((mate) => mate.id)).size, 18);
  assert.equal(mates.filter((mate) => mate.type === 'spherical').length, 12);
  assert.equal(mates.filter((mate) => mate.type === 'prismatic').length, 6);
  assert.equal(d.state.simulation.durationMs, 6000);
  const visited = new Set([groundPartId]);
  for (let i = 0; i < parts.length; i++) for (const mate of mates) {
    if (visited.has(mate.partA)) visited.add(mate.partB);
    if (visited.has(mate.partB)) visited.add(mate.partA);
  }
  assert.equal(visited.size, parts.length);
  assert.equal(mates.length - parts.length + 1, 5, 'six parallel leg paths create five independent graph loops');
  for (const p of parts) {
    assert(p.features.every((feature) => ['extrude', 'revolve'].includes(feature.type)));
    assert(p.features.every((feature) => p.sketches.some((sketch) => sketch.id === feature.sketchId)));
  }
});

test('every encoded joint closes in world space and each actuator uses compatible oblique frames', () => {
  const d = buildStewartPlatformDemo();
  const byId = new Map(d.state.assembly.parts.map((part) => [part.id, part]));
  for (const mate of d.state.assembly.mates) {
    const a = byId.get(mate.partA);
    const b = byId.get(mate.partB);
    near(world(a, mate.pivotA.localPoint), world(b, mate.pivotB.localPoint));
    if (mate.type === 'prismatic') {
      assert.deepEqual(a.transform.rotationDeg, b.transform.rotationDeg);
      assert(norm(a.transform.rotationDeg) > 10, 'the test must cover oblique, non-identity frames');
      const axis = rotate(mate.axisLocal, a.transform.rotationDeg);
      near(axis, rotate(mate.axisLocal, b.transform.rotationDeg));
      const top = d.state.assembly.mates.find((item) => item.type === 'spherical' && item.partA === b.id);
      const direction = sub(world(b, top.pivotA.localPoint), a.transform.positionMm);
      near(axis, scale(direction, 1 / norm(direction)));
      assert.equal(mate.motorVelocityMmPerSec, 2);
    }
  }
});

function solve(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  let minimumPivot = Infinity;
  for (let col = 0; col < a.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < a.length; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    minimumPivot = Math.min(minimumPivot, Math.abs(a[col][col]));
    assert(Math.abs(a[col][col]) > 1e-8, 'leg-length Jacobian is singular');
    const divisor = a[col][col];
    for (let j = col; j <= a.length; j++) a[col][j] /= divisor;
    for (let row = 0; row < a.length; row++) if (row !== col) {
      const factor = a[row][col];
      for (let j = col; j <= a.length; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return { solution: a.map((row) => row.at(-1)), minimumPivot };
}

test('the six-axis length Jacobian stays nonsingular and equal actuator rates produce pure heave', () => {
  const legs = fixtureLegs(buildStewartPlatformDemo());
  const radius = STEWART_DEFAULTS.platformAnchorRadiusMm;
  for (let step = 0; step <= 24; step++) {
    const time = step / 4;
    const reference = stewartHeaveReference(time);
    const jacobian = legs.map((leg) => {
      const delta = sub(add(leg.deckLocal, reference.platformPositionMm), leg.base);
      const axis = scale(delta, 1 / norm(delta));
      return [...axis, ...scale(cross(leg.deckLocal, axis), 1 / radius)];
    });
    const { solution, minimumPivot } = solve(jacobian, Array(6).fill(2));
    assert(minimumPivot > 0.25, `poorly conditioned pivot ${minimumPivot}`);
    near([solution[0], solution[1], ...solution.slice(3)], [0, 0, 0, 0, 0], 1e-9);
    const legLength = norm(sub(add(legs[0].deckLocal, reference.platformPositionMm), legs[0].base));
    const vertical = reference.platformPositionMm[2] - legs[0].base[2];
    assert.ok(Math.abs(solution[2] - 2 * legLength / vertical) < 1e-10);
    for (const leg of legs) {
      const initial = norm(sub(leg.deck, leg.base));
      const current = norm(sub(add(leg.deckLocal, reference.platformPositionMm), leg.base));
      assert.ok(Math.abs(current - initial - 2 * time) < 1e-10);
    }
  }
  assert.ok(Math.abs(stewartHeaveReference(6).platformPositionMm[2] - 172.83662094518425) < 1e-10);
});

function segmentDistance(p, q, r, s) {
  const u = sub(q, p), v = sub(s, r), w = sub(p, r);
  const a = dot(u, u), e = dot(v, v), b = dot(u, v), c = dot(u, w), f = dot(v, w);
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const denominator = a * e - b * b;
  let t = denominator > 1e-10 ? clamp((b * f - c * e) / denominator) : 0;
  let k = (b * t + f) / e;
  if (k < 0) { k = 0; t = clamp(-c / a); }
  else if (k > 1) { k = 1; t = clamp((b - c) / a); }
  return norm(sub(add(p, scale(u, t)), add(r, scale(v, k))));
}

test('sampled lift retains rod overlap, radial bore clearance and conservative separation between legs', () => {
  const p = STEWART_DEFAULTS;
  const legs = fixtureLegs(buildStewartPlatformDemo());
  assert.equal(p.boreRadiusMm - p.rodRadiusMm, 0.5);
  for (let step = 0; step <= 60; step++) {
    const reference = stewartHeaveReference(step / 10);
    assert(reference.remainingRodInsertionMm >= 20 - 1e-9);
    assert(reference.extensionMm <= p.maximumStrokeMm);
    const segments = legs.map((leg) => [leg.base, add(leg.deckLocal, reference.platformPositionMm)]);
    for (let a = 0; a < segments.length; a++) for (let b = a + 1; b < segments.length; b++) {
      const distance = segmentDistance(...segments[a], ...segments[b]);
      // Radius9 capsules enclose sleeve, collar, shaft and end balls.
      assert(distance > 2 * p.collarRadiusMm, `actuator capsules overlap: legs ${a + 1},${b + 1}, d=${distance}`);
    }
    for (const [base, deck] of segments) {
      const axis = scale(sub(deck, base), 1 / norm(sub(deck, base)));
      const horizontal = Math.hypot(axis[0], axis[1]);
      const sphereNeck = Math.sqrt(p.ballRadiusMm ** 2 - p.rodRadiusMm ** 2);
      assert(sphereNeck * axis[2] - p.rodRadiusMm * horizontal > 0, 'neck should clear the adjacent plate face');
      assert(10 * axis[2] - p.barrelRadiusMm * horizontal > 0, 'barrel must start above the base plate');
      assert(p.bearingSeatRadiusMm > p.ballRadiusMm, 'the spherical ends must fit their plate clearance bores');
    }
  }
});

test('the builder rejects an unsafe programme or insufficient rod overlap', () => {
  assert.throws(() => buildStewartPlatformDemo({ durationMs: 11000 }), /exceeds the designed stroke/);
  assert.throws(() => buildStewartPlatformDemo({ initialRodInsertionMm: 25 }), /At least 10 mm/);
});
