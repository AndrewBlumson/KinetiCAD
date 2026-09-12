import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { FOUR_BAR_PRESETS, scoreFourBarPath, validateFourBarDesign } from '../src/mechanisms/fourBarSynthesis.ts';

async function create() {
  const worker = new Worker(new URL('./helpers/four-bar-search-worker-node.mjs', import.meta.url), { execArgv: [] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Search worker startup timed out.')), 5000);
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('message', message => { clearTimeout(timer); assert(message.__searchReady); resolve(); });
  });
  return worker;
}

test('production search worker delivers provisional progress and a separately recomputable ellipse fit', { timeout: 30000 }, async () => {
  const worker = await create(), progress = [], before = performance.now();
  try {
    const done = new Promise((resolve, reject) => {
      worker.once('error', reject);
      worker.on('message', m => { if (m.type === 'error') reject(new Error(m.message)); else if (m.type === 'progress') progress.push(m); else if (m.type === 'result') resolve(m); });
    });
    worker.postMessage({ type: 'start', requestId: 'ellipse-worker-test', targetPathMm: FOUR_BAR_PRESETS[3].targetPathMm, seed: 42 });
    const { result, requestId } = await done;
    assert.equal(requestId, 'ellipse-worker-test'); assert.equal(progress.length, 129); assert.equal(progress[0].evaluations, 64);
    assert(progress.every(p => p.requestId === requestId)); assert.equal(progress.at(-1).evaluations, 8256);
    assert.deepEqual(result.fit, scoreFourBarPath(result.design.params, result.design.targetPathMm));
    validateFourBarDesign(result.design);
    assert(result.fit.rmsMm > 0 && result.fit.rmsMm < 0.3, JSON.stringify(result.fit));
    assert(result.fit.maxGapMm < 0.6, JSON.stringify(result.fit));
    console.log('[four-bar-worker-ellipse]', JSON.stringify({ seed: result.design.search.seed, evaluations: result.evaluations,
      progressMessageCount: progress.length, durationMs: performance.now() - before, fit: result.fit, parameters: result.design.params }));
  } finally { await worker.terminate(); }
});

test('terminating a running search cancels it before a result; a fresh worker rejects invalid input clearly', { timeout: 10000 }, async () => {
  const worker = await create(); let gotResult = false;
  worker.on('message', m => { if (m.type === 'result') gotResult = true; });
  const first = new Promise(resolve => worker.on('message', m => { if (m.type === 'progress') resolve(m); }));
  worker.postMessage({ type: 'start', requestId: 'cancel-test', targetPathMm: FOUR_BAR_PRESETS[0].targetPathMm, seed: 19 });
  const snapshot = await first; assert(snapshot.evaluations < snapshot.totalEvaluations);
  await worker.terminate(); assert.equal(gotResult, false);
  const fresh = await create();
  try {
    const response = new Promise(resolve => fresh.once('message', resolve));
    fresh.postMessage({ type: 'start', requestId: 'invalid-test', targetPathMm: [[0, 0], [60, 0], [60, 30]], seed: 19 });
    const result = await response; assert.equal(result.type, 'error'); assert.equal(result.requestId, 'invalid-test'); assert.match(result.message, /closed target/);
  } finally { await fresh.terminate(); }
});
