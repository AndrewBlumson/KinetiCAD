import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const run = (args, env = {}) => execFileSync('pnpm', args, {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production', ...env },
});
// Regenerate referenced declarations even if a platform cache contains an old
// incremental marker without its corresponding ignored dist/ directory.
run(['exec', 'tsc', '--build', '--force']);
run(['run', 'typecheck']);
run(['--filter', '@workspace/landing', 'run', 'build'], { PORT: '18150', BASE_PATH: '/' });
run(['--filter', '@workspace/kineticad', 'run', 'build'], { PORT: '25157', BASE_PATH: '/app/' });
run(['--filter', '@workspace/landing', 'exec', 'vite', 'build', '--ssr', 'src/prerender.tsx', '--outDir', 'dist/ssr'], { PORT: '18150', BASE_PATH: '/' });
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('artifacts/landing/dist/public', 'dist', { recursive: true });
await cp('artifacts/kineticad/dist/public', 'dist/app', { recursive: true });
const { render } = await import(pathToFileURL(resolve('artifacts/landing/dist/ssr/prerender.js')));
const shell = await readFile('dist/index.html', 'utf8');
const pages = [
  ['/', 'index.html', 'KinetiCAD, Parametric CAD in the Browser', 'Free browser CAD with real B-rep geometry, parametric modelling and live physics. Create, save and export your designs locally.'],
  ['/story', 'story.html', 'The story behind KinetiCAD | Andrew Blumson', 'How Andrew and Kevin Blumson built KinetiCAD: free, open-source browser CAD with OpenCascade geometry, WebGPU rendering and Rapier physics.'],
  ['/terms', 'terms.html', 'Terms of service | KinetiCAD', 'Terms for the free KinetiCAD hosted service, its MIT-licensed source code and optional support payments.'],
  ['/privacy', 'privacy.html', 'Privacy policy | KinetiCAD', 'How KinetiCAD keeps design work on your device, uses local recovery storage and handles hosting requests and optional support payments.'],
  ['/404', '404.html', 'Page not found | KinetiCAD', 'This KinetiCAD page could not be found. Return to the homepage to launch the CAD workspace.'],
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
for (const [path, file, title, description] of pages) {
  const canonical = `https://kineticad.co.uk${path === '/' ? '/' : path}`;
  const html = shell
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${escape(description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta property="og:url"\s+content=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title")\s+content=")[^"]*/g, `$1${escape(title)}`)
    .replace(/(<meta (?:property="og:description"|name="twitter:description")\s+content=")[^"]*/g, `$1${escape(description)}`)
    .replace('<div id="root"></div>', `<div id="root">${render(path)}</div>`);
  await writeFile(`dist/${file}`, html);
}
let revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.SOURCE_REVISION || null;
if (!revision) {
  try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { /* A source upload can legitimately omit Git metadata. */ }
}
await writeFile('dist/release.json', JSON.stringify({ revision, builtAt: new Date().toISOString() }));
console.log('Prepared landing pages and CAD routes in dist/.');
