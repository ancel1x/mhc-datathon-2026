import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');
let version = 0;
async function moduleWithEnv(env = {}) {
  // Supply the same import.meta.env values that Vite substitutes for a deployed build.
  const code = source.replaceAll('import.meta.env', JSON.stringify(env));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${version++}`);
}

test('standalone bundles load directly and concurrent requests share a promise', async (t) => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return Response.json({ ok: true }); });
  const { loadJson, peekJson } = await moduleWithEnv({ BASE_URL: '/story/' });
  const first = loadJson('summary');
  assert.equal(loadJson('summary'), first);
  assert.equal(peekJson('summary'), first);
  assert.deepEqual(await first, { ok: true });
  await loadJson('aq_monitors');
  assert.deepEqual(urls, ['/story/data/summary.json', '/story/data/aq_monitors.geojson']);
});

test('an explicitly configured API remains primary', async (t) => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return Response.json({ live: true }); });
  const { loadJson } = await moduleWithEnv({ VITE_API_BASE: '/api/' });
  assert.deepEqual(await loadJson('summary'), { live: true });
  await loadJson('aq_monitors');
  assert.deepEqual(urls, ['/api/bundle/summary', '/api/geo/aq_monitors']);
});

for (const failure of ['http', 'html', 'network', 'timeout']) {
  test(`API ${failure} failure falls back to the static data`, async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url);
      if (url.startsWith('/api/')) {
        if (failure === 'http') return new Response('', { status: 503 });
        if (failure === 'html') return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
        if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
        throw new TypeError('Failed to fetch');
      }
      return Response.json({ fallback: true });
    });
    const { loadJson } = await moduleWithEnv({ VITE_API_BASE: '/api' });
    assert.deepEqual(await loadJson('summary'), { fallback: true });
    assert.deepEqual(urls, ['/api/bundle/summary', '/data/summary.json']);
  });
}

test('a failed static request can be retried instead of poisoning the cache', async (t) => {
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++attempts === 1) return new Response('', { status: 503 });
    return Response.json({ recovered: true });
  });
  const { loadJson, peekJson } = await moduleWithEnv();
  await assert.rejects(loadJson('summary'), /503/);
  assert.equal(peekJson('summary'), null);
  assert.deepEqual(await loadJson('summary'), { recovered: true });
});
