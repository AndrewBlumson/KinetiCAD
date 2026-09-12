import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensionFields, withPrimitiveDimensions, validateSketchDimensions } from '../src/sketch/sketchDimensions.ts';

const values = (primitive) => Object.fromEntries(dimensionFields(primitive).map(({ key, value }) => [key, value]));
const edit = (primitive, changes) => withPrimitiveDimensions(primitive, { ...values(primitive), ...changes });
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const primitives = [
  { type: 'circle', centre: [7, -9], radius: 11 },
  { type: 'rectangle', corner: [-7, 3], width: 20, height: 13 },
  { type: 'line', start: [1.23456789, -3.45678901], end: [-8.7654321, 12.3456789] },
  { type: 'arc', centre: [4, -2], radius: 9, startAngle: -0.473, endAngle: 2.971 },
];

test('fields expose persistent UV geometry with diameter and degree conventions', () => {
  assert.deepEqual(dimensionFields(primitives[0]), [
    { key: 'centreU', label: 'Centre U', value: 7, unit: 'mm' },
    { key: 'centreV', label: 'Centre V', value: -9, unit: 'mm' },
    { key: 'diameter', label: 'Diameter', value: 22, unit: 'mm' },
  ]);
  const line = { type: 'line', start: [2, 5], end: [-1, 9] };
  close(values(line).length, 5);
  close(values(line).angle, 126.86989764584402);
  const arc = { type: 'arc', centre: [0, 0], radius: 3, startAngle: Math.PI * 3 / 2, endAngle: Math.PI * 5 / 2 };
  close(values(arc).startAngle, 270);
  close(values(arc).sweepAngle, 180);
});

test('exact no-op edits retain primitive identity and all original floating-point coordinates', () => {
  for (const primitive of primitives) {
    const original = structuredClone(primitive);
    for (const value of Object.values(primitive)) if (Array.isArray(value)) Object.freeze(value);
    Object.freeze(primitive);
    assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive);
    assert.deepEqual(primitive, original);
  }
});

test('circle diameter and rectangle width/height edits preserve anchors and neighbours', () => {
  const circle = edit(primitives[0], { diameter: 30 });
  assert.deepEqual(circle, { type: 'circle', centre: [7, -9], radius: 15 });
  const rectangle = edit(primitives[1], { width: 31, height: 17 });
  assert.deepEqual(rectangle, { type: 'rectangle', corner: [-7, 3], width: 31, height: 17 });
  assert.equal(primitives[0].radius, 11);
  assert.equal(primitives[1].width, 20);
  const moved = edit(primitives[0], { centreU: -8, centreV: 12 });
  assert.deepEqual(moved.centre, [-8, 12]);
  assert.equal(moved.radius, 11);
});

test('line edits satisfy independent right-triangle, quadrant and winding references', () => {
  const line = { type: 'line', start: [7, -11], end: [10, -7] };
  const longer = edit(line, { length: 10 });
  close(longer.end[0], 13); close(longer.end[1], -3);
  assert.deepEqual(longer.start, line.start);
  for (const [angle, expected] of [[0, [17, -11]], [90, [7, -1]], [180, [-3, -11]], [-90, [7, -21]], [450, [7, -1]], [-270, [7, -1]]]) {
    const result = edit(line, { length: 10, angle });
    result.end.forEach((coordinate, axis) => close(coordinate, expected[axis]));
    close(Math.hypot(result.end[0] - result.start[0], result.end[1] - result.start[1]), 10);
  }
  const moved = edit(line, { startU: -5, startV: 8 });
  close(moved.end[0], -2); close(moved.end[1], 12);
  assert.deepEqual(line.end, [10, -7]);
});

test('arc edits preserve centre and produce the stated circular endpoints and CCW sweep across zero', () => {
  const original = { type: 'arc', centre: [4, -2], radius: 9, startAngle: 0, endAngle: Math.PI / 2 };
  const result = edit(original, { radius: 6, startAngle: 270, sweepAngle: 180 });
  assert.deepEqual(result.centre, original.centre);
  close(result.startAngle, 3 * Math.PI / 2);
  close(result.endAngle, 5 * Math.PI / 2);
  const start = [result.centre[0] + result.radius * Math.cos(result.startAngle), result.centre[1] + result.radius * Math.sin(result.startAngle)];
  const end = [result.centre[0] + result.radius * Math.cos(result.endAngle), result.centre[1] + result.radius * Math.sin(result.endAngle)];
  start.forEach((v, i) => close(v, [4, -8][i]));
  end.forEach((v, i) => close(v, [4, 4][i]));
  close(result.radius * (result.endAngle - result.startAngle), 6 * Math.PI);
  assert.equal(original.radius, 9);
});

