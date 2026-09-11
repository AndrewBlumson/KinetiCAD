import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createFinishedSketchesLayer } from '../src/sketch/finishedSketchesLayer.ts';
import { createMateVisualizer } from '../src/three/MateVisualizer.ts';

const near = (actual, expected) => actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]) < 1e-9, `${actual} differs from ${expected}`));
const add = (a, b) => a.map((n, i) => n + b[i]);
// Independent scalar reference: intrinsic XYZ Euler = R_x R_y R_z.
function rotate(point, degrees) {
  const [a, b, c] = degrees.map((d) => d * Math.PI / 180);
  const [x, y, z] = point;
  const x1 = Math.cos(c) * x - Math.sin(c) * y;
  const y1 = Math.sin(c) * x + Math.cos(c) * y;
  const x2 = Math.cos(b) * x1 + Math.sin(b) * z;
  const z2 = -Math.sin(b) * x1 + Math.cos(b) * z;
  return [x2, Math.cos(a) * y1 - Math.sin(a) * z2, Math.sin(a) * y1 + Math.cos(a) * z2];
}
const part = (id = 'part-a') => ({
  id, name: id, visible: true, materialId: 'steel-mild',
  transform: { positionMm: [17, -9, 98], rotationDeg: [23, -37, 61] },
  sketches: [{ id: 'profile', name: 'Profile', plane: 'XY', primitives: [{ type: 'circle', centre: [4, -2], radius: 12 }] }],
  features: [{ id: 'extrude', type: 'extrude', sketchId: 'profile', depthMm: 10, direction: 'forward', extrudeMode: 'new-body' }],
});
const assembly = (p, mates = []) => ({ id: 'assembly', name: 'Assembly', parts: [p], mates, booleanFeatures: [], groundPartId: p.id });
const layer = {
  topologyVersion: () => 1,
  getPartTopology: () => ({ faces: [{ id: 'face', centroid: [101, 202, 303], normalAtCentroid: [0, 0, 1] }], edges: [] }),
};

test('finished sketches follow arbitrary part transforms, including changes without geometry edits', () => {
  const p = part();
  const model = assembly(p);
  const overlay = createFinishedSketchesLayer({ widthPx: 1280, heightPx: 720 });
  overlay.sync(model, { partId: p.id, sketchId: 'profile' });
  const sketch = overlay.group.children[0];
  const point = [16, -2, 0]; // rightmost point of the circular XY profile
  near(sketch.localToWorld(new THREE.Vector3(...point)).toArray(), add(rotate(point, p.transform.rotationDeg), p.transform.positionMm));
  p.transform = { positionMm: [-40, 82, 135], rotationDeg: [-43, 17, 88] };
  overlay.sync(model, { partId: p.id, sketchId: 'profile' });
  assert.equal(overlay.group.children[0], sketch, 'pose edits must reuse geometry');
  near(sketch.localToWorld(new THREE.Vector3(...point)).toArray(), add(rotate(point, p.transform.rotationDeg), p.transform.positionMm));
  overlay.dispose();
});

test('consumed sketches show only when selected, unused profiles show, and hidden parts stay hidden', () => {
  const p = part();
  const model = assembly(p);
  const overlay = createFinishedSketchesLayer({ widthPx: 1280, heightPx: 720 });
  overlay.sync(model);
  assert.equal(overlay.group.children[0].visible, false);
  overlay.sync(model, { partId: p.id, sketchId: 'profile' });
  assert.equal(overlay.group.children[0].visible, true);
  p.visible = false;
  overlay.sync(model, { partId: p.id, sketchId: 'profile' });
  assert.equal(overlay.group.children[0].visible, false);
  p.visible = true;
  p.features = [];
  overlay.sync(model);
  assert.equal(overlay.group.children[0].visible, true);
  const old = overlay.group.children[0];
  p.sketches[0].plane = 'YZ';
  overlay.sync(model);
  assert.notEqual(overlay.group.children[0], old, 'plane edits must rebuild local geometry');
  overlay.dispose();
});

