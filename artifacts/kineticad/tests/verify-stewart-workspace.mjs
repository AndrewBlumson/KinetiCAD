// Pure bounds: node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-workspace.mjs
// Add --occt for serial actual B-rep spot checks (coordinate other OCCT runs).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Quaternion, Matrix4 } from 'three';
import { buildStewartPlatformDemo, STEWART_DEFAULTS } from '../../../scripts/src/stewart-platform-demo.mjs';
import { analyseStewartPose, certifyStewartWorkspace, certifyStewartMotion, stewartPoseTransforms, WORKSPACE_LIMITS } from '../../../scripts/src/stewart-workspace-audit.mjs';
import { STEWART_MOTION_PRESETS, STEWART_CONTROL_LIMITS } from '../src/physics/stewartKinematics.ts';
import { loadGeometryKernel, rebuildPart, transformed, intersectionVolume, validateSolid } from '../../../scripts/src/verify-demo-geometry.mjs';

const root = new URL('../../../', import.meta.url);
const fixturePath = 'artifacts/kineticad/public/demos/stewart-platform.json';
const fixtureBytes = readFileSync(new URL(fixturePath, root));
const assembly = JSON.parse(fixtureBytes).state.assembly;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const physicalGeometry = (part) => ({ id: part.id, sketches: part.sketches, features: part.features, transform: part.transform });
assert.deepEqual(assembly.parts.map(physicalGeometry), buildStewartPlatformDemo().state.assembly.parts.map(physicalGeometry), 'Reassess the certificate after geometry or initial-frame edits.');
assert.equal(STEWART_CONTROL_LIMITS.translationMm, WORKSPACE_LIMITS.translationMm);
assert.equal(STEWART_CONTROL_LIMITS.rotationDeg, WORKSPACE_LIMITS.rotationDeg);
assert.equal(STEWART_CONTROL_LIMITS.minStrokeMm, WORKSPACE_LIMITS.minStrokeMm);
assert.equal(STEWART_CONTROL_LIMITS.maxStrokeMm, WORKSPACE_LIMITS.maxStrokeMm);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), fixturePath, fixtureSha256: sha(fixtureBytes),
  auditSourceSha256: sha(readFileSync(new URL('scripts/src/stewart-workspace-audit.mjs', root))),
  controllerSourceSha256: sha(readFileSync(new URL('artifacts/kineticad/src/physics/stewartKinematics.ts', root))),
  method: 'Adaptive Lipschitz enclosures cover the entire six-dimensional pose box. Independent Rodrigues paths use interval enclosures between progress samples. Neumann inverse bounds certify nonsingularity and normalized infinity-norm Jacobian conditioning. Optional OCCT spots intersect every exact solid pair at selected target poses.',
  limitations: 'Ideal fixture geometry; finite floating-point arithmetic with millimetre-scale margins, not a formal interval-arithmetic proof. Geometry does not model retained bearing cartridges, seals, friction, actuator force limits or flexible material. Target-path clearance does not certify uncontrolled dynamic overshoot or arbitrary geometry edits.',
  parameters: STEWART_DEFAULTS, limits: WORKSPACE_LIMITS, workspace: certifyStewartWorkspace(),
  motionCertificates: [], cornerSamples: [], exactSpots: [], failures: [] };