test('complete values reject unknown, missing, nonfinite, nonnumeric and out-of-domain edits without mutation', () => {
  for (const primitive of primitives) {
    const original = structuredClone(primitive);
    const complete = values(primitive), firstKey = Object.keys(complete)[0];
    assert.throws(() => withPrimitiveDimensions(primitive, { ...complete, surprise: 1 }), /Unknown/);
    const missing = { ...complete }; delete missing[firstKey];
    assert.throws(() => withPrimitiveDimensions(primitive, missing), /Missing/);
    for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '12']) assert.throws(() => withPrimitiveDimensions(primitive, { ...complete, [firstKey]: invalid }));
    assert.throws(() => withPrimitiveDimensions(primitive, { ...complete, [Symbol('extra')]: 1 }), /Unknown/);
    assert.deepEqual(primitive, original);
  }
  for (const diameter of [0, -1, 0.000999, 1_000_001]) assert.throws(() => edit(primitives[0], { diameter }));
  for (const width of [0, -1, 0.000999, 1_000_001]) assert.throws(() => edit(primitives[1], { width }));
  for (const length of [0, -1, 0.000999, 1_000_001]) assert.throws(() => edit(primitives[2], { length }));
  for (const angle of [-360_001, 360_001]) assert.throws(() => edit(primitives[2], { angle }));
  for (const sweepAngle of [-1, 0, 0.000999, 360, 720]) assert.throws(() => edit(primitives[3], { sweepAngle }));
  assert.throws(() => edit(primitives[0], { centreU: 1_000_001 }));
  assert.throws(() => edit(primitives[2], { startU: 1_000_000, angle: 0, length: 1 }), /Stored U\/V/);
});

test('inclusive bounds accept valid stored coordinates and primitives remain editable after serialization', () => {
  const circle = edit(primitives[0], { centreU: -1_000_000, centreV: 1_000_000, diameter: 0.001 });
  assert.equal(circle.radius, 0.0005);
  const rectangle = edit(primitives[1], { width: 1_000_000, height: 0.001 });
  for (const sweepAngle of [0.001, 359.999]) {
    const arc = edit(primitives[3], { startAngle: 0, sweepAngle });
    validateSketchDimensions([arc]);
  }
  const line = edit(primitives[2], { startU: 0, startV: 0, angle: 360_000, length: 1_000_000 });
  close(line.end[0], 1_000_000, 1e-6);
  const reloaded = JSON.parse(JSON.stringify([circle, rectangle, line]));
  validateSketchDimensions(reloaded);
  reloaded.forEach((primitive) => assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive));
});

test('minimum lengths and arc sweeps survive cancellation at the maximum coordinate and angle scales', () => {
  const results = [];
  for (const startAngle of [-360_000, 360_000]) {
    for (const sweepAngle of [0.001, 359.999]) {
      const arc = edit(primitives[3], { startAngle, sweepAngle });
      assert.equal(values(arc).sweepAngle, sweepAngle);
      results.push(arc);
    }
  }
  for (const angle of [0, 45, 90, 135, 180, -135, -90, -45]) {
    const line = edit(primitives[2], { startU: 999_999, startV: -999_999, length: 0.001, angle });
    assert.equal(values(line).length, 0.001);
    results.push(line);
  }
  const reloaded = JSON.parse(JSON.stringify(results));
  validateSketchDimensions(reloaded);
  reloaded.forEach((primitive) => assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive));
  // The representation correction is not an expanded range for typed input.
  assert.throws(() => edit(primitives[3], { sweepAngle: 0.001 - Number.EPSILON }));
  assert.throws(() => edit(primitives[2], { length: 0.001 - Number.EPSILON }));
});

test('sketch validation allows empty/open geometry but rejects degenerate primitive dimensions', () => {
  validateSketchDimensions([]);
  validateSketchDimensions([{ type: 'line', start: [0, 0], end: [3, 4] }]);
  for (const primitive of [
    { type: 'line', start: [0, 0], end: [0, 0] },
    { type: 'line', start: [999_999, 0], end: [1_000_001, 0] },
    { type: 'rectangle', corner: [0, 0], width: -1, height: 4 },
    { type: 'circle', centre: [0, 0], radius: 0 },
    { type: 'arc', centre: [0, 0], radius: 1, startAngle: 1, endAngle: 0 },
  ]) assert.throws(() => validateSketchDimensions([primitive]), /Primitive 1:/);
});