test('gyroscope profiles retain the assembly elevation instead of being drawn at the ground origin', () => {
  const model = JSON.parse(readFileSync(new URL('../public/demos/gyroscope.json', import.meta.url), 'utf8')).state.assembly;
  const overlay = createFinishedSketchesLayer({ widthPx: 1280, heightPx: 720 });
  const elevatedParts = model.parts.filter((p) => p.id !== model.groundPartId && p.transform.positionMm[2] > 0);
  assert.ok(elevatedParts.length >= 3, 'fixture must exercise the elevated ring/rotor profiles');
  for (const p of elevatedParts) {
    const profile = p.sketches[0];
    overlay.sync(model, { partId: p.id, sketchId: profile.id });
    const sketch = overlay.group.getObjectByName(`FinishedSketch:${profile.id}`);
    near(sketch.getWorldPosition(new THREE.Vector3()).toArray(), p.transform.positionMm);
    assert.equal(sketch.visible, true);
  }
  overlay.dispose();
});

test('joint glyph anchors and axes track moving body poses rather than static design transforms', () => {
  const p = part();
  const anchor = [8, -6, 12];
  const axis = [2 / 3, -1 / 3, 2 / 3];
  const mate = { id: 'revolute', type: 'revolute', partA: p.id, partB: 'part-b', pivotA: { kind: 'face', faceId: 'face', localPoint: anchor }, pivotB: { kind: 'face', faceId: 'other', localPoint: [0, 0, 0] }, axisLocal: axis };
  const model = assembly(p, [mate]);
  const overlay = createMateVisualizer();
  overlay.sync(model, mate.id, layer);
  const frame = overlay.group.getObjectByName('mate:revolute');
  const glyph = frame.children[0];
  near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), add(rotate(anchor, p.transform.rotationDeg), p.transform.positionMm));
  const geometry = glyph.geometry;
  const body = new THREE.Object3D();
  const parent = new THREE.Group();
  parent.position.set(9, -3, 21);
  parent.rotation.z = Math.PI / 2;
  parent.add(body);
  for (let i = 0; i < 12; i++) {
    const degrees = [13 + i * 17, -41 + i * 7, 83 - i * 11];
    const position = [31 + i, -11 + i * 2, 120 - i * 3];
    body.position.fromArray(position);
    body.rotation.set(...degrees.map((d) => d * Math.PI / 180), 'XYZ');
    overlay.sync(model, i % 2 ? mate.id : null, layer);
    overlay.updatePoses(() => body);
    const worldAnchor = add(rotate(add(rotate(anchor, degrees), position), [0, 0, 90]), [9, -3, 21]);
    near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), worldAnchor);
    const expectedAxis = rotate(rotate(axis, degrees), [0, 0, 90]);
    near(new THREE.Vector3(0, 1, 0).applyQuaternion(glyph.getWorldQuaternion(new THREE.Quaternion())).toArray(), expectedAxis);
    assert.equal(glyph.geometry, geometry, 'simulation ticks must not recreate glyph buffers');
  }
  overlay.updatePoses(() => null);
  assert.equal(frame.visible, false);
  overlay.dispose();
});

test('selection enlargement does not displace prismatic or planar anchors', () => {
  const p = part();
  for (const type of ['prismatic', 'planar']) {
    const anchor = type === 'planar' ? [101, 202, 303] : [8, -6, 12];
    const mate = { id: type, type, partA: p.id, partB: 'part-b', pivotA: { kind: 'face', faceId: 'face', localPoint: anchor }, pivotB: { kind: 'face', faceId: 'other', localPoint: [0, 0, 0] }, axisLocal: [0, 1, 0] };
    const overlay = createMateVisualizer();
    const model = assembly(p, [mate]);
    overlay.sync(model, null, layer);
    const glyph = overlay.group.getObjectByName(`mate:${type}`).children[0];
    const expected = add(rotate(anchor, p.transform.rotationDeg), p.transform.positionMm);
    near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), expected);
    overlay.sync(model, mate.id, layer);
    near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), expected);
    assert.equal(glyph.scale.x, 1.5);
    overlay.dispose();
  }
});