if (!report.workspace.certified) report.failures.push('Workspace contains unresolved cells.');
const corners = [];
for (let bits = 0; bits < 64; bits++) {
  const target = { translationMm: [0, 1, 2].map((i) => bits & (1 << i) ? 5 : -5), rotationDeg: [3, 4, 5].map((i) => bits & (1 << i) ? 2 : -2) };
  const result = analyseStewartPose(target);
  const sample = { id: `corner-${bits}`, target, minStrokeMm: Math.min(...result.legs.map((l) => l.extensionMm)),
    maxStrokeMm: Math.max(...result.legs.map((l) => l.extensionMm)), capsuleGapMm: result.capsuleGapMm,
    maxBearingDeg: Math.max(...result.legs.flatMap((l) => [l.baseDeflectionRad, l.deckDeflectionRad])) * 180 / Math.PI };
  corners.push(sample); report.cornerSamples.push(sample);
}
for (const candidate of [...corners, ...STEWART_MOTION_PRESETS]) {
  const certificate = certifyStewartMotion(candidate.target);
  report.motionCertificates.push({ id: candidate.id, target: candidate.target, ...certificate });
  if (!certificate.certified) report.failures.push(`${candidate.id}: motion enclosure failed`);
}
const w = report.workspace;
report.additionalGeometryBounds = {
  remainingRodInsertionMm: STEWART_DEFAULTS.initialRodInsertionMm - w.maxStrokeBoundMm,
  rodBottomAboveClosedFloorMm: STEWART_DEFAULTS.barrelLengthMm - STEWART_DEFAULTS.initialRodInsertionMm + w.minStrokeBoundMm - 16,
  shaftBoreRadialClearanceMm: STEWART_DEFAULTS.boreRadiusMm - STEWART_DEFAULTS.rodRadiusMm,
  sphericalSeatRadialClearanceMm: STEWART_DEFAULTS.bearingSeatRadiusMm - STEWART_DEFAULTS.ballRadiusMm,
  plateVerticalSeparationBoundMm: STEWART_DEFAULTS.platformHeightMm - WORKSPACE_LIMITS.translationMm - STEWART_DEFAULTS.baseThicknessMm
    - STEWART_DEFAULTS.platformRadiusMm * Math.sin(3 * WORKSPACE_LIMITS.rotationDeg * Math.PI / 180),
};
assert.ok(Object.values(report.additionalGeometryBounds).every((v) => v > 0));
if (process.argv.includes('--occt')) {
  const selected = [corners.reduce((a, b) => a.minStrokeMm < b.minStrokeMm ? a : b),
    corners.reduce((a, b) => a.maxStrokeMm > b.maxStrokeMm ? a : b),
    corners.reduce((a, b) => a.maxBearingDeg > b.maxBearingDeg ? a : b),
    corners.reduce((a, b) => a.capsuleGapMm < b.capsuleGapMm ? a : b),
    ...STEWART_MOTION_PRESETS.filter((c) => ['home', 'combined'].includes(c.id))];
  const unique = [...new Map(selected.map((c) => [JSON.stringify(c.target), c])).values()];
  const measurementsBytes = readFileSync(new URL('docs/stewart-controller-results.json', root));
  const measurements = JSON.parse(measurementsBytes);
  assert.equal(measurements.passed, true, 'Actual controller verification must pass first.');
  assert.equal(measurements.fixtureSha256, report.fixtureSha256, 'Actual controller poses are stale.');
  for (const [file, hash] of Object.entries(measurements.sourceSha256)) {
    assert.equal(sha(readFileSync(new URL(`artifacts/kineticad/src/physics/${file}`, root))), hash, `Actual controller poses are stale for ${file}.`);
  }
  report.controllerMeasurementSha256 = sha(measurementsBytes);
  for (const name of ['combined', 'workspace-corner', 'roll-', 'pitch+']) {
    const measured = measurements.cases.find((c) => c.name === name);
    assert.equal(measured.finalTransforms.length, 14);
    const frames = measured.finalTransforms.map((tx) => {
      const q = new Quaternion(...tx.rotationQuat).normalize();
      const e = new Matrix4().makeRotationFromQuaternion(q).elements;
      return { partId: tx.partId, positionMm: tx.positionMm, rotationMatrix: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]] };
    });
    unique.push({ id: `measured-${name}`, target: measured.target, measuredFrames: frames });
  }
  const oc = await loadGeometryKernel(), solids = [];
  try {
    for (const part of assembly.parts) {
      const solid = rebuildPart(oc, part); solids.push(solid);
      const valid = validateSolid(oc, solid); assert.ok(valid.valid && valid.solids === 1 && valid.volumeMm3 > 0, part.id);
    }
    for (const pose of unique) {
      const frames = new Map((pose.measuredFrames ?? stewartPoseTransforms(pose.target)).map((tx) => [tx.partId, tx]));
      const placed = [], checks = [];
      try {
        assembly.parts.forEach((part, i) => { const tx = frames.get(part.id); placed.push(transformed(oc, solids[i], tx.rotationMatrix, tx.positionMm)); });
        for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
          const overlap = intersectionVolume(oc, placed[a], placed[b]);
          checks.push({ partA: assembly.parts[a].id, partB: assembly.parts[b].id, intersectionVolumeMm3: overlap });
          if (!Number.isFinite(overlap) || overlap > 1e-5) report.failures.push(`${pose.id}: ${assembly.parts[a].id}/${assembly.parts[b].id} overlap ${overlap} mm³`);
        }
        report.exactSpots.push({ id: pose.id, target: pose.target, source: pose.measuredFrames ? 'actual-controller-final' : 'geometric-target',
          measuredTransforms: pose.measuredFrames ?? null, checks });
        console.log(`Workspace OCCT ${pose.id}: ${checks.length} exact pairs`);
      } finally { placed.forEach((solid) => solid.delete()); }
    }
  } finally { solids.forEach((solid) => solid.delete()); }
}
report.passed = report.failures.length === 0;
writeFileSync(new URL('docs/stewart-workspace-results.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, workspace: report.workspace, motionCount: report.motionCertificates.length,
  exactPoseCount: report.exactSpots.length, exactPairCount: report.exactSpots.reduce((s, p) => s + p.checks.length, 0), failures: report.failures }, null, 2));
if (!report.passed) process.exitCode = 1;
