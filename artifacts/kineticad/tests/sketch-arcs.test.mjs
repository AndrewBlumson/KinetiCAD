// node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/sketch-arcs.test.mjs
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { sketchToWire } from '../src/cad/operations/sketchToWire.ts';
import { extrude } from '../src/cad/operations/extrude.ts';
import { revolve } from '../src/cad/operations/revolve.ts';
import { computeMassProperties } from '../src/cad/operations/massProperties.ts';
import { loadGeometryKernel, rebuildPart, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';
import { buildStewartPlatformDemo } from '../../../scripts/src/stewart-platform-demo.mjs';

let oc;
before(async () => { oc = await loadGeometryKernel(); });
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const lift = (plane, [u, v]) => plane === 'XY' ? [u, v, 0] : plane === 'XZ' ? [u, 0, v] : [0, u, v];
const normals = { XY: [0, 0, 1], XZ: [0, 1, 0], YZ: [1, 0, 0] };
const line = (start, end) => ({ type: 'line', start, end });

for (const plane of ['XY', 'XZ', 'YZ']) {
  test(`${plane} arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid`, () => {
    const centre = [7, -9], radius = 11, startAngle = -0.4, endAngle = 1.1, depth = 5;
    const point = (angle) => [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
    const wire = sketchToWire(oc, plane, [
      { type: 'arc', centre, radius, startAngle, endAngle },
      line(point(endAngle), centre), line(centre, point(startAngle)),
    ]);
    let solid;
    const explorer = new oc.TopExp_Explorer_2(wire, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    try {
      let arcs = 0;
      for (; explorer.More(); explorer.Next()) {
        const shape = explorer.Current(), edge = oc.TopoDS.Edge_1(shape), curve = new oc.BRepAdaptor_Curve_2(edge);
        try {
          if (curve.GetType().value !== oc.GeomAbs_CurveType.GeomAbs_Circle.value) continue;
          arcs++;
          const t0 = curve.FirstParameter(), t1 = curve.LastParameter();
          for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
            const actual = curve.Value(t0 + fraction * (t1 - t0));
            try {
              const expected = lift(plane, point(startAngle + fraction * (endAngle - startAngle)));
              [actual.X(), actual.Y(), actual.Z()].forEach((v, i) => close(v, expected[i]));
            } finally { actual.delete(); }
          }
        } finally { curve.delete(); edge.delete(); shape.delete(); }
      }
      assert.equal(arcs, 1);
      solid = extrude(oc, wire, plane, depth, 'forward');
      const validity = validateSolid(oc, solid);
      assert.equal(validity.valid, true);
      assert.equal(validity.solids, 1);
      const props = computeMassProperties(oc, solid, 1);
      const sweep = endAngle - startAngle;
      close(props.volumeMm3, radius ** 2 * sweep * depth / 2);
      const uvCentroid = [centre[0] + 2 * radius * (Math.sin(endAngle) - Math.sin(startAngle)) / (3 * sweep),
        centre[1] + 2 * radius * (Math.cos(startAngle) - Math.cos(endAngle)) / (3 * sweep)];
      const centroid = lift(plane, uvCentroid).map((v, i) => v + normals[plane][i] * depth / 2);
      props.comLocal.forEach((v, i) => close(v, centroid[i]));
    } finally { explorer.delete(); solid?.delete(); wire.delete(); }
  });

  test(`${plane} semicircle revolves to an exact sphere about the sketch V axis`, () => {
    const radius = 6, centre = [0, 7];
    const wire = sketchToWire(oc, plane, [
      { type: 'arc', centre, radius, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 },
      line([0, centre[1] + radius], [0, centre[1] - radius]),
    ]);
    let solid;
    try {
      solid = revolve(oc, wire, plane === 'XY' ? 'Y' : 'Z', 360);
      const validity = validateSolid(oc, solid);
      assert.equal(validity.valid, true);
      assert.equal(validity.solids, 1);
      const props = computeMassProperties(oc, solid, 1);
      close(props.volumeMm3, 4 * Math.PI * radius ** 3 / 3);
      props.comLocal.forEach((v, i) => close(v, lift(plane, centre)[i]));
    } finally { solid?.delete(); wire.delete(); }
  });
}

test('both Stewart turning profiles retain exact circular ends and rebuild as single valid solids', () => {
  const parts = buildStewartPlatformDemo().state.assembly.parts;
  for (const id of ['stewart-barrel-1', 'stewart-rod-1']) {
    const part = parts.find((candidate) => candidate.id === id);
    assert.equal(part.sketches[0].primitives.filter((primitive) => primitive.type === 'arc').length, 1);
    const shape = rebuildPart(oc, part);
    try {
      const result = validateSolid(oc, shape);
      assert.equal(result.valid, true, id);
      assert.equal(result.solids, 1, id);
      assert.ok(result.volumeMm3 > 0, id);
      assert.ok(computeMassProperties(oc, shape, 1).principalInertiaKgMm2.every((v) => v > 0));
    } finally { shape.delete(); }
  }
});
