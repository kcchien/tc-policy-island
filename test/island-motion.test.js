import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout, islandPoints } from '../site/js/island-layout.js';
import { homeView } from '../site/js/island-camera.js';
import {
  ACCESSORY_CROWN, ACCESSORY_LOW, ACCESSORY_REACH, ACCESSORY_TOP, CITIZEN_BOB, CITIZEN_CROWN, CITIZEN_FIGURE, CITIZEN_HEIGHT, CITIZEN_RADIUS,
  CITIZEN_REACH, CITIZEN_REACH_HEIGHT, CITIZEN_ROLES, CITIZEN_SCALE,
  CITIZEN_ZOOM, citizenZoom, citizenPose, LOOP_CORE, LOOP_HEIGHT, LOOP_REACH, LOOP_REACH_FROM, LOOP_SCALE, LOOP_SECONDS, loopPose,
  LOOP_SPOTS, MOTION_LEVELS, MOTION_THEMES, motionPlan, motionSignature, pointAlong, RING_LANES, VEHICLE_HALF_WIDTH, vehiclePose,
} from '../site/js/island-motion.js';
import { BRIDGE, islandBody, tileAt, TILE_SLOTS } from '../site/js/island-body.js';
import { heroPlan, heroSceneFor, partBounds } from '../site/js/island-heroes.js';
import { decorPlan } from '../site/js/island-decor.js';
import { plazaLayout } from '../site/js/island-plaza.js';
import { fileURLToPath } from 'node:url';
import { loadRawData } from '../scripts/lib/raw-data.js';
import { makeRaw, policy } from './fixtures/make-raw.js';
import { assertFaceVisible } from './fixtures/face.js';

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

test('市民是 Q 版大頭：頭約占身高四成，腿、手臂、身體、頭、髮殼、眼睛各一種零件，腳下有淡淡的假影子', () => {
  const { parts, height, shadow } = CITIZEN_FIGURE;
  const head = parts.find((p) => p.part === 'head');

  assert.deepEqual([...new Set(parts.map((p) => p.part))].sort(), ['arm', 'body', 'cheek', 'eye', 'hair', 'head', 'leg', 'mouth']);
  assertFaceVisible(parts, { forward: 0 });
  const ratio = (head.radius * 2) / height;
  assert.ok(ratio >= 0.36 && ratio <= 0.44, `頭占身高 ${ratio.toFixed(2)}`);
  // 頭頂（含髮殼）就是身高，腳底在 0。
  const top = Math.max(...parts.map((p) => p.at[1] + (p.radius ?? p.height / 2)));
  assert.ok(Math.abs(top - height) < 1e-9, `零件最高到 ${top}，身高 ${height}`);
  assert.equal(parts.filter((p) => p.part === 'leg').length, 2);
  assert.equal(parts.filter((p) => p.part === 'arm').length, 2);
  assert.equal(parts.filter((p) => p.part === 'eye').length, 2);
  assert.ok(shadow.opacity > 0.15 && shadow.opacity < 0.3);
});

