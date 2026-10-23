import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout, islandPoints } from '../site/js/island-layout.js';
import { homeView } from '../site/js/island-camera.js';
import {
  CITIZEN_HEIGHT, CITIZEN_RADIUS, CITIZEN_SCALE, citizenPose, LOOP_CORE, LOOP_HEIGHT, LOOP_REACH, LOOP_REACH_FROM, LOOP_SCALE, LOOP_SECONDS, loopPose,
  LOOP_SPOTS, MOTION_LEVELS, MOTION_THEMES, motionPlan, motionSignature, pointAlong, vehiclePose,
} from '../site/js/island-motion.js';
import { islandBody } from '../site/js/island-body.js';
import { fileURLToPath } from 'node:url';
import { loadRawData } from '../scripts/lib/raw-data.js';
import { makeRaw, policy } from './fixtures/make-raw.js';

// 一列三格加第二列兩格、一格裝飾格的小島。政見由 policies 指定。
function rawWith(policies) {
  const raw = makeRaw();
  const area = (id, axial) => ({ id, name: `議題區${id}`, departments: ['測試局'], description: '測試用議題區', axial, localElementId: null });
  raw.issueAreas = [
    area('area-a', [0, 0]), area('area-b', [1, 0]), area('area-c', [2, 0]),
    area('area-d', [0, 1]), area('area-e', [1, 1]),
  ];
  raw.decorativeTiles = [{ id: 'tile-east', axial: [3, 0], localElementId: null }];
  raw.policies = policies;
  return raw;
}
const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));
const areaPlans = (plan) => plan.tiles.filter((tile) => tile.kind === 'area');

const FEW = [policy('p-a1', 'cand-a'), policy('p-b1', 'cand-b')];
const MANY = [
  policy('p-a1', 'cand-a', undefined, 'area-c'),
  policy('p-a2', 'cand-a', undefined, 'area-c'),
  policy('p-a3', 'cand-a', undefined, 'area-c'),
  policy('p-c1', 'cand-c', undefined, 'area-e'),
  policy('p-b1', 'cand-b', undefined, 'area-d'),
];

test('每個議題區格子的動態數量與強度相同，每種畫質都是', () => {
  const layout = layoutOf(rawWith(FEW));

  for (const level of Object.keys(MOTION_LEVELS)) {
    const plans = areaPlans(motionPlan(layout, { level }));
    assert.equal(plans.length, 5);
    assert.equal(new Set(plans.map(motionSignature)).size, 1, level);
    assert.equal(plans[0].citizens.length, MOTION_LEVELS[level].citizensPerTile);
    assert.equal(plans[0].loops.length, 2);
  }
});

test('動態配置與政見資料無關：換一份政見資料，配置完全相同', () => {
  for (const level of Object.keys(MOTION_LEVELS)) {
    assert.deepEqual(motionPlan(layoutOf(rawWith(MANY)), { level }), motionPlan(layoutOf(rawWith(FEW)), { level }));
    assert.deepEqual(motionPlan(layoutOf(rawWith([])), { level }), motionPlan(layoutOf(rawWith(FEW)), { level }));
  }
});

test('循環動畫的題材依格子順序輪替，裝飾格沒有動態', () => {
  const plan = motionPlan(layoutOf(rawWith(FEW)));

  assert.deepEqual(plan.tiles.map((tile) => tile.theme), ['windmill', 'fountain', 'flag', 'crane', 'boat', null]);
  const decorative = plan.tiles.find((tile) => tile.kind === 'decorative');
  assert.deepEqual([decorative.loops.length, decorative.citizens.length], [0, 0]);
});

