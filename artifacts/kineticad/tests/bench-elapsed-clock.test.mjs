import test from 'node:test';
import assert from 'node:assert/strict';
import { createBenchElapsedClock } from '../src/physics/benchElapsedClock.ts';

test('a paused background tab earns no simulation time when resumed before its next animation frame', () => {
  const clock = createBenchElapsedClock();
  clock.setRunning(true);
  assert.equal(clock.advance(100), 0);
  assert.equal(clock.advance(116), 16);
  clock.setRunning(false);
  // No animation frames occur during this ten-minute suspended interval.
  clock.setRunning(true);
  assert.equal(clock.advance(600116), 0);
  assert.equal(clock.advance(600124), 8);
});

test('delayed first play and ordinary paused frames cannot consume a short test window', () => {
  const clock = createBenchElapsedClock();
  assert.equal(clock.advance(0), 0);
  clock.setRunning(true);
  assert.equal(clock.advance(600000), 0);
  assert.equal(clock.advance(600010), 10);
  clock.setRunning(false);
  assert.equal(clock.advance(600020), 0);
  assert.equal(clock.advance(610000), 0);
  clock.setRunning(true);
  assert.equal(clock.advance(620000), 0);
  assert.equal(clock.advance(620020), 20);
});

test('running cadence partitions retain elapsed time while repeated play calls do not reset the clock', () => {
  const regular = createBenchElapsedClock(), irregular = createBenchElapsedClock();
  regular.setRunning(true); irregular.setRunning(true);
  const regularMs = [0,10,20,30,40,50].reduce((sum, now) => sum + regular.advance(now), 0);
  irregular.advance(0); irregular.setRunning(true);
  const irregularMs = [3,7,29,50].reduce((sum, now) => sum + irregular.advance(now), 0);
  assert.equal(regularMs, 50); assert.equal(irregularMs, regularMs);
  assert.throws(() => irregular.advance(NaN), /finite/);
});