test('市民的角色配件：每格配件大小的組成相同，同類別內依格子順序輪替，與議題區內容和政見無關', () => {
  const plan = motionPlan(layoutOf(rawWith(FEW)));
  const roles = areaPlans(plan).map((tile) => tile.citizens.map((c) => c.role));

  assert.deepEqual(CITIZEN_ROLES.map((r) => r.id), ['student', 'elder', 'commuter', 'farmer', 'worker', 'traveler', 'parent']);
  // 第 1 位是地上的大件（腳踏車、行李箱、嬰兒車），第 2 位戴帽子，第 3 位是拐杖。
  assert.deepEqual(roles.slice(0, 4), [
    ['commuter', 'student', 'elder'],
    ['traveler', 'farmer', 'elder'],
    ['parent', 'worker', 'elder'],
    ['commuter', 'student', 'elder'],
  ]);
  assert.deepEqual(areaPlans(motionPlan(layoutOf(rawWith(FEW)), { level: 'low' })).map((t) => t.citizens.map((c) => c.role)).slice(0, 2), [['commuter'], ['traveler']]);
  // 簽章比對類別：換成另一類別的角色時不同，同類別內換角色時相同。
  const [first] = areaPlans(plan);
  const swap = (citizen, role) => ({ ...first, citizens: first.citizens.map((c) => (c === citizen ? { ...c, role, group: CITIZEN_ROLES.find((r) => r.id === role).group } : c)) });
  assert.equal(motionSignature(swap(first.citizens[0], 'parent')), motionSignature(first));
  assert.notEqual(motionSignature(swap(first.citizens[0], 'farmer')), motionSignature(first));
  // 換政見、換議題區名稱與說明，配件分配不變。
  const renamed = rawWith(MANY);
  renamed.issueAreas = renamed.issueAreas.map((a, i) => ({ ...a, name: `改名${i}`, description: '另一段說明', departments: ['另一局'] }));
  const other = motionPlan(layoutOf(renamed));
  assert.deepEqual(areaPlans(other).map((tile) => tile.citizens.map((c) => c.role)), roles);
  // 每種角色都有配件。
  assert.ok(CITIZEN_ROLES.every((r) => r.accessory));
});

test('市民沿路網走：繞自己島的步道環，途中走上一座橋到拱頂折返，去回走同一側人行道，不進鄰島；優先走沒有環線車輛的橋', () => {
  for (const layout of [layoutOf(rawWith(FEW)), islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))))]) {
    const plan = motionPlan(layout);
    const { bridges } = islandBody(layout);
    const ringPoints = plan.ring.map(([x, z]) => `${x.toFixed(6)},${z.toFixed(6)}`);
    const onRing = (bridge) => ringPoints.includes(bridge.from.map((v, i) => ((v + bridge.to[i]) / 2).toFixed(6)).join(','));
    for (const tile of areaPlans(plan)) {
      const own = bridges.filter((b) => b.tiles.includes(tile.id));
      const bridge = own.find((b) => b.tiles.includes(tile.spur.tileId));
      assert.ok(bridge, `${tile.id} 的過橋對象 ${tile.spur.tileId} 不是鄰島`);
      if (own.some((b) => !onRing(b))) assert.ok(!onRing(bridge), `${tile.id} 有沒有車的橋卻走環線的橋`);
      // 路線上的點：只在自己島或橋上（橋上拱起），不走進鄰島，每座島上只有自己的市民。
      const visited = new Set(tile.path.map(([x, z]) => tileAt(layout, { x, z })));
      assert.deepEqual([...visited].sort(), [null, tile.id].sort(), tile.id);
      assert.ok(Math.max(...tile.path.map(([, , y]) => y)) >= BRIDGE.rise - 1e-9, `${tile.id} 沒走到拱頂`);
      assert.ok(tile.path.every(([x, z, y]) => tileAt(layout, { x, z }) !== null || y > 0), `${tile.id} 在水道上方卻沒拱起`);
      // 橋上去回走同一條人行道（不在拱頂橫越車道），在橋面內。
      const [fx, fz] = bridge.from;
      const [dx, dz] = [(bridge.to[0] - fx) / bridge.length, (bridge.to[1] - fz) / bridge.length];
      const sides = tile.path.filter(([, , y]) => y > 0).map(([x, z]) => (x - fx) * -dz + (z - fz) * dx);
      assert.ok(Math.max(...sides) - Math.min(...sides) < 1e-9, `${tile.id} 去回不在同一條人行道`);
      assert.ok(sides.every((d) => Math.abs(d) + CITIZEN_RADIUS < BRIDGE.width / 2), `${tile.id} 走出橋面`);
      // 拱起只在橋的兩端之間。
      const along = tile.path.filter(([, , y]) => y > 0).map(([x, z]) => (x - fx) * dx + (z - fz) * dz);
      assert.ok(along.every((s) => s > 0 && s < bridge.length), `${tile.id} 拱起超出橋`);
    }
  }
});

