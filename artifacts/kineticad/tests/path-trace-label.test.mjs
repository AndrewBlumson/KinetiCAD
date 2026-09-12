import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFourBarTraceLabel } from '../src/three/FourBarTraceLabel.ts';
import { createFourBarDocument } from '../src/mechanisms/fourBarWorkspace.ts';
import { FOUR_BAR_IDS } from '../src/mechanisms/fourBarAssembly.ts';
import { independentFourBarParams as params } from './helpers/four-bar-reference.mjs';

// Real Three.js matrices plus a controlled DOM. These checks establish the
// annotation's data/projection boundary, not rendered-browser appearance.
function element() {
  return { style: {}, attributes: {}, children: [], parent: null,
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); child.parent = this; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; },
  };
}

function fixture(t) {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: element };
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  const container = element(), overlay = createFourBarTraceLabel(container), label = container.children[0];
  const design = { kind: 'four-bar-path', version: 1, params: structuredClone(params),
    targetPathMm: [[-30, -20], [30, -20], [30, 20], [-30, 20], [-30, -20]], search: { algorithmVersion: 1, seed: 42 } };
  const { assembly, simulation } = createFourBarDocument(design).state;
  const camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 1, 2000);
  camera.position.set(0, 0, 500); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const mesh = new THREE.Object3D();
  const meshFor = id => { assert.equal(id, FOUR_BAR_IDS.coupler); return mesh; };
  const update = (patch = {}) => overlay.update(patch.assembly ?? assembly, patch.simulation ?? simulation,
    camera, patch.meshFor ?? meshFor);
  t.after(() => overlay.dispose());
  return { container, overlay, label, assembly, simulation, camera, mesh, update };
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
}
const readPercent = (label, key) => { assert.match(label.style[key], /%$/); return Number.parseFloat(label.style[key]); };

test('trace label uses the actual coupler and ancestor matrices instead of a predicted or saved pose', t => {
  const f = fixture(t), parent = new THREE.Group();
  const [u, v] = f.simulation.fourBar.params.couplerPointLocalMm;
  parent.position.set(-20, 30, 4); parent.rotation.z = Math.PI / 2;
  f.mesh.position.set(100, -40, 60); f.mesh.rotation.z = Math.PI / 2; parent.add(f.mesh);
  const before = { position: f.mesh.position.toArray(), rotation: f.mesh.quaternion.toArray(), simulation: structuredClone(f.simulation) };
  f.update();
  // Two independent scalar 90-degree rotations, followed by their translations.
  near(readPercent(f.label, 'left'), 50 + (20 - u) / 4);
  near(readPercent(f.label, 'top'), 50 - (130 - v) / 4);
  assert.equal(f.label.style.visibility, 'visible');
  assert.equal(f.label.textContent, 'Trace point'); assert.equal(f.label.attributes['aria-hidden'], 'true');
  assert.equal(f.label.style.pointerEvents, 'none');
  f.mesh.position.x += 32; f.update();
  near(readPercent(f.label, 'left'), 50 + (20 - u) / 4);
  near(readPercent(f.label, 'top'), 50 - (162 - v) / 4);
  assert.deepEqual(f.mesh.quaternion.toArray(), before.rotation);
  assert.deepEqual(f.simulation, before.simulation, 'projection never writes simulated state');
  assert.deepEqual(f.mesh.position.toArray(), [before.position[0] + 32, ...before.position.slice(1)], 'projection never drives mesh motion');
  parent.position.set(0, 0, 0); parent.rotation.set(0, 0, 0);
  f.mesh.position.set(0, 0, 0); f.mesh.rotation.set(Math.PI / 2, 0, 0); f.update();
  near(readPercent(f.label, 'left'), 50 + u / 4);
  // Authored plate spans local Z 0..6 mm; its material marker is at local Z=3.
  // A 90-degree X rotation moves that offset to world Y=-3, not the origin.
  near(readPercent(f.label, 'top'), 50 + 3 / 4);
});

test('trace projection refreshes a camera moved since the previous rendered frame', t => {
  const f = fixture(t), [u] = f.simulation.fourBar.params.couplerPointLocalMm;
  f.update(); near(readPercent(f.label, 'left'), 50 + u / 4);
  f.camera.position.x = 40; // Renderer has not refreshed matrixWorldInverse yet.
  f.update(); near(readPercent(f.label, 'left'), 50 + (u - 40) / 4);
});

test('trace annotation hides on missing meshes, clipped depth and invalidated geometry or experiment configuration', t => {
  const f = fixture(t);
  f.update(); assert.equal(f.label.style.visibility, 'visible');
  f.update({ meshFor: () => null }); assert.equal(f.label.style.visibility, 'hidden');
  f.mesh.position.z = 700; f.update(); assert.equal(f.label.style.visibility, 'hidden');
  f.mesh.position.z = 0; f.update(); assert.equal(f.label.style.visibility, 'visible');
  const edited = structuredClone(f.assembly); edited.parts[2].transform.positionMm[0] += 1;
  f.update({ assembly: edited }); assert.equal(f.label.style.visibility, 'hidden');
  f.update(); assert.equal(f.label.style.visibility, 'visible');
  for (const patch of [{ fourBar: undefined }, { gravity: [0, 0, -9810] }, { sketchGeometryEdited: true }, { durationMs: 8000 }]) {
    f.update({ simulation: { ...f.simulation, ...patch } }); assert.equal(f.label.style.visibility, 'hidden');
    f.update(); assert.equal(f.label.style.visibility, 'visible');
  }
});

test('trace annotation holds a paused material point and releases its own DOM node on disposal', t => {
  const f = fixture(t);
  f.mesh.position.set(10, -20, 54); f.update();
  const held = [f.label.style.left, f.label.style.top];
  f.update({ simulation: { ...f.simulation, running: true, paused: true, simulationTimeMs: 3000 } });
  assert.deepEqual([f.label.style.left, f.label.style.top], held);
  assert.equal(f.label.style.visibility, 'visible');
  assert.equal(f.container.children.length, 1);
  f.overlay.dispose(); f.overlay.dispose();
  assert.deepEqual(f.container.children, []);
});
