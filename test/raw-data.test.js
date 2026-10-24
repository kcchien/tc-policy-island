import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRawData } from '../site/js/dataset.js';
import { loadRawData } from '../scripts/lib/raw-data.js';

const RAW_DIR = fileURLToPath(new URL('../data/raw', import.meta.url));
const SAMPLE_RAW = fileURLToPath(new URL('./fixtures/raw-sample', import.meta.url));

test('meta.json 自己帶 electionSchedule 時讀取失敗，不讓選舉時程檔靜默蓋掉它', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'raw-data-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const metaPath = join(rawDir, 'meta.json');
  writeFileSync(metaPath, JSON.stringify({ ...JSON.parse(readFileSync(metaPath, 'utf8')), electionSchedule: null }));

  assert.throws(() => loadRawData(rawDir), /不應有 electionSchedule/);
});

test('repo 內的正式原始資料通過結構驗證', () => {
  assert.deepEqual(validateRawData(loadRawData(RAW_DIR)), []);
});
