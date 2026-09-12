import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCrankSliderCad, crankSliderCadCases, crankSliderCadSourceSha256 } from './helpers/crank-slider-cad.mjs';
import { transformed, intersectionVolume } from '../../../scripts/src/verify-demo-geometry.mjs';
import { buildCrankSliderAssembly } from '../src/mechanisms/crankSlider.ts';

test('all domain vertices and the default produce four exact valid CAD solids with no sampled interference', async () => {
  const report = { sourceSha256: crankSliderCadSourceSha256, generatedAt: new Date().toISOString(), cases: [], overlapToleranceMm3: 1e-5 };
  for (const params of crankSliderCadCases) {
    const fixture = await loadCrankSliderCad(params, { keepShapes: true });
    const { oc, shapes } = fixture;
    const result = { params, solids: fixture.solids, poses: 0, pairChecks: 0, maxIntersectionMm3: 0 };
    try {
      for (let i = 0; i < 24; i++) {
        const theta = 2 * Math.PI * i / 24, r = params.radiusMm, l = params.rodLengthMm;
        const pin = [r * Math.cos(theta), r * Math.sin(theta)], horizontal = Math.sqrt(l * l - pin[1] ** 2);
        const angles = [0, theta, Math.atan2(-pin[1], horizontal), 0];
        const positions = [[0, 0, 0], [0, 0, 30], [...pin, 39], [pin[0] + horizontal, 0, 20]];
        const world = [];
        try {
          for (let j = 0; j < shapes.length; j++) {
            const c = Math.cos(angles[j]), s = Math.sin(angles[j]);
            world.push(transformed(oc, shapes[j], [c, -s, 0, s, c, 0, 0, 0, 1], positions[j]));
          }
          for (let a = 0; a < world.length; a++) for (let b = a + 1; b < world.length; b++) {
            const overlap = intersectionVolume(oc, world[a], world[b]);
            result.pairChecks++; result.maxIntersectionMm3 = Math.max(result.maxIntersectionMm3, overlap);
            assert(overlap <= report.overlapToleranceMm3, `${JSON.stringify(params)} angle${i * 15}: ${fixture.assembly.parts[a].id}/${fixture.assembly.parts[b].id} overlap ${overlap}mm³`);
          }
          result.poses++;
        } finally { world.forEach(shape => shape.delete()); }
      }
      report.cases.push(result);
      console.log(JSON.stringify(result));
    } finally { shapes.forEach(shape => shape.delete()); }
  }
  report.passed = true;
  writeFileSync(join(tmpdir(), 'kineticad-crank-slider-geometry-results.json'), JSON.stringify(report, null, 2) + '\n');
});

test('continuous rigid-geometry clearances hold across the admitted parameter domain', () => {
  // Read dimensions from the actual authored feature profiles. XY separation
  // bounds are affine in R/L, so their extrema lie on the five domain vertices;
  // z-slabs and coaxial clearances are constant. This is rigid geometry only.
  const profile = (part, name) => {
    const sketch = part.sketches.find(s => s.name.startsWith(name));
    assert(sketch, `missing ${name}`);
    return { primitive: sketch.primitives[0], feature: part.features.find(f => f.sketchId === sketch.id) };
  };
  for (const params of crankSliderCadCases) {
    const [ground, crank, rod, slider] = buildCrankSliderAssembly(params).parts;
    const boss = profile(crank, 'Outer crank boss'), rail = profile(ground, 'Raised linear guide rail');
    const crankRadius = Math.hypot(...boss.primitive.centre) + boss.primitive.radius;
    assert(rail.primitive.corner[0] - crankRadius >= 2, 'crank swept envelope to raised rail');
    const block = profile(slider, 'Slider block stock'), rodStrap = profile(rod, 'Connecting strap');
    const minSliderX = params.rodLengthMm - params.radiusMm + block.primitive.corner[0];
    assert(minSliderX - crankRadius >= 8, 'crank swept envelope to slider');
    assert(rod.transform.positionMm[2] - (crank.transform.positionMm[2] + boss.feature.depthMm / 2) >= 6);
    assert(rod.transform.positionMm[2] - (slider.transform.positionMm[2] + block.primitive.corner[1] + block.primitive.height) >= 3);
    assert(rod.transform.positionMm[2] - rail.feature.depthMm >= 11);
    assert(crank.transform.positionMm[2] - boss.feature.depthMm / 2 - profile(ground, 'Spindle bearing pedestal').feature.depthMm >= 3);
    assert(crank.transform.positionMm[2] - profile(crank, 'Main spindle').feature.depthMm - profile(ground, 'Continuous steel bed').feature.depthMm >= 2);
    assert(profile(rod, 'Pin bore').primitive.radius - profile(crank, 'Connecting pin').primitive.radius >= 0.5);
    assert(profile(rod, 'Pin bore').primitive.radius - profile(slider, 'Connecting pin').primitive.radius >= 0.5);
    assert(profile(ground, 'Spindle bore').primitive.radius - profile(crank, 'Main spindle').primitive.radius >= 0.5);
    const groove = profile(slider, 'Open guide groove');
    assert(slider.transform.positionMm[2] + groove.primitive.corner[1] + groove.primitive.height - rail.feature.depthMm >= 0.5);
    assert((groove.primitive.width - rail.primitive.height) / 2 >= 0.5);
    assert(minSliderX - rail.primitive.corner[0] >= 6);
    assert(rail.primitive.corner[0] + rail.primitive.width - (params.rodLengthMm + params.radiusMm + block.primitive.corner[0] + block.primitive.width) >= 6);
    assert(rodStrap.feature.depthMm > 0);
  }
});