test('環線沿步道環與橋繞整群島外緣一圈，車輛數量依畫質而定、與格子無關', () => {
  for (const layout of [layoutOf(rawWith(FEW)), islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))))]) {
    const plan = motionPlan(layout);
    const { network, bridges } = islandBody(layout);
    const byId = new Map(network.nodes.map((n) => [n.id, n]));
    const segments = network.edges.map(({ a, b }) => [byId.get(a), byId.get(b)]);
    // 環線上每一點都在路網的某一段路或橋上（橋上的點另有拱起的高度）。
    const onNetwork = ([x, z]) => segments.some(([p, q]) => {
      const [dx, dz] = [q.x - p.x, q.z - p.z];
      const k = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(p.x + dx * k - x, p.z + dz * k - z) < 1e-9;
    });
    for (const point of plan.ring) assert.ok(onNetwork(point), `環線上的點 ${point} 不在路網上`);
    // 每座島都被環線圍住（環繞數不為 0）。
    for (const tile of layout.tiles) assert.notEqual(windingNumber(plan.ring, tile.position), 0, tile.id);
    // 車道往右偏就是往島外：在步道環上的每段中點，右偏後離最近格心更遠。
    let s = 0;
    plan.ring.forEach((p, i) => {
      const q = plan.ring[(i + 1) % plan.ring.length];
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (p[2] === 0 && q[2] === 0) {
        const nearest = ({ x, z }) => Math.min(...layout.tiles.map((t) => Math.hypot(x - t.position.x, z - t.position.z)));
        const center = pointAlong(plan.ring, s + length / 2);
        const outer = pointAlong(plan.ring, s + length / 2, { lane: 0.05 });
        assert.ok(nearest(outer) > nearest(center), `第 ${i} 段的右側不是島外`);
      }
      s += length;
    });
    // 有過橋：至少一點拱在水道上方。
    assert.ok(bridges.length > 0 && plan.ring.some((p) => p[2] > 0));
  }
  const plan = motionPlan(layoutOf(rawWith(FEW)));
  assert.deepEqual(plan.vehicles.map((v) => v.kind), ['train', 'bus', 'bus']);
  const layout = layoutOf(rawWith(FEW));
  assert.deepEqual(motionPlan(layout, { level: 'low' }).vehicles.map((v) => v.kind), ['train', 'bus']);
});

test('沿路線取點：依走過的距離得到位置與行進方向，繞完一圈回到起點', () => {
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]];

  assert.deepEqual(round(pointAlong(square, 0.5)), { x: 0.5, z: 0, heading: 0 });
  assert.deepEqual(round(pointAlong(square, 1.5)), { x: 1, z: 0.5, heading: round1(Math.PI / 2) });
  assert.deepEqual(round(pointAlong(square, 4.5)), round(pointAlong(square, 0.5)));
  assert.deepEqual(round(pointAlong(square, -0.5)), { x: 0, z: 0.5, heading: round1(-Math.PI / 2) });
  // lane 為正時往行進方向的右側偏（俯視、+z 朝下時的右手邊）。
  assert.deepEqual(round(pointAlong(square, 0.5, { lane: 0.1 })), { x: 0.5, z: 0.1, heading: 0 });
});

test('市民、車輛與循環動畫都是時間的函式：同一時間同一姿勢，循環動畫每個週期回到原樣', () => {
  const plan = motionPlan(layoutOf(rawWith(FEW)));
  const tile = areaPlans(plan)[0];
  const citizen = tile.citizens[0];

  assert.deepEqual(citizenPose(tile, citizen, 3.2), citizenPose(tile, citizen, 3.2));
  assert.notDeepEqual(citizenPose(tile, citizen, 0), citizenPose(tile, citizen, 2));
  const swings = Array.from({ length: 50 }, (_, i) => citizenPose(tile, citizen, i * 0.05).legSwing);
  assert.ok(Math.max(...swings) > 0.3 && Math.min(...swings) < -0.3, '走路時腿要前後擺');

  const train = plan.vehicles[0];
  assert.notDeepEqual(vehiclePose(plan.ring, train, 0), vehiclePose(plan.ring, train, 1));

  for (const { id } of MOTION_THEMES) {
    for (const t of [0, 1.3, 4.9]) {
      assert.deepEqual(round(loopPose(id, t)), round(loopPose(id, t + LOOP_SECONDS)), id);
    }
    assert.notDeepEqual(loopPose(id, 0), loopPose(id, LOOP_SECONDS / 4), `${id} 要會動`);
  }
});

test('道具與市民放大到全景看得到，每格的倍率相同，倍率算進動態的強度', () => {
  const tiles = areaPlans(motionPlan(layoutOf(rawWith(FEW))));

  assert.ok(LOOP_SCALE >= 2, `道具倍率 ${LOOP_SCALE}`);
  assert.ok(CITIZEN_SCALE >= 1.2, `市民倍率 ${CITIZEN_SCALE}`);
  for (const tile of tiles) {
    assert.ok(tile.loops.every((loop) => loop.scale === LOOP_SCALE), tile.id);
    assert.ok(tile.citizens.every((citizen) => citizen.scale === CITIZEN_SCALE), tile.id);
  }
  const bigger = { ...tiles[1], loops: tiles[1].loops.map((loop) => ({ ...loop, scale: loop.scale * 1.5 })) };
  assert.notEqual(motionSignature(bigger), motionSignature(tiles[0]), '只有一格道具比較大時，簽章要不同');
  const taller = { ...tiles[1], citizens: tiles[1].citizens.map((c) => ({ ...c, scale: c.scale * 1.5 })) };
  assert.notEqual(motionSignature(taller), motionSignature(tiles[0]), '只有一格市民比較大時，簽章要不同');
});

