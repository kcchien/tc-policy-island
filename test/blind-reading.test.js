import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskedColumnLabel, revealedIndex, shuffleColumns } from '../site/js/blind-reading.js';

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

test('打亂欄位順序：注入固定的隨機數時結果可重現，且不改動傳入的陣列', () => {
  const indices = [0, 1, 2];
  // 隨機數一律取 0：每一步都和第一個位置交換。
  assert.deepEqual(shuffleColumns(indices, () => 0), [1, 2, 0]);
  // 隨機數接近 1：每一步都和自己交換，順序不變。
  assert.deepEqual(shuffleColumns(indices, () => 0.999), [0, 1, 2]);
  assert.deepEqual(indices, [0, 1, 2]);
});

test('打亂欄位順序：三欄的六種排列都會出現，而且次數接近均勻', () => {
  const random = seeded(47);
  const counts = new Map();
  const runs = 6000;
  for (let i = 0; i < runs; i += 1) {
    const key = shuffleColumns([0, 1, 2], random).join('');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort(), ['012', '021', '102', '120', '201', '210']);
  for (const [key, count] of counts) {
    assert.ok(Math.abs(count - runs / 6) < runs / 6 * 0.15, `${key} 出現 ${count} 次`);
  }
});

test('遮住的欄位依畫面位置給中性代號，三欄同一套，不依候選人而不同', () => {
  assert.deepEqual([0, 1, 2].map(maskedColumnLabel), ['甲', '乙', '丙']);
});

test('揭曉時，遮名期間停在第幾欄的候選人，回到排序規則後找得到他原本的位置', () => {
  const order = [2, 0, 1];
  // 遮名時畫面第 0 欄是排序規則的第 2 位。
  assert.equal(revealedIndex(order, 0), 2);
  assert.equal(revealedIndex(order, 1), 0);
  assert.equal(revealedIndex(order, 2), 1);
  // 沒有遮名（沒有打亂的順序）時位置不變。
  assert.equal(revealedIndex(null, 1), 1);
});
