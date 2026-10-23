import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { BRIDGE, CHANNEL_WIDTH, ISLAND_RADIUS, islandBody, tileAt, WALKWAY, WALKWAY_APOTHEM } from '../site/js/island-body.js';
import {
  CITIZEN_APOTHEM, CITIZEN_RADIUS, LOOP_CORE, LOOP_SPOTS, RING_LANES, VEHICLE_HALF_WIDTH,
} from '../site/js/island-motion.js';
import { fileURLToPath } from 'node:url';
import { loadRawData } from '../scripts/lib/raw-data.js';
import { makeRaw } from './fixtures/make-raw.js';

// 一列三格加第二列兩格、一格裝飾格。
function rawWithSix() {
  const raw = makeRaw();
  const area = (id, axial) => ({ id, name: `議題區${id}`, departments: ['測試局'], description: '測試用議題區', axial, localElementId: null });
  raw.issueAreas = [area('area-a', [0, 0]), area('area-b', [1, 0]), area('area-c', [2, 0]), area('area-d', [0, 1]), area('area-e', [1, 1])];
  raw.decorativeTiles = [{ id: 'tile-east', axial: [3, 0], localElementId: null }];
  return raw;
}
const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));
const realLayout = () => layoutOf(loadRawData(fileURLToPath(new URL('../data/raw', import.meta.url))));
const axialKey = ([q, r]) => `${q},${r}`;
const NEIGHBORS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

// 相鄰的島（軸向座標差一步）兩兩列出，每對只列一次。
function adjacentPairs(layout) {
  const byAxial = new Map(layout.tiles.map((t) => [axialKey(t.axial), t]));
  const pairs = [];
  for (const tile of layout.tiles) {
    for (const [dq, dr] of NEIGHBORS.slice(0, 3)) {
      const other = byAxial.get(axialKey([tile.axial[0] + dq, tile.axial[1] + dr]));
      if (other) pairs.push([tile, other]);
    }
  }
  return pairs;
}

test('分離小島：相鄰兩島的對邊之間隔一道固定寬度的水道，六個方向都一樣', () => {
  const layout = layoutOf(rawWithSix());
  const pairs = adjacentPairs(layout);
  // 一列內 3 對加第二列內 1 對，兩列之間 4 對。
  assert.equal(pairs.length, 8);

  assert.equal(layout.hexSize, ISLAND_RADIUS);
  const apothem = (ISLAND_RADIUS * Math.sqrt(3)) / 2;
  for (const [a, b] of pairs) {
    const gap = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) - 2 * apothem;
    assert.ok(Math.abs(gap - CHANNEL_WIDTH) < 1e-9, `${a.id}–${b.id} 水道寬 ${gap}`);
  }
  // 水道看得出來，但不寬到像兩座分開的島群（參考數值約為島外接半徑的兩成）。
  assert.ok(CHANNEL_WIDTH / ISLAND_RADIUS > 0.18 && CHANNEL_WIDTH / ISLAND_RADIUS < 0.3);
});

test('每對相鄰島恰一座橋，兩端是兩島步道環面對面那條邊的中點，不相鄰的島沒有橋', () => {
  for (const layout of [layoutOf(rawWithSix()), realLayout()]) {
    const { bridges } = islandBody(layout);
    const pairs = adjacentPairs(layout);
    const key = (a, b) => [a, b].sort().join('|');
    assert.deepEqual(bridges.map((b) => key(...b.tiles)).sort(), pairs.map(([a, b]) => key(a.id, b.id)).sort());

    const byId = new Map(layout.tiles.map((t) => [t.id, t]));
    const walkApothem = (WALKWAY.radius * Math.sqrt(3)) / 2;
    for (const bridge of bridges) {
      const [a, b] = bridge.tiles.map((id) => byId.get(id).position);
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const toward = (p, q, d) => [p.x + ((q.x - p.x) / length) * d, p.z + ((q.z - p.z) / length) * d];
      // 邊中點在兩島格心的連線上，離自己的格心一個步道環邊心距。
      assertNear(bridge.from, toward(a, b, walkApothem));
      assertNear(bridge.to, toward(b, a, walkApothem));
      // 橋跨過水道，兩端都落在島上。
      assert.ok(bridge.length > CHANNEL_WIDTH);
      assert.ok(Math.abs(bridge.length - (length - 2 * walkApothem)) < 1e-9);
    }
  }
});