test('放大後的道具底座不進元素區、不碰市民路線，吊臂擺到最遠也不伸進元素區', () => {
  const tile = areaPlans(motionPlan(layoutOf(rawWith(FEW))))[0];
  // 市民路線上最靠近道具軸心的距離（每 0.01 取一點）。
  const steps = Math.ceil(tile.pathLength / 0.01);
  const along = Array.from({ length: steps }, (_, i) => pointAlong(tile.path, i * 0.01, { total: tile.pathLength }));

  for (const loop of tile.loops) {
    const [x, z] = [tile.center.x + loop.x, tile.center.z + loop.z];
    assert.ok(loop.z - LOOP_CORE >= ELEMENT_MAX_Z - 1e-9, `底座伸到 z ${loop.z - LOOP_CORE}`);
    const nearest = Math.min(...along.map((p) => Math.hypot(p.x - x, p.z - z)));
    assert.ok(nearest - CITIZEN_RADIUS > LOOP_CORE, `市民身體離道具軸心 ${nearest - CITIZEN_RADIUS}`);
  }
  // 吊臂（原尺寸伸出 0.14）往格心擺動時離元素區最近。
  const swings = Array.from({ length: 60 }, (_, i) => Math.abs(loopPose('crane', (i / 60) * LOOP_SECONDS).swing));
  assert.ok(LOOP_SPOTS[0].z - 0.14 * LOOP_SCALE * Math.sin(Math.max(...swings)) >= ELEMENT_MAX_Z, '吊臂伸進元素區');
});

// 標記離鏡頭的視線有沒有被擋：從標記頂面中心往鏡頭取樣，碰到直立圓柱（離格子頂面 bottom 到 height）就算擋住。
// 以下兩個值抄自 island-models.js（該模組載入 three.js，Node 不載）：TILE_SURFACE 與議題區 ELEMENT_AREA 的 maxZ。
const SURFACE = 0.44;
const ELEMENT_MAX_Z = 0.24;
const RAW_DIR = fileURLToPath(new URL('../data/raw', import.meta.url));
const MARKER_TOP = SURFACE + 0.08;
function blocked(from, camera, { x, z, radius, bottom = 0, height }) {
  for (let k = 1; k <= 400; k++) {
    const t = k / 400;
    const [px, py, pz] = from.map((v, i) => v + (camera[i] - v) * t);
    if (py > SURFACE + height) return false;
    if (py >= SURFACE + bottom && Math.hypot(px - x, pz - z) < radius) return true;
  }
  return false;
}

test('放大後的道具與市民不擋住正式資料任何標記：桌面與手機的預設視角', () => {
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))));
  const plan = motionPlan(layout);
  const outline = islandPoints(layout, { surface: SURFACE, top: SURFACE + 1.1 });
  // 道具是一根柱子加上方會動零件掃過的範圍；市民沿路線每 0.05 取一個位置。
  const obstacles = plan.tiles.flatMap((tile) => [
    ...tile.loops.flatMap((loop) => {
      const at = { x: tile.center.x + loop.x, z: tile.center.z + loop.z, height: LOOP_HEIGHT };
      return [{ ...at, radius: LOOP_CORE }, { ...at, radius: LOOP_REACH, bottom: LOOP_REACH_FROM }];
    }),
    ...Array.from({ length: Math.ceil(tile.pathLength / 0.05) }, (_, i) => pointAlong(tile.path, i * 0.05, { total: tile.pathLength }))
      .filter(() => tile.citizens.length > 0)
      .map(({ x, z }) => ({ x, z, radius: CITIZEN_RADIUS, height: CITIZEN_HEIGHT })),
  ]);

  // 橫式桌面與直式手機（扣掉浮動元件後的可見範圍長寬比）。
  for (const aspect of [1.6, 1.2, 0.6, 0.5, 0.46]) {
    const view = homeView(outline, { fov: 32, aspect, fill: 0.8 });
    const camera = [
      view.target.x + view.distance * Math.sin(view.polar) * Math.sin(view.azimuth),
      view.distance * Math.cos(view.polar),
      view.target.z + view.distance * Math.sin(view.polar) * Math.cos(view.azimuth),
    ];
    const hidden = layout.tiles.flatMap((tile) => tile.markers
      .filter((m) => obstacles.some((o) => blocked([tile.position.x + m.offset.x, MARKER_TOP, tile.position.z + m.offset.z], camera, o)))
      .map((m) => `${tile.id}/${m.candidateId}`));
    assert.deepEqual(hidden, [], `長寬比 ${aspect}`);
  }
});

// 封閉折線繞 point 的圈數（俯視平面上）。
function windingNumber(ring, { x, z }) {
  let total = 0;
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    let d = Math.atan2(bz - z, bx - x) - Math.atan2(az - z, ax - x);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    total += d;
  });
  return Math.round(total / (2 * Math.PI));
}

const round1 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round1(v)]));
