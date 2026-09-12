import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductionRequestHandler } from '../serve.mjs';

const HTML = '<!doctype html><title>KinetiCAD test shell</title>';
const NO_STORE = 'no-cache, no-store, must-revalidate';

async function fixture(t, basePath = '/app') {
  const dist = await mkdtemp(join(tmpdir(), 'kineticad-static-'));
  t.after(() => rm(dist, { recursive: true, force: true }));
  for (const directory of ['assets', 'demos', 'seeds', 'application']) {
    await mkdir(join(dist, directory));
  }
  const files = {
    'index.html': HTML,
    'assets/App-abc123.js': 'export const name = "CAD";',
    'assets/worker-def456.mjs': 'self.onmessage = () => {};',
    'assets/style-abc123.css': 'body { color: orange; }',
    'assets/kernel-abc123.wasm': Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
    'assets/info.html': '<title>Asset documentation</title>',
    'demos/windmill.json': '{"id":"windmill"}',
    'seeds/windmill.js': 'window.example = true;',
    'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'application/example.json': '{"prefix":"not-app"}',
  };
  await Promise.all(Object.entries(files).map(([path, content]) => writeFile(join(dist, path), content)));
  return { dist, files, handler: createProductionRequestHandler({ dist, basePath }) };
}

// Actual Node HTTP response serialization over an in-memory Duplex: no listening
// port, browser, deployed proxy or controlled replacement for URL/filesystem APIs.
async function request(handler, url, method = 'GET') {
  const chunks = [];
  const socket = new Duplex({
    read() {},
    write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
  });
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  const res = new ServerResponse(req);
  res.assignSocket(socket);
  const finished = new Promise((resolve) => res.once('finish', resolve));
  try {
    await handler(req, res);
    await finished;
    const wire = Buffer.concat(chunks);
    const separator = wire.indexOf('\r\n\r\n');
    assert.ok(separator >= 0, 'response headers were serialized');
    const lines = wire.subarray(0, separator).toString().split('\r\n');
    const headers = Object.fromEntries(lines.slice(1).map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()];
    }));
    return { status: Number(lines[0].split(' ')[1]), headers, body: wire.subarray(separator + 4) };
  } finally {
    socket.destroy();
  }
}

test('production handler returns 400 for malformed URLs and serves a later request', async (t) => {
  const { handler } = await fixture(t);
  for (const url of ['http://[', '//[', 'http://%invalid']) {
    const response = await request(handler, url);
    assert.equal(response.status, 400, url);
    assert.equal(response.headers['cache-control'], NO_STORE);
    assert.equal(response.body.toString(), 'Bad request');
  }
  const next = await request(handler, '/app/');
  assert.equal(next.status, 200);
  assert.equal(next.body.toString(), HTML);
});

test('production base and extensionless SPA routes return the uncached app shell', async (t) => {
  const { handler } = await fixture(t, '/app/');
  for (const url of ['/app', '/app/', '/app/simulator', '/app/simulator?mode=inspect', '/app/future/route']) {
    const response = await request(handler, url);
    assert.equal(response.status, 200, url);
    assert.equal(response.body.toString(), HTML);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(response.headers['cache-control'], NO_STORE);
    assert.equal(response.headers.pragma, 'no-cache');
    assert.equal(response.headers.expires, '0');
  }
});

test('existing hashed JavaScript, CSS and WASM retain exact bytes, MIME and immutable caching', async (t) => {
  const { handler, files } = await fixture(t);
  for (const [path, mime] of [
    ['assets/App-abc123.js', 'text/javascript'],
    ['assets/worker-def456.mjs', 'text/javascript'],
    ['assets/style-abc123.css', 'text/css'],
    ['assets/kernel-abc123.wasm', 'application/wasm'],
  ]) {
    const response = await request(handler, `/app/${path}?v=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, Buffer.from(files[path]));
    assert.equal(response.headers['content-type'], mime);
    assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.equal(response.headers.pragma, undefined);
  }
});

test('public demo JSON, seed scripts, icons and HTML remain uncached with their real content', async (t) => {
  const { handler, files } = await fixture(t);
  for (const [path, mime] of [
    ['demos/windmill.json', 'application/json'],
    ['seeds/windmill.js', 'text/javascript'],
    ['favicon.svg', 'image/svg+xml'],
    ['assets/info.html', 'text/html; charset=utf-8'],
  ]) {
    const response = await request(handler, `/app/${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, Buffer.from(files[path]));
    assert.equal(response.headers['content-type'], mime);
    assert.equal(response.headers['cache-control'], NO_STORE);
  }
});

test('missing static resources return uncached 404 rather than successful or immutable HTML', async (t) => {
  const { handler } = await fixture(t);
  for (const path of [
    'assets/stale-build.js', 'assets/missing.css', 'assets/missing.wasm',
    'assets/no-extension', 'assets', 'demos/missing.json', 'demos/missing',
    'seeds/missing.js', 'seeds/no-extension', 'favicon.ico', 'missing.woff2',
  ]) {
    const response = await request(handler, `/app/${path}?reload=1`);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers['cache-control'], NO_STORE);
    assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(response.body.toString(), 'Not found');
  }
});

test('base stripping respects path boundaries and still supports root deployment', async (t) => {
  const { dist, handler, files } = await fixture(t);
  const untouchedPrefix = await request(handler, '/application/example.json');
  assert.equal(untouchedPrefix.status, 200);
  assert.equal(untouchedPrefix.body.toString(), files['application/example.json']);
  const rootHandler = createProductionRequestHandler({ dist, basePath: '/' });
  assert.equal((await request(rootHandler, '/simulator')).body.toString(), HTML);
  assert.equal((await request(rootHandler, '/assets/App-abc123.js')).status, 200);
});

test('HEAD returns GET status and content/cache headers without a response body', async (t) => {
  const { handler } = await fixture(t);
  for (const url of ['/app/simulator', '/app/assets/App-abc123.js', '/app/demos/missing.json', '//[']) {
    const get = await request(handler, url);
    const head = await request(handler, url, 'HEAD');
    assert.equal(head.status, get.status);
    assert.equal(head.headers['content-type'], get.headers['content-type']);
    assert.equal(head.headers['cache-control'], get.headers['cache-control']);
    assert.equal(head.body.length, 0);
  }
});

test('missing app shell returns 404 and an unexpected filesystem failure stays in its request', async (t) => {
  const { dist, handler } = await fixture(t);
  await symlink('loop.js', join(dist, 'loop.js'));
  const failure = await request(handler, '/app/loop.js');
  assert.equal(failure.status, 500);
  assert.equal(failure.headers['cache-control'], NO_STORE);
  assert.equal(failure.body.toString(), 'Internal server error');
  assert.equal((await request(handler, '/app/simulator')).status, 200);
  await rm(join(dist, 'index.html'));
  const missing = await request(handler, '/app/simulator');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers['cache-control'], NO_STORE);
});

test('a disconnected response is left closed and cannot reject the asynchronous handler', async (t) => {
  const { handler } = await fixture(t);
  const response = { destroyed: true, writeHead() { assert.fail('closed response was written'); }, end() { assert.fail('closed response was ended again'); } };
  await assert.doesNotReject(handler({ url: '/app/', method: 'GET' }, response));
  await assert.doesNotReject(handler({ url: '//[', method: 'GET' }, response));
});