test('行人路網：每島步道環 12 個節點連成一圈，橋連起相鄰島，任兩島都走得到', () => {
  for (const layout of [layoutOf(rawWithSix()), realLayout()]) {
    const { network, bridges } = islandBody(layout);
    for (const tile of layout.tiles) {
      const own = network.nodes.filter((n) => n.tileId === tile.id);
      assert.equal(own.length, 12, tile.id);
      // 步道環上的節點：6 個頂點離格心一個外接半徑，6 個邊中點離格心一個邊心距。
      const distances = own.map((n) => Math.hypot(n.x - tile.position.x, n.z - tile.position.z));
      assert.equal(distances.filter((d) => Math.abs(d - WALKWAY.radius) < 1e-9).length, 6);
      assert.equal(distances.filter((d) => Math.abs(d - (WALKWAY.radius * Math.sqrt(3)) / 2) < 1e-9).length, 6);
    }
    assert.equal(network.edges.filter((e) => e.kind === 'walkway').length, 12 * layout.tiles.length);
    assert.equal(network.edges.filter((e) => e.kind === 'bridge').length, bridges.length);

    // 從第一個節點出發走得到每個節點。
    const links = new Map(network.nodes.map((n) => [n.id, []]));
    for (const { a, b } of network.edges) {
      links.get(a).push(b);
      links.get(b).push(a);
    }
    const seen = new Set([network.nodes[0].id]);
    const queue = [network.nodes[0].id];
    while (queue.length > 0) for (const next of links.get(queue.shift())) if (!seen.has(next)) seen.add(next), queue.push(next);
    assert.equal(seen.size, network.nodes.length);
  }
});

test('每個議題區島有同一個主題場景位置與在地感元素位置，都在步道環內，彼此與三個標記、循環道具不重疊', () => {
  const layout = realLayout();
  const areas = layout.tiles.filter((t) => t.kind === 'area');
  const inner = (WALKWAY.radius * Math.sqrt(3)) / 2 - WALKWAY.width / 2;
  // 尖頂六角形的「邊心距範數」：點到六條邊法線方向的最大投影，小於 inner 就在步道環內側。
  const hexNorm = (x, z) => Math.max(...[0, 1, 2, 3, 4, 5].map((i) => x * Math.cos((i * Math.PI) / 3) + z * Math.sin((i * Math.PI) / 3)));
  const corners = ({ minX, maxX, minZ, maxZ }) => [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]];
  const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

  for (const tile of areas) {
    assert.deepEqual(tile.heroSlot, areas[0].heroSlot, tile.id);
    assert.deepEqual(tile.elementSlot, areas[0].elementSlot, tile.id);
  }
  const { heroSlot, elementSlot, markers } = areas[0];
  // 主題場景在單位空間設計（底面 ±0.5），放大 size 倍後的範圍。
  const hero = { minX: heroSlot.x - heroSlot.size / 2, maxX: heroSlot.x + heroSlot.size / 2, minZ: heroSlot.z - heroSlot.size / 2, maxZ: heroSlot.z + heroSlot.size / 2 };
  const markerBoxes = markers.map((m) => ({ minX: m.offset.x - m.radius, maxX: m.offset.x + m.radius, minZ: m.offset.z - m.radius, maxZ: m.offset.z + m.radius }));
  const loopBoxes = LOOP_SPOTS.map(({ x, z }) => ({ minX: x - LOOP_CORE, maxX: x + LOOP_CORE, minZ: z - LOOP_CORE, maxZ: z + LOOP_CORE }));
  for (const box of [hero, elementSlot]) {
    for (const [x, z] of corners(box)) assert.ok(hexNorm(x, z) < inner, `(${x}, ${z}) 壓到步道環`);
  }
  // 標記以外接圓檢查。
  for (const m of markers) assert.ok(hexNorm(m.offset.x, m.offset.z) + m.radius < inner, `${m.shape} 標記壓到步道環`);
  for (const box of [...markerBoxes, ...loopBoxes]) {
    assert.ok(!overlaps(hero, box), '主題場景壓到標記或道具');
    assert.ok(!overlaps(elementSlot, box), '在地感元素壓到標記或道具');
  }
  assert.ok(!overlaps(hero, elementSlot), '主題場景與在地感元素重疊');
  // 主題場景在北側（離鏡頭較遠），不擋南側的標記。
  assert.ok(hero.maxZ < Math.min(...markerBoxes.map((b) => b.minZ)));
  assert.ok(heroSlot.size >= 0.6, `主題場景太小 ${heroSlot.size}`);

  for (const tile of layout.tiles.filter((t) => t.kind === 'decorative')) {
    assert.equal(tile.heroSlot, null);
    for (const [x, z] of corners(tile.elementSlot)) assert.ok(hexNorm(x, z) < inner, `${tile.id} 元素壓到步道環`);
  }
});

