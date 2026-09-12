import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { createServer, loadConfigFromFile } from 'vite';
import { replitAllowedHosts } from '../../shared/viteAllowedHosts.mts';

test('absent Replit domains leave Vite localhost and IP defaults intact', () => {
  assert.deepEqual(replitAllowedHosts({}), []);
  assert.deepEqual(replitAllowedHosts({ REPLIT_DEV_DOMAIN: ' ', REPLIT_DOMAINS: ' , , ' }), []);
  assert.deepEqual(replitAllowedHosts({ UNRELATED_DOMAIN: 'untrusted.example' }), []);
});

test('Replit development and comma-separated application domains produce exact unique hosts', () => {
  assert.deepEqual(replitAllowedHosts({
    REPLIT_DEV_DOMAIN: ' CAD-PROJECT.replit.dev ',
    REPLIT_DOMAINS: ' kineticad.co.uk, www.kineticad.co.uk, cad-project.replit.dev, ,kineticad.co.uk ',
  }), ['cad-project.replit.dev', 'kineticad.co.uk', 'www.kineticad.co.uk']);
});

test('HTTP(S) origins are reduced to exact hostnames without making subdomain wildcards', () => {
  assert.deepEqual(replitAllowedHosts({
    REPLIT_DEV_DOMAIN: 'https://cad-project.replit.dev/',
    REPLIT_DOMAINS: 'http://kineticad.co.uk:8080,https://www.kineticad.co.uk',
  }), ['cad-project.replit.dev', 'kineticad.co.uk', 'www.kineticad.co.uk']);
});

test('wildcard and leading-dot tenant-domain settings fail closed', () => {
  for (const value of ['*', '*.replit.dev', '.replit.dev', 'https://*.replit.app', 'https://.replit.app']) {
    for (const key of ['REPLIT_DEV_DOMAIN', 'REPLIT_DOMAINS']) {
      assert.throws(() => replitAllowedHosts({ [key]: value }), new RegExp(key), `${key}: ${value}`);
    }
  }
});

test('invalid origins, credentials and hostname labels cannot silently widen trusted hosts', () => {
  for (const value of [
    'https://user:password@example.com', 'example.com/app', 'https://example.com?x=1',
    'example.com#fragment', 'ftp://example.com', '//example.com', 'host name.example',
    'example.com\\other', 'https://[', 'example..com', '-wrong.example',
    'wrong-.example', `${'x'.repeat(64)}.example`,
  ]) {
    assert.throws(() => replitAllowedHosts({ REPLIT_DOMAINS: `good.example,${value}` }), /REPLIT_DOMAINS/, value);
  }
});

test('host parsing does not mutate environment values or retain another invocation list', () => {
  const env = Object.freeze({ REPLIT_DEV_DOMAIN: 'one.replit.dev', REPLIT_DOMAINS: 'site.example' });
  const first = replitAllowedHosts(env);
  first.push('untrusted.example');
  assert.deepEqual(replitAllowedHosts(env), ['one.replit.dev', 'site.example']);
  assert.deepEqual(replitAllowedHosts({ REPLIT_DEV_DOMAIN: 'two.replit.dev' }), ['two.replit.dev']);
  assert.equal(env.REPLIT_DOMAINS, 'site.example');
});

function environment(t, values) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

test('CAD, landing and mockup configs apply the exact allowlist to development and preview', async (t) => {
  environment(t, {
    PORT: '5199', BASE_PATH: '/', NODE_ENV: 'production',
    REPLIT_DEV_DOMAIN: 'project.replit.dev', REPLIT_DOMAINS: 'kineticad.co.uk,www.kineticad.co.uk',
  });
  const expected = ['project.replit.dev', 'kineticad.co.uk', 'www.kineticad.co.uk'];
  for (const artifact of ['kineticad', 'landing', 'mockup-sandbox']) {
    const configPath = fileURLToPath(new URL(`../../${artifact}/vite.config.ts`, import.meta.url));
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'production' }, configPath);
    assert.ok(loaded, artifact);
    assert.deepEqual(loaded.config.server.allowedHosts, expected, `${artifact} development`);
    assert.deepEqual(loaded.config.preview.allowedHosts, expected, `${artifact} preview`);
  }
});

test('actual installed Vite middleware accepts configured/local hosts and rejects other tenants', async (t) => {
  environment(t, { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: undefined });
  const root = await mkdtemp(join(tmpdir(), 'kineticad-vite-hosts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await createServer({
    configFile: false, envFile: false, root, publicDir: false, logLevel: 'silent', appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false, watch: null, allowedHosts: replitAllowedHosts({
      REPLIT_DEV_DOMAIN: 'project.replit.dev', REPLIT_DOMAINS: 'kineticad.co.uk',
    }) },
    plugins: [{ name: 'host-check-response', configureServer(vite) {
      vite.middlewares.use((_req, res) => { res.statusCode = 204; res.end(); });
    } }],
  });
  try {
    assert.equal(server.httpServer, null, 'middleware-only instance has no listening HTTP server');
    async function requestHost(host) {
      const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
      try {
        return await new Promise((resolve, reject) => {
          const req = new IncomingMessage(socket);
          req.url = '/'; req.method = 'GET'; req.headers = { host };
          const res = new ServerResponse(req);
          res.assignSocket(socket);
          res.once('finish', () => resolve(res.statusCode));
          server.middlewares(req, res, (error) => reject(error ?? new Error('Host check response was not reached')));
        });
      } finally {
        socket.destroy();
      }
    }
    for (const host of ['project.replit.dev', 'kineticad.co.uk:5199', 'localhost:5199', 'local.localhost', '127.0.0.1', '[::1]:5199']) {
      assert.equal(await requestHost(host), 204, host);
    }
    for (const host of ['other.replit.dev', 'other.replit.app', 'sub.project.replit.dev', 'kineticad.co.uk.attacker.example', 'attacker.example']) {
      assert.equal(await requestHost(host), 403, host);
    }
  } finally {
    await server.close();
  }
});
