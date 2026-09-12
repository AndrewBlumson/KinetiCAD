import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import * as Comlink from 'comlink';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
import { importDurableStep, createProjectDocument, restoreProjectAssets, clearProjectAssetMemory } from '../src/project/projectAssets.ts';
import { parseProjectDocument, shapeIdForAsset } from '../src/project/projectDocument.ts';
import { clearImportedShapeCache } from '../src/cad/importedShapeCache.ts';

const fixtureBytes = () => new Uint8Array(readFileSync(new URL('./fixtures/recovery-block.step', import.meta.url)));
const identity = { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] };
function start() {
  const worker = new Worker(new URL('./helpers/cad-worker-node.mjs', import.meta.url));
  return { worker, api: Comlink.wrap(nodeEndpoint(worker)) };
}
function state(imported) {
  return { mode: 'modeller', assembly: { id: 'mixed-project', name: 'Native and STEP roundtrip', groundPartId: 'native', booleanFeatures: [],
    parts: [
      { id: 'native', name: 'Native plate', visible: true, materialId: 'steel-1018', transform: identity,
        sketches: [{ id: 'profile', name: 'Plate sketch', plane: 'XY', primitives: [{ type: 'rectangle', corner: [-30, -30], width: 60, height: 60 }] }],
        features: [{ id: 'extrude', type: 'extrude', sketchId: 'profile', depthMm: 3, direction: 'forward', extrudeMode: 'new-body' }] },
      { id: 'imported', name: 'Imported machined block', visible: true, materialId: 'brass-c36000', transform: { positionMm: [31, -17, 23], rotationDeg: [19, -37, 61] }, sketches: [], features: [{ id: 'import', type: 'imported-step', shapeId: imported.shapeId }] },
    ], mates: [{ id: 'bond', type: 'fixed', partA: 'native', partB: 'imported' }],
  }, simulation: { running: false, paused: false, simulationTimeMs: 0, gravity: [0, 0, -9810], timeStepMs: 1000 / 60, speedMultiplier: 1 } };
}
const mass = (api, part) => api.getMassProperties({ features: part.features, sketches: part.sketches, density: 8.5 });

