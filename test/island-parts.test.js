import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partBuckets } from '../site/js/island-parts.js';

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

test('繪製呼叫數不隨零件數線性增加：零件從 60 個加到 6000 個，桶數不變', () => {
  const counts = [60, 600, 6000].map((n) => partBuckets(parts(n)).length);
  assert.deepEqual(counts, [6, 6, 6]);
});

test('每個實例保留自己的顏色與變換', () => {
  const [box] = partBuckets(parts(12));
  assert.deepEqual(box.items.map((p) => [p.color, p.transform.position[0]]), [[0x100000, 0], [0x100006, 6]]);
});
