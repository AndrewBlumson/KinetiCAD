// Run from the repository root with the shared TypeScript loader:
// node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-clearance.mjs
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadGeometryKernel, rebuildPart, transformed, intersectionVolume, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';

const root = new URL('../../../', import.meta.url);
const fixturePath = 'artifacts/kineticad/public/demos/material-studio.json';
const fixtureText = readFileSync(new URL(fixturePath, root), 'utf8');
const source = JSON.parse(fixtureText).state;
const measurementText = readFileSync(new URL('docs/material-force-results.json', root), 'utf8');
const measurements = JSON.parse(measurementText);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(measurements.passed, true, 'Run the actual-CAD force verification first.');
assert.equal(measurements.fixtureSha256, sha256(fixtureText), 'Force measurements are stale for the current material fixture.');
assert.equal(measurements.physicsWorkerSha256, sha256(readFileSync(new URL('artifacts/kineticad/src/physics/physicsWorker.ts', root))), 'Force measurements are stale for the current worker.');
const run = measurements.runs.find((candidate) => candidate.name === 'configured-force-60Hz');
assert.equal(run.forceN, 0.001);
assert.equal(run.actualDurationMs, 2000);
assert.deepEqual(source.simulation.forceExperiment.direction, [0, 1, 0]);
const parts = source.assembly.parts;
const groundIndex = parts.findIndex((part) => part.id === source.assembly.groundPartId);
assert.equal(groundIndex, 0);
assert.equal(parts.length, 9);
const ground = parts[groundIndex];
assert.equal(ground.features.length, 10, 'Expected the bed and its nine continuous straight rails.');
const rectangleFor = (feature) => {
  assert.equal(feature.type, 'extrude');
  assert.equal(feature.direction, 'forward');
  const sketch = ground.sketches.find((candidate) => candidate.id === feature.sketchId);
  assert.equal(sketch.plane, 'XY');
  assert.equal(sketch.primitives.length, 1);
  const rectangle = sketch.primitives[0];
  assert.equal(rectangle.type, 'rectangle');
  return rectangle;
};
const bed = rectangleFor(ground.features[0]);
assert.deepEqual({ corner: bed.corner, width: bed.width, height: bed.height, depth: ground.features[0].depthMm }, { corner: [-164, -132], width: 328, height: 264, depth: 6 });
const rails = ground.features.slice(1).map((feature, i) => {
  const rectangle = rectangleFor(feature);
  assert.deepEqual({ corner: rectangle.corner, width: rectangle.width, height: rectangle.height, depth: feature.depthMm }, { corner: [-162 + 40 * i, -126], width: 4, height: 252, depth: 8 });
  return { minX: rectangle.corner[0], maxX: rectangle.corner[0] + rectangle.width, minY: rectangle.corner[1], maxY: rectangle.corner[1] + rectangle.height };
});
for (const part of parts) assert.deepEqual(part.transform.rotationDeg, [0, 0, 0], 'Straight translation envelope requires the fixture identity orientations.');
const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const overlapToleranceMm3 = 1e-5;
const coordinateToleranceMm = 1e-5;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  method: 'Exact OCCT B-rep intersection volumes for every pair at the initial pose and the measured 1 mN, 2 s final pose. Separate interval containment verifies the bounded straight-Y travel corridor between these poses. This is geometric interference verification; contact forces are disabled in the simulation.',
  fixturePath, fixtureSha256: sha256(fixtureText),
  forceMeasurementReportSha256: sha256(measurementText),
  physicsWorkerSha256: measurements.physicsWorkerSha256,
  overlapToleranceMm3, coordinateToleranceMm,
  bed: { minX: -164, maxX: 164, minY: -132, maxY: 132, surfaceZ: 6 },
  rails,
  finalPoseSource: 'Initial fixture transform plus measured Y displacement from configured-force-60Hz. The force report verifies zero off-axis translation and rotation at every solver step.',
  solids: [], poses: [], travelCorridors: [],
  totalPairChecks: 0, maxIntersectionVolumeMm3: 0,
};
const oc = await loadGeometryKernel();
const shapes = [];
function bounds(shape) {
  const box = new oc.Bnd_Box_1();
  let minimum, maximum;
  try {
    oc.BRepBndLib.Add(shape, box, false);
    minimum = box.CornerMin(); maximum = box.CornerMax();
    return { min: [minimum.X(), minimum.Y(), minimum.Z()], max: [maximum.X(), maximum.Y(), maximum.Z()] };
  } finally { minimum?.delete(); maximum?.delete(); box.delete(); }
}
try {
  for (const part of parts) {
    const shape = rebuildPart(oc, part);
    shapes.push(shape);
    const solid = validateSolid(oc, shape);
    assert.ok(solid.valid && solid.solids === 1 && solid.volumeMm3 > 0, `${part.id}: invalid CAD solid`);
    report.solids.push({ partId: part.id, ...solid, localBoundsMm: bounds(shape) });
  }
  for (const phase of ['initial', 'measured-final']) {
    const placed = [];
    const positions = [];
    try {
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        const position = [...part.transform.positionMm];
        if (index !== groundIndex) {
          const reading = run.samples[part.id];
          assert.ok(reading, `Missing actual force measurement for ${part.id}`);
          assert.equal(reading.maxOffAxisPositionMm, 0);
          assert.equal(reading.maxQuaternionDifference, 0);
          if (phase === 'measured-final') position[1] += reading.snapshots.at(-1).measuredDisplacementMm;
        }
        positions.push(position);
        placed.push(transformed(oc, shapes[index], identity, position));
      }
      const checks = [];
      for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
        const volumeMm3 = intersectionVolume(oc, placed[a], placed[b]);
        checks.push({ partA: parts[a].id, partB: parts[b].id, intersectionVolumeMm3: volumeMm3 });
        report.totalPairChecks++;
        report.maxIntersectionVolumeMm3 = Math.max(report.maxIntersectionVolumeMm3, volumeMm3);
        check(volumeMm3 <= overlapToleranceMm3, `${phase}: ${parts[a].id}/${parts[b].id} intersects by ${volumeMm3} mm³`);
      }
      report.poses.push({ phase, positions: Object.fromEntries(parts.map((part, i) => [part.id, positions[i]])), checks });
      console.log(`Material clearance ${phase}: ${checks.length} exact B-rep pair checks`);
    } finally { placed.forEach((shape) => shape.delete()); }
  }
  // The tested samples move monotonically only along Y. The rails have
  // constant rectangular cross-sections over their entire run. Their complete
  // travel envelopes can therefore be checked by coordinate intervals.
  for (let index = 1; index < parts.length; index++) {
    const part = parts[index];
    const local = report.solids[index].localBoundsMm;
    const reading = run.samples[part.id];
    const final = reading.snapshots.at(-1);
    assert.ok(reading.maxVelocityRelativeError < 1, 'The force report must establish positive Y velocity.');
    assert.ok(reading.maxPositionBoundRatio <= 1, 'The numerical trajectory must satisfy its conservative integration bound.');
    const start = part.transform.positionMm;
    const leftRail = rails[index - 1], rightRail = rails[index];
    const maximumTravelMm = final.expectedDisplacementMm + final.positionErrorBoundMm;
    const envelope = {
      min: [start[0] + local.min[0], start[1] + local.min[1], start[2] + local.min[2]],
      max: [start[0] + local.max[0], start[1] + maximumTravelMm + local.max[1], start[2] + local.max[2]],
    };
    const clearances = {
      leftRailMm: envelope.min[0] - leftRail.maxX,
      rightRailMm: rightRail.minX - envelope.max[0],
      railStartMm: envelope.min[1] - Math.max(leftRail.minY, rightRail.minY),
      railEndMm: Math.min(leftRail.maxY, rightRail.maxY) - envelope.max[1],
      bedLeftMm: envelope.min[0] - report.bed.minX,
      bedRightMm: report.bed.maxX - envelope.max[0],
      bedStartMm: envelope.min[1] - report.bed.minY,
      bedEndMm: report.bed.maxY - envelope.max[1],
      bedSurfaceMm: envelope.min[2] - report.bed.surfaceZ,
    };
    for (const [name, gap] of Object.entries(clearances)) check(gap >= -coordinateToleranceMm, `${part.id}: conservative travel envelope violates ${name} (${gap} mm)`);
    check(clearances.leftRailMm >= 4 - coordinateToleranceMm && clearances.rightRailMm >= 4 - coordinateToleranceMm, `${part.id}: less than 4 mm lateral rail clearance`);
    report.travelCorridors.push({ partId: part.id, maximumTravelMm, measuredFinalTravelMm: final.measuredDisplacementMm, conservativeEnvelopeMm: envelope, clearances });
  }
  report.minimumSampleLaneSeparationMm = Infinity;
  for (let a = 0; a < report.travelCorridors.length; a++) for (let b = a + 1; b < report.travelCorridors.length; b++) {
    const left = report.travelCorridors[a], right = report.travelCorridors[b];
    const gap = right.conservativeEnvelopeMm.min[0] - left.conservativeEnvelopeMm.max[0];
    report.minimumSampleLaneSeparationMm = Math.min(report.minimumSampleLaneSeparationMm, gap);
    check(gap >= -coordinateToleranceMm, `${left.partId}/${right.partId}: swept lane envelopes overlap in X`);
  }
} finally { shapes.forEach((shape) => shape.delete()); }
assert.equal(report.totalPairChecks, 72);
report.failures = failures;
report.passed = failures.length === 0;
writeFileSync(new URL('docs/material-clearance-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, pairChecks: report.totalPairChecks, maxIntersectionVolumeMm3: report.maxIntersectionVolumeMm3, minimumSampleLaneSeparationMm: report.minimumSampleLaneSeparationMm, failures, report: 'docs/material-clearance-results.json' }, null, 2));
if (failures.length) process.exitCode = 1;