test('actual worker restores embedded STEP after worker restart, retaining native history, transforms, topology and exportable geometry', { timeout: 120000 }, async () => {
  clearProjectAssetMemory(); clearImportedShapeCache();
  let running = start();
  try {
    await running.api.init();
    const imported = await importDurableStep(running.api, fixtureBytes(), 'recovery-block.step');
    assert.equal(imported.parts.length, 1);
    const initial = state(imported.parts[0]);
    const before = await mass(running.api, initial.assembly.parts[1]);
    assert.ok(Math.abs(before.volumeMm3 - 3717.256661176908) < 1e-6);
    const project = await createProjectDocument(initial, async () => running.api);
    const downloaded = JSON.stringify(project);
    writeFileSync(new URL('./fixtures/mixed-recovery.kineticad.json', import.meta.url), downloaded + '\n');
    // Add a real Hole feature through the imported block at [5,5,10]. Its
    // original radius-3 bore at [10,10] is disjoint from this radius-1 bore.
    const top = imported.parts[0].tessellated.faces.find((face) => face.type === 'plane' && Math.abs(face.centroid[2] - 10) < 1e-6);
    assert.ok(top?.planeBasis);
    const delta = [5, 5, 10].map((v, axis) => v - top.planeBasis.origin[axis]);
    const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    const modified = structuredClone(initial);
    modified.assembly.parts[1].features.push({ id: 'new-hole', type: 'hole', targetFace: top.id,
      positionUV: [dot(delta, top.planeBasis.u), dot(delta, top.planeBasis.v)], diameterMm: 2, depthMm: 0 });
    const modifiedMass = await mass(running.api, modified.assembly.parts[1]);
    assert.ok(Math.abs(modifiedMass.volumeMm3 - (4000 - 100 * Math.PI)) < 1e-5, 'a downstream imported-solid Hole removes the analytical cylinder volume');
    const modifiedDocument = await createProjectDocument(modified, async () => running.api);
    writeFileSync(new URL('./fixtures/modified-import-recovery.kineticad.json', import.meta.url), JSON.stringify(modifiedDocument) + '\n');
    const priorEdges = imported.parts[0].tessellated.edges.map((edge) => edge.id).sort();
    await running.worker.terminate();
    clearProjectAssetMemory(); clearImportedShapeCache();
    running = start(); await running.api.init();
    const loaded = parseProjectDocument(JSON.parse(downloaded));
    await restoreProjectAssets(loaded, running.api);
    assert.deepEqual(loaded.state, project.state);
    assert.equal(loaded.state.assembly.parts[1].features[0].shapeId, shapeIdForAsset(loaded.assets[0], 0));
    const after = await mass(running.api, loaded.state.assembly.parts[1]);
    assert.ok(Math.abs(after.volumeMm3 - before.volumeMm3) < 1e-7);
    assert.deepEqual(after.comLocal, before.comLocal);
    const restoredModified = parseProjectDocument(JSON.parse(JSON.stringify(modifiedDocument)));
    await restoreProjectAssets(restoredModified, running.api);
    const restoredHole = await mass(running.api, restoredModified.state.assembly.parts[1]);
    assert.ok(Math.abs(restoredHole.volumeMm3 - modifiedMass.volumeMm3) < 1e-7, 'saved Hole feature regenerates against restored STEP topology after restart');
    const holeMesh = await running.api.buildPartMesh({ features: restoredModified.state.assembly.parts[1].features, sketches: [] });
    assert.ok(holeMesh.mesh.indices.length > 0);
    const built = await running.api.buildPartMesh({ features: loaded.state.assembly.parts[1].features, sketches: [] });
    assert.deepEqual(built.mesh.edges.map((edge) => edge.id).sort(), priorEdges);
    const nativeMesh = await running.api.buildPartMesh({ features: loaded.state.assembly.parts[0].features, sketches: loaded.state.assembly.parts[0].sketches });
    assert.ok(nativeMesh.mesh.indices.length > 0);
    const bytes = await running.api.exportAssemblyStep(loaded.state.assembly.parts.map((p) => ({ partId: p.id, features: p.features, sketches: p.sketches, transform: p.transform })));
    assert.match(new TextDecoder().decode(bytes), /ISO-10303-21/);
    // Fingerprint corruption with intact raw STEP bytes must also reject.
    const mismatched = structuredClone(loaded); mismatched.assets[0].bodies[0].meshSha256 = '0'.repeat(64);
    await assert.rejects(restoreProjectAssets(mismatched, running.api), /does not match its saved geometry/);
    const stillValid = await mass(running.api, loaded.state.assembly.parts[1]);
    assert.ok(Math.abs(stillValid.volumeMm3 - before.volumeMm3) < 1e-7, 'failed staging does not change the existing content-addressed shape');
  } finally { await running.worker.terminate(); clearProjectAssetMemory(); clearImportedShapeCache(); }
});

test('a legacy live import is packaged in local coordinates and missing old worker geometry fails clearly', { timeout: 120000 }, async () => {
  clearProjectAssetMemory(); clearImportedShapeCache();
  const { worker, api } = start();
  try {
    await api.init();
    const [legacy] = await api.importStep(fixtureBytes(), 'legacy.step');
    const project = await createProjectDocument(state(legacy), async () => api);
    assert.equal(project.assets.length, 1); assert.equal(project.assets[0].preserveCoordinates, true);
    assert.notEqual(project.state.assembly.parts[1].features[0].shapeId, legacy.shapeId);
    const original = await mass(api, state(legacy).assembly.parts[1]);
    const packaged = await mass(api, project.state.assembly.parts[1]);
    assert.ok(Math.abs(original.volumeMm3 - packaged.volumeMm3) < 1e-6);
    const missing = state({ shapeId: 'no-longer-in-worker' });
    await assert.rejects(createProjectDocument(missing, async () => api), /not found|re-import|missing|no longer/i);
  } finally { await worker.terminate(); clearProjectAssetMemory(); clearImportedShapeCache(); }
});
