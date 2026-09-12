import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { buildStewartPlatformDemo, STEWART_DEFAULTS } from '../../../scripts/src/stewart-platform-demo.mjs';
import { analyseStewartPose, certifyStewartWorkspace, certifyStewartMotion, poseAtProgress, stewartPoseTransforms, WORKSPACE_LIMITS } from '../../../scripts/src/stewart-workspace-audit.mjs';

const matrixPoint = (matrix, p) => [0, 1, 2].map((i) => matrix[i * 3] * p[0] + matrix[i * 3 + 1] * p[1] + matrix[i * 3 + 2] * p[2]);
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8, `${a} != ${b}`));
const target = { translationMm: [4, -3, 4], rotationDeg: [1.5, -1, 2] };

test('the entire ±5 mm / ±2° pose box is enclosed with no unresolved cells', () => {
  const report = certifyStewartWorkspace();
  assert.equal(report.certified, true);
  assert.deepEqual(report.unresolvedCells, []);
  assert.ok(report.acceptedCells > 1, 'must subdivide, not relabel corner samples as an enclosure');
  assert.ok(report.minStrokeBoundMm >= -12 && report.maxStrokeBoundMm <= 20);
  assert.ok(report.minCapsuleGapBoundMm > 8);
  assert.ok(report.minPlateNeckGapBoundMm > 1.8);
  assert.ok(report.maxRelativeBearingBoundDeg <= 8);
  assert.ok(report.maxJacobianConditionBound < 100);
  assert.ok(STEWART_DEFAULTS.initialRodInsertionMm - report.maxStrokeBoundMm > 12);
  assert.ok(STEWART_DEFAULTS.barrelLengthMm - STEWART_DEFAULTS.initialRodInsertionMm + report.minStrokeBoundMm > 16);
});

test('insufficient subdivision and an enlarged unsafe range fail explicitly', () => {
  assert.equal(certifyStewartWorkspace(WORKSPACE_LIMITS, 0).certified, false);
  assert.equal(certifyStewartWorkspace({ ...WORKSPACE_LIMITS, translationMm: 30 }, 6).certified, false);
});

test('independent Rodrigues progress matches exact quaternion axis-angle interpolation at intermediate poses', () => {
  const q = new Quaternion().setFromEuler(new Euler(...target.rotationDeg.map((v) => v * Math.PI / 180), 'XYZ'));
  for (const s of [0, 0.1, 0.3, 0.7, 1]) {
    const pose = poseAtProgress(target, s);
    // Three's convenience slerp switches to normalized lerp for small angles.
    // The controller deliberately uses exact angular progress, so compare to
    // its independent axis-angle definition, not that fast approximation.
    const theta = 2 * Math.acos(q.w);
    const axis = theta < 1e-9 ? new Vector3(0, 0, 1) : new Vector3(q.x, q.y, q.z).normalize();
    const expected = new Quaternion().setFromAxisAngle(axis, theta * s);
    for (const p of [[75, 0, 0], [0, 75, 0], [0, 0, 1], [17, -33, 41]]) {
      near(matrixPoint(pose.rotationMatrix, p), new Vector3(...p).applyQuaternion(expected).toArray());
    }
    near(pose.translationMm, target.translationMm.map((v) => v * s));
  }
});

test('all 64 extreme home-to-target paths are enclosed between progress samples', () => {
  for (let bits = 0; bits < 64; bits++) {
    const target = { translationMm: [0, 1, 2].map((i) => bits & (1 << i) ? 5 : -5), rotationDeg: [3, 4, 5].map((i) => bits & (1 << i) ? 2 : -2) };
    const report = certifyStewartMotion(target);
    assert.equal(report.certified, true, JSON.stringify({ target, failures: report.failures }));
    assert.ok(report.maxActuatorSpeedBoundMmPerSec < 8);
  }
});

test('exact target solid placements close spherical endpoints and encode independent rod extension', () => {
  const source = buildStewartPlatformDemo().state.assembly;
  const transforms = new Map(stewartPoseTransforms(target).map((tx) => [tx.partId, tx]));
  const point = (id, local) => {
    const tx = transforms.get(id);
    return matrixPoint(tx.rotationMatrix, local).map((v, i) => v + tx.positionMm[i]);
  };
  for (const mate of source.mates.filter((m) => m.type === 'spherical')) near(point(mate.partA, mate.pivotA.localPoint), point(mate.partB, mate.pivotB.localPoint));
  const result = analyseStewartPose(target);
  for (let i = 1; i <= 6; i++) {
    const tx = transforms.get(`stewart-barrel-${i}`), rod = transforms.get(`stewart-rod-${i}`);
    const displacement = rod.positionMm.map((v, j) => v - tx.positionMm[j]);
    near(displacement, result.legs[i - 1].direction.map((v) => v * result.legs[i - 1].extensionMm));
    const m = new Matrix4().set(...[0, 1, 2].flatMap((r) => [...tx.rotationMatrix.slice(r * 3, r * 3 + 3), 0]), 0, 0, 0, 1);
    assert.ok(Math.abs(m.determinant() - 1) < 1e-10);
  }
});
