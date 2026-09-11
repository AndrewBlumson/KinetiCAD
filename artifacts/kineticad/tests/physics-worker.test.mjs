// Run from artifacts/kineticad: node --test tests/physics-worker.test.mjs
// Actual shipped physicsWorker.ts + Comlink + Rapier WASM. Analytic descriptor
// geometry deliberately isolates mechanics from the separately tested OCCT and
// browser-rendering pipeline; these tests do not substitute for live CAD QA.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { Euler, Quaternion } from 'three';

let worker;
let physics;
let diagnostics = [];
const DT = 1000 / 240;
const fixture = (id) => JSON.parse(readFileSync(new URL(`../public/demos/${id}.json`, import.meta.url), 'utf8')).state;

before(async () => {
  worker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
  worker.on('message', (message) => {
    if (message.__log && message.args?.[0] === '[step-diag]') diagnostics.push(message.args[1]);
  });
  physics = Comlink.wrap(nodeEndpoint(worker));
  const initialized = await physics.init();
  assert.equal(initialized.version, '0.12.0');
});
after(async () => {
  if (physics) await physics.destroy();
  if (worker) await worker.terminate();
});

const add = (a, b) => a.map((v, i) => v + b[i]);
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const norm = (a) => Math.hypot(...a);
const quaternion = (degrees) => new Quaternion().setFromEuler(new Euler(...degrees.map((value) => value * Math.PI / 180), 'XYZ')).toArray();
const inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
function rotate(q, v) {
  const [x, y, z, w] = q;
  const t = [2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])];
  return add(add(v, scale(t, w)), [y * t[2] - z * t[1], z * t[0] - x * t[2], x * t[1] - y * t[0]]);
}
const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual}, expected ${expected} ± ${tolerance}`);
const nearVector = (actual, expected, tolerance, label) => close(norm(subtract(actual, expected)), 0, tolerance, label);

function box(id, { size = [10, 10, 10], position = [0, 0, 0], rotation = [0, 0, 0], centre = [0, 0, 0], mass = 1, fixed = false } = {}) {
  const [x, y, z] = size.map((v) => v / 2);
  const vertices = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  return {
    id, transform: { positionMm: position, rotationDeg: rotation },
    meshPositions: new Float32Array(vertices.flatMap((v) => add(v, centre))),
    meshIndices: new Uint32Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]),
    massKg: mass, comLocal: centre,
    principalInertiaKgMm2: [mass * (size[1] ** 2 + size[2] ** 2) / 12, mass * (size[0] ** 2 + size[2] ** 2) / 12, mass * (size[0] ** 2 + size[1] ** 2) / 12],
    principalInertiaLocalFrame: [0, 0, 0, 1], isGround: fixed,
  };
}
const pivot = (localPoint = [0, 0, 0]) => ({ kind: 'edge', edgeId: 'analytic-anchor', localPoint });
function revolute(id, partA, partB, axis = [0, 0, 1], rpm = null) {
  return { id, type: 'revolute', partA, partB, pivotA: pivot(), pivotB: pivot(), axisLocal: axis, motorSpeedRpm: rpm };
}
async function build(parts, mates = [], gravity = [0, 0, 0], timeStepMs = DT) {
  diagnostics = [];
  const result = await physics.buildWorld({ parts, mates, gravity, timeStepMs });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.bodyCount, parts.length);
  assert.equal(result.jointCount, mates.length);
  assert.deepEqual(result.warnings, []);
}
async function step(count, dt = DT) {
  let result;
  for (let i = 0; i < count; i++) result = await physics.step(dt);
  for (const pose of result.transforms) {
    assert.ok([...pose.positionMm, ...pose.rotationQuat].every(Number.isFinite));
    close(norm(pose.rotationQuat), 1, 2e-5, `normalised quaternion ${pose.partId}`);
  }
  return result;
}

test('windmill seed mate retains pi ±5e-7 rad/s after five seconds with an analytical rotor', async (t) => {
  const state = fixture('windmill');
  const parts = state.assembly.parts.map((part) => box(part.id, {
    position: part.transform.positionMm, rotation: part.transform.rotationDeg,
    size: part.id === state.assembly.groundPartId ? [12, 12, 100] : [48, 48, 16],
    fixed: part.id === state.assembly.groundPartId,
  }));
  await build(parts, state.assembly.mates, state.simulation.gravity, 1000 / 60);
  await step(600, 1000 / 60);
  const settled = diagnostics.filter((entry) => entry.stepCount >= 300);
  assert.ok(settled.length >= 5, 'existing production diagnostic bridge yielded settled samples');
  for (const entry of settled) {
    close(entry.bodyBangvelMag, Math.PI, 5e-7, '30 RPM magnitude');
    close(entry.bodyBangvel.z, Math.PI, 5e-7, '30 RPM Z axis');
    close(Math.hypot(entry.bodyBangvel.x, entry.bodyBangvel.y), 0, 1e-6, 'off-axis velocity');
    assert.equal(entry.bodyBSleeping, false);
  }
  t.diagnostic(`Maximum settled windmill error: ${Math.max(...settled.map((d) => Math.abs(d.bodyBangvelMag - Math.PI)))} rad/s`);
  assert.equal((await physics.updateJointMotor({ mateId: state.assembly.mates[0].id, motorSpeedRpm: -15 })).ok, true);
  diagnostics = [];
  await step(180, 1000 / 60);
  close(diagnostics.at(-1).bodyBangvel.z, -Math.PI / 2, 5e-7, 'live motor reversal');
  close(diagnostics.at(-1).targetAngularSpeedRadPerSec, -Math.PI / 2, 1e-12, 'diagnostic command follows live motor update');
});

test('free fall uses millimetres, seconds, kilograms and is independent of mass', async (t) => {
  await build([box('light', { position: [-20, 0, 10000], mass: 0.1 }), box('heavy', { position: [20, 0, 10000], mass: 10 })], [], [0, 0, -9810]);
  const result = await step(240);
  const expected = 10000 - 0.5 * 9810;
  for (const pose of result.transforms) close(pose.positionMm[2], expected, 12, 'one-second free fall; at most 0.25% integration error');
  close(result.transforms[0].positionMm[2], result.transforms[1].positionMm[2], 0.001, 'mass-independent acceleration');
  t.diagnostic(`One-second fall: ${10000 - result.transforms[0].positionMm[2]} mm; continuum reference 4905 mm`);
});

test('zero and blank live revolute commands release the motor so a rotor coasts', async () => {
  for (const off of [0, null]) {
    await build([box('base', { fixed: true }), box('rotor')], [revolute('motor', 'base', 'rotor', [0, 0, 1], 30)]);
    await step(240);
    close(diagnostics.at(-1).relativeAngularSpeedRadPerSec, Math.PI, 5e-7, 'powered rotor');
    assert.equal((await physics.updateJointMotor({ mateId: 'motor', motorSpeedRpm: off })).ok, true);
    await step(240);
    const released = diagnostics.at(-1);
    close(released.relativeAngularSpeedRadPerSec, Math.PI, 1e-5, 'unpowered rotor retains angular momentum within float32 integration error');
    assert.equal(released.motorEnabled, false);
    assert.equal(released.targetAngularSpeedRadPerSec, null);
    close(released.anchorSeparationMm, 0, 0.001, 'released rotor retains hinge anchors');
    assert.equal((await physics.updateJointMotor({ mateId: 'motor', motorSpeedRpm: -15 })).ok, true);
    await step(240);
    close(diagnostics.at(-1).relativeAngularSpeedRadPerSec, -Math.PI / 2, 5e-7, 'motor can be reenabled and reversed');
    assert.equal(diagnostics.at(-1).motorEnabled, true);
  }
});

test('zero and blank live prismatic commands release the slider to gravity', async () => {
  for (const off of [0, null]) {
    const mate = { ...revolute('slide', 'base', 'slider'), type: 'prismatic', motorVelocityMmPerSec: 100 };
    await build([box('base', { fixed: true }), box('slider')], [mate], [0, 0, -9810]);
    await step(240);
    const poweredVelocity = diagnostics.at(-1).relativeLinearSpeedMmPerSec;
    assert.equal((await physics.updateJointMotor({ mateId: 'slide', motorVelocityMmPerSec: off })).ok, true);
    await step(60);
    const first = diagnostics.at(-1);
    await step(60);
    const second = diagnostics.at(-1);
    close(second.relativeLinearSpeedMmPerSec - first.relativeLinearSpeedMmPerSec, -9810 / 4, 1, 'released slider has gravitational acceleration');
    assert.equal(second.motorEnabled, false);
    assert.equal(second.targetLinearSpeedMmPerSec, null);
    assert.equal((await physics.updateJointMotor({ mateId: 'slide', motorVelocityMmPerSec: 100 })).ok, true);
    await step(240);
    close(diagnostics.at(-1).relativeLinearSpeedMmPerSec, poweredVelocity, 0.001, 'slider drive resumes its previous response against gravity');
    assert.equal(diagnostics.at(-1).motorEnabled, true);
  }
});

test('unpowered pendulum follows the analytical physical-pendulum period', async (t) => {
  const length = 1000;
  const amplitude = 10 * Math.PI / 180;
  const rod = box('rod', { size: [20, 20, length], centre: [0, 0, -length / 2], rotation: [0, 10, 0] });
  await build([box('pivot', { fixed: true }), rod], [revolute('hinge', 'pivot', 'rod', [0, 1, 0])], [0, 0, -9810]);
  const crossings = [];
  let previous = amplitude;
  let maximumAnchorError = 0;
  for (let i = 1; i <= 960; i++) {
    const pose = (await physics.step(DT)).transforms.find((part) => part.partId === 'rod');
    const angle = 2 * Math.atan2(pose.rotationQuat[1], pose.rotationQuat[3]);
    if (previous > 0 && angle <= 0) crossings.push((i - 1 + previous / (previous - angle)) * DT / 1000);
    previous = angle;
    maximumAnchorError = Math.max(maximumAnchorError, norm(pose.positionMm));
  }
  assert.ok(crossings.length >= 3, 'pendulum oscillates freely without a motor');
  const inertiaAboutPivot = rod.principalInertiaKgMm2[1] + rod.massKg * (length / 2) ** 2;
  const expected = 2 * Math.PI * Math.sqrt(inertiaAboutPivot / (rod.massKg * 9810 * length / 2)) * (1 + amplitude ** 2 / 16);
  const observed = (crossings[2] - crossings[0]) / 2;
  close(observed, expected, expected * 0.02, 'physical-pendulum period');
  close(maximumAnchorError, 0, 0.5, 'hinge anchor drift in mm');
  t.diagnostic(`Pendulum period ${observed}s; analytical finite-amplitude reference ${expected}s; max anchor error ${maximumAnchorError}mm`);
});

test('revolute motor follows part A local axis when both bodies share a rotated frame', async () => {
  await build([box('base', { fixed: true, rotation: [0, 90, 0] }), box('rotor', { rotation: [0, 90, 0] })], [revolute('motor', 'base', 'rotor', [0, 0, 1], 30)]);
  await step(360);
  const omega = diagnostics.at(-1).bodyBangvel;
  nearVector([omega.x, omega.y, omega.z], [Math.PI, 0, 0], 2e-5, 'local Z becomes world X');
});

test('prismatic motor follows rotated local axis and preserves lateral position', async (t) => {
  const mate = { ...revolute('slide', 'base', 'slider'), type: 'prismatic', motorVelocityMmPerSec: 100 };
  await build([box('base', { fixed: true, rotation: [0, 90, 0] }), box('slider', { rotation: [0, 90, 0] })], [mate]);
  const first = (await step(240)).transforms.find((part) => part.partId === 'slider');
  const second = (await step(240)).transforms.find((part) => part.partId === 'slider');
  nearVector(subtract(second.positionMm, first.positionMm), [100, 0, 0], 0.05, '100 mm/s world-X motion');
  close(diagnostics.at(-1).relativeLinearSpeedMmPerSec, 100, 0.01, 'diagnostic reports slider velocity, not angular speed');
  t.diagnostic(`Slider travelled ${second.positionMm[0] - first.positionMm[0]}mm during its second second`);
});

test('fixed mate preserves an initially translated and rotated child', async () => {
  const position = [100, -50, 120];
  await build([box('base', { fixed: true, position: [20, 30, 40], rotation: [15, 25, 35] }), box('child', { position, rotation: [-25, 40, 65] })], [{ id: 'fixed', type: 'fixed', partA: 'base', partB: 'child' }], [0, 0, -9810]);
  const first = (await step(1)).transforms.find((part) => part.partId === 'child');
  const final = (await step(360)).transforms.find((part) => part.partId === 'child');
  nearVector(final.positionMm, position, 0.01, 'fixed relative position');
  close(Math.abs(dot(first.rotationQuat, final.rotationQuat)), 1, 1e-5, 'fixed relative orientation');
});

function differentlyOrientedPair() {
  const rotationA = [20, 35, 10];
  const rotationB = [-15, 60, 25];
  const positionA = [20, 15, 30];
  const positionB = [-30, 25, 50];
  const qA = quaternion(rotationA);
  const qB = quaternion(rotationB);
  const anchorWorld = [40, -20, 60];
  const anchorA = rotate(inverse(qA), subtract(anchorWorld, positionA));
  const anchorB = rotate(inverse(qB), subtract(anchorWorld, positionB));
  const axisWorld = rotate(qA, [0, 0, 1]);
  const parts = [
    box('base', { fixed: true, position: positionA, rotation: rotationA }),
    box('moving', { position: positionB, rotation: rotationB, centre: anchorB }),
  ];
  const mate = { ...revolute('different-frames', 'base', 'moving', [0, 0, 1], 30), pivotA: pivot(anchorA), pivotB: pivot(anchorB) };
  return { parts, mate, qB, anchorB, anchorWorld, axisWorld };
}

test('unsupported mismatched joint frames stop the whole world instead of snapping parts', async () => {
  const { parts, mate } = differentlyOrientedPair();
  for (const joint of [mate, { ...mate, type: 'prismatic', motorVelocityMmPerSec: 100 }]) {
    const result = await physics.buildWorld({ parts, mates: [joint], gravity: [0, 0, 0], timeStepMs: DT });
    assert.equal(result.ok, false);
    assert.match(result.error, /joint-frame-unsupported/);
    assert.deepEqual((await physics.step()).transforms, []);
  }
});

test('revolute allows initial twist about its shared axis; prismatic rejects that twist', async () => {
  const parts = [box('base', { fixed: true }), box('moving', { rotation: [0, 0, 45] })];
  const mate = revolute('twisted-axis', 'base', 'moving', [0, 0, 1], 30);
  await build(parts, [mate]);
  await step(360);
  close(diagnostics.at(-1).relativeAngularSpeedRadPerSec, Math.PI, 5e-7, 'supported revolute twist');
  const result = await physics.buildWorld({ parts, mates: [{ ...mate, type: 'prismatic', motorVelocityMmPerSec: 100 }], gravity: [0, 0, 0], timeStepMs: DT });
  assert.equal(result.ok, false);
  assert.match(result.error, /joint-frame-unsupported/);
  assert.deepEqual((await physics.step()).transforms, []);
});

test('unsupported planar constraints stop simulation rather than being omitted', async () => {
  const result = await physics.buildWorld({ parts: [box('a', { fixed: true }), box('b')], mates: [{ id: 'plane', type: 'planar', partA: 'a', partB: 'b' }], gravity: [0, 0, 0], timeStepMs: DT });
  assert.equal(result.ok, false);
  assert.match(result.error, /planar mates are not supported/);
  assert.deepEqual((await physics.step()).transforms, []);
});

test('a mate referencing a hidden or missing body rejects the whole incomplete assembly', async () => {
  await build([box('old-body')]);
  const result = await physics.buildWorld({
    parts: [box('visible-base', { fixed: true })],
    mates: [revolute('missing-link', 'visible-base', 'hidden-rotor', [0, 0, 1], 30)],
    gravity: [0, 0, 0], timeStepMs: DT,
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /missing part geometry.*hidden-rotor/);
  assert.deepEqual((await physics.step()).transforms, []);
});

test('new gimbal seed drives each relative joint speed, not each child world-speed magnitude', async (t) => {
  const state = fixture('gyroscope');
  const { parts: sourceParts, mates, groundPartId } = state.assembly;
  await build(sourceParts.map((part) => box(part.id, { position: part.transform.positionMm, rotation: part.transform.rotationDeg, fixed: part.id === groundPartId })), mates, state.simulation.gravity);
  let maximumError = 0;
  let maximumTransverse = 0;
  let maximumAnchorError = 0;
  for (let sample = 0; sample < 12; sample++) {
    const result = await step(60);
    if (sample < 4) continue;
    const poses = new Map(result.transforms.map((pose) => [pose.partId, pose]));
    const omegaByPart = new Map([[groundPartId, [0, 0, 0]]]);
    for (const entry of diagnostics.slice(-mates.length)) {
      const mate = mates.find((candidate) => candidate.id === entry.mateId);
      omegaByPart.set(mate.partB, [entry.bodyBangvel.x, entry.bodyBangvel.y, entry.bodyBangvel.z]);
    }
    for (const mate of mates) {
      const a = poses.get(mate.partA);
      const b = poses.get(mate.partB);
      const axis = rotate(a.rotationQuat, mate.axisLocal);
      const relative = subtract(omegaByPart.get(mate.partB), omegaByPart.get(mate.partA));
      const speed = dot(relative, axis);
      const target = mate.motorSpeedRpm * 2 * Math.PI / 60;
      const entry = diagnostics.slice(-mates.length).find((candidate) => candidate.mateId === mate.id);
      close(entry.relativeAngularSpeedRadPerSec, speed, 1e-6, 'production relative-speed diagnostic matches independent reconstruction');
      close(entry.targetAngularSpeedRadPerSec, target, 1e-12, 'production diagnostic target');
      maximumError = Math.max(maximumError, Math.abs(speed - target));
      maximumTransverse = Math.max(maximumTransverse, norm(subtract(relative, scale(axis, speed))));
      const anchorA = add(a.positionMm, rotate(a.rotationQuat, mate.pivotA.localPoint));
      const anchorB = add(b.positionMm, rotate(b.rotationQuat, mate.pivotB.localPoint));
      maximumAnchorError = Math.max(maximumAnchorError, norm(subtract(anchorA, anchorB)));
    }
  }
  close(maximumError, 0, 0.02, 'maximum relative motor-speed error in rad/s');
  close(maximumTransverse, 0, 0.03, 'maximum forbidden relative angular velocity in rad/s');
  close(maximumAnchorError, 0, 0.1, 'maximum nested anchor error in mm');
  t.diagnostic(`Nested gimbal: max relative speed error ${maximumError}rad/s; transverse ${maximumTransverse}rad/s; anchor ${maximumAnchorError}mm`);
});

test('fixed solver stepping gives identical motion at 30 Hz, 144 Hz and irregular render rates', async (t) => {
  const parts = [box('fixed', { fixed: true }), box('rotor'), box('falling', { position: [100, 0, 10000] })];
  const mates = [revolute('motor', 'fixed', 'rotor', [0, 0, 1], 30)];
  const schedules = [Array(30).fill(1000 / 30), Array(144).fill(1000 / 144), Array.from({ length: 20 }, () => [3, 27, 11, 9]).flat()];
  const runs = [];
  for (const schedule of schedules) {
    await build(parts, mates, [0, 0, -9810], 10);
    let advanced = 0;
    let final;
    for (const elapsed of schedule) { final = await physics.step(elapsed); advanced += final.dtMs; }
    close(advanced, 1000, 1e-9, 'actual solver time');
    runs.push(final.transforms);
  }
  assert.deepEqual(runs[1], runs[0]);
  assert.deepEqual(runs[2], runs[0]);
  t.diagnostic('30 Hz, 144 Hz and irregular schedules produced bit-identical body transforms after 100 fixed solver steps.');
});

test('fractional requests accumulate; zero pauses and undefined advances one configured step', async () => {
  const parts = [box('falling', { position: [0, 0, 1000] })];
  await build(parts, [], [0, 0, -9810], 10);
  const initial = await physics.step(0);
  const fraction = await physics.step(4);
  assert.equal(fraction.dtMs, 0);
  assert.deepEqual(fraction.transforms, initial.transforms);
  assert.equal((await physics.step(6)).dtMs, 10);
  assert.equal((await physics.step()).dtMs, 10);
  const paused = await physics.step(0);
  assert.equal(paused.dtMs, 0);
  assert.deepEqual((await physics.step(0)).transforms, paused.transforms);
  await assert.rejects(physics.step(-1), /finite and non-negative/);
  await assert.rejects(physics.step(NaN), /finite and non-negative/);
  await physics.step(7);
  await build(parts, [], [0, 0, -9810], 10);
  assert.equal((await physics.step(3)).dtMs, 0, 'new world clears the old fractional remainder');
});

test('bounded catch-up retains time instead of dropping it and zero never drains backlog', async () => {
  await build([box('falling', { position: [0, 0, 100000] })], [], [0, 0, -9810], 10);
  const first = await physics.step(3000);
  assert.equal(first.dtMs, 1200);
  const paused = await physics.step(0);
  assert.equal(paused.dtMs, 0);
  assert.deepEqual(paused.transforms, first.transforms);
  assert.equal((await physics.step(1)).dtMs, 1200);
  assert.equal((await physics.step(1)).dtMs, 600);
  assert.equal((await physics.step(8)).dtMs, 10);
});

test('playback time scaling advances only the actual zero, one or two seconds requested', async () => {
  const finalBySpeed = new Map();
  for (const speed of [0, 1, 2]) {
    await build([box('falling', { position: [0, 0, 100000] })], [], [0, 0, -9810], 10);
    let actualMs = 0;
    let final;
    for (let frame = 0; frame < 60; frame++) {
      final = await physics.step((1000 / 60) * speed);
      actualMs += final.dtMs;
    }
    close(actualMs, speed * 1000, 1e-9, 'scaled solver time');
    finalBySpeed.set(speed, final.transforms[0].positionMm[2]);
  }
  assert.equal(finalBySpeed.get(0), 100000);
  close(100000 - finalBySpeed.get(1), 4905, 15, 'one-second displacement');
  close(100000 - finalBySpeed.get(2), 19620, 30, 'two-second displacement');
});
