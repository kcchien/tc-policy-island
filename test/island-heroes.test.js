import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_COLORS, HERO_SCENES, HERO_SHAPES, heroPlan, heroSceneFor, partBounds, sceneBounds } from '../site/js/island-heroes.js';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { makeRaw, policy } from './fixtures/make-raw.js';
import { forbiddenRangesOf, loadForbiddenColors, rgbToHsl } from '../scripts/lib/colors.js';

const issueAreas = JSON.parse(readFileSync(new URL('../data/raw/issue-areas.json', import.meta.url), 'utf8'));

test('正式資料的每個議題區都有自己的主題場景', () => {
  assert.equal(issueAreas.length, 20);
  for (const area of issueAreas) {
    const scene = heroSceneFor(area.id);
    assert.equal(scene.id, area.id, `${area.id} 沒有專屬主題場景`);
    assert.ok(scene.parts.length >= 20, `${area.id} 的主題場景只有 ${scene.parts.length} 個零件，細節不夠`);
  }
  assert.equal(new Set(Object.keys(HERO_SCENES)).size, 20);
});

test('零件外框：平移、縮放與繞 y 轉 90 度', () => {
  const b = partBounds({ shape: 'box', color: 'stone', size: [0.4, 0.2, 0.1], at: [0.1, 0.3, 0], yaw: Math.PI / 2 });
  const close = (actual, expected) => expected.forEach((v, i) => assert.ok(Math.abs(actual[i] - v) < 1e-9, `${actual} ≠ ${expected}`));
  close(b.min, [0.05, 0.2, -0.2]);
  close(b.max, [0.15, 0.4, 0.2]);
});

test('每座主題場景都在單位空間內：底面 ±0.5、高度 0 到 1.5，形體與顏色都認得', () => {
  for (const scene of [...Object.values(HERO_SCENES), heroSceneFor('not-an-area')]) {
    const { min, max } = sceneBounds(scene);
    assert.ok(min[0] >= -0.5 - 1e-9 && max[0] <= 0.5 + 1e-9, `${scene.id} 的 x 範圍 ${min[0].toFixed(3)}～${max[0].toFixed(3)}`);
    assert.ok(min[2] >= -0.5 - 1e-9 && max[2] <= 0.5 + 1e-9, `${scene.id} 的 z 範圍 ${min[2].toFixed(3)}～${max[2].toFixed(3)}`);
    assert.ok(min[1] >= -1e-9 && max[1] <= 1.5, `${scene.id} 的高度範圍 ${min[1].toFixed(3)}～${max[1].toFixed(3)}`);
    for (const p of scene.parts) {
      assert.ok(HERO_SHAPES.includes(p.shape), `${scene.id} 用了不認得的形體 ${p.shape}`);
      assert.ok(p.color in HERO_COLORS, `${scene.id} 用了不認得的顏色 ${p.color}`);
    }
  }
});

// 兩個議題區（一個有專屬場景、一個沒有）加一格裝飾格。
function rawWith(policies) {
  const raw = makeRaw();
  const area = (id, axial) => ({ id, name: `議題區${id}`, departments: ['測試局'], description: '測試用議題區', axial, localElementId: null });
  raw.issueAreas = [area('education', [0, 0]), area('area-x', [1, 0])];
  raw.decorativeTiles = [{ id: 'tile-east', axial: [2, 0], localElementId: null }];
  raw.policies = policies;
  return raw;
}
const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));

test('每個議題區格子放一座主題場景，只依識別碼選；裝飾格不放', () => {
  const plan = heroPlan(layoutOf(rawWith([])));
  assert.deepEqual(plan.map((h) => [h.areaId, h.sceneId]), [['education', 'education'], ['area-x', 'generic']]);
});

test('換政見資料，主題場景的選擇與位置都不變', () => {
  const none = heroPlan(layoutOf(rawWith([])));
  const crowded = heroPlan(layoutOf(rawWith([
    policy('p-a1', 'cand-a', undefined, 'education'),
    policy('p-a2', 'cand-a', undefined, 'education'),
    policy('p-b1', 'cand-b', undefined, 'education'),
    policy('p-c1', 'cand-c', undefined, 'area-x'),
  ])));
  assert.deepEqual(crowded, none);
});

test('主題場景放進每島的主題場景位置：外框在位置範圍內，每座放大倍率相同', () => {
  // 每個有專屬場景的議題區各一格，連同通用場景都檢查。
  const raw = makeRaw();
  const ids = [...Object.keys(HERO_SCENES), 'area-x'];
  raw.issueAreas = ids.map((id, i) => ({ id, name: `議題區${id}`, departments: ['測試局'], description: '測試用議題區', axial: [i, 0], localElementId: null }));
  raw.decorativeTiles = [];
  raw.policies = [];
  const layout = layoutOf(raw);
  for (const hero of heroPlan(layout)) {
    const tile = layout.tiles.find((t) => t.id === hero.areaId);
    const slot = tile.heroSlot;
    const { min, max } = sceneBounds(heroSceneFor(hero.areaId));
    const s = hero.transform.scale;
    assert.equal(s, slot.size, `${hero.areaId} 放大 ${s}，與位置大小不同`);
    // 外框（單位空間 ±0.5 內）放大後在位置的底面範圍內。
    for (const x of [min[0], max[0]]) assert.ok(Math.abs(hero.transform.x - tile.position.x - slot.x + x * s) <= slot.size / 2 + 1e-9, `${hero.areaId} 東西超出`);
    for (const z of [min[2], max[2]]) assert.ok(Math.abs(hero.transform.z - tile.position.z - slot.z + z * s) <= slot.size / 2 + 1e-9, `${hero.areaId} 南北超出`);
  }
});

test('主題場景的色碼都不落在禁用色範圍', () => {
  const { ranges } = loadForbiddenColors();
  for (const [name, value] of Object.entries(HERO_COLORS)) {
    const hex = value.toString(16).padStart(6, '0');
    const [r, g, b] = hex.match(/../g).map((d) => parseInt(d, 16));
    const hit = forbiddenRangesOf({ ...rgbToHsl({ r, g, b }), alpha: 1 }, ranges);
    assert.deepEqual(hit.map((h) => h.name), [], `${name} #${hex}`);
  }
});
