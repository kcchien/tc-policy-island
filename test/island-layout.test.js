import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { filterViewModel } from '../site/js/filter.js';
import {
  cameraLimits, flightPlan, frameIsland, islandLayout, islandPoints, markerLegend, orbitCenter, projectedBox, qualityFor,
} from '../site/js/island-layout.js';
import { makeRaw, policy } from './fixtures/make-raw.js';

const viewModelOf = (raw) => buildViewModel(buildPublicDataset(raw));
const areaTiles = (layout) => layout.tiles.filter((tile) => tile.kind === 'area');

test('每個議題區一格，每格三個同尺寸標記，依候選人排序配 ○ △ □，有政見才亮起', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-c1', 'cand-c', undefined, 'area-b'));
  const vm = viewModelOf(raw);

  const layout = islandLayout(vm);

  assert.deepEqual(
    areaTiles(layout).map((tile) => [tile.id, tile.markers.map((m) => [m.candidateId, m.symbol, m.lit])]),
    [
      ['area-a', [['cand-a', '○', true], ['cand-b', '△', true], ['cand-c', '□', false]]],
      ['area-b', [['cand-a', '○', false], ['cand-b', '△', false], ['cand-c', '□', true]]],
    ],
  );
  const sizes = new Set(layout.tiles.flatMap((tile) => tile.markers.map((m) => m.size)));
  assert.equal(sizes.size, 1);
});

test('標記亮或灰與檢視模型每格的狀態一致', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-a2', 'cand-a', undefined, 'area-b'), policy('p-c1', 'cand-c', undefined, 'area-b'));
  const vm = viewModelOf(raw);

  const layout = islandLayout(vm);

  const fromLayout = areaTiles(layout).map((tile) => tile.markers.map((m) => m.lit));
  const fromViewModel = vm.rows.map((row) => row.cells.map((cell) => cell.status === 'has-policies'));
  assert.deepEqual(fromLayout, fromViewModel);
});

test('標記的政見多寡不影響標記：一筆與多筆政見的標記完全相同', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-a2', 'cand-a'), policy('p-a3', 'cand-a'));
  const vm = viewModelOf(raw);

  const [tileA] = areaTiles(islandLayout(vm));

  const [many, one] = tileA.markers;
  assert.equal(many.size, one.size);
  assert.equal(many.lit, one.lit);
  assert.equal('policyCount' in many, false);
});

test('篩選時島的格子不變；沒有符合政見的格子標記灰掉，被篩掉的議題區標為淡化', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-c1', 'cand-c', undefined, 'area-b'));
  const vm = viewModelOf(raw);
  const filtered = filterViewModel(vm, { query: 'p-c1' });

  const layout = islandLayout(vm, { filtered });

  assert.deepEqual(
    areaTiles(layout).map((tile) => [tile.id, tile.dimmed, tile.markers.map((m) => m.lit)]),
    [
      ['area-a', true, [false, false, false]],
      ['area-b', false, [false, false, true]],
    ],
  );
});

test('尖頂六角格：q 往東、r 往南，相鄰格距離相同；裝飾格也排上島但沒有標記', () => {
  const raw = makeRaw();
  raw.decorativeTiles = [{ id: 'tile-south', axial: [0, 1], localElementId: null }];

  const layout = islandLayout(viewModelOf(raw));

  const byId = Object.fromEntries(layout.tiles.map((tile) => [tile.id, tile]));
  const a = byId['area-a'].position;
  const east = byId['area-b'].position;
  const south = byId['tile-south'].position;
  assert.ok(east.x > a.x);
  assert.equal(east.z, a.z);
  assert.ok(south.z > a.z);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  assert.ok(Math.abs(dist(a, east) - dist(a, south)) < 1e-9);
  assert.ok(Math.abs(dist(a, east) - Math.sqrt(3) * layout.hexSize) < 1e-9);
  assert.equal(byId['tile-south'].kind, 'decorative');
  assert.deepEqual(byId['tile-south'].markers, []);
});

test('島的範圍涵蓋所有格子，中心在範圍正中', () => {
  const raw = makeRaw();
  raw.decorativeTiles = [{ id: 'tile-south', axial: [0, 1], localElementId: null }];

  const { bounds, tiles } = islandLayout(viewModelOf(raw));

  for (const { position } of tiles) {
    assert.ok(position.x >= bounds.minX && position.x <= bounds.maxX);
    assert.ok(position.z >= bounds.minZ && position.z <= bounds.maxZ);
  }
  assert.equal(bounds.center.x, (bounds.minX + bounds.maxX) / 2);
  assert.equal(bounds.center.z, (bounds.minZ + bounds.maxZ) / 2);
});

test('圖例依候選人排序列出形狀與姓名', () => {
  const vm = viewModelOf(makeRaw());

  assert.deepEqual(markerLegend(vm), [
    { candidateId: 'cand-a', name: '候選人甲', shape: 'circle', symbol: '○' },
    { candidateId: 'cand-b', name: '候選人乙', shape: 'triangle', symbol: '△' },
    { candidateId: 'cand-c', name: '候選人丙', shape: 'square', symbol: '□' },
  ]);
});

