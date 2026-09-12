// Independent exact-geometry checks after dimension edits. These use the
// installed OpenCascade WASM and the shipped sketch/sweep/mass operations.
// Run serially with other OCCT tests:
// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { dimensionFields, withPrimitiveDimensions, validateSketchDimensions } from '../src/sketch/sketchDimensions.ts';
import { sketchToWire } from '../src/cad/operations/sketchToWire.ts';
import { extrude } from '../src/cad/operations/extrude.ts';
import { computeMassProperties } from '../src/cad/operations/massProperties.ts';
import { tessellateShape } from '../src/cad/operations/tessellate.ts';
import { loadGeometryKernel, rebuildPart, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';
import { createProjectDocument } from '../src/project/projectAssets.ts';
import { parseProjectDocument } from '../src/project/projectDocument.ts';

let oc;
before(async () => { oc = await loadGeometryKernel(); });
const radians = degrees => degrees * Math.PI / 180;
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (absolute tolerance ${tolerance})`);
const lift = (plane, [u, v]) => plane === 'XY' ? [u, v, 0] : plane === 'XZ' ? [u, 0, v] : [0, u, v];
const normal = plane => ({ XY: [0, 0, 1], XZ: [0, 1, 0], YZ: [1, 0, 0] })[plane];
const line = (start, end) => ({ type: 'line', start, end });
const fields = primitive => Object.fromEntries(dimensionFields(primitive).map(field => [field.key, field.value]));
function edit(primitive, changes) {
  const original = structuredClone(primitive);
  const result = withPrimitiveDimensions(primitive, { ...fields(primitive), ...changes });
  assert.deepEqual(primitive, original, 'dimension editing must not mutate the previous primitive');
  validateSketchDimensions([result]);
  return result;
}
function swept(primitives, plane, depth) {
  validateSketchDimensions(primitives);
  const wire = sketchToWire(oc, plane, primitives);
  try { return extrude(oc, wire, plane, depth, 'forward'); }
  finally { wire.delete(); }
}
function bounds(shape) {
  const box = new oc.Bnd_Box_1(); let min, max;
  try {
    oc.BRepBndLib.Add(shape, box, false);
    min = box.CornerMin(); max = box.CornerMax();
    return { min: [min.X(), min.Y(), min.Z()], max: [max.X(), max.Y(), max.Z()] };
  } finally { min?.delete(); max?.delete(); box.delete(); }
}
function properties(shape, expectedVolume, density = 2.7) {
  const validity = validateSolid(oc, shape);
  assert.equal(validity.valid, true, 'OCCT BRepCheck must accept the edited solid');
  assert.equal(validity.solids, 1);
  const result = computeMassProperties(oc, shape, density);
  close(result.volumeMm3, expectedVolume);
  close(result.massKg, expectedVolume * density * 1e-6, 1e-10);
  assert.ok(result.principalInertiaKgMm2.every(value => Number.isFinite(value) && value > 0));
  assert.ok(tessellateShape(oc, shape).indices.length > 0, 'the detached final B-rep must also tessellate');
  return result;
}
function compareBounds(actual, expected) {
  for (const side of ['min', 'max']) actual[side].forEach((value, axis) => close(value, expected[side][axis]));
}
function expectedSweepBounds(plane, uvPoints, depth) {
  const vertices = uvPoints.flatMap(uv => [0, depth].map(d => lift(plane, uv).map((v, axis) => v + normal(plane)[axis] * d)));
  return { min: [0, 1, 2].map(axis => Math.min(...vertices.map(v => v[axis]))), max: [0, 1, 2].map(axis => Math.max(...vertices.map(v => v[axis]))) };
}

test('editing circle diameter20→30 mm rebuilds an exact cylinder with the expected volume, bounds and mass', () => {
  const initial = { type: 'circle', centre: [3, -5], radius: 10 };
  assert.equal(fields(initial).diameter, 20);
  const resized = edit(initial, { diameter: 30, centreU: 7, centreV: -4 });
  const beforeShape = swept([initial], 'XY', 12), afterShape = swept([resized], 'XY', 12);
  try {
    const before = properties(beforeShape, Math.PI * 10 ** 2 * 12);
    const after = properties(afterShape, Math.PI * 15 ** 2 * 12);
    close(after.volumeMm3 / before.volumeMm3, 2.25);
    close(after.massKg / before.massKg, 2.25);
    after.comLocal.forEach((v, i) => close(v, [7, -4, 6][i]));
    compareBounds(bounds(afterShape), { min: [-8, -19, 0], max: [22, 11, 12] });
    assert.deepEqual(resized, { type: 'circle', centre: [7, -4], radius: 15 });
  } finally { beforeShape.delete(); afterShape.delete(); }
});

for (const plane of ['XY', 'XZ', 'YZ']) {
  test(`${plane} rectangle width and height edits change exact solid dimensions in the sketch's U/V axes`, () => {
    const initial = { type: 'rectangle', corner: [-7, 4], width: 20, height: 15 };
    const wider = edit(initial, { width: 35 });
    const taller = edit(wider, { height: 18 });
    for (const [primitive, width, height] of [[initial, 20, 15], [wider, 35, 15], [taller, 35, 18]]) {
      const shape = swept([primitive], plane, 8);
      try {
        const props = properties(shape, width * height * 8, 7.85);
        const expectedCentre = lift(plane, [-7 + width / 2, 4 + height / 2]).map((v, axis) => v + normal(plane)[axis] * 4);
        props.comLocal.forEach((v, axis) => close(v, expectedCentre[axis]));
        compareBounds(bounds(shape), expectedSweepBounds(plane, [[-7, 4], [-7 + width, 4 + height]], 8));
      } finally { shape.delete(); }
    }
  });
}

