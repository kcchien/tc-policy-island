import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/hit.js';

// 假的統計資料集綁定：記下每次寫入的資料點。
function fakeEnv() {
  const points = [];
  return { points, env: { HITS: { writeDataPoint: (point) => points.push(point) } } };
}

const post = (body, headers = {}) => new Request('https://example.org/api/hit', {
  method: 'POST',
  headers,
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('頁面瀏覽：寫入一筆資料點，回 204，不設 cookie', async () => {
  const { points, env } = fakeEnv();
  const response = await onRequest({ request: post({ kind: 'pageview', id: null, view: 'island' }), env });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(points, [{ blobs: ['pageview', '', 'island'], doubles: [1], indexes: ['pageview'] }]);
});

test('出處點擊：寫入出處識別碼與當時的檢視', async () => {
  const { points, env } = fakeEnv();
  const response = await onRequest({ request: post({ kind: 'source', id: 'cand-a-site', view: 'table' }), env });

  assert.equal(response.status, 204);
  assert.deepEqual(points, [{ blobs: ['source', 'cand-a-site', 'table'], doubles: [1], indexes: ['source'] }]);
});

test('不是 POST 回 405，不寫入', async () => {
  const { points, env } = fakeEnv();
  const response = await onRequest({ request: new Request('https://example.org/api/hit'), env });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.deepEqual(points, []);
});

test('格式不合回 400，不寫入', async () => {
  const bad = [
    'not json',
    '[]',
    'null',
    { kind: 'click', id: null, view: 'island' },
    { kind: 'pageview', id: null, view: 'home' },
    { kind: 'pageview', id: 'cand-a-site', view: 'island' },
    { kind: 'source', id: null, view: 'island' },
    { kind: 'source', id: '', view: 'island' },
    { kind: 'source', id: 42, view: 'island' },
    { kind: 'source', id: 'x'.repeat(200), view: 'island' },
    { kind: 'source', id: '<script>', view: 'island' },
    { kind: 'pageview', id: null, view: 'island', extra: 'cand-a' },
    'x'.repeat(5000),
  ];
  for (const body of bad) {
    const { points, env } = fakeEnv();
    const response = await onRequest({ request: post(body), env });
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80));
    assert.deepEqual(points, []);
  }
});

test('不讀請求標頭：IP、裝置、來源網址、cookie 都不會進資料點', async () => {
  const { points, env } = fakeEnv();
  const identifying = {
    'cf-connecting-ip': '203.0.113.7',
    'x-forwarded-for': '203.0.113.7',
    'user-agent': 'Reader-Device/1.0',
    referer: 'https://referrer.example/',
    cookie: 'reader=abc123',
  };
  const real = post({ kind: 'source', id: 'cand-a-site', view: 'island' }, identifying);
  // 讀到 headers 就記下來；端點不該碰它。
  const touched = [];
  const request = {
    method: real.method,
    text: () => real.text(),
    get headers() {
      touched.push('headers');
      return real.headers;
    },
    get cf() {
      touched.push('cf');
      return { country: 'TW' };
    },
  };
  const response = await onRequest({ request, env });

  assert.equal(response.status, 204);
  assert.deepEqual(touched, []);
  const written = JSON.stringify(points);
  for (const value of Object.values(identifying)) assert.equal(written.includes(value), false, value);
  assert.equal(response.headers.get('set-cookie'), null);
});
