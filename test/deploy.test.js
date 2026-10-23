import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploy } from '../scripts/lib/deploy.js';

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

test('上線關卡失敗時不呼叫 wrangler', () => {
  const { run, calls } = fakeRunner({ 'node scripts/gates.js': { status: 1 } });

  const result = deploy({ run, log: () => {} });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, ['node --test', 'node scripts/build.js', 'node scripts/gates.js']);
});

test('檢查全過且專案已存在時，部署 site 到正式環境', () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': EXISTING_PROJECT });

  const result = deploy({ run, log: () => {} });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), [
    'wrangler pages project list --json',
    'wrangler pages deploy site --project-name tc-policy-island --branch main',
  ]);
});

test('專案不存在時先建立專案，正式環境分支為 main，再部署', () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '[]' } });

  const result = deploy({ run, log: () => {} });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), [
    'wrangler pages project list --json',
    'wrangler pages project create tc-policy-island --production-branch main --force',
    'wrangler pages deploy site --project-name tc-policy-island --branch main',
  ]);
});

test('專案清單不是 JSON 時中止，不建立專案也不部署', () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '有新版 wrangler 可更新\n[]' } });
  const logs = [];

  const result = deploy({ run, log: (line) => logs.push(line) });

  assert.equal(result.ok, false);
  assert.deepEqual(calls.slice(3), ['wrangler pages project list --json']);
  assert.ok(logs.some((line) => line.includes('不部署')));
});

test('建立專案失敗時不部署', () => {
  const { run, calls } = fakeRunner({
    'wrangler pages project list': { status: 0, stdout: '[]' },
    'wrangler pages project create': { status: 1 },
  });

  const result = deploy({ run, log: () => {} });

  assert.equal(result.ok, false);
  assert.equal(calls.some((line) => line.startsWith('wrangler pages deploy')), false);
});

test('試跑時跑完檢查與專案查詢，只列出建立與部署指令、不執行', () => {
  const { run, calls } = fakeRunner({ 'wrangler pages project list': { status: 0, stdout: '[]' } });
  const logs = [];

  const result = deploy({ run, log: (line) => logs.push(line), dryRun: true });

  assert.equal(result.ok, true);
  assert.deepEqual(calls.slice(3), ['wrangler pages project list --json']);
  assert.ok(logs.some((line) => line.includes('wrangler pages project create tc-policy-island --production-branch main')));
  assert.ok(logs.some((line) => line.includes('wrangler pages deploy site --project-name tc-policy-island --branch main')));
});

test('試跑時關卡失敗一樣中止，不列出部署指令', () => {
  const { run } = fakeRunner({ 'node scripts/gates.js': { status: 1 } });
  const logs = [];

  const result = deploy({ run, log: (line) => logs.push(line), dryRun: true });

  assert.equal(result.ok, false);
  assert.equal(logs.some((line) => line.includes('wrangler pages deploy')), false);
});
