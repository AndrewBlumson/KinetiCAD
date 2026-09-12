import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOUR_BAR_PRESETS, searchFourBarPath, validateTargetPath, scaleTargetPath, resampleClosedPath, scoreFourBarPath, validateFourBarDesign } from '../src/mechanisms/fourBarSynthesis.ts';
import { sampleFourBarPath, validateFourBarParams } from '../src/mechanisms/fourBarKinematics.ts';

test('closed target validation rejects crossings, open paths, retracing, tiny/huge and nonfinite data', () => {
  const valid = [[0, 0], [60, 0], [60, 30], [0, 30], [0, 0]];
  assert.deepEqual(validateTargetPath(valid), valid);
  for (const path of [valid.slice(0, -1), [[0, 0], [60, 30], [0, 30], [60, 0], [0, 0]], [[0, 0], [60, 0], [30, 0], [30, 30], [0, 30], [0, 0]],
    [[0, 0], [1, 0], [1, 1], [0, 0]], [[0, 0], [Infinity, 0], [50, 20], [0, 0]], Array(514).fill([0, 0])]) assert.throws(() => validateTargetPath(path));
  const scaled = scaleTargetPath(valid, 100); assert.equal(Math.max(...scaled.map(p => p[0])) - Math.min(...scaled.map(p => p[0])), 100);
  assert.equal(Math.max(...scaled.map(p => p[1])) - Math.min(...scaled.map(p => p[1])), 50);
  assert.throws(() => scaleTargetPath(valid, 39));
});

test('arc-length resampling is independent of drawing speed and duplicated collinear vertices', () => {
  const sparse = [[0, 0], [60, 0], [60, 30], [0, 30], [0, 0]], dense = [[0, 0], [1, 0], [2, 0], [30, 0], [60, 0], [60, 10], [60, 30], [0, 30], [0, 0]];
  assert.deepEqual(resampleClosedPath(sparse, 18), resampleClosedPath(dense, 18));
  assert.throws(() => resampleClosedPath(sparse, 0));
});

test('known mechanism paths have a declared source, while an ellipse remains an approximation', async () => {
  for (const preset of FOUR_BAR_PRESETS.slice(0, 3)) {
    assert(preset.knownParams); const fit = scoreFourBarPath(preset.knownParams, preset.targetPathMm);
    assert(fit.rmsMm < 0.005 && fit.maxGapMm < 0.005, JSON.stringify(fit));
    const result = await searchFourBarPath({ targetPathMm: preset.targetPathMm, seed: 1, populationSize: 16, generations: 1 });
    assert(result.fit.rmsMm < 0.01, JSON.stringify(result.fit)); validateFourBarDesign(result.design);
  }
  assert.equal(FOUR_BAR_PRESETS.at(-1).knownParams, undefined);
});

test('complete-cycle score allows cyclic start/reversal but cannot match a displaced or partial target for free', () => {
  const p = FOUR_BAR_PRESETS[0], raw = p.targetPathMm.slice(0, -1), rotated = [...raw.slice(53), ...raw.slice(0, 53)]; rotated.push([...rotated[0]]);
  const reversed = [...rotated].reverse();
  for (const target of [rotated, reversed]) assert(scoreFourBarPath(p.knownParams, target).rmsMm < 0.02);
  const moved = p.targetPathMm.map(q => [q[0] + 100, q[1] - 80]);
  assert(scoreFourBarPath(p.knownParams, moved).rmsMm > 100);
  const small = p.targetPathMm.map(q => [q[0] * 0.5, q[1] * 0.5]);
  assert(scoreFourBarPath(p.knownParams, small).rmsMm > 8);
});

test('seeded search is deterministic, reports real monotone progress and supports cancellation', async () => {
  const request = { targetPathMm: FOUR_BAR_PRESETS[3].targetPathMm, seed: 197, populationSize: 16, generations: 3 }, progress = [];
  const first = await searchFourBarPath(request, { onProgress: p => progress.push(structuredClone(p)) });
  const second = await searchFourBarPath(request); assert.deepEqual(first, second);
  assert.equal(first.evaluations, 64); assert.deepEqual(progress.map(p => p.evaluations), [16, 32, 48, 64]);
  for (let i = 1; i < progress.length; i++) assert(progress[i].best.rmsMm <= progress[i - 1].best.rmsMm);
  let cancelled = false;
  await assert.rejects(searchFourBarPath(request, { onProgress: () => { cancelled = true; }, isCancelled: () => cancelled }), /cancelled/);
  for (const patch of [{ seed: NaN }, { seed: -1 }, { populationSize: 15 }, { generations: 241 }]) await assert.rejects(searchFourBarPath({ ...request, ...patch }));
});

test('default search fits a nonpreset independently supplied mechanism path without receiving its parameters', { timeout: 30000 }, async () => {
  const heldOut = validateFourBarParams({ groundLengthMm: 112, crankLengthMm: 31, couplerLengthMm: 101, rockerLengthMm: 91,
    couplerPointLocalMm: [72, -12], branch: -1, originMm: [-50, 37], rotationDeg: 37, initialCrankAngleDeg: 0, rpm: 10 });
  const targetPathMm = sampleFourBarPath(heldOut, 500);
  const before = performance.now(), result = await searchFourBarPath({ targetPathMm, seed: 73 });
  assert(result.fit.rmsMm < 1, JSON.stringify(result.fit)); assert(result.fit.maxGapMm < 3, JSON.stringify(result.fit));
  assert.equal(result.evaluations, 8256); assert.equal(result.design.search.seed, 73);
  assert.deepEqual(result.fit, scoreFourBarPath(result.design.params, targetPathMm));
  console.log('[four-bar-search-held-out]', JSON.stringify({ seed: result.design.search.seed, evaluations: result.evaluations,
    durationMs: performance.now() - before, targetParameters: heldOut, targetPointCount: targetPathMm.length, fit: result.fit, parameters: result.design.params }));
});
