import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { filterViewModel } from '../site/js/filter.js';
import { markSeen, nextAreaId, parseSeen, SEEN_KEY, serializeSeen } from '../site/js/reading-progress.js';
import { makeRaw } from './fixtures/make-raw.js';

// 三個議題區：area-a 有政見，area-b 與 area-c 沒有。
function sampleRows() {
  const raw = makeRaw();
  raw.issueAreas.push({ ...raw.issueAreas[1], id: 'area-c', name: '議題區三', axial: [2, 0] });
  return buildViewModel(buildPublicDataset(raw)).rows;
}

test('下一題依議題區編號往後，最後一題接回第一題', () => {
  const rows = sampleRows();
  assert.equal(nextAreaId(rows, 'area-a', 1), 'area-b');
  assert.equal(nextAreaId(rows, 'area-b', 1), 'area-c');
  assert.equal(nextAreaId(rows, 'area-c', 1), 'area-a');
});

test('上一題往前，第一題接到最後一題', () => {
  const rows = sampleRows();
  assert.equal(nextAreaId(rows, 'area-b', -1), 'area-a');
  assert.equal(nextAreaId(rows, 'area-a', -1), 'area-c');
});

test('還沒開過任何議題區時，下一題從第一題開始、上一題從最後一題開始', () => {
  const rows = sampleRows();
  assert.equal(nextAreaId(rows, null, 1), 'area-a');
  assert.equal(nextAreaId(rows, null, -1), 'area-c');
});

test('下一題只看完整的議題區順序，不受篩選與政見數量影響', () => {
  const raw = makeRaw();
  raw.issueAreas.push({ ...raw.issueAreas[1], id: 'area-c', name: '議題區三', axial: [2, 0] });
  const vm = buildViewModel(buildPublicDataset(raw));
  // 篩選後 area-b、area-c 沒有符合的政見而整列移除，但下一題仍用完整的 rows。
  const filtered = filterViewModel(vm, { query: 'area-a', district: '' });
  assert.ok(filtered.rows.length < vm.rows.length);
  assert.equal(nextAreaId(vm.rows, 'area-a', 1), 'area-b');
});

test('看過紀錄：加入議題區不改動原集合，序列化後解析回相同的集合', () => {
  const empty = new Set();
  const seen = markSeen(markSeen(empty, 'area-b'), 'area-a');
  assert.equal(empty.size, 0);
  assert.deepEqual([...parseSeen(serializeSeen(seen))].sort(), ['area-a', 'area-b']);
  assert.equal(markSeen(seen, 'area-a').size, 2);
  assert.equal(SEEN_KEY, 'policy-island:areas-seen');
});

test('看過紀錄是壞資料時回空集合，陣列裡不是文字的項目略過', () => {
  for (const bad of [null, '', '{', '"area-a"', '{"a":1}', '42']) {
    assert.deepEqual([...parseSeen(bad)], [], String(bad));
  }
  assert.deepEqual([...parseSeen('["area-a", 3, null, "area-b"]')], ['area-a', 'area-b']);
});