function editedLineRectangle() {
  const theta = radians(37), a = [2, -1], u = [Math.cos(theta), Math.sin(theta)], v = [-Math.sin(theta), Math.cos(theta)];
  const b = a.map((value, i) => value + 18 * u[i]);
  const c = b.map((value, i) => value + 9 * v[i]);
  const d = a.map((value, i) => value + 9 * v[i]);
  const starts = [a, b, c, d], angles = [37, 127, 217, 307], lengths = [18, 9, 18, 9];
  const primitives = starts.map((start, i) => edit(line([0, 0], [1, 0]), { startU: start[0], startV: start[1], length: lengths[i], angle: angles[i] }));
  return { primitives, corners: starts, centre: a.map((value, i) => value + 9 * u[i] + 4.5 * v[i]) };
}

test('line length/angle/start edits create a closed rotated rectangular profile with analytical area', () => {
  const { primitives, corners, centre } = editedLineRectangle();
  const shape = swept(primitives, 'XY', 5);
  try {
    const props = properties(shape, 18 * 9 * 5);
    props.comLocal.forEach((value, axis) => close(value, [...centre, 2.5][axis]));
    compareBounds(bounds(shape), expectedSweepBounds('XY', corners, 5));
  } finally { shape.delete(); }
});

function editedSector() {
  const original = { type: 'arc', centre: [0, 0], radius: 10, startAngle: 0, endAngle: Math.PI / 2 };
  const arc = edit(original, { centreU: 4, centreV: -3, radius: 15, startAngle: 30, sweepAngle: 100 });
  const end = [4 + 15 * Math.cos(radians(130)), -3 + 15 * Math.sin(radians(130))];
  // Neighbours are explicitly edited too: no relation/constraint propagation is assumed.
  const inward = edit(line([0, 10], [0, 0]), { startU: end[0], startV: end[1], length: 15, angle: 310 });
  const outward = edit(line([0, 0], [10, 0]), { startU: 4, startV: -3, length: 15, angle: 30 });
  return [arc, inward, outward];
}

