// Run separately from other heavy OCCT checks:
// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/part-transform-occt.test.mjs
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { Euler, Quaternion, Vector3 } from 'three';
import { transformPartShape } from '../src/cad/operations/partTransform.ts';
import { computeMassProperties } from '../src/cad/operations/massProperties.ts';
import { loadGeometryKernel, validateSolid, intersectionVolume } from '../../../scripts/src/verify-demo-geometry.mjs';

let oc;
before(async () => { oc = await loadGeometryKernel(); });
test('a translated, generally rotated B-rep keeps its analytic volume and Three-world centroid', () => {
  const builder = new oc.BRepPrimAPI_MakeBox_2(20, 30, 40);
  const original = builder.Shape(); builder.delete();
  const tx = { positionMm: [43, -67, 89], rotationDeg: [27, -39, 61] };
  let placed;
  try {
    placed = transformPartShape(oc, original, tx);
    const props = computeMassProperties(oc, placed, 1);
    const q = new Quaternion().setFromEuler(new Euler(...tx.rotationDeg.map((v) => v * Math.PI / 180), 'XYZ'));
    const centroid = new Vector3(10, 15, 20).applyQuaternion(q).add(new Vector3(...tx.positionMm)).toArray();
    assert.ok(Math.abs(props.volumeMm3 - 24000) < 1e-7);
    props.comLocal.forEach((v, i) => assert.ok(Math.abs(v - centroid[i]) < 1e-8));
    assert.deepEqual(validateSolid(oc, placed).solids, 1);
    const originalProps = computeMassProperties(oc, original, 1);
    originalProps.comLocal.forEach((v, i) => assert.ok(Math.abs(v - [10, 15, 20][i]) < 1e-9), 'input shape must stay in its local frame');
  } finally { placed?.delete(); original.delete(); }
});

test('the same world transform preserves boolean overlap between two independently transformed bodies', () => {
  const aBuilder = new oc.BRepPrimAPI_MakeBox_2(10, 20, 30), a = aBuilder.Shape(); aBuilder.delete();
  const point = new oc.gp_Pnt_3(5, 0, 0);
  const bBuilder = new oc.BRepPrimAPI_MakeBox_3(point, 10, 20, 30), b = bBuilder.Shape(); bBuilder.delete(); point.delete();
  const tx = { positionMm: [53, -41, 23], rotationDeg: [-17, 42, 73] };
  let placedA, placedB;
  try {
    placedA = transformPartShape(oc, a, tx); placedB = transformPartShape(oc, b, tx);
    assert.ok(Math.abs(intersectionVolume(oc, placedA, placedB) - 3000) < 1e-6);
  } finally { placedA?.delete(); placedB?.delete(); a.delete(); b.delete(); }
});
