import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFourBarCad, fourBarCadCases, fourBarCadSourceSha256 } from './helpers/four-bar-cad.mjs';
import { independentFourBar } from './helpers/four-bar-reference.mjs';
import { transformed, intersectionVolume, rebuildPart } from '../../../scripts/src/verify-demo-geometry.mjs';
import { fourBarAssemblyClearances } from '../src/mechanisms/fourBarAssembly.ts';

test('seven native four-bar geometries are valid single solids with supported tracing points and zero sampled interference', async () => {
  const report = { schemaVersion: 1, sourceSha256: fourBarCadSourceSha256, generatedAt: new Date().toISOString(),
    scope: 'Six selected dimension/trace boundary cases plus one measured optimiser winner, both closure branches, twelve equally spaced input angles per branch. Continuous authored-envelope bounds are checked separately; this is not general contact simulation.',
    overlapToleranceMm3: 1e-5, cases: [] };
  for (const params of fourBarCadCases) {
    const fixture = await loadFourBarCad(params, { keepShapes: true });
    const { oc, shapes } = fixture;
    const result = { params, solids: fixture.solids, clearances: fourBarAssemblyClearances(params), poses: 0, pairChecks: 0, maxIntersectionMm3: 0 };
    try {
      const probe = rebuildPart(oc, { id: 'probe', sketches: [{ id: 'probe-sketch', name: 'probe', plane: 'XY', primitives: [{ type: 'circle', centre: params.couplerPointLocalMm, radius: 0.1 }] }], features: [{ id: 'probe-feature', type: 'extrude', sketchId: 'probe-sketch', depthMm: 6, direction: 'forward', extrudeMode: 'new-body' }] });
      try {
        result.traceProbeVolumeMm3 = intersectionVolume(oc, shapes[2], probe);
        assert(Math.abs(result.traceProbeVolumeMm3 - Math.PI * 0.1 ** 2 * 6) < 1e-7, 'the trace point is on actual connected coupler material');
      } finally { probe.delete(); }
      for (const branch of [1, -1]) for (let i = 0; i < 12; i++) {
        const state = independentFourBar({ ...params, branch }, 2 * Math.PI * i / 12), world = [];
        try {
          for (let j = 0; j < shapes.length; j++) {
            const c = Math.cos(state.angles[j]), s = Math.sin(state.angles[j]);
            world.push(transformed(oc, shapes[j], [c, -s, 0, s, c, 0, 0, 0, 1], state.positions[j]));
          }
          for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
            const overlap = intersectionVolume(oc, world[a], world[b]);
            result.pairChecks++; result.maxIntersectionMm3 = Math.max(result.maxIntersectionMm3, overlap);
            assert(overlap <= report.overlapToleranceMm3, `${JSON.stringify(params)} branch${branch} angle${i * 30}: ${a}/${b} overlap ${overlap}mm³`);
          }
          result.poses++;
        } finally { world.forEach(shape => shape.delete()); }
      }
      report.cases.push(result); console.log(JSON.stringify(result));
    } finally { shapes.forEach(shape => shape.delete()); }
  }
  report.passed = true;
  writeFileSync(join(tmpdir(), 'kineticad-four-bar-geometry-results.json'), JSON.stringify(report, null, 2) + '\n');
});
