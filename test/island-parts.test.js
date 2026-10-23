import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castsShadow, partBuckets, SCALE_JITTER, scaleJitter } from '../site/js/island-parts.js';

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

const summary = (buckets) => buckets.map((b) => [b.merged ? 'merged' : b.shape, b.material, b.items.length]);

test('非發光零件不分形體：同材質的零件合成一桶（合併成一個網格、一次繪製呼叫）；發光件依形體分桶（InstancedMesh）', () => {
  const buckets = partBuckets(parts(12));

  assert.deepEqual(summary(buckets), [
    ['merged', 'standard', 6],
    ['box', 'glow', 2], ['cone6', 'glow', 2], ['cyl8:0.5', 'glow', 2],
  ]);
  assert.ok(buckets.filter((b) => b.material !== 'glow').every((b) => b.merged));
});

test('遠距離隱藏的小物件另外分桶：同材質也不和一般零件同桶，桶上標明 lod', () => {
  const [a, b] = parts(2);
  const buckets = partBuckets([a, { ...a, lod: 'small' }, b, { ...a, lod: 'small' }]);

  assert.deepEqual(buckets.map((x) => [x.material, x.lod, x.items.length]), [
    ['standard', null, 2], ['standard', 'small', 2],
  ]);
});

test('投影的零件另外分桶，陰影那一趟只畫投影的桶', () => {
  const [a, b] = parts(2);
  const buckets = partBuckets([a, { ...b, castShadow: true }, { ...a, castShadow: true }, b]);

  assert.deepEqual(buckets.map((x) => [x.castShadow, x.items.length]), [[false, 2], [true, 2]]);
});

test('合併的桶依議題區排序：同一區的零件相鄰（點選與選取抬高用區段），區內維持原順序', () => {
  const [a, b, c] = parts(3);
  const buckets = partBuckets([
    { ...a, owner: 'x' }, { ...b, owner: null }, { ...c, owner: 'y' }, { ...b, owner: 'x' }, { ...a, owner: null },
  ]);

  assert.deepEqual(buckets[0].items.map((p) => [p.owner, p.shape]), [
    ['x', 'box'], ['x', 'cone6'], [null, 'cone6'], [null, 'box'], ['y', 'cyl8:0.5'],
  ]);
});

test('繪製呼叫數不隨零件數線性增加：零件從 60 個加到 6000 個，桶數不變', () => {
  const counts = [60, 600, 6000].map((n) => partBuckets(parts(n)).length);
  assert.deepEqual(counts, [4, 4, 4]);
});

test('投影的只有主題場景與大樹，小物件、路燈與其他裝飾不投影', () => {
  assert.equal(castsShadow('hero'), true);
  assert.equal(castsShadow('tree'), true);
  for (const kind of ['lamp', 'bench', 'pot', 'flowers', 'shrub', 'stone', 'bin', 'flowerbed', 'element', undefined]) {
    assert.equal(castsShadow(kind), false, kind);
  }
});

test('實例縮放微抖動：在 1 ± 0.0072 之內、每次載入相同、相鄰實例不同（共面的零件不會 z-fighting）', () => {
  assert.equal(SCALE_JITTER, 0.0072);
  const values = Array.from({ length: 200 }, (_, i) => scaleJitter(i));
  assert.ok(values.every((v) => v >= 1 - 0.0072 && v <= 1 + 0.0072));
  assert.deepEqual(values, Array.from({ length: 200 }, (_, i) => scaleJitter(i)));
  assert.ok(values.slice(1).every((v, i) => v !== values[i]));
  assert.ok(Math.max(...values) - Math.min(...values) > 0.01, '抖動幅度太小');
});

test('每個零件保留自己的顏色與變換', () => {
  const [, box] = partBuckets(parts(12));
  assert.deepEqual(box.items.map((p) => [p.color, p.transform.position[0]]), [[0x100003, 3], [0x100009, 9]]);
});
