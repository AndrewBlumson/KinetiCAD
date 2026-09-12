// Real CAD worker/OCCT -> exact final-solid properties -> shipped physics worker.
// Only the worker endpoint and OCCT file loader are adapted for Node.
// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/boolean-physics.test.mjs
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { massPropertiesForMaterial, volumeDataFromMassProperties } from '../src/features/volumeCache.ts';

const IDENTITY = { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] };
const MOVED = { positionMm: [43, -27, 59], rotationDeg: [19, -37, 61] };
const G = 9810;
const DT = 1000 / 120;
const limits = {
  volumeMm3: 1e-6, massKg: 1e-10, centroidMm: 1e-6, tensorKgMm2: 1e-7,
  meshRelativeVolume: 5e-6, meshBoundsMm: 2e-5,
  freefallVelocityMmPerSec: 0.5, forceAccelerationRelative: 2e-4,
  fixedPositionMm: 1e-7, pendulumAngleRad: 0.003, pendulumSpeedRadPerSec: 0.03,
  pendulumClosureMm: 0.01,
};
const sha = path => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), passed: false,
  sources: {}, tolerances: limits,
  scope: 'Final connected Boolean solids, uniform density, exact OCCT mass properties, and actual Comlink/Rapier rigid-body response. Input transforms are baked into mesh, COM and principal frame; the descriptor transform is identity. Contact, friction, force-limited motors, automatic mate remapping, arbitrary Boolean assemblies and browser rendering are not established by these tests.',
  cases: [],
};
let cadWorker, physicsWorker, cad, physics;
before(async () => {
  report.sources = {
    cadWorkerSha256: sha('../src/cad/cadWorker.ts'),
    physicsWorkerSha256: sha('../src/physics/physicsWorker.ts'),
    massPropertiesSha256: sha('../src/cad/operations/massProperties.ts'),
    transformSha256: sha('../src/cad/operations/partTransform.ts'),
  };
  cadWorker = new Worker(new URL('./helpers/cad-worker-node.mjs', import.meta.url));
  cad = Comlink.wrap(nodeEndpoint(cadWorker));
  await cad.init();
  physicsWorker = new Worker(new URL('./helpers/physics-worker-node.mjs', import.meta.url), { execArgv: [] });
  physics = Comlink.wrap(nodeEndpoint(physicsWorker));
  assert.equal((await physics.init()).version, '0.12.0');
});
after(async () => {
  if (physics) await physics.destroy();
  if (physicsWorker) await physicsWorker.terminate();
  if (cadWorker) await cadWorker.terminate();
  report.passed = report.cases.length === 15;
  writeFileSync(new URL('../../../docs/boolean-physics-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
});
const record = (name, data) => report.cases.push({ name, ...data });
const close = (actual, expected, tolerance, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}, absolute tolerance ${tolerance}`);
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, k) => a.map(v => v * k);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const transpose = m => m[0].map((_, j) => m.map(row => row[j]));
const multiply = (a, b) => a.map(row => transpose(b).map(column => dot(row, column)));
const mv = (m, v) => m.map(row => dot(row, v));
const diagonal = d => d.map((v, i) => d.map((_, j) => i === j ? v : 0));
const rotateTensor = (r, tensor) => multiply(multiply(r, tensor), transpose(r));
function xyzMatrix(degrees) {
  const [x, y, z] = degrees.map(v => v * Math.PI / 180);
  const rx = [[1, 0, 0], [0, Math.cos(x), -Math.sin(x)], [0, Math.sin(x), Math.cos(x)]];
  const ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const rz = [[Math.cos(z), -Math.sin(z), 0], [Math.sin(z), Math.cos(z), 0], [0, 0, 1]];
  return multiply(multiply(rx, ry), rz);
}
function quaternionMatrix([x, y, z, w]) {
  return [[1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
    [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
    [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)]];
}
const tensorOf = props => rotateTensor(quaternionMatrix(props.principalInertiaLocalFrame), diagonal(props.principalInertiaKgMm2));
const transformedPoint = (point, tx) => add(mv(xyzMatrix(tx.rotationDeg), point), tx.positionMm);
function cuboidReference(size, centre, density = 1) {
  const [a, b, c] = size, volumeMm3 = a*b*c, massKg = volumeMm3 * density * 1e-6;
  return { volumeMm3, massKg, centre, tensor: diagonal([massKg*(b*b+c*c)/12, massKg*(a*a+c*c)/12, massKg*(a*a+b*b)/12]) };
}
function shiftedTensor(tensor, mass, displacement) {
  const distance2 = dot(displacement, displacement);
  return tensor.map((row, i) => row.map((value, j) => value + mass * ((i === j ? distance2 : 0) - displacement[i] * displacement[j])));
}
function differenceReference(whole, removed) {
  const massKg = whole.massKg - removed.massKg;
  const centre = scale(sub(scale(whole.centre, whole.massKg), scale(removed.centre, removed.massKg)), 1 / massKg);
  const a = shiftedTensor(whole.tensor, whole.massKg, sub(whole.centre, centre));
  const b = shiftedTensor(removed.tensor, removed.massKg, sub(removed.centre, centre));
  return { volumeMm3: whole.volumeMm3 - removed.volumeMm3, massKg, centre, tensor: a.map((row, i) => row.map((v, j) => v - b[i][j])) };
}
function input(id, size, origin = [0, 0, 0], tx = IDENTITY) {
  return { partId: id,
    transform: { positionMm: transformedPoint(origin, tx), rotationDeg: [...tx.rotationDeg] },
    sketches: [{ id: `${id}-sketch`, name: 'Box profile', plane: 'XY', primitives: [{ type: 'rectangle', corner: [0, 0], width: size[0], height: size[1] }] }],
    features: [{ id: `${id}-extrude`, type: 'extrude', sketchId: `${id}-sketch`, depthMm: size[2], direction: 'forward', extrudeMode: 'new-body' }],
  };
}
function cuboidCase(operation, tx = IDENTITY, offset = 5) {
  const args = { inputs: [input('body', [10, 20, 30], [0, 0, 0], tx), input('tool', [10, 20, 30], [offset, 0, 0], tx)],
    operation: operation === 'subtract' ? { type: operation, toolPartId: 'tool' } : { type: operation } };
  const width = operation === 'union' ? 10 + offset : operation === 'subtract' ? offset : 10 - offset;
  const x = operation === 'union' ? width/2 : operation === 'subtract' ? width/2 : offset + width/2;
  return { args, reference: cuboidReference([width, 20, 30], [x, 10, 15]), box: { size: [width, 20, 30], origin: [x - width/2, 0, 0] }, tx };
}
function offCentreCase(tx = IDENTITY) {
  const args = { inputs: [input('body', [20, 30, 40], [0, 0, 0], tx), input('tool', [4, 6, 40], [4, 8, 0], tx)], operation: { type: 'subtract', toolPartId: 'tool' } };
  const reference = differenceReference(cuboidReference([20, 30, 40], [10, 15, 20]), cuboidReference([4, 6, 40], [6, 11, 20]));
  return { args, reference, box: { size: [20, 30, 40], origin: [0, 0, 0] }, tx };
}
const cases = new Map();
for (const [frame, tx] of [['identity', IDENTITY], ['mixed-rotation', MOVED]]) {
  for (const op of ['union', 'subtract', 'intersect']) cases.set(`${op}-${frame}`, cuboidCase(op, tx));
  cases.set(`off-centre-cut-${frame}`, offCentreCase(tx));
}
const builtCases = new Map();
async function bodyFor(name) {
  if (!builtCases.has(name)) builtCases.set(name, await cad.buildBooleanBody(cases.get(name).args));
  return builtCases.get(name);
}
function meshVolume(mesh) {
  let sum = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = [0, 1, 2].map(k => Array.from(mesh.positions.slice(mesh.indices[i+k]*3, mesh.indices[i+k]*3+3)));
    const [a, b, c] = points;
    sum += (a[0]*(b[1]*c[2]-b[2]*c[1]) + a[1]*(b[2]*c[0]-b[0]*c[2]) + a[2]*(b[0]*c[1]-b[1]*c[0])) / 6;
  }
  return Math.abs(sum);
}
function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((v, i) => { min[i%3] = Math.min(min[i%3], v); max[i%3] = Math.max(max[i%3], v); });
  return { min, max };
}
function expectedBounds(box, tx) {
  const corners = [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => transformedPoint(add(box.origin, [x*box.size[0], y*box.size[1], z*box.size[2]]), tx))));
  return { min: [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...corners.map(p => p[i]))) };
}

for (const [name, item] of cases) test(`${name}: final solid mesh, volume, COM and all tensor components agree with independent geometry`, async () => {
  const original = structuredClone(item.args);
  const result = await bodyFor(name), props = result.massProperties;
  const expectedCentre = transformedPoint(item.reference.centre, item.tx);
  const expectedTensor = rotateTensor(xyzMatrix(item.tx.rotationDeg), item.reference.tensor);
  close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, 'exact volume');
  close(props.massKg, item.reference.massKg, limits.massKg, 'unit-density mass');
  props.comLocal.forEach((v, i) => close(v, expectedCentre[i], limits.centroidMm, 'world-frame COM'));
  close(Math.hypot(...props.principalInertiaLocalFrame), 1, 1e-12, 'principal frame normalization');
  const actualTensor = tensorOf(props);
  let maxTensorError = 0;
  actualTensor.forEach((row, i) => row.forEach((v, j) => {
    close(v, expectedTensor[i][j], limits.tensorKgMm2, `centroidal inertia[${i},${j}]`);
    maxTensorError = Math.max(maxTensorError, Math.abs(v - expectedTensor[i][j]));
  }));
  if (name.startsWith('off-centre')) assert.ok(Math.abs(expectedTensor[0][1]) > 1e-3, 'offset removed volume must exercise products of inertia');
  assert.ok(result.mesh.positions instanceof Float32Array && result.mesh.indices instanceof Uint32Array);
  assert.equal(result.mesh.solidCount, 1, 'physical result identifies its single connected solid for attachment picking');
  assert.ok(result.mesh.indices.length > 0 && result.mesh.positions.every(Number.isFinite));
  const measuredMeshVolume = meshVolume(result.mesh);
  close(measuredMeshVolume, props.volumeMm3, limits.meshRelativeVolume * props.volumeMm3, 'mesh and properties describe the same solid');
  const actualBounds = meshBounds(result.mesh), targetBounds = expectedBounds(item.box, item.tx);
  for (const side of ['min', 'max']) actualBounds[side].forEach((v, i) => close(v, targetBounds[side][i], limits.meshBoundsMm, 'baked world mesh bound'));
  assert.deepEqual(item.args, original, 'CAD construction must not consume or mutate caller geometry');
  record(name, { volumeMm3: props.volumeMm3, massKgAtUnitDensity: props.massKg, centreOfMassWorldMm: props.comLocal, inertiaTensorWorldKgMm2: actualTensor, maxTensorErrorKgMm2: maxTensorError, meshVolumeMm3: measuredMeshVolume, boundsMm: actualBounds });
});

test('empty and disconnected Boolean bodies reject while ordinary Boolean compounds and later valid calls remain usable', async () => {
  const disconnected = cuboidCase('union', IDENTITY, 30).args;
  const empty = cuboidCase('intersect', IDENTITY, 30).args;
  await assert.rejects(cad.buildBooleanBody(disconnected), /solid|connect/i);
  await assert.rejects(cad.buildBooleanBody(empty), /empty|solid/i);
  const compound = await cad.booleanOp(disconnected);
  assert.equal(compound.solidCount, 2, 'ordinary compound geometry remains visible but is ineligible as one physical body');
  close(meshVolume(compound), 12000, 1e-5, 'ordinary CAD union still supports two disconnected solids');
  const valid = await cad.buildBooleanBody(cases.get('union-identity').args);
  assert.equal(valid.mesh.solidCount, 1);
  close(valid.massProperties.volumeMm3, 9000, limits.volumeMm3, 'retry after failure');
  record('invalid-result-recovery', { disconnectedRejected: true, emptyRejected: true, compoundCadStillSupported: true, validRetryVolumeMm3: valid.massProperties.volumeMm3 });
});

test('sub-four-decimal input translation changes final mesh and exact properties instead of reusing rounded geometry', async () => {
  const delta = 0.00001;
  const original = await cad.buildBooleanBody(cuboidCase('union').args);
  const changed = await cad.buildBooleanBody(cuboidCase('union', IDENTITY, 5 + delta).args);
  const expectedVolumeChange = delta * 20 * 30;
  const measuredVolumeChange = changed.massProperties.volumeMm3 - original.massProperties.volumeMm3;
  close(measuredVolumeChange, expectedVolumeChange, limits.volumeMm3, 'small-translation volume difference');
  assert.notDeepEqual(changed.mesh.positions, original.mesh.positions);
  record('small-translation', { translationMm: delta, expectedVolumeChangeMm3: expectedVolumeChange, measuredVolumeChangeMm3: measuredVolumeChange });
});

test('a transformed imported STEP source and native cutter produce the analytic final body without changing the registered source', async () => {
  const nativeSource = input('step-source', [20, 30, 40]);
  const bytes = await cad.exportAssemblyStep([nativeSource]);
  assert.match(new TextDecoder().decode(bytes), /ISO-10303-21/);
  const stepSha256 = createHash('sha256').update(bytes).digest('hex');
  const imported = await cad.importStep(bytes, 'boolean-physics-source.step', {
    assetId: `${stepSha256}-local`, preserveCoordinates: true,
  });
  assert.equal(imported.length, 1);
  const source = { partId: 'imported-body', transform: structuredClone(MOVED), sketches: [],
    features: [{ id: 'registered-step', type: 'imported-step', shapeId: imported[0].shapeId }] };
  const massArgs = { features: source.features, sketches: [], density: 1 };
  const beforeMass = await cad.getMassProperties(massArgs);
  const beforeMesh = await cad.buildPartMesh({ features: source.features, sketches: [] });
  close(beforeMass.volumeMm3, 24000, limits.volumeMm3, 'registered STEP source volume');
  beforeMass.comLocal.forEach((v, i) => close(v, [10, 15, 20][i], limits.centroidMm, 'registered source stays in local coordinates'));

  const nativeCase = offCentreCase(MOVED);
  const args = { inputs: [source, nativeCase.args.inputs[1]], operation: { type: 'subtract', toolPartId: 'tool' } };
  const originalArgs = structuredClone(args);
  const result = await cad.buildBooleanBody(args), props = result.massProperties;
  const expectedCentre = transformedPoint(nativeCase.reference.centre, MOVED);
  const expectedTensor = rotateTensor(xyzMatrix(MOVED.rotationDeg), nativeCase.reference.tensor);
  assert.equal(result.mesh.solidCount, 1);
  close(props.volumeMm3, nativeCase.reference.volumeMm3, limits.volumeMm3, 'imported/native final volume');
  close(props.massKg, nativeCase.reference.massKg, limits.massKg, 'imported/native unit-density mass');
  props.comLocal.forEach((v, i) => close(v, expectedCentre[i], limits.centroidMm, 'imported/native world COM'));
  const actualTensor = tensorOf(props);
  let maxTensorError = 0;
  actualTensor.forEach((row, i) => row.forEach((v, j) => {
    close(v, expectedTensor[i][j], limits.tensorKgMm2, `imported/native inertia[${i},${j}]`);
    maxTensorError = Math.max(maxTensorError, Math.abs(v - expectedTensor[i][j]));
  }));
  const measuredMeshVolume = meshVolume(result.mesh);
  close(measuredMeshVolume, props.volumeMm3, limits.meshRelativeVolume * props.volumeMm3, 'imported/native mesh volume');
  const actualBounds = meshBounds(result.mesh), targetBounds = expectedBounds(nativeCase.box, MOVED);
  for (const side of ['min', 'max']) actualBounds[side].forEach((v, i) => close(v, targetBounds[side][i], limits.meshBoundsMm, 'imported/native baked mesh bounds'));
  assert.deepEqual(args, originalArgs, 'Boolean construction leaves imported source references and transforms intact');

  // A Boolean may transform/cut a copy, but the durable source registry must
  // still rebuild its complete original volume, local mesh and topology.
  const afterMass = await cad.getMassProperties(massArgs);
  const afterMesh = await cad.buildPartMesh({ features: source.features, sketches: [] });
  assert.deepEqual(afterMass, beforeMass, 'registered source exact mass properties are unchanged');
  for (const key of ['positions', 'normals', 'indices', 'faces', 'edges']) {
    assert.deepEqual(afterMesh.mesh[key], beforeMesh.mesh[key], `registered source ${key} remain unchanged`);
  }
  record('imported-step-source', { stepSha256, sourceShapeId: source.features[0].shapeId,
    sourceVolumeMm3: beforeMass.volumeMm3, sourceRegistryGeometryUnchanged: true,
    volumeMm3: props.volumeMm3, massKgAtUnitDensity: props.massKg, centreOfMassWorldMm: props.comLocal,
    inertiaTensorWorldKgMm2: actualTensor, maxTensorErrorKgMm2: maxTensorError,
    meshVolumeMm3: measuredMeshVolume, boundsMm: actualBounds });
});

function descriptor(id, result, density = 2.7, isGround = false) {
  const properties = massPropertiesForMaterial(volumeDataFromMassProperties(result.massProperties, 1), density);
  return { id, transform: structuredClone(IDENTITY), meshPositions: new Float32Array(result.mesh.positions), meshIndices: new Uint32Array(result.mesh.indices),
    massKg: properties.massKg, comLocal: properties.comLocal, principalInertiaKgMm2: properties.principalInertiaKgMm2,
    principalInertiaLocalFrame: properties.principalInertiaLocalFrame, isGround };
}
async function buildPhysics(parts, options = {}) {
  const result = await physics.buildWorld({ parts, mates: [], gravity: [0, 0, 0], timeStepMs: DT, ...options });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.bodyCount, parts.length);
  assert.deepEqual(result.warnings, []);
}
function reading(result, id) { const value = result.bodyMeasurements.find(body => body.partId === id); assert.ok(value, `actual readout missing for ${id}`); return value; }
function pose(result, id) { const value = result.transforms.find(body => body.partId === id); assert.ok(value); return value; }

test('actual Boolean bodies fall with mass-independent gravity using their baked world geometry once', async () => {
  const a = descriptor('boolean:union', await bodyFor('union-mixed-rotation'));
  const b = descriptor('boolean:cut', await bodyFor('off-centre-cut-mixed-rotation'), 7.87);
  await buildPhysics([a, b], { gravity: [0, 0, -G], durationMs: 1000, measurementPartIds: [a.id, b.id] });
  const start = await physics.step(0), end = await physics.step(1000);
  assert.equal(end.completed, true); close(end.simulatedTimeMs, 1000, 1e-9, 'actual clock');
  const measured = [];
  for (const part of [a, b]) {
    assert.deepEqual(pose(start, part.id).positionMm, [0, 0, 0], 'input transforms were already baked into the Boolean');
    const body = reading(end, part.id);
    close(body.massKg, part.massKg, 2e-8, 'actual Rapier body mass');
    close(body.linearVelocityMmPerSec[2], -G, limits.freefallVelocityMmPerSec, 'fall velocity');
    close(body.positionMm[2], -G / 2, G * (DT / 1000) / 2 + 0.01, 'continuum fall distance within a fixed-step integration bound');
    body.linearVelocityMmPerSec.slice(0, 2).forEach(v => close(v, 0, 1e-6, 'no lateral gravity'));
    assert.deepEqual(pose(end, part.id).rotationQuat, pose(start, part.id).rotationQuat);
    measured.push(body);
  }
  close(reading(end, a.id).linearVelocityMmPerSec[2], reading(end, b.id).linearVelocityMmPerSec[2], 1e-4, 'different materials fall alike');
  record('freefall', { durationMs: end.simulatedTimeMs, fixedStepMs: DT, bodies: measured });
});

test('equal COM forces measure acceleration from each final Boolean mass without adding torque', async () => {
  const parts = await Promise.all(['union', 'subtract', 'intersect'].map(async type => descriptor(`boolean:${type}`, await bodyFor(`${type}-mixed-rotation`))));
  const forceN = 0.001;
  await buildPhysics(parts, { appliedForces: parts.map(part => ({ partId: part.id, forceN: [0, forceN, 0] })), durationMs: 1000, measurementPartIds: parts.map(part => part.id) });
  let previous = await physics.step(0), final;
  let maximumAccelerationRelativeError = 0;
  for (let index = 0; index < 120; index++) {
    final = await physics.step(DT);
    const dt = (final.simulatedTimeMs - previous.simulatedTimeMs) / 1000;
    for (const part of parts) {
      const actual = reading(final, part.id), before = reading(previous, part.id);
      const measuredAcceleration = (actual.linearVelocityMmPerSec[1] - before.linearVelocityMmPerSec[1]) / dt;
      const expectedAcceleration = 1000 * forceN / part.massKg;
      maximumAccelerationRelativeError = Math.max(maximumAccelerationRelativeError, Math.abs(measuredAcceleration / expectedAcceleration - 1));
      actual.angularVelocityRadPerSec.forEach(v => close(v, 0, 1e-6, 'COM force has no torque'));
    }
    previous = final;
  }
  close(maximumAccelerationRelativeError, 0, limits.forceAccelerationRelative, 'acceleration inferred from actual consecutive velocities');
  const measurements = parts.map(part => {
    const actual = reading(final, part.id), acceleration = 1000 * forceN / part.massKg;
    close(actual.linearVelocityMmPerSec[1], acceleration, acceleration * limits.forceAccelerationRelative, 'velocity F t/m');
    close(actual.positionMm[1], acceleration / 2, acceleration * (DT / 1000) / 2 + 0.002, 'displacement within fixed-step bound');
    return { ...actual, expectedAccelerationMmPerSec2: acceleration };
  });
  close(reading(final, 'boolean:subtract').linearVelocityMmPerSec[1] / reading(final, 'boolean:union').linearVelocityMmPerSec[1], 3, 0.001, 'subtract result has one-third the union mass');
  const frozen = await physics.step(2000);
  assert.equal(frozen.dtMs, 0); assert.deepEqual(frozen.transforms, final.transforms);
  record('equal-force', { forceN, fixedStepMs: DT, durationMs: final.simulatedTimeMs, maximumAccelerationRelativeError, bodies: measurements });
});

test('grounded Boolean stays fixed, zero-time readback pauses, and rebuilding restores original poses', async () => {
  const fixed = descriptor('boolean:ground', await bodyFor('union-mixed-rotation'), 2.7, true);
  const moving = descriptor('boolean:moving', await bodyFor('subtract-mixed-rotation'));
  const options = { gravity: [0, 0, -G], durationMs: 500, measurementPartIds: [moving.id] };
  await buildPhysics([fixed, moving], options);
  const start = await physics.step(0), end = await physics.step(500);
  assert.deepEqual(pose(end, fixed.id), pose(start, fixed.id));
  assert.ok(pose(end, moving.id).positionMm[2] < -100);
  const paused = await physics.step(0);
  assert.equal(paused.dtMs, 0); assert.deepEqual(paused.transforms, end.transforms);
  await physics.destroy();
  await buildPhysics([fixed, moving], options);
  const reset = await physics.step(0);
  assert.deepEqual(reset.transforms, start.transforms);
  record('ground-pause-reset', { fixedBody: pose(end, fixed.id), freeBody: pose(end, moving.id), resetMatchesInitial: true });
});

function pendulumReference(k, seconds) {
  // Independent RK4 solution of I_pivot θ'' = m g l cosθ. Start horizontal.
  const count = Math.ceil(seconds / 1e-5), h = seconds / count;
  let angle = 0, velocity = 0;
  for (let i = 0; i < count; i++) {
    const a1 = velocity, v1 = k * Math.cos(angle);
    const a2 = velocity + h*v1/2, v2 = k * Math.cos(angle + h*a1/2);
    const a3 = velocity + h*v2/2, v3 = k * Math.cos(angle + h*a2/2);
    const a4 = velocity + h*v3, v4 = k * Math.cos(angle + h*a3);
    angle += h * (a1 + 2*a2 + 2*a3 + a4) / 6;
    velocity += h * (v1 + 2*v2 + 2*v3 + v4) / 6;
  }
  return { angle, velocity };
}
test('passive hinged Boolean follows its anisotropic final inertia and improves with timestep refinement', async () => {
  const result = await bodyFor('off-centre-cut-mixed-rotation');
  const moving = descriptor('boolean:pendulum', result);
  const fixed = descriptor('ground', await bodyFor('union-identity'), 2.7, true);
  const lever = 100, pivotWorld = sub(moving.comLocal, [lever, 0, 0]);
  const pivot = { kind: 'edge', edgeId: 'independent-world-pivot', localPoint: pivotWorld };
  const joint = { id: 'passive-hinge', type: 'revolute', partA: fixed.id, partB: moving.id, pivotA: pivot, pivotB: pivot, axisLocal: [0, 1, 0], motorSpeedRpm: null };
  const item = cases.get('off-centre-cut-mixed-rotation');
  const exactTensor = rotateTensor(xyzMatrix(item.tx.rotationDeg), item.reference.tensor).map(row => row.map(v => v * 2.7));
  const inertiaAboutPivot = exactTensor[1][1] + moving.massKg * lever * lever;
  const k = moving.massKg * G * lever / inertiaAboutPivot;
  const durationMs = 50, reference = pendulumReference(k, durationMs / 1000), trials = [];
  for (const hz of [240, 480]) {
    const dt = 1000 / hz;
    await buildPhysics([fixed, moving], { mates: [joint], gravity: [0, 0, -G], timeStepMs: dt, durationMs, measurementPartIds: [moving.id] });
    let final, maximumClosureMm = 0;
    for (let step = 0; step < Math.round(durationMs / dt); step++) {
      final = await physics.step(dt);
      const p = pose(final, moving.id), actualPivot = add(p.positionMm, mv(quaternionMatrix(p.rotationQuat), pivotWorld));
      maximumClosureMm = Math.max(maximumClosureMm, Math.hypot(...sub(actualPivot, pivotWorld)));
    }
    const p = pose(final, moving.id), body = reading(final, moving.id);
    const angle = 2 * Math.atan2(p.rotationQuat[1], p.rotationQuat[3]);
    close(angle, reference.angle, limits.pendulumAngleRad, 'passive nonlinear pendulum angle');
    close(body.angularVelocityRadPerSec[1], reference.velocity, limits.pendulumSpeedRadPerSec, 'passive nonlinear pendulum angular speed');
    close(maximumClosureMm, 0, limits.pendulumClosureMm, 'revolute anchor closure');
    close(Math.hypot(p.rotationQuat[0], p.rotationQuat[2]), 0, 1e-4, 'locked rotation axes');
    trials.push({ hz, angleRad: angle, angularVelocityRadPerSec: body.angularVelocityRadPerSec[1], angleErrorRad: Math.abs(angle - reference.angle), speedErrorRadPerSec: Math.abs(body.angularVelocityRadPerSec[1] - reference.velocity), maximumClosureMm });
  }
  assert.ok(trials[1].angleErrorRad <= trials[0].angleErrorRad + 2e-5, 'halving the timestep must not worsen angle error beyond float32 pose roundoff');
  record('passive-pendulum', { durationMs, leverMm: lever, inertiaAboutPivotKgMm2: inertiaAboutPivot, independentReference: reference, trials });
});
