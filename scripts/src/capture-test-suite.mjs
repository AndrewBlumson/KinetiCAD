#!/usr/bin/env node
/** Portable, explicit evidence capture; no dependency installation or browser QA.
 * Run from any directory with installed workspace dependencies:
 *   node /path/to/checkout/scripts/src/capture-test-suite.mjs --output-dir /path/to/new-evidence
 * For a subset, repeat --test tests/example.test.mjs. The summary labels subsets.
 * Do not run another suite or edit source/reports concurrently. The lock protects
 * cooperating captures only. SIGINT/SIGTERM restores the two known overwritten
 * reports; after SIGKILL/power loss use original-reports/ and run-start.json to
 * recover their bytes manually. Historical evidence scripts remain unchanged.
 */
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '../..');
const app = join(root, 'artifacts/kineticad');
const protectedReports = ['docs/assembly-export-results.json', 'docs/boolean-physics-results.json'];
// Capture the workspace built by the release commands, including production
// servers, Vite configuration/public fixtures, generated API clients and Orval's
// source/configuration. Build outputs and dated evidence are not source inputs.
const sourceTrees = ['artifacts', 'lib', 'scripts', 'attached_assets'];
const sourceFiles = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'tsconfig.json', 'tsconfig.base.json', '.npmrc', '.replit', '.replitignore', '.gitignore'];
const excludedDirectories = new Set(['node_modules', '.git', 'dist', '.vite', '.turbo', 'coverage', 'docs', 'evidence']);
const excludedFile = name => name === '.DS_Store' || name.endsWith('.tsbuildinfo')
  || name === '.env' || name.startsWith('.env.');
const sourceInputScope = { trees: sourceTrees, rootFiles: sourceFiles, excludedDirectories: [...excludedDirectories],
  excludedFiles: ['.DS_Store', '*.tsbuildinfo', '.env', '.env.*'],
  limitations: 'Regular source files only; installed dependencies and environment values are not hashed.' };
