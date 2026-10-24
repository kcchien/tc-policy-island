import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { filterViewModel } from '../site/js/filter.js';
import { pickRandomArea } from '../site/js/random-area.js';
import { makeRaw } from './fixtures/make-raw.js';

// 三個議題區：area-a 有兩筆政見，area-b 與 area-c 沒有任何政見。
function sampleViewModel() {
  const raw = makeRaw();
  raw.issueAreas.push({ ...raw.issueAreas[1], id: 'area-c', name: '議題區三', axial: [2, 0] });
  return buildViewModel(buildPublicDataset(raw));
}

test('注入固定的隨機數時，依議題區順序選出對應的議題區', () => {
  const { rows } = sampleViewModel();
  assert.equal(pickRandomArea(rows, () => 0), 'area-a');
  assert.equal(pickRandomArea(rows, () => 0.5), 'area-b');
  assert.equal(pickRandomArea(rows, () => 0.99), 'area-c');
});

test('連續兩次不抽到同一個議題區：上一次的議題區排除在外，其餘仍依順序對應', () => {
  const { rows } = sampleViewModel();
  for (const r of [0, 0.3, 0.6, 0.99]) {
    assert.notEqual(pickRandomArea(rows, () => r, 'area-b'), 'area-b');
  }
  assert.equal(pickRandomArea(rows, () => 0, 'area-a'), 'area-b');
  assert.equal(pickRandomArea(rows, () => 0.99, 'area-a'), 'area-c');
});

// 可重現的偽隨機數（mulberry32），讓抽樣測試每次結果相同。
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tally(rows, draws, { chained }) {
  const random = seeded(36);
  const counts = Object.fromEntries(rows.map((row) => [row.issueArea.id, 0]));
  let previous = null;
  for (let i = 0; i < draws; i += 1) {
    const id = pickRandomArea(rows, random, chained ? previous : null);
    counts[id] += 1;
    previous = id;
  }
  return counts;
}

test('大量抽樣時各議題區次數接近均勻，不依政見數量加權（沒有政見的議題區也一樣常被抽到）', () => {
  const { rows } = sampleViewModel();
  const policyCounts = rows.map((row) => row.cells.reduce((sum, cell) => sum + cell.policies.length, 0));
  assert.deepEqual(policyCounts, [2, 0, 0]);
  for (const chained of [false, true]) {
    const counts = tally(rows, 30000, { chained });
    for (const [id, count] of Object.entries(counts)) {
      assert.ok(Math.abs(count - 10000) < 300, `${id} 抽到 ${count} 次（chained=${chained}）`);
    }
  }
});

test('篩選後仍從全部議題區抽：傳入完整檢視模型的 rows，篩選掉的議題區照樣抽得到', () => {
  const vm = sampleViewModel();
  const filtered = filterViewModel(vm, { query: '', district: '大里區' });
  assert.ok(filtered.rows.length < vm.rows.length);
  const counts = tally(vm.rows, 3000, { chained: true });
  assert.ok(Object.values(counts).every((count) => count > 0));
});

test('只有一個議題區時，連續兩次都抽到它', () => {
  const rows = sampleViewModel().rows.slice(0, 1);
  assert.equal(pickRandomArea(rows, () => 0.5, 'area-a'), 'area-a');
});