test('每座橋上市民路線與環線車道不重疊，都在欄杆內側（正式資料含每座橋都有環線經過的格子）', () => {
  for (const layout of [layoutOf(rawWith(FEW)), islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))))]) {
    const plan = motionPlan(layout);
    const { bridges } = islandBody(layout);
    // 橋上的點換成橋的座標：along 從 from 量起，side 是離橋中線的距離。
    const frames = bridges.map((bridge) => {
      const [fx, fz] = bridge.from;
      const [dx, dz] = [(bridge.to[0] - fx) / bridge.length, (bridge.to[1] - fz) / bridge.length];
      return { bridge, at: (x, z) => ({ along: (x - fx) * dx + (z - fz) * dz, side: (x - fx) * -dz + (z - fz) * dx }), vehicles: [], citizens: [] };
    });
    const onBridge = (x, z) => {
      for (const frame of frames) {
        const { along, side } = frame.at(x, z);
        if (along > 0 && along < frame.bridge.length && Math.abs(side) < BRIDGE.width) return { frame, side };
      }
      return null;
    };
    // 環線每 0.005 取一點，兩種車道都算（環線來回經過同一座橋時兩側都有車）。
    for (const kind of ['train', 'bus']) {
      for (let s = 0; s < plan.ringLength; s += 0.005) {
        const pose = pointAlong(plan.ring, s, { lane: RING_LANES[kind], total: plan.ringLength });
        const hit = pose.y > 0 && onBridge(pose.x, pose.z);
        if (hit) hit.frame.vehicles.push([hit.side - VEHICLE_HALF_WIDTH[kind], hit.side + VEHICLE_HALF_WIDTH[kind]]);
      }
    }
    for (const tile of areaPlans(plan)) {
      for (let s = 0; s < tile.pathLength; s += 0.005) {
        const pose = pointAlong(tile.path, s, { total: tile.pathLength });
        const hit = pose.y > 0 && onBridge(pose.x, pose.z);
        // 市民的橫向範圍取含帽子的半徑。
        if (hit) hit.frame.citizens.push({ tileId: tile.id, span: [hit.side - CITIZEN_CROWN, hit.side + CITIZEN_CROWN] });
      }
    }
    // 去回同一條人行道：同一格的市民不會同時在橋上，不會迎面相撞。
    for (const tile of areaPlans(plan)) {
      const period = tile.pathLength / tile.citizens[0].speed;
      for (let t = 0; t < period; t += 0.05) {
        const up = tile.citizens.filter((c) => citizenPose(tile, c, t).y > 0).length;
        assert.ok(up <= 1, `${tile.id} 在 ${t.toFixed(2)} 秒有 ${up} 位市民同時在橋上`);
      }
    }
    const busy = frames.filter((f) => f.vehicles.length > 0 && f.citizens.length > 0);
    if (layout.tiles.length > 10) assert.ok(busy.length >= 3, '正式資料應有市民與車輛共用的橋');
    const rail = BRIDGE.width / 2 - 0.008;
    for (const frame of frames) {
      for (const [lo, hi] of frame.vehicles) assert.ok(lo > -rail && hi < rail, `車身穿過 ${frame.bridge.tiles} 橋的欄杆`);
      for (const { tileId, span: [lo, hi] } of frame.citizens) {
        assert.ok(lo > -rail && hi < rail, `${tileId} 的市民走出 ${frame.bridge.tiles} 橋的欄杆`);
        for (const [vlo, vhi] of frame.vehicles) assert.ok(hi <= vlo || lo >= vhi, `${tileId} 的市民在 ${frame.bridge.tiles} 橋上與車道重疊`);
      }
    }
  }
});

test('動態簽章看路線的形狀：轉向不同鄰島的格子相同，過橋的路線變短就不同', () => {
  const tiles = areaPlans(motionPlan(islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))))));
  assert.ok(new Set(tiles.map((t) => t.spur.angle)).size > 1, '正式資料應有轉向不同鄰島的格子');
  assert.equal(new Set(tiles.map(motionSignature)).size, 1);
  const shorter = { ...tiles[1], path: tiles[1].path.map(([x, z, y]) => [x + (y > 0 ? 0.01 : 0), z, y]) };
  assert.notEqual(motionSignature(shorter), motionSignature(tiles[0]));
});

