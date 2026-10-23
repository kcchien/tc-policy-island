import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_SCRIPT = fileURLToPath(new URL('../scripts/build.js', import.meta.url));
const SAMPLE_RAW = fileURLToPath(new URL('./fixtures/raw-sample', import.meta.url));

function build(rawDir) {
  const out = join(mkdtempSync(join(tmpdir(), 'build-out-')), 'dataset.json');
  const result = spawnSync(process.execPath, [BUILD_SCRIPT, '--raw', rawDir, '--out', out], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr, out };
}

test('建置指令從原始資料目錄產出公開資料集，未核對政見不在其中', () => {
  const { code, output, out } = build(SAMPLE_RAW);

  assert.equal(code, 0, output);
  const dataset = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(
    dataset.policies.map((p) => p.id),
    ['sample-jia-001', 'sample-yi-001'],
  );
  assert.deepEqual(
    dataset.candidates.map((c) => c.id),
    ['sample-jia', 'sample-yi', 'sample-bing'],
  );
  assert.match(dataset.meta.builtAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('建置指令把公開出處的出處快照複製到公開資料集旁的 snapshots/，讓卡片的快照連結可用', () => {
  const { code, output, out } = build(SAMPLE_RAW);

  assert.equal(code, 0, output);
  const copied = readFileSync(join(dirname(out), 'snapshots', 'sample-src-jia.txt'), 'utf8');
  const original = readFileSync(new URL('./fixtures/snapshots/sample-src-jia.txt', import.meta.url), 'utf8');
  assert.equal(copied, original);
});

test('公開出處的出處快照檔不存在時，建置失敗並指出是哪個出處', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const file = join(rawDir, 'sources', 'sample-yi.json');
  const sources = JSON.parse(readFileSync(file, 'utf8'));
  sources[0].snapshotPath = 'test/fixtures/snapshots/missing.txt';
  writeFileSync(file, JSON.stringify(sources));

  const { code, output } = build(rawDir);

  assert.notEqual(code, 0);
  assert.match(output, /出處 sample-src-yi 的出處快照 test\/fixtures\/snapshots\/missing\.txt 不存在/);
});

test('原始資料結構錯誤時，建置指令以非零結束碼退出並列出錯誤', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const file = join(rawDir, 'policies', 'sample-jia.json');
  const policies = JSON.parse(readFileSync(file, 'utf8'));
  policies[0].issueAreaId = 'no-such-area';
  writeFileSync(file, JSON.stringify(policies));

  const { code, output } = build(rawDir);

  assert.notEqual(code, 0);
  assert.match(output, /政見 sample-jia-001：issueAreaId 指向不存在的議題區 no-such-area/);
});