test('路燈：每島六盞，在島的六個頂點、步道環外緣與島緣之間的路緣上', () => {
  const layout = layoutOf(rawWithSix());
  const { lamps } = islandBody(layout);
  assert.equal(lamps.length, 6 * layout.tiles.length);
  const walkOuterCorner = (WALKWAY.radius * Math.sqrt(3) / 2 + WALKWAY.width / 2) / (Math.sqrt(3) / 2);
  for (const tile of layout.tiles) {
    const own = lamps.filter((l) => l.tileId === tile.id);
    assert.equal(own.length, 6);
    for (const { x, z } of own) {
      const d = Math.hypot(x - tile.position.x, z - tile.position.z);
      assert.ok(d > walkOuterCorner && d < ISLAND_RADIUS, `${tile.id} 路燈離格心 ${d}`);
      // 在頂點方向（30 度起每 60 度）。
      const angle = (Math.atan2(z - tile.position.z, x - tile.position.x) * 180) / Math.PI;
      assert.ok(Math.abs((((angle - 30) % 60) + 60) % 60) < 1e-6 || Math.abs((((angle - 30) % 60) + 60) % 60 - 60) < 1e-6, `角度 ${angle}`);
    }
  }
});

test('點在哪座島上：步道環的頂點與邊中點算本島，橋面中段與水道不屬於任何島', () => {
  const layout = layoutOf(rawWithSix());
  const { network, bridges } = islandBody(layout);
  for (const node of network.nodes) assert.equal(tileAt(layout, node), node.tileId, node.id);
  for (const { from, to } of bridges) {
    const middle = { x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2 };
    assert.equal(tileAt(layout, middle), null);
  }
});

test('車道與市民路線都在步道上、彼此不重疊，火車不碰路燈，橋夠寬', () => {
  const half = WALKWAY.width / 2;
  const lanes = [
    { name: '市民', center: -(WALKWAY_APOTHEM - CITIZEN_APOTHEM), half: CITIZEN_RADIUS },
    { name: '公車', center: RING_LANES.bus, half: VEHICLE_HALF_WIDTH.bus },
    { name: '火車', center: RING_LANES.train, half: VEHICLE_HALF_WIDTH.train },
  ];
  for (const lane of lanes) {
    assert.ok(lane.center - lane.half >= -half - 0.012 && lane.center + lane.half <= half + 1e-9, `${lane.name}超出步道`);
  }
  for (let i = 1; i < lanes.length; i++) {
    assert.ok(lanes[i].center - lanes[i].half >= lanes[i - 1].center + lanes[i - 1].half - 0.01, `${lanes[i - 1].name}與${lanes[i].name}重疊`);
  }
  // 火車在頂點轉角的外緣（離格心）不碰到路燈柱。
  const trainCorner = (WALKWAY_APOTHEM + RING_LANES.train + VEHICLE_HALF_WIDTH.train) / (Math.sqrt(3) / 2);
  const { lamps } = islandBody(layoutOf(rawWithSix()));
  const lampRadius = Math.hypot(lamps[0].x - layoutOf(rawWithSix()).tiles[0].position.x, lamps[0].z - layoutOf(rawWithSix()).tiles[0].position.z);
  assert.ok(lampRadius - 0.018 > trainCorner, `路燈 ${lampRadius} 擋到火車 ${trainCorner}`);
  // 橋的欄杆在兩種車外側（市民過橋走兩側的線，見 island-motion.test.js）。
  const vehicles = lanes.filter((l) => l.name !== '市民');
  assert.ok(BRIDGE.width / 2 - 0.008 > Math.max(...vehicles.map((l) => Math.abs(l.center) + l.half)), '車身穿過橋的欄杆');
});

function assertNear([x, z], [ex, ez]) {
  assert.ok(Math.hypot(x - ex, z - ez) < 1e-9, `(${x}, ${z}) 應為 (${ex}, ${ez})`);
}
