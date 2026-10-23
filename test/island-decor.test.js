import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { decorPlan, decorSignature, TREE_SPECIES } from '../site/js/island-decor.js';
import { WALKWAY } from '../site/js/island-body.js';
import { LOOP_CORE, LOOP_SPOTS } from '../site/js/island-motion.js';
import { makeRaw, policy } from './fixtures/make-raw.js';

// 一列三格加第二列兩格、兩格裝飾格（第一格是候選人廣場）。政見由 policies 指定。
function rawWith(policies) {
  const raw = makeRaw();
  const area = (id, axial) => ({ id, name: `議題區${id}`, departments: ['測試局'], description: '測試用議題區', axial, localElementId: null });
  raw.issueAreas = [
    area('transportation', [0, 0]), area('education', [1, 0]), area('area-x', [2, 0]),
    area('health', [0, 1]), area('parks', [1, 1]),
  ];
  // 最南排的裝飾格是候選人廣場（island-plaza.js）。
  raw.decorativeTiles = [{ id: 'tile-east', axial: [3, 0], localElementId: null }, { id: 'tile-plaza', axial: [2, 1], localElementId: null }];
  raw.policies = policies;
  return raw;
}
const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));
const areaPlans = (plan) => plan.tiles.filter((tile) => tile.kind === 'area');

const FEW = [policy('p-a1', 'cand-a', undefined, 'transportation'), policy('p-b1', 'cand-b', undefined, 'transportation')];
const MANY = [
  policy('p-a1', 'cand-a', undefined, 'area-x'),
  policy('p-a2', 'cand-a', undefined, 'area-x'),
  policy('p-a3', 'cand-a', undefined, 'area-x'),
  policy('p-c1', 'cand-c', undefined, 'parks'),
  policy('p-b1', 'cand-b', undefined, 'health'),
];
const countOf = (tile, kind) => tile.items.filter((item) => item.kind === kind).length;

test('每個議題區格子的靜態裝飾相同：一座主題場景、同一放大倍率，路燈、大樹、家具與植栽的數量與位置都一樣', () => {
  const tiles = areaPlans(decorPlan(layoutOf(rawWith(FEW))));

  assert.equal(tiles.length, 5);
  assert.equal(new Set(tiles.map(decorSignature)).size, 1);
  for (const tile of tiles) {
    assert.equal(tile.hero.areaId, tile.id);
    assert.equal(tile.hero.transform.scale, tiles[0].hero.transform.scale);
  }
  // 參考數值：六個頂點路燈、外圈四到六棵大樹，加上長椅與盆栽等小物件。
  assert.equal(countOf(tiles[0], 'lamp'), 6);
  assert.ok(countOf(tiles[0], 'tree') >= 4 && countOf(tiles[0], 'tree') <= 6, `大樹 ${countOf(tiles[0], 'tree')} 棵`);
  assert.ok(countOf(tiles[0], 'bench') >= 2);
  assert.ok(tiles[0].items.length >= 30, `每格只有 ${tiles[0].items.length} 件裝飾`);
});

test('裝飾都在步道環內側，彼此不重疊，也不壓到主題場景、在地感元素、標記與循環道具', () => {
  const layout = layoutOf(rawWith(FEW));
  const tile = areaPlans(decorPlan(layout))[0];
  const layoutTile = layout.tiles.find((t) => t.id === tile.id);
  // 尖頂六角形的邊心距範數：點到六條邊法線方向的最大投影。步道環內緣是 0.875，市民走在內緣外側一點。
  const hexNorm = (x, z) => Math.max(...[0, 1, 2, 3, 4, 5].map((i) => x * Math.cos((i * Math.PI) / 3) + z * Math.sin((i * Math.PI) / 3)));
  const walkwayInner = (WALKWAY.radius * Math.sqrt(3)) / 2 - WALKWAY.width / 2;
  const { heroSlot: hero, elementSlot: element } = layoutTile;
  const rects = [
    { name: '主題場景', minX: hero.x - hero.size / 2, maxX: hero.x + hero.size / 2, minZ: hero.z - hero.size / 2, maxZ: hero.z + hero.size / 2 },
    { name: '在地感元素', ...element },
  ];
  const circles = [
    ...layoutTile.markers.map((m) => ({ name: `${m.shape}標記`, x: m.offset.x, z: m.offset.z, radius: m.radius })),
    ...LOOP_SPOTS.map(({ x, z }) => ({ name: '循環道具', x, z, radius: LOOP_CORE })),
  ];
  const inRect = (item, r) => {
    const dx = Math.max(r.minX - item.x, 0, item.x - r.maxX);
    const dz = Math.max(r.minZ - item.z, 0, item.z - r.maxZ);
    return Math.hypot(dx, dz) < item.radius;
  };
  const touches = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius;

  const inside = tile.items.filter((item) => item.kind !== 'lamp');
  for (const item of inside) {
    const at = `${item.kind} (${item.x}, ${item.z})`;
    assert.ok(hexNorm(item.x, item.z) + item.radius < walkwayInner, `${at} 壓到步道環`);
    for (const r of rects) assert.ok(!inRect(item, r), `${at} 壓到${r.name}`);
    for (const c of circles) assert.ok(!touches(item, c), `${at} 壓到${c.name}`);
  }
  inside.forEach((a, i) => inside.slice(i + 1).forEach((b) => assert.ok(!touches(a, b), `${a.kind} (${a.x}, ${a.z}) 與 ${b.kind} (${b.x}, ${b.z}) 重疊`)));
});

test('大樹的樹種依格子順序輪替：相鄰兩格不同，五種以上', () => {
  const plan = decorPlan(layoutOf(rawWith(FEW)));
  const species = plan.tiles.map((t) => t.species);
  species.slice(1).forEach((s, i) => assert.notEqual(s, species[i]));
  assert.ok(new Set(species).size >= 5);
  for (const s of species) assert.ok(TREE_SPECIES.includes(s));
});

test('裝飾格沒有主題場景，候選人廣場只有路燈', () => {
  const plan = decorPlan(layoutOf(rawWith(FEW)));
  const plaza = plan.tiles.find((t) => t.id === 'tile-plaza');
  const other = plan.tiles.find((t) => t.id === 'tile-east');
  assert.equal(plaza.hero, null);
  assert.deepEqual(plaza.items.map((i) => i.kind), Array(6).fill('lamp'));
  assert.equal(other.hero, null);
  assert.equal(countOf(other, 'lamp'), 6);
});

test('裝飾配置與政見資料無關：換一份政見資料，配置完全相同', () => {
  const few = decorPlan(layoutOf(rawWith(FEW)));
  assert.deepEqual(decorPlan(layoutOf(rawWith(MANY))), few);
  assert.deepEqual(decorPlan(layoutOf(rawWith([]))), few);
});