const frameOf = (layout, aspect) =>
  frameIsland(islandPoints(layout, { surface: 0.44, top: 1.7 }), { fov: 32, aspect, polar: 0.6, fill: 0.8 });

test('鏡頭不能平移，距離有上下限，仰角不會低到水平面以下', () => {
  const layout = islandLayout(viewModelOf(makeRaw()));

  const limits = cameraLimits(layout.bounds, frameOf(layout, 1.6).distance);

  assert.equal(limits.enablePan, false);
  assert.ok(limits.minDistance > 0);
  assert.ok(Number.isFinite(limits.maxDistance) && limits.maxDistance > limits.minDistance);
  assert.ok(limits.minPolarAngle >= 0);
  assert.ok(limits.maxPolarAngle < Math.PI / 2);
});

test('窄而高的畫面要退得比較遠才能看到整座島，距離上限也跟著放寬', () => {
  const layout = islandLayout(viewModelOf(makeRaw()));

  const wide = frameOf(layout, 1.6).distance;
  const portrait = frameOf(layout, 0.75).distance;

  assert.ok(portrait > wide);
  assert.ok(cameraLimits(layout.bounds, portrait).maxDistance >= portrait);
});

test('寬度 800px 以下或觸控裝置降低畫質與像素比上限', () => {
  const desktop = qualityFor({ width: 1280, coarsePointer: false, devicePixelRatio: 2 });
  const narrow = qualityFor({ width: 800, coarsePointer: false, devicePixelRatio: 3 });
  const touch = qualityFor({ width: 1024, coarsePointer: true, devicePixelRatio: 2 });
  const lowDpr = qualityFor({ width: 390, coarsePointer: true, devicePixelRatio: 1 });

  assert.deepEqual([desktop.level, desktop.pixelRatio, desktop.shadows], ['high', 1.75, true]);
  assert.deepEqual([narrow.level, narrow.pixelRatio, narrow.shadows], ['medium', 1.4, false]);
  assert.deepEqual([touch.level, touch.pixelRatio], ['medium', 1.4]);
  assert.equal(lowDpr.pixelRatio, 1);
});

test('投影：鏡頭看的點落在畫面正中，垂直視角邊緣上的點落在畫面上緣', () => {
  const target = { x: 2, y: 0, z: -1 };
  const distance = 10;
  const view = { fov: 32, aspect: 2, polar: 0, target, distance };
  // 正上方往下看時，畫面上方是北（-z）。距離 10、半視角 16 度，上緣在地面上北邊 10·tan16° 處。
  const edge = { x: 2, y: 0, z: -1 - 10 * Math.tan((16 * Math.PI) / 180) };

  const center = projectedBox([target], view);
  const top = projectedBox([edge], view);

  assert.ok(Math.abs(center.minX) < 1e-9 && Math.abs(center.minY) < 1e-9);
  assert.ok(Math.abs(top.minY - 1) < 1e-9);
  assert.ok(Math.abs(top.minX) < 1e-9);
});

for (const [name, aspect, polar] of [['桌面寬畫面', 836 / 660, 0.78], ['手機直式', 390 / 520, 0.42], ['手機方形', 1, 0.42]]) {
  test(`預設視角讓島在畫布置中、最長邊約占 80%（${name}）`, () => {
    const raw = makeRaw();
    raw.decorativeTiles = [{ id: 'tile-south', axial: [-1, 2], localElementId: null }];
    const points = islandPoints(islandLayout(viewModelOf(raw)), { surface: 0.44, top: 1.5 });
    const view = { fov: 32, aspect, polar, fill: 0.8 };

    const { target, distance } = frameIsland(points, view);

    const box = projectedBox(points, { ...view, target, distance });
    assert.ok(Math.abs((box.minX + box.maxX) / 2) < 0.01, `水平置中 ${JSON.stringify(box)}`);
    assert.ok(Math.abs((box.minY + box.maxY) / 2) < 0.01, `垂直置中 ${JSON.stringify(box)}`);
    const fill = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
    assert.ok(Math.abs(fill - 0.8) < 0.01, `填滿比例 ${fill}`);
  });
}

test('飛到議題區後再縮遠，旋轉中心逐步回到島中心，島不會偏到畫面外', () => {
  const focus = { x: 6, z: -3 };
  const center = { x: -1, z: 0 };
  const range = { near: 9, far: 30 };

  assert.deepEqual(orbitCenter(focus, center, 9, range), focus);
  assert.deepEqual(orbitCenter(focus, center, 5, range), focus);
  assert.deepEqual(orbitCenter(focus, center, 30, range), center);
  assert.deepEqual(orbitCenter(focus, center, 45, range), center);
  assert.deepEqual(orbitCenter(focus, center, 19.5, range), { x: 2.5, z: -1.5 });
});

test('開啟減少動態時鏡頭不飛行，直接切到目的地', () => {
  assert.equal(flightPlan({ reducedMotion: true }).durationMs, 0);
  assert.ok(flightPlan({ reducedMotion: false }).durationMs > 0);
});
