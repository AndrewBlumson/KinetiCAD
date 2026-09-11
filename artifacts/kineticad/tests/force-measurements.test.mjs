import test from 'node:test';
import assert from 'node:assert/strict';
import { beginForceMeasurements, clearForceMeasurements, reduceForceMeasurements, useForceMeasurements } from '../src/physics/forceMeasurements.ts';

const config = { kind:'equal-force', partIds:['sample'], forceN:0.001, direction:[0,1,0], durationMs:2000 };
const parts = [{ id:'sample', isGround:false, massKg:0.02, transform:{positionMm:[0,-96,6]} }];
function start() { beginForceMeasurements(config, parts); return useForceMeasurements.getState(); }
const reading = (time, velocity, distance, completed = false) => ({
  transforms:[], dtMs:time, simulatedTimeMs:time, completed,
  bodyMeasurements:[{partId:'sample',massKg:0.02,positionMm:[0,-96+distance,6],linearVelocityMmPerSec:[0,velocity,0]}],
});

test('display measures acceleration from solver readback even when it disagrees with F/m', () => {
  const result = reduceForceMeasurements(start(), reading(1000,20,10));
  assert.equal(result.rows[0].expectedAccelerationMmPerSec2,50);
  assert.equal(result.rows[0].measuredAccelerationMmPerSec2,20);
  assert.equal(result.rows[0].distanceMm,10);
});

test('measurement uses consecutive actual simulation timestamps and holds at completion', () => {
  const first = reduceForceMeasurements(start(),reading(500,25,6.25));
  const final = reduceForceMeasurements(first,{...reading(2000,100,100,true),dtMs:1500});
  assert.equal(final.rows[0].measuredAccelerationMmPerSec2,50);
  assert.equal(final.timeMs,2000);
  assert.equal(final.completed,true);
  assert.equal(reduceForceMeasurements(final,{...reading(2000,200,999),dtMs:0}),final);
});

test('new runs clear prior readings and missing measurements cannot look successful', () => {
  const previous = start();
  assert.throws(() => reduceForceMeasurements(previous,{...reading(1000,50,25),bodyMeasurements:[]}),/No physics measurement/);
  clearForceMeasurements();
  assert.equal(useForceMeasurements.getState().rows.length,0);
  assert.equal(start().rows[0].measuredAccelerationMmPerSec2,null);
});
