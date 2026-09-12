import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Quaternion, Vector3 } from 'three';
import { partTransformMatrix, makePartTransform, transformPartShape } from '../src/cad/operations/partTransform.ts';

const transform = (m, p) => [0, 1, 2].map((i) => m[i * 4] * p[0] + m[i * 4 + 1] * p[1] + m[i * 4 + 2] * p[2] + m[i * 4 + 3]);
const cases = [
  { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
  { positionMm: [40, -70, 15], rotationDeg: [27, -39, 61] },
  { positionMm: [-12, 91, 200], rotationDeg: [-75, 23, -115] },
  { positionMm: [50, -90, -20], rotationDeg: [90, 90, -90] },
];

test('arbitrary mixed XYZ rotations and translations match the actual Three quaternion convention', () => {
  for (const tx of cases) {
    const m = partTransformMatrix(tx);
    const q = new Quaternion().setFromEuler(new Euler(...tx.rotationDeg.map((v) => v * Math.PI / 180), 'XYZ'));
    for (const p of [[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, -3], [17, -8, 33]]) {
      const expected = new Vector3(...p).applyQuaternion(q).add(new Vector3(...tx.positionMm)).toArray();
      transform(m, p).forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-10));
    }
    assert.deepEqual(transform(m, [0, 0, 0]), tx.positionMm, 'world translation must never be rotated');
  }
});

test('invalid transforms fail before constructing OCCT values', () => {
  const bad = [NaN, Infinity, -Infinity];
  for (const value of bad) assert.throws(() => partTransformMatrix({ positionMm: [value, 0, 0], rotationDeg: [0, 0, 0] }), /finite XYZ/);
  assert.throws(() => partTransformMatrix({ positionMm: [0, 0, 0], rotationDeg: [0, NaN, 0] }), /finite XYZ/);
});

test('OCCT transform wrappers are released on constructor or shape-operation failures', () => {
  let deleted = 0;
  class FailingTransform { SetValues() { throw new Error('bad values'); } delete() { deleted++; } }
  assert.throws(() => makePartTransform({ gp_Trsf_1: FailingTransform }, cases[0]), /bad values/);
  assert.equal(deleted, 1);
  class Transform { SetValues() {} delete() { deleted++; } }
  class FailingBuilder { IsDone() { return false; } delete() { deleted++; } }
  assert.throws(() => transformPartShape({ gp_Trsf_1: Transform, BRepBuilderAPI_Transform_2: FailingBuilder }, {}, cases[1]), /failed to apply/);
  assert.equal(deleted, 3);
});
