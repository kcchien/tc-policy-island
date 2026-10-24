import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploy, checkStatsDataset, accountIdFrom } from '../scripts/lib/deploy.js';

// 假執行器：記下每個指令，依 results 回傳結束碼與輸出（沒指定就成功、無輸出）。
function fakeRunner(results = {}) {
  const calls = [];
  const run = (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    const match = Object.entries(results).find(([prefix]) => line.startsWith(prefix));
    return match ? match[1] : { status: 0, stdout: '' };
  };
  return { run, calls };
}

const EXISTING_PROJECT = { status: 0, stdout: JSON.stringify([{ 'Project Name': 'tc-policy-island' }]) };

test('上線關卡失敗時不呼叫 wrangler', async () => {
  const { run, calls } = fakeRunner({ 'node scripts/gates.js': { status: 1 } });

  const result = await deploy({ run, log: () => {} });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['node --test', 'node scripts/build.js', 'node scripts/gates.js']);
});

test('檢查全過且專案已存在時，部署 site 到正式環境', async () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': EXISTING_PROJECT });

  const result = await deploy({ run, log: () => {} });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), [
    'wrangler pages project list --json',
    'wrangler pages deploy site --project-name tc-policy-island --branch main',
  ]);
});

test('專案不存在時先建立專案，正式環境分支為 main，再部署', async () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '[]' } });

  const result = await deploy({ run, log: () => {} });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), [
    'wrangler pages project list --json',
    'wrangler pages project create tc-policy-island --production-branch main --force',
    'wrangler pages deploy site --project-name tc-policy-island --branch main',
  ]);
});

test('專案清單不是 JSON 時中止，不建立專案也不部署', async () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '有新版 wrangler 可更新\n[]' } });
  const logs = [];

  const result = await deploy({ run, log: (line) => logs.push(line) });

  assert.equal(result.ok, false);
  assert.deepEqual(calls.slice(3), ['wrangler pages project list --json']);
  assert.ok(logs.some((line) => line.includes('不部署')));
});

test('建立專案失敗時不部署', async () => {
  const { run, calls } = fakeRunner({
    'wrangler pages project list': { status: 0, stdout: '[]' },
    'wrangler pages project create': { status: 1 },
  });

  const result = await deploy({ run, log: () => {} });

  assert.equal(result.ok, false);
  assert.equal(calls.some((line) => line.startsWith('wrangler pages deploy')), false);
});

test('試跑時跑完檢查與專案查詢，只列出建立與部署指令、不執行', async () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '[]' } });
  const logs = [];

  const result = await deploy({ run, log: (line) => logs.push(line), dryRun: true });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), ['wrangler pages project list --json']);
  assert.ok(logs.some((line) => line.includes('wrangler pages project create tc-policy-island --production-branch main')));
  assert.ok(logs.some((line) => line.includes('wrangler pages deploy site --project-name tc-policy-island --branch main')));
});

test('試跑時關卡失敗一樣中止，不列出部署指令', async () => {
  const { run } = fakeRunner({ 'node scripts/gates.js': { status: 1 } });
  const logs = [];

  const result = await deploy({ run, log: (line) => logs.push(line), dryRun: true });

  assert.equal(result.ok, false);
  assert.equal(logs.some((line) => line.includes('wrangler pages deploy')), false);
});

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';

// 假 fetch：記下請求，回傳指定的狀態碼與內容；error 有值時模擬網路錯誤。
function fakeFetch({ status = 200, body = '', error } = {}) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    if (error) throw error;
    return new Response(body, { status });
  };
  return { fetch, requests };
}