for (const plane of ['XY', 'XZ', 'YZ']) {
  test(`${plane} edited arc radius/start/sweep and its two lines rebuild the exact closed sector`, () => {
    const primitives = editedSector(), sweep = radians(100), depth = 6;
    const shape = swept(primitives, plane, depth);
    try {
      const props = properties(shape, 15 ** 2 * sweep * depth / 2);
      const centroidUV = [4 + 2 * 15 * (Math.sin(radians(130)) - Math.sin(radians(30))) / (3 * sweep),
        -3 + 2 * 15 * (Math.cos(radians(30)) - Math.cos(radians(130))) / (3 * sweep)];
      const centroid = lift(plane, centroidUV).map((value, axis) => value + normal(plane)[axis] * depth / 2);
      props.comLocal.forEach((value, axis) => close(value, centroid[axis]));
    } finally { shape.delete(); }
  });
}

test('an arc-only edit does not silently move adjacent lines or disguise an open profile as a solid', () => {
  const arc = { type: 'arc', centre: [0, 0], radius: 10, startAngle: 0, endAngle: Math.PI / 2 };
  const primitives = [arc, line([0, 10], [0, 0]), line([0, 0], [10, 0])];
  const before = swept(primitives, 'XY', 4);
  try {
    const candidate = [edit(arc, { radius: 15 }), ...primitives.slice(1)];
    assert.deepEqual(candidate.slice(1), primitives.slice(1));
    validateSketchDimensions(candidate); // Individual dimensions are valid; topology is not.
    assert.throws(() => swept(candidate, 'XY', 4), /closed|connect|chain|gap/i);
    properties(before, Math.PI * 10 ** 2 * 4 / 4);
  } finally { before.delete(); }
});

test('complete Save/parse preserves edited primitives and rebuilds identical actual CAD geometry', async () => {
  const cases = [
    { plane: 'XY', primitives: [edit({ type: 'circle', centre: [0, 0], radius: 10 }, { centreU: 7, centreV: -4, diameter: 30 })], volume: Math.PI * 15 ** 2 * 6 },
    { plane: 'XZ', primitives: [edit({ type: 'rectangle', corner: [0, 0], width: 20, height: 15 }, { cornerU: -7, cornerV: 4, width: 35, height: 18 })], volume: 35 * 18 * 6 },
    { plane: 'YZ', primitives: editedLineRectangle().primitives, volume: 18 * 9 * 6 },
    { plane: 'XZ', primitives: editedSector(), volume: 15 ** 2 * radians(100) * 6 / 2 },
  ];
  const parts = cases.map((value, i) => ({ id: `part-${i}`, name: `Edited ${i}`, visible: true, materialId: 'aluminium-6061',
    transform: { positionMm: [17 * i, i === 0 ? 0 : -9 * i, 3 * i], rotationDeg: [13, -27, 41] },
    sketches: [{ id: `sketch-${i}`, name: 'Dimensioned sketch', plane: value.plane, primitives: value.primitives }],
    features: [{ id: `extrude-${i}`, type: 'extrude', sketchId: `sketch-${i}`, depthMm: 6, direction: 'forward', extrudeMode: 'new-body' }] }));
  const state = { mode: 'modeller', assembly: { id: 'dimension-roundtrip', name: 'Dimension roundtrip', groundPartId: parts[0].id, parts, mates: [], booleanFeatures: [] },
    simulation: { running: false, paused: false, simulationTimeMs: 0, gravity: [0, 0, -9810], timeStepMs: 1000 / 60, speedMultiplier: 1 } };
  const saved = await createProjectDocument(state, async () => { throw new Error('Native Save must not initialise another kernel.'); });
  const loaded = parseProjectDocument(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(loaded.assets, []);
  assert.deepEqual(loaded.state.assembly, state.assembly);
  for (let i = 0; i < parts.length; i++) {
    const before = rebuildPart(oc, parts[i]), after = rebuildPart(oc, loaded.state.assembly.parts[i]);
    try {
      const first = properties(before, cases[i].volume), second = properties(after, cases[i].volume);
      close(second.volumeMm3, first.volumeMm3);
      close(second.massKg, first.massKg, 1e-12);
      second.comLocal.forEach((value, axis) => close(value, first.comLocal[axis], 1e-9));
      compareBounds(bounds(after), bounds(before));
      assert.deepEqual(loaded.state.assembly.parts[i].sketches[0].primitives, cases[i].primitives);
    } finally { before.delete(); after.delete(); }
  }
});
