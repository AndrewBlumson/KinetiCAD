#!/usr/bin/env node
// Reproduce the browser dependency notice inventory from the frozen install.
// This copies upstream notices verbatim; it does not infer a licence grant.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
if (process.argv.some((arg, i) => i > 1 && arg !== '--check')) throw new Error('Usage: node licenses/collect-notices.mjs [--check]');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const slash = (path) => path.replaceAll('\\', '/');
const packageName = (specifier) => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const noticePattern = /^(licen[sc]e|copying|notice|authors|copyright)([.\-_]|$)/i;
// An icon/component named "copyright" is source code, not a licence notice.
const codeArtifactPattern = /\.(?:[cm]?[jt]sx?|map)$/i;
const packages = new Map();
const visited = new Set();
const queue = [];
const unresolved = [];
const expected = new Map();
const seedMap = new Map();
const supplemental = readJson(join(root, 'licenses/supplemental-manifest.json'));
for (const notice of supplemental.notices) {
  if (!notice.path.startsWith('licenses/upstream/') || notice.path.includes('..')) throw new Error('Invalid supplemental notice path');
  if (sha256(readFileSync(join(root, notice.path))) !== notice.sha256) throw new Error(`Supplemental notice hash differs: ${notice.path}`);
}

function walk(directory, visit) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, visit);
    else if (entry.isFile()) visit(path);
  }
}

function locate(name, from) {
  const require = createRequire(join(from, 'package.json'));
  for (const path of require.resolve.paths(name) ?? []) {
    const manifest = join(path, name, 'package.json');
    if (existsSync(manifest)) return dirname(realpathSync(manifest));
  }
  return null;
}

function seed(name, from) {
  if (!name || name.startsWith('.') || name.startsWith('@/') || name.startsWith('@assets/') || name.startsWith('@workspace/') || name.startsWith('node:')) return;
  name = packageName(name);
  const origin = slash(relative(root, from));
  seedMap.set(`${origin}:${name}`, { workspace: origin, name });
  const path = locate(name, from);
  if (path) queue.push(path);
  else unresolved.push(`${origin}: ${name}`);
}

