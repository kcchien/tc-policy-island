import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partBuckets, SCALE_JITTER, scaleJitter } from '../site/js/island-parts.js';

const SHAPES = ['box', 'cone6', 'cyl8:0.5'];
const MATERIALS = ['standard', 'glow'];

// count 個零件，輪流用各種形體與材質，每個有自己的位置與顏色。
function parts(count) {
  return Array.from({ length: count }, (_, i) => ({
    shape: SHAPES[i % SHAPES.length],
    material: MATERIALS[Math.floor(i / SHAPES.length) % MATERIALS.length],
    transform: { position: [i, 0, 0] },
    color: 0x100000 + i,
  }));
}

test('同種形體、同種材質的零件收進同一桶（一個 InstancedMesh、一次繪製呼叫）', () => {
  const buckets = partBuckets(parts(12));

  assert.deepEqual(buckets.map((b) => [b.shape, b.material, b.items.length]), [
    ['box', 'standard', 2], ['cone6', 'standard', 2], ['cyl8:0.5', 'standard', 2],
    ['box', 'glow', 2], ['cone6', 'glow', 2], ['cyl8:0.5', 'glow', 2],
  ]);
});

test('遠距離隱藏的小物件另外分桶：同形體同材質也不和一般零件同桶，桶上標明 lod', () => {
  const [a, b] = parts(2);
  const buckets = partBuckets([a, { ...a, lod: 'small' }, b, { ...a, lod: 'small' }]);

  assert.deepEqual(buckets.map((x) => [x.shape, x.material, x.lod, x.items.length]), [
    ['box', 'standard', null, 1], ['box', 'standard', 'small', 2], ['cone6', 'standard', null, 1],
  ]);
});

test('繪製呼叫數不隨零件數線性增加：零件從 60 個加到 6000 個，桶數不變', () => {
  const counts = [60, 600, 6000].map((n) => partBuckets(parts(n)).length);
  assert.deepEqual(counts, [6, 6, 6]);
});

test('實例縮放微抖動：在 1 ± 0.0072 之內、每次載入相同、相鄰實例不同（共面的零件不會 z-fighting）', () => {
  assert.equal(SCALE_JITTER, 0.0072);
  const values = Array.from({ length: 200 }, (_, i) => scaleJitter(i));
  assert.ok(values.every((v) => v >= 1 - 0.0072 && v <= 1 + 0.0072));
  assert.deepEqual(values, Array.from({ length: 200 }, (_, i) => scaleJitter(i)));
  assert.ok(values.slice(1).every((v, i) => v !== values[i]));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.01, '抖動幅度太小');
});

test('每個實例保留自己的顏色與變換', () => {
  const [box] = partBuckets(parts(12));
  assert.deepEqual(box.items.map((p) => [p.color, p.transform.position[0]]), [[0x100000, 0], [0x100006, 6]]);
});
