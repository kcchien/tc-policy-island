import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateRawData } from '../site/js/dataset.js';
import { loadRawData } from '../scripts/lib/raw-data.js';

const RAW_DIR = fileURLToPath(new URL('../data/raw', import.meta.url));

test('repo 內的正式原始資料通過結構驗證', () => {
  assert.deepEqual(validateRawData(loadRawData(RAW_DIR)), []);
});