for (const workspace of ['artifacts/kineticad', 'artifacts/landing']) {
  const from = join(root, workspace);
  for (const name of Object.keys(readJson(join(from, 'package.json')).dependencies ?? {})) seed(name, from);
  walk(join(from, 'src'), (path) => {
    if (!/\.(?:[cm]?[jt]sx?|css)$/.test(path)) return;
    const source = readFileSync(path, 'utf8');
    const patterns = /(?:from\s+|import\s*\(\s*|import\s+|@import\s+)["']([^"']+)["']/g;
    for (const match of source.matchAll(patterns)) seed(match[1], from);
  });
}

for (let i = 0; i < queue.length; i++) {
  const directory = queue[i];
  if (visited.has(directory)) continue;
  visited.add(directory);
  const metadata = readJson(join(directory, 'package.json'));
  const id = `${metadata.name}@${metadata.version}`;
  const safeName = metadata.name.replace(/^@/, '').replaceAll('/', '__');
  const entry = packages.get(id) ?? {
    name: metadata.name,
    version: metadata.version,
    license: metadata.license ?? metadata.licenses ?? null,
    repository: metadata.repository ?? null,
    homepage: metadata.homepage ?? null,
    notices: [],
  };
  walk(directory, (path) => {
    const fileName = path.split('/').at(-1);
    if (!noticePattern.test(fileName) || codeArtifactPattern.test(fileName)) return;
    const sourcePath = slash(relative(directory, path));
    const destination = `licenses/packages/${safeName}/${metadata.version}/${sourcePath}`;
    const bytes = readFileSync(path);
    const prior = expected.get(destination);
    if (prior && !prior.equals(bytes)) throw new Error(`Different upstream notice bytes for ${id}: ${sourcePath}`);
    expected.set(destination, bytes);
    if (!entry.notices.some((notice) => notice.sourcePath === sourcePath)) {
      entry.notices.push({ sourcePath, path: destination, sha256: sha256(bytes) });
    }
  });
  entry.notices.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  packages.set(id, entry);
  const optional = metadata.optionalDependencies ?? {};
  for (const name of Object.keys({ ...metadata.dependencies, ...optional }).sort()) {
    const path = locate(name, directory);
    if (path) queue.push(path);
    else if (!(name in optional)) unresolved.push(`${id}: ${name}`);
  }
}

if (unresolved.length) throw new Error(`Incomplete installed dependency resolution:\n${unresolved.join('\n')}`);
const entries = [...packages.values()].sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
for (const entry of entries) {
  entry.upstreamNotices = supplemental.notices.filter((notice) => notice.packages?.includes(`${entry.name}@${entry.version}`))
    .map(({ path, sourceUrl, sha256, kind, limitation }) => ({ path, sourceUrl, sha256, kind, ...(limitation ? { limitation } : {}) }));
}
const manifest = {
  schemaVersion: 1,
  scope: 'Conservative browser-source imports (including CSS) and declared application dependencies, plus their installed non-peer dependency closure. Includes potentially unused/tree-shaken UI packages. Excludes project-local workspace code and unrelated server/build/test tools. Externally hosted fonts and the OCCT kernel are described separately in THIRD-PARTY-NOTICES.md.',
  lockfileSha256: sha256(readFileSync(join(root, 'pnpm-lock.yaml'))),
  seeds: [...seedMap.values()].sort((a, b) => `${a.workspace}:${a.name}`.localeCompare(`${b.workspace}:${b.name}`, 'en')),
  packageCount: entries.length,
  packages: entries,
};
expected.set('licenses/manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
const rows = entries.map((entry) => {
  const license = typeof entry.license === 'string' ? entry.license : JSON.stringify(entry.license);
  const notices = entry.notices.length
    ? entry.notices.map((notice) => `[${notice.sourcePath}](${notice.path.replace(/^licenses\//, '')})`).join(', ')
    : entry.upstreamNotices.length
      ? entry.upstreamNotices.map((notice) => `[Upstream project notice](${notice.path.replace(/^licenses\//, '')})${notice.limitation ? ' — **exact installed-version correspondence unverified**' : ' — from the npm release source revision'}`).join(', ')
      : '**No notice text located** — metadata only; review the upstream source before redistribution.';
  return `| ${entry.name} | ${entry.version} | ${license} | ${notices} |`;
});
const readme = `# Installed browser dependency notices\n\nGenerated by [collect-notices.mjs](collect-notices.mjs) from the frozen installed packages.\nThe copied upstream files are byte-for-byte originals. The [manifest](manifest.json) records\npackage metadata, each notice hash and the lockfile hash. The scope deliberately includes\nUI dependencies that may be unused or removed by tree shaking; it is not a bundle analysis.\nPackage metadata is not a substitute for a missing licence/copyright notice.\n\nThe [supplemental manifest](supplemental-manifest.json) records separately retrieved,\npinned upstream texts. Eighteen installed package versions omit notice files; these\nhave upstream project references below. The exact source-version correspondence for\nreact-remove-scroll-bar 2.3.8 remains unverified and is expressly marked.\n\nSee [THIRD-PARTY-NOTICES](../THIRD-PARTY-NOTICES.md) for attribution, the separately loaded\nOCCT kernel and fonts, and remaining distribution checks.\n\nRun from the repository root after \`pnpm install --frozen-lockfile\`:\n\n\`\`\`sh\nnode licenses/collect-notices.mjs\nnode licenses/collect-notices.mjs --check\n\`\`\`\n\nGeneration updates the expected files without deleting old notices. Review removed\ndependencies explicitly if the lockfile changes. \`--check\` compares installed metadata\nand copied bytes, and verifies the recorded supplemental hashes; it does not certify\nlicence compliance or fetch/revalidate upstream files.\n\n${entries.length} installed package versions.\n\n| Package | Version | Declared licence | Copied upstream notices |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
expected.set('licenses/README.md', Buffer.from(readme));
for (const [path, bytes] of expected) {
  const destination = join(root, path);
  if (check) {
    if (!existsSync(destination) || !readFileSync(destination).equals(bytes)) throw new Error(`Notice inventory differs: ${path}`);
  } else {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
}
console.log(`${check ? 'Verified' : 'Wrote'} ${entries.length} package versions and ${expected.size - 2} original notice files.`);
console.log(`Verified ${supplemental.notices.length} supplemental notice hashes; ${entries.filter((entry) => !entry.notices.length).length} package versions use upstream references, with ${entries.filter((entry) => entry.upstreamNotices.some((notice) => notice.limitation)).length} explicit source-version limitation.`);
