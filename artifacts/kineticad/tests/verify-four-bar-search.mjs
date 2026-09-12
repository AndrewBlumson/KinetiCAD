// Explicit report capture, intentionally outside the *.test.mjs regression glob.
// This overwrites its own dated report; preserve it before comparing revisions.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const app = fileURLToPath(new URL('../', import.meta.url)), repo = resolve(app, '../..');
const tests = ['tests/four-bar-kinematics.test.mjs', 'tests/four-bar-synthesis.test.mjs', 'tests/four-bar-search-worker.test.mjs'];
const inputs = ['src/mechanisms/fourBarKinematics.ts', 'src/mechanisms/fourBarSynthesis.ts', 'src/mechanisms/fourBarSearchWorker.ts',
  ...tests, 'tests/helpers/four-bar-search-worker-node.mjs', 'tests/verify-four-bar-search.mjs'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = () => Object.fromEntries(inputs.map(path => [`artifacts/kineticad/${path}`, digest(readFileSync(resolve(app, path)))]));
const before = sources(), startedAt = new Date().toISOString(), start = performance.now();
const args = ['--import', '../../scripts/node_modules/tsx/dist/loader.mjs', '--test', '--test-concurrency=1', '--test-reporter=tap', ...tests];
const run = spawnSync(process.execPath, args, { cwd: app, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 120000 });
const stdout = run.stdout ?? '', stderr = run.stderr ?? '', after = sources();
const metric = tag => {
  const line = stdout.split('\n').find(line => line.includes(`[${tag}] `));
  if (!line) return null;
  return JSON.parse(line.slice(line.indexOf(`] `) + 2));
};
const number = name => Number(stdout.match(new RegExp(`^# ${name} ([0-9.]+)$`, 'm'))?.[1] ?? NaN);
const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after), count = number('tests'), failures = number('fail');
const passed = run.status === 0 && sourceUnchanged && count === 13 && failures === 0;
const report = {
  schemaVersion: 1, startedAt, completedAt: new Date().toISOString(), passed,
  scope: 'Pure four-bar equations/search and the actual search worker with only its browser message endpoint adapted to Node. No OCCT, Rapier, browser or full-suite acceptance.',
  provenance: { node: process.version, head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim(),
    implementationMayContainUncommittedChanges: true, command: { executable: 'node', cwd: 'artifacts/kineticad', args },
    sourceSha256: before, sourcesUnchangedDuringRun: sourceUnchanged, stdoutSha256: digest(stdout), stderrSha256: digest(stderr) },
  testRun: { testCount: count, passed: number('pass'), failed: failures, cancelled: number('cancelled'), skipped: number('skipped'),
    nodeDurationMs: number('duration_ms'), wallDurationMs: performance.now() - start,
    names: stdout.split('\n').filter(line => line.startsWith('# Subtest: ')).map(line => line.slice(11)), exitCode: run.status, error: run.error?.message ?? null },
  measuredSearches: { ellipseWorker: metric('four-bar-worker-ellipse'), heldOutMechanism: metric('four-bar-search-held-out') },
  acceptanceGates: { ellipse: { rmsMm: 0.3, maxGapMm: 0.6 }, heldOutMechanism: { rmsMm: 1, maxGapMm: 3 },
    knownPresetPolygonComparison: { rmsMm: 0.005, maxGapMm: 0.005 }, knownPresetSeededSearchRmsMm: 0.01,
    linkLengthErrorMm: 1e-10, exactFixtureErrorMm: 1e-12, velocityFiniteDifferenceErrorMmPerSec: 2e-6,
    accelerationFiniteDifferenceErrorMmPerSec2: 2e-5, placementErrorMm: 1e-10 },
  limitations: ['The three known mechanisms seed the population and are labelled as known references; the held-out target supplies only its path, not its parameters.',
    'Search minimises a sampled complete-loop RMS objective; final metrics use denser samples. It does not prove a global optimum or exact fitting of arbitrary drawings.',
    'Worst gaps are sampled quantities. Free cyclic starting phase and either traversal direction are allowed; drawing speed is not fitted.',
    'Runtime is a measurement on this local Node run, not a browser deadline or cross-device guarantee.',
    'Physical CAD and Rapier acceptance are recorded separately.'], stdout, stderr,
};
const path = resolve(repo, 'docs/four-bar-search-results.json');
writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ path, passed, testRun: report.testRun, measuredSearches: report.measuredSearches }, null, 2));
if (!passed) process.exitCode = 1;
