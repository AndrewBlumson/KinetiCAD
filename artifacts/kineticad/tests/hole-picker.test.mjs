// Exercise the shipped canvas event handler, Three raycasting and the exact
// selection consumer used by HoleInspector; no renderer or CAD kernel needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStore } from 'zustand/vanilla';
import { createTopologyPicker } from '../src/three/TopologyPicker.ts';
import { consumeHoleSelection, clearHoleFace } from '../src/components/inspectors/holeSelection.ts';

const near = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8, `${actual} != ${expected}`));
function fixture(position = [0, 0, 0], rotationDeg = [0, 0, 0]) {
  const previousWindow = globalThis.window;
  const windowTarget = new EventTarget();
  Object.assign(windowTarget, { innerWidth: 1000, innerHeight: 1000 });
  globalThis.window = windowTarget;
  const canvas = new EventTarget();
  Object.assign(canvas, { clientWidth: 1000, clientHeight: 1000, getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 5), new THREE.MeshBasicMaterial());
  mesh.position.fromArray(position);
  mesh.rotation.set(...rotationDeg.map(value => value * Math.PI / 180), 'XYZ');
  mesh.updateMatrixWorld(true);
  const faces = [
    { id: 'top', type: 'plane', planeBasis: { origin: [0, 0, 2.5], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } },
    { id: 'bottom', type: 'plane', planeBasis: { origin: [0, 0, -2.5], u: [1, 0, 0], v: [0, -1, 0], normal: [0, 0, -1] } },
    { id: 'side', type: 'plane', planeBasis: null },
  ];
  const geometry = mesh.geometry, normals = geometry.getAttribute('normal'), index = geometry.getIndex();
  const faceForTriangle = Uint32Array.from({ length: index.count / 3 }, (_, i) => {
    const z = normals.getZ(index.getX(i * 3)); return z > 0.9 ? 0 : z < -0.9 ? 1 : 2;
  });
  const topology = { faces, edges: [], faceForTriangle };
  const layer = { forEachVisible: callback => callback('block', mesh, topology), getPartTopology: () => topology, getPartMesh: () => mesh };
  const camera = new THREE.OrthographicCamera(-25, 25, 25, -25, 0.1, 1000);
  const aim = faceId => {
    const face = faces.find(item => item.id === faceId), centre = mesh.localToWorld(new THREE.Vector3(...face.planeBasis.origin));
    const normal = new THREE.Vector3(...face.planeBasis.normal).transformDirection(mesh.matrixWorld);
    camera.position.copy(centre).addScaledVector(normal, 100);
    camera.up.copy(new THREE.Vector3(...face.planeBasis.v).transformDirection(mesh.matrixWorld));
    camera.lookAt(centre); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  };
  const store = createStore(set => ({
    pickingMode: 'point-on-face', pickFilter: null, selection: null,
    featureEditor: { open: true, type: 'hole', mode: 'create', partId: 'block', params: { targetFace: null, positionUV: null, diameterMm: 3, depthMm: 0 } },
    setFeatureEditorHoleParams: params => set(state => ({ featureEditor: { ...state.featureEditor, params } })),
    selectFace: (partId, faceId) => set({ selection: { kind: 'face', partId, faceId } }),
    selectPointOnFace: (partId, faceId, uv) => set({ selection: { kind: 'point-on-face', partId, faceId, uv } }),
    clearSelection: () => set({ selection: null }),
  }));
  const unsubscribe = store.subscribe((state, previous) => { if (state.selection !== previous.selection) consumeHoleSelection(state); });
  const picker = createTopologyPicker({ domElement: canvas, camera, partMeshLayer: layer, store, edgeLayer: { setHover() {} }, faceLayer: { setHover() {} } });
  const click = localPoint => {
    const point = mesh.localToWorld(new THREE.Vector3(...localPoint)).project(camera);
    const properties = { button: 0, clientX: (point.x + 1) * 500, clientY: (1 - point.y) * 500, shiftKey: false };
    canvas.dispatchEvent(Object.assign(new Event('mousedown'), properties));
    windowTarget.dispatchEvent(Object.assign(new Event('mouseup'), properties));
  };
  return { store, aim, click, dispose() { picker.dispose(); unsubscribe(); mesh.geometry.dispose(); mesh.material.dispose(); globalThis.window = previousWindow; } };
}

for (const frame of [
  { name: 'untransformed', position: [0, 0, 0], rotation: [0, 0, 0] },
  { name: 'translated with mixed XYZ rotation', position: [43, -17, 91], rotation: [23, -37, 61] },
]) for (const face of [
  { id: 'top', point: [4, -3, 2.5], uv: [4, -3] },
  { id: 'bottom', point: [4, -3, -2.5], uv: [4, 3] },
]) test(`two real canvas clicks set Hole UV on the ${face.id} face of an ${frame.name} solid`, () => {
  const h = fixture(frame.position, frame.rotation);
  try {
    h.aim(face.id); h.click(face.point);
    assert.equal(h.store.getState().featureEditor.params.targetFace, face.id);
    assert.equal(h.store.getState().featureEditor.params.positionUV, null);
    assert.equal(h.store.getState().selection?.kind, 'face', 'the inspector must retain the first pick until the point click');
    h.click(face.point);
    near(h.store.getState().featureEditor.params.positionUV, face.uv);
    assert.equal(h.store.getState().selection, null, 'the completed point pick is consumed');
  } finally { h.dispose(); }
});

test('Clear face and a changed face both restart the Hole picker without stale UV', () => {
  const h = fixture();
  try {
    h.aim('top'); h.click([1, 2, 2.5]);
    clearHoleFace(h.store.getState());
    assert.equal(h.store.getState().selection, null);
    assert.equal(h.store.getState().featureEditor.params.targetFace, null);
    h.click([1, 2, 2.5]);
    assert.equal(h.store.getState().featureEditor.params.positionUV, null);
    h.aim('bottom'); h.click([2, 3, -2.5]);
    assert.equal(h.store.getState().featureEditor.params.targetFace, 'bottom');
    assert.equal(h.store.getState().featureEditor.params.positionUV, null);
    h.click([2, 3, -2.5]);
    near(h.store.getState().featureEditor.params.positionUV, [2, -3]);
    clearHoleFace(h.store.getState());
    assert.equal(h.store.getState().featureEditor.params.positionUV, null);
  } finally { h.dispose(); }
});
