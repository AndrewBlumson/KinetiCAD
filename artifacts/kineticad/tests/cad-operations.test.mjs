// Actual installed OCCT, shipped operation functions, independent analytical
// references. Run serially with other OCCT suites to bound WASM memory usage.
// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/cad-operations.test.mjs
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadGeometryKernel, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';
import { sketchToWire } from '../src/cad/operations/sketchToWire.ts';
import { extrude } from '../src/cad/operations/extrude.ts';
import { revolve } from '../src/cad/operations/revolve.ts';
import { applyFillet } from '../src/cad/operations/fillet.ts';
import { applyChamfer } from '../src/cad/operations/chamfer.ts';
import { applyHole } from '../src/cad/operations/hole.ts';
import { applyBoolean } from '../src/cad/operations/boolean.ts';
import { computeMassProperties } from '../src/cad/operations/massProperties.ts';
import { tessellateShape } from '../src/cad/operations/tessellate.ts';
import { enumerateTopology, enumerateEdgeRefs, enumerateFaceRefs, disposeRefMap } from '../src/cad/operations/topology.ts';

let oc;
before(async () => { oc = await loadGeometryKernel(); });
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (absolute tolerance ${tolerance})`);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function box(size = [20, 30, 40], origin = [0, 0, 0]) {
  const point = new oc.gp_Pnt_3(...origin);
  const builder = new oc.BRepPrimAPI_MakeBox_3(point, ...size);
  try { return builder.Shape(); } finally { builder.delete(); point.delete(); }
}
function properties(shape, expectedVolume) {
  const validity = validateSolid(oc, shape);
  assert.equal(validity.valid, true);
  assert.equal(validity.solids, 1);
  const props = computeMassProperties(oc, shape, 1);
  close(props.volumeMm3, expectedVolume);
  assert.ok(props.principalInertiaKgMm2.every((v) => v > 0 && Number.isFinite(v)));
  const mesh = tessellateShape(oc, shape);
  assert.ok(mesh.indices.length > 0, 'returned shape must remain meshable after its builders are deleted');
  return props;
}
function bounds(shape) {
  const bbox = new oc.Bnd_Box_1();
  let min, max;
  try {
    oc.BRepBndLib.Add(shape, bbox, false);
    min = bbox.CornerMin(); max = bbox.CornerMax();
    return [[min.X(), min.Y(), min.Z()], [max.X(), max.Y(), max.Z()]];
  } finally { min?.delete(); max?.delete(); bbox.delete(); }
}
function verticalEdge(refs) {
  for (const [id, edge] of refs) {
    const curve = new oc.BRepAdaptor_Curve_2(edge);
    let point;
    try {
      point = curve.Value((curve.FirstParameter() + curve.LastParameter()) / 2);
      if (Math.abs(point.X()) < 1e-7 && Math.abs(point.Y()) < 1e-7 && Math.abs(point.Z() - 20) < 1e-7) return id;
    } finally { point?.delete(); curve.delete(); }
  }
  assert.fail('box must expose the analytical [0,0,20] edge midpoint');
}

for (const plane of ['XY', 'XZ', 'YZ']) {
  test(`${plane} extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh`, () => {
    const normalAxis = { XY: 2, XZ: 1, YZ: 0 }[plane];
    const uvAxes = { XY: [0, 1], XZ: [0, 2], YZ: [1, 2] }[plane];
    for (const direction of ['forward', 'backward', 'symmetric']) {
      const wire = sketchToWire(oc, plane, [{ type: 'rectangle', corner: [2, -3], width: 12, height: 8 }]);
      let shape;
      try {
        shape = extrude(oc, wire, plane, 10, direction);
        const props = properties(shape, 960);
        const normalMin = direction === 'forward' ? 0 : direction === 'backward' ? -10 : -5;
        const expectedMin = [0, 0, 0], expectedMax = [0, 0, 0];
        expectedMin[uvAxes[0]] = 2; expectedMax[uvAxes[0]] = 14;
        expectedMin[uvAxes[1]] = -3; expectedMax[uvAxes[1]] = 5;
        expectedMin[normalAxis] = normalMin; expectedMax[normalAxis] = normalMin + 10;
        const actualBounds = bounds(shape);
        for (let axis = 0; axis < 3; axis++) {
          close(props.comLocal[axis], (expectedMin[axis] + expectedMax[axis]) / 2);
          close(actualBounds[0][axis], expectedMin[axis]);
          close(actualBounds[1][axis], expectedMax[axis]);
        }
      } finally { shape?.delete(); wire.delete(); }
    }
  });
}

test('quarter-turn revolve keeps analytical annular-sector volume and centroid', () => {
  const wire = sketchToWire(oc, 'XZ', [{ type: 'rectangle', corner: [5, 0], width: 5, height: 7 }]);
  let shape;
  try {
    shape = revolve(oc, wire, 'Z', 90);
    const props = properties(shape, Math.PI * (100 - 25) * 7 / 4);
    // Integral r^2 dr * integral cos(theta) dtheta / sector area.
    const xyCentroid = 4 * (1000 - 125) / (3 * Math.PI * (100 - 25));
    close(props.comLocal[0], xyCentroid); close(props.comLocal[1], xyCentroid); close(props.comLocal[2], 3.5);
  } finally { shape?.delete(); wire.delete(); }
});

test('single-edge fillet removes square-minus-quarter-circle volume and leaves its input unchanged', () => {
  const shape = box(), refs = enumerateEdgeRefs(oc, shape);
  let result;
  try {
    result = applyFillet(oc, shape, refs, [verticalEdge(refs)], 2);
    properties(result, 24000 - (4 - Math.PI) * 40);
    properties(shape, 24000);
  } finally { result?.delete(); disposeRefMap(refs); shape.delete(); }
});

test('single-edge chamfer removes an exact triangular prism and leaves its input unchanged', () => {
  const shape = box(), refs = enumerateEdgeRefs(oc, shape);
  let result;
  try {
    result = applyChamfer(oc, shape, refs, [verticalEdge(refs)], 2);
    properties(result, 24000 - 2 * 40);
    properties(shape, 24000);
  } finally { result?.delete(); disposeRefMap(refs); shape.delete(); }
});

test('all six face pick bases drill inward for blind holes and span the correct dimension for through holes', () => {
  const shape = box(), mesh = tessellateShape(oc, shape);
  const { faces } = enumerateTopology(oc, shape, mesh.positions, mesh.indices, mesh.faceRanges);
  const refs = enumerateFaceRefs(oc, shape, mesh.positions, mesh.indices, mesh.faceRanges);
  try {
    assert.equal(faces.length, 6);
    for (const face of faces) {
      assert.ok(face.planeBasis && refs.has(face.id));
      const { origin, u, v } = face.planeBasis;
      const delta = face.centroid.map((p, axis) => p - origin[axis]);
      const uv = [dot(delta, u), dot(delta, v)];
      const axis = face.normalAtCentroid.findIndex((n) => Math.abs(n) > 0.99);
      assert.ok(axis >= 0);
      const ref = { face: refs.get(face.id), origin, u, v, normal: face.normalAtCentroid };
      for (const depth of [5, 0]) {
        const result = applyHole(oc, shape, ref, uv, 4, depth);
        try { properties(result, 24000 - 4 * Math.PI * (depth || [20, 30, 40][axis])); }
        finally { result.delete(); }
      }
    }
    properties(shape, 24000);
  } finally { disposeRefMap(refs); shape.delete(); }
});

for (const [type, expectedVolume] of [['union', 9000], ['subtract', 3000], ['intersect', 3000]]) {
  test(`Boolean ${type} matches overlapping-box volume and preserves both input solids`, () => {
    const a = box([10, 20, 30]), b = box([10, 20, 30], [5, 0, 0]);
    let result;
    try {
      result = applyBoolean(oc, [a, b], { type });
      properties(result, expectedVolume);
      properties(a, 6000); properties(b, 6000);
    } finally { result?.delete(); a.delete(); b.delete(); }
  });
}

test('invalid dimensions, missing picks, non-solid inputs and empty booleans fail without consuming originals', () => {
  const a = box(), b = box([20, 30, 40], [100, 0, 0]);
  const wire = sketchToWire(oc, 'XY', [{ type: 'rectangle', corner: [0, 0], width: 2, height: 3 }]);
  const refs = enumerateEdgeRefs(oc, a);
  try {
    for (const radius of [0, -1, NaN, Infinity]) {
      assert.throws(() => applyFillet(oc, a, refs, [verticalEdge(refs)], radius), /radius must be positive/);
      assert.throws(() => applyChamfer(oc, a, refs, [verticalEdge(refs)], radius), /size must be positive/);
    }
    assert.throws(() => applyFillet(oc, a, refs, ['deleted-edge'], 2), /edge-not-found/);
    assert.throws(() => applyChamfer(oc, a, refs, ['deleted-edge'], 2), /edge-not-found/);
    assert.throws(() => extrude(oc, wire, 'XY', 0, 'forward'), /depth must be positive/);
    assert.throws(() => revolve(oc, wire, 'Y', 361), /angle must be in/);
    assert.throws(() => applyBoolean(oc, [a, wire], { type: 'union' }), /invalid-input-not-solid/);
    assert.throws(() => applyBoolean(oc, [a, b], { type: 'intersect' }), /empty-result/);
    assert.throws(() => applyBoolean(oc, [a, a], { type: 'subtract' }), /empty-result/);
    properties(a, 24000); properties(b, 24000);
  } finally { disposeRefMap(refs); wire.delete(); a.delete(); b.delete(); }
});
