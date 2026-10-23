import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout, islandPoints } from '../site/js/island-layout.js';
import { homeView } from '../site/js/island-camera.js';
import {
  CITIZEN_HEIGHT, CITIZEN_RADIUS, CITIZEN_SCALE, citizenPose, LOOP_CORE, LOOP_HEIGHT, LOOP_REACH, LOOP_REACH_FROM, LOOP_SCALE, LOOP_SECONDS, loopPose,
  MOTION_LEVELS, MOTION_THEMES, motionPlan, motionSignature, pointAlong, vehiclePose,
} from '../site/js/island-motion.js';
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

test('路網鋪在每條格子邊上，相鄰兩格共用的邊只鋪一次', () => {
  const plan = motionPlan(layoutOf(rawWith(FEW)));

  // 6 格共 36 條邊，相鄰格共用 8 條：一列內 3 條加第二列內 1 條，兩列之間 4 條。
  assert.equal(plan.roads.length, 28);
  assert.equal(plan.roads.filter((road) => road.shared).length, 8);
});

test('環線繞島外緣一圈、在格子外面，車輛數量依畫質而定、與格子無關', () => {
  const layout = layoutOf(rawWith(FEW));
  const plan = motionPlan(layout);

  assert.equal(plan.ring.length, 20);
  for (const [x, z] of plan.ring) {
    const nearest = Math.min(...layout.tiles.map((t) => Math.hypot(x - t.position.x, z - t.position.z)));
    assert.ok(nearest > 1.05, `環線上的點 ${x},${z} 離格心只有 ${nearest}`);
  }
  assert.deepEqual(plan.vehicles.map((v) => v.kind), ['train', 'bus', 'bus']);
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
  assert.ok(CITIZEN_SCALE >= 1.3, `市民倍率 ${CITIZEN_SCALE}`);
  for (const tile of tiles) {
    assert.ok(tile.loops.every((loop) => loop.scale === LOOP_SCALE), tile.id);
    assert.ok(tile.citizens.every((citizen) => citizen.scale === CITIZEN_SCALE), tile.id);
  }
  const bigger = { ...tiles[1], loops: tiles[1].loops.map((loop) => ({ ...loop, scale: loop.scale * 1.5 })) };
  assert.notEqual(motionSignature(bigger), motionSignature(tiles[0]), '只有一格道具比較大時，簽章要不同');
  const taller = { ...tiles[1], citizens: tiles[1].citizens.map((c) => ({ ...c, scale: c.scale * 1.5 })) };
  assert.notEqual(motionSignature(taller), motionSignature(tiles[0]), '只有一格市民比較大時，簽章要不同');
});

// 標記離鏡頭的視線有沒有被擋：從標記頂面中心往鏡頭取樣，碰到直立圓柱（離格子頂面 bottom 到 height）就算擋住。
const SURFACE = 0.44; // island-models.js 的 TILE_SURFACE（該模組載入 three.js，Node 不載）
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
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData('data/raw'))));
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

const round1 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round1(v)]));