const slash = value => value.split(sep).join('/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const relativeFile = path => slash(relative(root, path));
const inside = (parent, path) => { const r = relative(parent, path); return r === '' || (!r.startsWith(`..${sep}`) && r !== '..' && !isAbsolute(r)); };

function usage() {
  console.log(`Usage: node scripts/src/capture-test-suite.mjs --output-dir <new-or-empty-directory> [--test tests/name.test.mjs ...]
       node scripts/src/capture-test-suite.mjs --list-inputs

Runs the existing kineticad *.test.mjs files serially with the installed TS loader.
Paths supplied to --test are relative to artifacts/kineticad; omission runs every
current top-level test file. No packages are installed. Node and pnpm versions,
source hashes before/after, full reporter events, per-test results and summary
are retained in the explicitly selected output directory.

--list-inputs prints the current source-input hashes and discovery scope as JSON.
It starts no tests, acquires no lock and writes no files. Source inputs include
artifact/library/script source, public fixtures/assets, generated API clients,
root manifests/lockfile and build/Replit configuration. Dependencies, dist/cache
outputs, docs/evidence and environment-file values are excluded.

Output: run-start.json, summary.json, suite-events.jsonl, tests.jsonl,
stderr.log, reporter.mjs, original-reports/, generated-reports/.
The two historical assembly-export/boolean-physics JSON reports are backed up,
their post-run copies retained, and their original bytes restored even on test
failure or handled SIGINT/SIGTERM. Other commands must not run tests or modify
source/reports concurrently. SIGKILL/power loss cannot run cleanup; recover from
original-reports/ using run-start.json before clearing a stale capture lock.

Exit status is nonzero for test/capture failure, interrupted execution, missing
Node summary, source drift or failed report restoration. A passing automated
capture does not establish a production build, browser or deployment acceptance.`);
}

function options(argv) {
  let outputDir;
  const tests = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') { usage(); return null; }
    if (flag !== '--output-dir' && flag !== '--test') throw Error(`Unknown argument: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw Error(`${flag} needs a value.`);
    if (flag === '--output-dir') {
      if (outputDir) throw Error('Pass --output-dir exactly once.');
      outputDir = resolve(value);
    } else tests.push(value);
  }
  if (!outputDir) throw Error('An explicit --output-dir is required. Use --help for the capture contract.');
  if (sourceTrees.some(tree => inside(join(root, tree), outputDir)) || outputDir === root || outputDir === app) {
    throw Error('Keep capture output outside the source/test trees and project roots.');
  }
  if (existsSync(outputDir) && (!lstatSync(outputDir).isDirectory() || readdirSync(outputDir).length)) {
    throw Error('Output must be a new or empty directory; existing evidence is never overwritten.');
  }
  const available = readdirSync(join(app, 'tests')).filter(name => name.endsWith('.test.mjs'))
    .map(name => `tests/${name}`).sort();
  const selected = tests.length ? [...new Set(tests.map(path => slash(path)))].sort() : available;
  for (const path of selected) if (!available.includes(path)) throw Error(`Not an existing top-level test file: ${path}`);
  if (!selected.length) throw Error('No test files were found.');
  return { outputDir, selected, available, scope: selected.length === available.length ? 'all-current-test-files' : 'explicit-subset' };
}

function fileHashes() {
  const paths = new Set(sourceFiles.filter(path => existsSync(join(root, path))));
  function visit(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (excludedFile(entry.name) || (entry.isDirectory() && excludedDirectories.has(entry.name))) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) paths.add(relativeFile(path));
    }
  }
  sourceTrees.forEach(tree => visit(join(root, tree)));
  return Object.fromEntries([...paths].sort().map(path => [path, sha(readFileSync(join(root, path)))]));
}

function commandText(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore'], timeout: 10000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

function summarizeEvents(eventsPath, outputDir) {
  const tests = [], parseErrors = []; let nodeSummary = null;
  for (const [index, line] of readFileSync(eventsPath, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); }
    catch (error) { parseErrors.push({ line: index + 1, message: error.message }); continue; }
    const data = event.data ?? {};
    if (event.type === 'test:summary' && !data.file) nodeSummary = data;
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const file = data.file ? (String(data.file).startsWith('file:') ? fileURLToPath(data.file) : resolve(app, data.file)) : null;
    const sourcePath = file && inside(root, file) ? relativeFile(file) : file;
    const status = data.skip ? 'skipped' : data.todo ? 'todo'
      : data.details?.error?.failureType === 'cancelledByParent' ? 'cancelled'
      : event.type === 'test:pass' ? 'passed' : 'failed';
    tests.push({ name: data.name, file: sourcePath, line: data.line ?? null, column: data.column ?? null,
      status, durationMs: data.details?.duration_ms ?? null, kind: data.details?.type ?? 'test', nesting: data.nesting ?? 0,
      testNumber: data.testNumber ?? null, skip: data.skip ?? null, todo: data.todo ?? null,
      error: data.details?.error ?? null });
  }
  writeFileSync(join(outputDir, 'tests.jsonl'), tests.map(test => JSON.stringify(test) + '\n').join(''));
  return { nodeSummary, resultEvents: tests.length, parseErrors, tests };
}

async function capture(config) {
  const { outputDir, selected, available, scope } = config;
  const loader = join(root, 'scripts/node_modules/tsx/dist/loader.mjs');
  if (!existsSync(loader)) throw Error('The workspace TS loader is missing. Install the pinned workspace dependencies before capturing.');
  const reporterSource = join(dirname(scriptPath), 'capture-test-reporter.mjs');
  if (!existsSync(reporterSource)) throw Error('The companion capture-test-reporter.mjs is missing.');
  const lockPath = join(root, '.kineticad-test-capture.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx'); }
  catch (error) { throw Error(`Cannot acquire capture lock ${lockPath}. Another capture may be active; inspect it before removing a stale lock. ${error.message}`); }
  const lockContents = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), outputDir });
  try { writeFileSync(lock, lockContents); } finally { closeSync(lock); }
  const originals = [], restoration = [], errors = [];
  let child = null, interrupted = null, killTimer = null, started = false, stdout = null, stderr = null;
  let result = { code: null, signal: null }, provenance = null, beforeHashes = null;
  const startedClock = performance.now();
  const interrupt = signal => {
    interrupted ??= signal;
    if (!child?.pid) return;
    const send = next => { try { if (process.platform === 'win32') child.kill(next); else process.kill(-child.pid, next); } catch {} };
    send(signal);
    killTimer ??= setTimeout(() => send('SIGKILL'), 5000);
    killTimer.unref();
  };
  const onInterrupt = () => interrupt('SIGINT'), onTerminate = () => interrupt('SIGTERM');
  process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate);
  try {
    mkdirSync(outputDir, { recursive: true });
    const reporterPath = join(outputDir, 'reporter.mjs'); copyFileSync(reporterSource, reporterPath);
    for (const path of protectedReports) {
      const absolute = join(root, path), existed = existsSync(absolute);
      if (existed && !lstatSync(absolute).isFile()) throw Error(`Historical report must be a regular file: ${path}`);
      const bytes = existed ? readFileSync(absolute) : null;
      originals.push({ path, bytes, existed });
      if (bytes) { const backup = join(outputDir, 'original-reports', path); mkdirSync(dirname(backup), { recursive: true }); writeFileSync(backup, bytes); }
    }
    beforeHashes = fileHashes();
    const args = ['--import', loader, '--test', '--test-concurrency=1', `--test-reporter=${reporterPath}`, ...selected];
    provenance = { schemaVersion: 1, startedAt: new Date().toISOString(), commit: commandText('git',['rev-parse','HEAD']),
      gitStatus: commandText('git',['status','--porcelain','--untracked-files=normal']),
      nodeVersion: process.version, nodeExecutable: process.execPath, pnpmVersion: commandText('pnpm',['--version']),
      platform: process.platform, arch: process.arch, repositoryRoot: root, cwd: app, command: [process.execPath, ...args],
      scope, selectedTestFiles: selected, availableTestFiles: available, sourceInputScope, sourceInputSha256: beforeHashes,
      reporterSha256: sha(readFileSync(reporterPath)), captureScriptSha256: sha(readFileSync(scriptPath)),
      historicalReports: originals.map(({ path, bytes, existed }) => ({ path, existed, sha256: bytes ? sha(bytes) : null,
        backup: existed ? `original-reports/${path}` : null })),
      limitations: ['Automated tests only; no build, browser or deployment acceptance.',
        'Some test helpers may reuse source-validated temporary CAD descriptors; caches are not deliberately purged.',
        'Only the two explicitly listed historical reports are preserved. Do not run other suites or edit source/reports concurrently.',
        'SIGKILL/power loss cannot run cleanup; original report backups are written before tests begin.'] };
    writeJson(join(outputDir, 'run-start.json'), provenance);
    stdout = openSync(join(outputDir, 'suite-events.jsonl'), 'wx'); stderr = openSync(join(outputDir, 'stderr.log'), 'wx');
    if (interrupted) throw Error(`Capture interrupted during preparation (${interrupted}); no tests were started.`);
    console.log(`Capturing ${selected.length} test files serially (${scope}) to ${outputDir}`);
    started = true;
    result = await new Promise(resolveResult => {
      child = spawn(process.execPath, args, { cwd: app, stdio: ['ignore',stdout,stderr], detached: process.platform !== 'win32' });
      child.once('error', error => { errors.push({ phase: 'spawn', message: error.message }); resolveResult({ code: null, signal: null }); });
      child.once('close', (code, signal) => resolveResult({ code, signal }));
    });
  } catch (error) { errors.push({ phase: started ? 'execution' : 'preparation', message: error.message }); }
  finally {
    if (killTimer) clearTimeout(killTimer);
    if (stdout !== null) closeSync(stdout); if (stderr !== null) closeSync(stderr);
    // Fresh-copy failures cannot bypass restoration of any original report.
    for (const { path, bytes, existed } of originals) {
      const absolute = join(root, path), record = { path, existedBefore: existed, historicalSha256: bytes ? sha(bytes) : null };
      try {
        const after = existsSync(absolute) ? readFileSync(absolute) : null;
        record.postRunSha256 = after ? sha(after) : null;
        record.contentChanged = existed ? !after?.equals(bytes) : after !== null;
        if (after) { const fresh = join(outputDir, 'generated-reports', path); mkdirSync(dirname(fresh), { recursive: true }); writeFileSync(fresh, after); record.postRunSnapshot = `generated-reports/${path}`; }
      } catch (error) { errors.push({ phase: 'save-post-run-report', path, message: error.message }); }
      try {
        if (existed) writeFileSync(absolute, bytes);
        else if (existsSync(absolute)) unlinkSync(absolute);
        record.restored = existed ? readFileSync(absolute).equals(bytes) : !existsSync(absolute);
      } catch (error) { record.restored = false; errors.push({ phase: 'restore-report', path, message: error.message }); }
      restoration.push(record);
    }
    process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate);
    if (existsSync(lockPath) && readFileSync(lockPath, 'utf8') === lockContents) unlinkSync(lockPath);
  }
  if (!provenance) throw Error(errors.map(error => error.message).join('; ') || 'Capture could not start.');
  let events = { nodeSummary: null, resultEvents: 0, parseErrors: [], tests: [] };
  try { events = summarizeEvents(join(outputDir, 'suite-events.jsonl'), outputDir); }
  catch (error) { errors.push({ phase: 'read-events', message: error.message }); }
  let afterHashes = {}, changes = [];
  try {
    afterHashes = fileHashes();
    changes = [...new Set([...Object.keys(beforeHashes), ...Object.keys(afterHashes)])].sort()
      .filter(path => beforeHashes[path] !== afterHashes[path]).map(path => ({ path, before: beforeHashes[path] ?? null, after: afterHashes[path] ?? null }));
  } catch (error) { errors.push({ phase: 'hash-source', message: error.message }); }
  const restorationVerified = restoration.length === protectedReports.length && restoration.every(report => report.restored);
  const sourceInputsUnchanged = errors.every(error => error.phase !== 'hash-source') && changes.length === 0;
  const passed = result.code === 0 && !interrupted && errors.length === 0 && events.parseErrors.length === 0
    && events.nodeSummary?.success === true && restorationVerified && sourceInputsUnchanged;
  const summary = { schemaVersion: 1, passed, provenance, completedAt: new Date().toISOString(), wallDurationMs: performance.now() - startedClock,
    process: result, interrupted, nodeSummary: events.nodeSummary, resultEvents: events.resultEvents, parseErrors: events.parseErrors,
    sourceInputsUnchanged, sourceInputChanges: changes, sourceInputSha256After: afterHashes,
    restorationVerified, generatedReports: restoration, errors,
    files: { events: 'suite-events.jsonl', testResults: 'tests.jsonl', stderr: 'stderr.log', reporter: 'reporter.mjs' },
    rawReporterSha256: existsSync(join(outputDir, 'suite-events.jsonl')) ? sha(readFileSync(join(outputDir, 'suite-events.jsonl'))) : null };
  writeJson(join(outputDir, 'summary.json'), summary);
  console.log(JSON.stringify({ passed, scope, counts: events.nodeSummary?.counts ?? null, sourceInputsUnchanged,
    restorationVerified, interrupted, exitCode: result.code, summary: join(outputDir, 'summary.json') }, null, 2));
  process.exitCode = passed ? 0 : result.code || 1;
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--list-inputs') {
    const sourceInputSha256 = fileHashes();
    console.log(JSON.stringify({ sourceInputCount: Object.keys(sourceInputSha256).length,
      scope: sourceInputScope, sourceInputSha256 }, null, 2));
  } else {
    const config = options(args);
    if (config) await capture(config);
  }
}
catch (error) { console.error(`Test capture failed: ${error.message}`); process.exitCode = 1; }