test('鏡頭拉遠時市民放大：近看原尺寸，越遠越大，有上限；遮擋與車道檢查用上限的尺寸', () => {
  assert.equal(citizenZoom(5), 1);
  assert.equal(citizenZoom(CITIZEN_ZOOM.from), 1);
  assert.ok(citizenZoom(CITIZEN_ZOOM.from * 1.1) > 1);
  assert.equal(citizenZoom(500), CITIZEN_ZOOM.max);
  assert.ok(CITIZEN_ZOOM.max > 1.1 && CITIZEN_ZOOM.max <= 1.45);
  // 尺寸上限：身高含配件、起伏與離地，左右半寬（手臂外緣），配件伸出的範圍。
  const top = CITIZEN_SCALE * CITIZEN_ZOOM.max;
  assert.ok(Math.abs(CITIZEN_HEIGHT - (0.006 + (ACCESSORY_TOP + CITIZEN_BOB) * top)) < 1e-12);
  assert.ok(CITIZEN_REACH >= ACCESSORY_REACH * top - 1e-12);
  assert.ok(CITIZEN_CROWN >= ACCESSORY_CROWN * top - 1e-12);
  assert.ok(Math.abs(CITIZEN_REACH_HEIGHT - (0.006 + (ACCESSORY_LOW + CITIZEN_BOB) * top)) < 1e-12);
  // 頭與髮殼在帽子的範圍內。
  const crown = Math.max(...CITIZEN_FIGURE.parts.filter((p) => p.shape !== 'box').map((p) => Math.hypot(p.at[0], p.at[2]) + (p.radius ?? 0)));
  assert.ok(crown <= ACCESSORY_CROWN, `頭部伸出 ${crown}`);
  const armOuter = Math.max(...CITIZEN_FIGURE.parts.filter((p) => p.part === 'arm').map((p) => Math.abs(p.at[2]) + p.width / 2));
  assert.ok(CITIZEN_RADIUS >= armOuter * top - 1e-12);
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
  assert.ok(Math.max(...swings) > 0.5 && Math.min(...swings) < -0.5, '走路時腿要前後擺約 ±0.55');
  assert.ok(Math.max(...swings) <= 0.55 + 1e-9);
  const poses = Array.from({ length: 50 }, (_, i) => citizenPose(tile, citizen, i * 0.05));
  // 手臂與腿反向擺，幅度約 ±0.45；身體隨步伐上下起伏，不會沉到地面以下。
  assert.ok(poses.every((p) => Math.sign(p.armSwing) === -Math.sign(p.legSwing)));
  assert.ok(Math.max(...poses.map((p) => p.armSwing)) > 0.4 && Math.max(...poses.map((p) => p.armSwing)) <= 0.45 + 1e-9);
  const bobs = poses.map((p) => p.bob);
  assert.ok(Math.min(...bobs) >= 0 && Math.max(...bobs) > 0.004 && Math.max(...bobs) <= CITIZEN_BOB + 1e-9);
  // 過橋時跟著橋面拱起，在島上時貼地。
  const lifts = Array.from({ length: 400 }, (_, i) => citizenPose(tile, citizen, (i / 400) * (tile.pathLength / citizen.speed)).y);
  assert.ok(Math.max(...lifts) > 0.04 && Math.min(...lifts) === 0);

  const train = plan.vehicles[0];
  assert.notDeepEqual(vehiclePose(plan.ring, train, 0), vehiclePose(plan.ring, train, 1));

  for (const { id } of MOTION_THEMES) {
    for (const t of [0, 1.3, 4.9]) {
      assert.deepEqual(round(loopPose(id, t)), round(loopPose(id, t + LOOP_SECONDS)), id);
    }
    assert.notDeepEqual(loopPose(id, 0), loopPose(id, LOOP_SECONDS / 4), `${id} 要會動`);
  }
});

