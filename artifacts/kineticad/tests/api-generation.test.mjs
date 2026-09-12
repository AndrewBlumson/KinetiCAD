import test from 'node:test';
import assert from 'node:assert/strict';
import {
  healthCheck, getHealthCheckUrl, getHealthCheckQueryOptions,
} from '../../../lib/api-client-react/src/generated/api.ts';
import { HealthCheckResponse } from '../../../lib/api-zod/src/generated/api.ts';

test('regenerated health client preserves the API path, GET request and JSON response', async (t) => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/healthz');
    assert.equal(options.method, 'GET');
    assert.equal(options.signal, controller.signal);
    assert.equal(new Headers(options.headers).get('x-test'), 'health-contract');
    return Response.json({ status: 'ok' });
  });
  assert.equal(getHealthCheckUrl(), '/api/healthz');
  assert.deepEqual(await healthCheck({ signal: controller.signal, headers: { 'x-test': 'health-contract' } }), { status: 'ok' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('regenerated query accepts partial options and forwards query cancellation to the request', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    return Response.json({ status: 'ok' });
  });
  const options = getHealthCheckQueryOptions({ query: { enabled: false, staleTime: 500 } });
  assert.equal(options.enabled, false);
  assert.equal(options.staleTime, 500);
  assert.deepEqual(options.queryKey, ['/api/healthz']);
  assert.deepEqual(await options.queryFn({ queryKey: options.queryKey, signal: controller.signal, meta: undefined }), { status: 'ok' });
});

test('regenerated health response schema retains the required string status contract', () => {
  assert.deepEqual(HealthCheckResponse.parse({ status: 'ok' }), { status: 'ok' });
  assert.equal(HealthCheckResponse.safeParse({}).success, false);
  assert.equal(HealthCheckResponse.safeParse({ status: 7 }).success, false);
});
