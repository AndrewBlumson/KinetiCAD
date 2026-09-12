import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStewartSourceGeometry } from '../src/physics/stewartFixture.ts';
import { parseDemoDocument } from '../src/demos/demoDocument.ts';
import { usePoseMeasurements, publishPoseMeasurements, clearPoseMeasurements } from '../src/physics/poseMeasurements.ts';

const fixture = () => JSON.parse(readFileSync(new URL('../public/demos/stewart-platform.json', import.meta.url), 'utf8'));
test('saved six-axis command survives demo parsing and invalid commands fail closed', () => {
  const document = fixture();
  document.state.simulation.stewartMotion = { kind: 'six-axis', target: { translationMm: [4, -3, 4], rotationDeg: [1.5, -1, 2] }, moveDurationMs: 4000, settleDurationMs: 2000 };
  assert.deepEqual(parseDemoDocument(document).state.simulation.stewartMotion, document.state.simulation.stewartMotion);
  document.state.simulation.stewartMotion.target.rotationDeg[0] = 8;
  assert.throws(() => parseDemoDocument(document), /workspace/);
});
test('source guard permits labels and material changes but rejects altered solids, topology and visibility', () => {
  const reference = fixture().state.assembly;
  const renamed = structuredClone(reference);
  renamed.parts[0].name = 'My stand'; renamed.parts[0].materialId = 'brass-c36000';
  validateStewartSourceGeometry(renamed, reference);
  for (const edit of [
    a => { a.parts[1].features[0].distance = 999; },
    a => { a.parts[1].sketches[0].primitives[0].radius = 200; },
    a => { a.parts[1].transform.positionMm[0] = 1; },
    a => { a.parts[1].visible = false; },
    a => { a.mates.pop(); },
    a => { a.booleanFeatures.push({ id: 'extra' }); },
  ]) {
    const modified = structuredClone(reference); edit(modified);
    assert.throws(() => validateStewartSourceGeometry(modified, reference), /original Stewart geometry/);
  }
});
test('measurement state uses actual worker results, holds on zero step, and clears on reset or another experiment', () => {
  const measurement = { phase: 'moving', positionErrorMm: 0.013, actualTranslationMm: [1,2,3] };
  const transforms = [{partId: 'stewart-platform', positionMm: [1,2,163], rotationQuat: [0,0,0,1]}];
  publishPoseMeasurements({dtMs: 10, transforms, stewartMeasurement: measurement});
  assert.equal(usePoseMeasurements.getState().stewart, measurement);
  assert.equal(usePoseMeasurements.getState().poses, transforms);
  publishPoseMeasurements({dtMs: 0, transforms: []});
  assert.equal(usePoseMeasurements.getState().stewart, measurement);
  clearPoseMeasurements();
  assert.equal(usePoseMeasurements.getState().stewart, undefined);
  assert.deepEqual(usePoseMeasurements.getState().poses, []);
  publishPoseMeasurements({dtMs: 10, transforms, stewartMeasurement: measurement});
  publishPoseMeasurements({dtMs: 10, transforms: []});
  assert.equal(usePoseMeasurements.getState().stewart, undefined);
});