// 道具的大小上限由「選中議題區時，循環道具不擋住主題場景」那條測試把關。
test('市民放大到全景看得到，道具與市民每格的倍率相同，倍率算進動態的強度', () => {
  const tiles = areaPlans(motionPlan(layoutOf(rawWith(FEW))));

  assert.ok(CITIZEN_SCALE * CITIZEN_ZOOM.max >= 1.2, `市民全景倍率 ${CITIZEN_SCALE * CITIZEN_ZOOM.max}`);
  for (const tile of tiles) {
    assert.ok(tile.loops.every((loop) => loop.scale === LOOP_SCALE), tile.id);
    assert.ok(tile.citizens.every((citizen) => citizen.scale === CITIZEN_SCALE), tile.id);
  }
  const bigger = { ...tiles[1], loops: tiles[1].loops.map((loop) => ({ ...loop, scale: loop.scale * 1.5 })) };
  assert.notEqual(motionSignature(bigger), motionSignature(tiles[0]), '只有一格道具比較大時，簽章要不同');
  const taller = { ...tiles[1], citizens: tiles[1].citizens.map((c) => ({ ...c, scale: c.scale * 1.5 })) };
  assert.notEqual(motionSignature(taller), motionSignature(tiles[0]), '只有一格市民比較大時，簽章要不同');
});

test('市民路線與候選人人物不和靜態裝飾重疊：正式資料的每一格', () => {
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))));
  // 踏石平貼地面，走過去不算重疊。
  const items = decorPlan(layout).tiles.flatMap((tile) => tile.items
    .filter((item) => item.kind !== 'stone')
    .map((item) => ({ ...item, x: tile.center.x + item.x, z: tile.center.z + item.z, tileId: tile.id })));
  const near = (x, z, radius) => items.filter((item) => Math.hypot(item.x - x, item.z - z) < item.radius + radius);

  for (const tile of areaPlans(motionPlan(layout))) {
    const steps = Math.ceil(tile.pathLength / 0.01);
    for (let i = 0; i < steps; i++) {
      const { x, z } = pointAlong(tile.path, i * 0.01, { total: tile.pathLength });
      const hit = near(x, z, CITIZEN_RADIUS);
      assert.deepEqual(hit.map((item) => `${item.tileId}/${item.kind}`), [], `${tile.id} 的市民在 (${x.toFixed(2)}, ${z.toFixed(2)}) 碰到裝飾`);
    }
  }
  const plaza = plazaLayout(layout);
  for (const figure of plaza.figures) {
    const hit = near(figure.position.x, figure.position.z, figure.padRadius);
    assert.deepEqual(hit.map((item) => item.kind), [], `${figure.candidateId} 的人物底座碰到裝飾`);
  }
});

test('道具底座不進元素區、不碰市民路線，吊臂擺到最遠也不伸進元素區', () => {
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

test('正式資料每格的循環道具（含會動零件掃過的範圍）不穿進主題場景的零件，也不進在地感元素區', () => {
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))));
  const plan = motionPlan(layout);
  const heroes = new Map(heroPlan(layout).map((hero) => [hero.areaId, hero]));
  // 圓柱與外框在俯視平面相交、高度也重疊才算碰到。
  const hits = ({ x, z, radius, bottom = 0, height }, box) => {
    const dx = Math.max(box.min[0] - x, 0, x - box.max[0]);
    const dz = Math.max(box.min[2] - z, 0, z - box.max[2]);
    return Math.hypot(dx, dz) < radius && bottom < box.max[1] && box.min[1] < height;
  };
  const failures = [];
  for (const tile of areaPlans(plan)) {
    const e = layout.tiles.find((t) => t.id === tile.id).elementSlot;
    const [cx, cz] = [tile.center.x, tile.center.z];
    const boxes = [
      ...heroBoxes(heroes.get(tile.id)).map((b) => ({ ...b, name: `主題場景零件 ${b.name}` })),
      { name: '在地感元素區', min: [cx + e.minX, 0, cz + e.minZ], max: [cx + e.maxX, e.maxY, cz + e.maxZ] },
    ];
    for (const cyl of loopCylinders(tile)) {
      for (const box of boxes.filter((b) => hits(cyl, b))) failures.push(`${tile.id} 的 ${tile.theme} 道具（${cyl.x}, ${cyl.z}）${cyl.name}碰到${box.name}`);
    }
  }
  assert.deepEqual(failures, []);
});

