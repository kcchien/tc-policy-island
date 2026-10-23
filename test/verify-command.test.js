import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const VERIFY_SCRIPT = repoPath('scripts/verify.js');
const SAMPLE_RAW = repoPath('test/fixtures/raw-sample');
const FAKE_CLAUDE = repoPath('test/fixtures/fake-claude');
const BRAND_TERMS = repoPath('test/fixtures/rules/brand-terms.json');

function copySample() {
  const rawDir = mkdtempSync(join(tmpdir(), 'verify-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  return rawDir;
}

const readPolicies = (rawDir, candidateId) => JSON.parse(readFileSync(join(rawDir, 'policies', `${candidateId}.json`), 'utf8'));
const policyById = (rawDir, candidateId, id) => readPolicies(rawDir, candidateId).find((p) => p.id === id);

function editPolicy(rawDir, candidateId, id, change) {
  const policies = readPolicies(rawDir, candidateId);
  change(policies.find((p) => p.id === id));
  writeFileSync(join(rawDir, 'policies', `${candidateId}.json`), JSON.stringify(policies));
}

function verify(rawDir, args = [], { verdict = '通過' } = {}) {
  const log = join(mkdtempSync(join(tmpdir(), 'verify-log-')), 'calls.jsonl');
  const result = spawnSync(
    process.execPath,
    [VERIFY_SCRIPT, '--raw', rawDir, '--claude', FAKE_CLAUDE, '--brand-terms', BRAND_TERMS, '--date', '2026-10-24', ...args],
    { encoding: 'utf8', env: { ...process.env, FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_VERDICT: verdict } },
  );
  const calls = existsSync(log)
    ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    : [];
  return { code: result.status, output: result.stdout + result.stderr, calls };
}

test('核對指令對全部政見跑兩層核對，結果寫回原始資料', () => {
  const rawDir = copySample();

  const { code, output, calls } = verify(rawDir);

  assert.equal(code, 0, output);
  assert.equal(calls.length, 3);
  assert.deepEqual(policyById(rawDir, 'sample-jia', 'sample-jia-002').verification, {
    layer1: { status: 'pass', checkedAt: '2026-10-24' },
    layer2: {
      status: 'pass',
      reason: '假判定：通過',
      checklistVersion: '1',
      model: 'fake-model',
      checkedAt: '2026-10-24',
    },
  });
});

test('每筆政見各開一個全新 claude -p session：不帶工具與設定、不在 repo 內執行、看不到候選人', () => {
  const rawDir = copySample();
  editPolicy(rawDir, 'sample-jia', 'sample-jia-001', (p) => {
    p.summary = '範例甲在範例區增設三條公車路線，每 15 分鐘一班。';
  });

  const { calls } = verify(rawDir);

  assert.equal(calls.length, 3);
  for (const { args, cwd, prompt } of calls) {
    assert.equal(args[0], '-p');
    assert.equal(args[args.indexOf('--tools') + 1], '');
    assert.equal(args[args.indexOf('--setting-sources') + 1], '');
    for (const flag of ['--no-session-persistence', '--strict-mcp-config', '--disable-slash-commands', '--system-prompt', '--json-schema']) {
      assert.ok(args.includes(flag), flag);
    }
    assert.ok(!cwd.startsWith(repoPath('')), cwd);
    for (const leaked of ['範例甲', '範例乙', '範例丙', 'sample-']) assert.ok(!prompt.includes(leaked), leaked);
  }
});

test('--candidate 只核對指定候選人的政見，其他候選人的紀錄不變', () => {
  const rawDir = copySample();
  const otherFile = join(rawDir, 'policies', 'sample-jia.json');
  const before = readFileSync(otherFile, 'utf8');

  const { code, output, calls } = verify(rawDir, ['--candidate', 'sample-yi']);

  assert.equal(code, 0, output);
  assert.equal(calls.length, 1);
  assert.equal(policyById(rawDir, 'sample-yi', 'sample-yi-001').verification.layer2.model, 'fake-model');
  assert.equal(readFileSync(otherFile, 'utf8'), before);
});

test('--candidate 指向不存在的候選人時以非零結束碼退出', () => {
  const { code, output, calls } = verify(copySample(), ['--candidate', 'no-such']);

  assert.notEqual(code, 0);
  assert.match(output, /no-such/);
  assert.equal(calls.length, 0);
});

test('--skip-passed 只跑未核對或已退回的政見', () => {
  const rawDir = copySample();
  editPolicy(rawDir, 'sample-yi', 'sample-yi-001', (p) => {
    p.verification.layer2.status = 'fail';
  });

  editPolicy(rawDir, 'sample-jia', 'sample-jia-001', (p) => {
    p.verification.layer2.checklistVersion = '1';
  });

  const { code, output, calls } = verify(rawDir, ['--skip-passed']);

  assert.equal(code, 0, output);
  assert.equal(calls.length, 2);
  assert.equal(policyById(rawDir, 'sample-jia', 'sample-jia-001').verification.layer2.model, 'sample-model');
  assert.equal(policyById(rawDir, 'sample-jia', 'sample-jia-002').verification.layer2.status, 'pass');
  assert.equal(policyById(rawDir, 'sample-yi', 'sample-yi-001').verification.layer2.status, 'pass');
});

test('--skip-passed 會重跑以舊版檢核表通過的政見', () => {
  const rawDir = copySample();

  const { calls } = verify(rawDir, ['--skip-passed', '--candidate', 'sample-yi']);

  assert.equal(calls.length, 1);
  assert.equal(policyById(rawDir, 'sample-yi', 'sample-yi-001').verification.layer2.checklistVersion, '1');
});

test('第一層不通過就不送第二層，第二層維持未核對', () => {
  const rawDir = copySample();
  editPolicy(rawDir, 'sample-jia', 'sample-jia-002', (p) => {
    p.quotes[0].text = '範例區增設三座範例公園。';
  });

  const { code, output, calls } = verify(rawDir, ['--candidate', 'sample-jia']);

  assert.equal(code, 0, output);
  assert.equal(calls.length, 1);
  assert.deepEqual(policyById(rawDir, 'sample-jia', 'sample-jia-002').verification, {
    layer1: { status: 'fail', checkedAt: '2026-10-24' },
    layer2: { status: 'pending', reason: null, checklistVersion: null, model: null, checkedAt: null },
  });
  assert.match(output, /sample-jia-002：第一層不通過/);
});

test('出處快照雜湊與出處紀錄不符時，第一層不通過', () => {
  const rawDir = copySample();
  const file = join(rawDir, 'sources', 'sample-yi.json');
  const sources = JSON.parse(readFileSync(file, 'utf8'));
  sources[0].snapshotSha256 = '0'.repeat(64);
  writeFileSync(file, JSON.stringify(sources));

  const { output, calls } = verify(rawDir, ['--candidate', 'sample-yi']);

  assert.equal(calls.length, 0);
  assert.equal(policyById(rawDir, 'sample-yi', 'sample-yi-001').verification.layer1.status, 'fail');
  assert.match(output, /雜湊/);
});

test('第二層退回或輸出格式錯誤時寫成不通過，並記錄原因', () => {
  const rejected = copySample();
  const { output } = verify(rejected, ['--candidate', 'sample-yi'], { verdict: '退回' });
  assert.match(output, /sample-yi-001：第一層通過、第二層退回/);
  const malformed = copySample();
  verify(malformed, ['--candidate', 'sample-yi'], { verdict: 'malformed' });

  const rejectedRecord = policyById(rejected, 'sample-yi', 'sample-yi-001').verification.layer2;
  assert.equal(rejectedRecord.status, 'fail');
  assert.equal(rejectedRecord.reason, '假判定：退回');
  const malformedRecord = policyById(malformed, 'sample-yi', 'sample-yi-001').verification.layer2;
  assert.equal(malformedRecord.status, 'fail');
  assert.match(malformedRecord.reason, /^第二層輸出格式錯誤：/);
  assert.equal(malformedRecord.model, 'claude-opus-5-5');
});

test('claude 執行檔不存在時中止並以非零結束碼退出，不寫成退回', () => {
  const rawDir = copySample();
  const before = readPolicies(rawDir, 'sample-yi');
  const result = spawnSync(
    process.execPath,
    [VERIFY_SCRIPT, '--raw', rawDir, '--claude', '/no/such/claude', '--brand-terms', BRAND_TERMS, '--candidate', 'sample-yi'],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /無法執行/);
  assert.deepEqual(readPolicies(rawDir, 'sample-yi'), before);
});

test('品牌用語清單不存在時以非零結束碼退出', () => {
  const result = spawnSync(
    process.execPath,
    [VERIFY_SCRIPT, '--raw', copySample(), '--claude', FAKE_CLAUDE, '--brand-terms', '/no/such/brand-terms.json'],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /brand-terms/);
});