test('統計資料集查詢回 200 時通過，查詢是帶權杖的 SELECT 1', async () => {
  const { fetch, requests } = fakeFetch({ status: 200, body: '{"data":[{"1":1}]}' });

  const result = await checkStatsDataset({ accountId: ACCOUNT_ID, token: 'tok', fetch });

  assert.equal(result.ok, true);
  assert.equal(requests[0].url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`);
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.body, 'SELECT 1');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer tok');
});

test('統計資料集查詢回 403 時視為未啟用 Analytics Engine，附後台啟用網址', async () => {
  const { fetch } = fakeFetch({ status: 403, body: '{"success":false}' });

  const result = await checkStatsDataset({ accountId: ACCOUNT_ID, token: 'tok', fetch });

  assert.equal(result.ok, false);
  assert.match(result.reason, /啟用 Analytics Engine/);
  assert.ok(result.reason.includes(`https://dash.cloudflare.com/${ACCOUNT_ID}/workers/analytics-engine`));
});

test('統計資料集查詢回其他非 200 狀態碼時失敗，附狀態碼與回應前 200 字', async () => {
  const body = `伺服器錯誤${'x'.repeat(300)}`;
  const { fetch } = fakeFetch({ status: 500, body });

  const result = await checkStatsDataset({ accountId: ACCOUNT_ID, token: 'tok', fetch });

  assert.equal(result.ok, false);
  assert.match(result.reason, /500/);
  assert.ok(result.reason.includes(body.slice(0, 200)));
  assert.equal(result.reason.includes(body.slice(0, 201)), false);
});

test('統計資料集查詢遇到網路錯誤時失敗，不放行', async () => {
  const { fetch } = fakeFetch({ error: new TypeError('fetch failed') });

  const result = await checkStatsDataset({ accountId: ACCOUNT_ID, token: 'tok', fetch });

  assert.equal(result.ok, false);
  assert.match(result.reason, /fetch failed/);
});

test('找不到 CLOUDFLARE_API_TOKEN 時略過檢查、不送查詢，部署流程照走', async () => {
  const { fetch, requests } = fakeFetch();

  const result = await checkStatsDataset({ accountId: ACCOUNT_ID, token: undefined, fetch });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, '略過統計資料集檢查：找不到 CLOUDFLARE_API_TOKEN');
  assert.equal(requests.length, 0);
});

test('找不到帳號識別碼時略過檢查、不送查詢，部署流程照走', async () => {
  const { fetch, requests } = fakeFetch();

  const result = await checkStatsDataset({ accountId: null, token: 'tok', fetch });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, '略過統計資料集檢查：找不到帳號識別碼');
  assert.equal(requests.length, 0);
});

const WHOAMI_OUTPUT = `👋 You are logged in with an User API Token.
┌────────────────┬──────────────────────────────────┐
│ Account Name   │ Account ID                       │
├────────────────┼──────────────────────────────────┤
│ 範例帳號       │ fedcba9876543210fedcba9876543210 │
└────────────────┴──────────────────────────────────┘`;

test('帳號識別碼優先取 CLOUDFLARE_ACCOUNT_ID，其次 wrangler whoami 輸出中的 32 位十六進位字串', () => {
  assert.equal(accountIdFrom({ envAccountId: ACCOUNT_ID, whoamiOutput: WHOAMI_OUTPUT }), ACCOUNT_ID);
  assert.equal(accountIdFrom({ envAccountId: undefined, whoamiOutput: WHOAMI_OUTPUT }), 'fedcba9876543210fedcba9876543210');
  assert.equal(accountIdFrom({ envAccountId: '', whoamiOutput: 'You are not authenticated.' }), null);
});

test('關卡之後統計資料集查詢回 403 時中止，不碰 Pages 專案也不部署', async () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': EXISTING_PROJECT });
  const { fetch } = fakeFetch({ status: 403 });
  const logs = [];
  const env = { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

  const result = await deploy({ run, log: (line) => logs.push(line), env, fetch });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['node --test', 'node scripts/build.js', 'node scripts/gates.js']);
  assert.ok(logs.some((line) => line.includes('啟用 Analytics Engine') && line.includes('不部署')));
});

test('沒有 CLOUDFLARE_ACCOUNT_ID 時以 wrangler whoami 取帳號識別碼，查詢通過後照常部署', async () => {
  const { run, calls } = fakeRunner({
    'wrangler whoami': { status: 0, stdout: WHOAMI_OUTPUT },
    'wrangler pages project list': EXISTING_PROJECT,
  });
  const { fetch, requests } = fakeFetch({ status: 200 });

  const result = await deploy({ run, log: () => {}, env: { CLOUDFLARE_API_TOKEN: 'tok' }, fetch });

  assert.equal(result.ok, true);
  assert.ok(requests[0].url.includes('/accounts/fedcba9876543210fedcba9876543210/'));
  assert.deepEqual(calls.slice(3), [
    'wrangler whoami',
    'wrangler pages project list --json',
    'wrangler pages deploy site --project-name tc-policy-island --branch main',
  ]);
});