// 標記離鏡頭的視線有沒有被擋：從標記頂面中心往鏡頭取樣，碰到直立圓柱（離格子頂面 bottom 到 height）就算擋住。
// TILE_SURFACE 抄自 island-models.js（該模組載入 three.js，Node 不載）。
const SURFACE = 0.44;
// 北側的主題場景與在地感元素最南到哪裡。
const ELEMENT_MAX_Z = Math.max(TILE_SLOTS.hero.z + TILE_SLOTS.hero.size / 2, TILE_SLOTS.element.area.maxZ);
const RAW_DIR = fileURLToPath(new URL('../data/raw', import.meta.url));
// 取立牌立柱的低處（牌面中心約在島面上 0.25），比牌面難看到，檢查較嚴。
const MARKER_TOP = SURFACE + 0.08;
// 障礙物是直立圓柱 { x, z, radius, bottom?, height }，或軸對齊的盒子 { min: [x, y, z], max }（y 從格子頂面量起）。
function blocked(from, camera, obstacle) {
  const { x, z, radius, bottom = 0, height = obstacle.max?.[1] } = obstacle;
  for (let k = 1; k <= 400; k++) {
    const t = k / 400;
    const [px, py, pz] = from.map((v, i) => v + (camera[i] - v) * t);
    if (py > SURFACE + height) return false;
    if (obstacle.min) {
      const p = [px, py - SURFACE, pz];
      if (p.every((c, i) => c >= obstacle.min[i] && c <= obstacle.max[i])) return true;
    } else if (py >= SURFACE + bottom && Math.hypot(px - x, pz - z) < radius) return true;
  }
  return false;
}

// 一格的循環道具，每個道具是兩段直立圓柱：柱子（地面到 LOOP_HEIGHT、半徑 LOOP_CORE）與會動零件掃過的範圍
// （LOOP_REACH_FROM 到 LOOP_HEIGHT、半徑 LOOP_REACH）。格式同 blocked 的圓柱，x、z 是場景座標。
function loopCylinders(tile) {
  return tile.loops.flatMap((loop) => {
    const at = { x: tile.center.x + loop.x, z: tile.center.z + loop.z, height: LOOP_HEIGHT };
    return [{ name: '柱子', ...at, radius: LOOP_CORE }, { name: '會動零件', ...at, radius: LOOP_REACH, bottom: LOOP_REACH_FROM }];
  });
}

// 主題場景每個零件的外框 { name, min: [x, y, z], max }：照擺放（每座同倍率，朝向不轉）放大平移，y 從格子頂面量起。
function heroBoxes(hero) {
  const { x, z, scale } = hero.transform;
  const offset = [x, 0, z];
  return heroSceneFor(hero.areaId).parts.map((part, i) => {
    const b = partBounds(part);
    return { name: `${i}（${part.shape}）`, min: b.min.map((v, k) => offset[k] + v * scale), max: b.max.map((v, k) => offset[k] + v * scale) };
  });
}

// 鏡頭位置：從 target（場景座標，y 是高度）沿 view 的俯角與方位角退 distance。
const cameraAt = ({ x, y, z }, { polar, azimuth }, distance) => [
  x + distance * Math.sin(polar) * Math.sin(azimuth),
  y + distance * Math.cos(polar),
  z + distance * Math.sin(polar) * Math.cos(azimuth),
];

test('道具、市民、主題場景、在地感元素與靜態裝飾都不擋住正式資料任何標記：桌面與手機的預設視角', () => {
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))));
  const plan = motionPlan(layout);
  const outline = islandPoints(layout, { surface: SURFACE, top: SURFACE + 1.1 });
  // 道具是一根柱子加上方會動零件掃過的範圍；市民沿路線每 0.05 取一個位置。
  const obstacles = plan.tiles.flatMap((tile) => [
    ...loopCylinders(tile),
    ...Array.from({ length: Math.ceil(tile.pathLength / 0.05) }, (_, i) => pointAlong(tile.path, i * 0.05, { total: tile.pathLength }))
      .filter(() => tile.citizens.length > 0)
      .flatMap(({ x, z }) => [{ x, z, radius: CITIZEN_CROWN, height: CITIZEN_HEIGHT }, { x, z, radius: CITIZEN_REACH, height: CITIZEN_REACH_HEIGHT }]),
  ]);
  // 主題場景以每個零件的外框檢查。在地感元素以外接元素區的圓柱近似。
  for (const hero of heroPlan(layout)) obstacles.push(...heroBoxes(hero));
  // 靜態裝飾：每件以最寬處為半徑、最高處為高的圓柱近似。
  for (const tile of decorPlan(layout).tiles) {
    for (const item of tile.items) obstacles.push({ x: tile.center.x + item.x, z: tile.center.z + item.z, radius: item.reach, height: item.height });
  }
  for (const tile of layout.tiles.filter((t) => t.heroSlot)) {
    const e = tile.elementSlot;
    obstacles.push({
      x: tile.position.x + (e.minX + e.maxX) / 2, z: tile.position.z + (e.minZ + e.maxZ) / 2,
      radius: Math.hypot(e.maxX - e.minX, e.maxZ - e.minZ) / 2, height: e.maxY,
    });
  }

  // 橫式桌面與直式手機（扣掉浮動元件後的可見範圍長寬比）。
  for (const aspect of [2.6, 2.2, 2.0, 1.9, 1.8, 1.6, 1.4, 1.2, 1.0, 0.9, 0.6, 0.5, 0.46]) {
    const view = homeView(outline, { fov: 32, aspect });
    const camera = cameraAt({ x: view.target.x, y: 0, z: view.target.z }, view, view.distance);
    const hidden = layout.tiles.flatMap((tile) => tile.markers
      .filter((m) => obstacles.some((o) => blocked([tile.position.x + m.offset.x, MARKER_TOP, tile.position.z + m.offset.z], camera, o)))
      .map((m) => `${tile.id}/${m.candidateId}`));
    assert.deepEqual(hidden, [], `長寬比 ${aspect}`);
  }
});

test('選中議題區時，循環道具不擋住正式資料任何主題場景的零件：桌面與手機的預設視角', () => {
  const layout = islandLayout(buildViewModel(buildPublicDataset(loadRawData(RAW_DIR))));
  const plan = motionPlan(layout);
  const outline = islandPoints(layout, { surface: SURFACE, top: SURFACE + 1.1 });
  const props = plan.tiles.flatMap(loopCylinders);
  // 每個零件取外框頂面中心。只保證每個零件的頂面看得到，側面下半部仍可能被擋。
  const tops = heroPlan(layout).flatMap((hero) => heroBoxes(hero).map(({ name, min, max }) => (
    { areaId: hero.areaId, name, at: [(min[0] + max[0]) / 2, SURFACE + max[1], (min[2] + max[2]) / 2] })));
  // 選中議題區時鏡頭保持預設視角的俯角與方位角，對準格心，距離取 FOCUS_DISTANCE 與預設距離較近者。
  // FOCUS_DISTANCE 抄自 island-view.js（focusArea，該模組載入 three.js，Node 不載）。
  const FOCUS_DISTANCE = 14;
  const failures = [];
  for (const aspect of [2.6, 2.0, 1.6, 1.2, 0.9, 0.6, 0.46]) {
    const view = homeView(outline, { fov: 32, aspect });
    const distance = Math.min(FOCUS_DISTANCE, view.distance);
    for (const tile of layout.tiles.filter((t) => t.heroSlot)) {
      const camera = cameraAt({ x: tile.position.x, y: SURFACE, z: tile.position.z }, view, distance);
      for (const top of tops.filter((t) => t.areaId === tile.id)) {
        if (props.some((o) => blocked(top.at, camera, o))) failures.push(`長寬比 ${aspect}：${tile.id} 零件 ${top.name}`);
      }
    }
  }
  assert.deepEqual(failures, []);
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
