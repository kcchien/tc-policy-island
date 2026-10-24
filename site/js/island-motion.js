// 島嶼的動態配置：每格的循環動畫、市民、環線上的車輛與路網。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 動態數量固定（ADR 0001）：每個議題區格子的動態元素數量與強度相同，配置只讀格子的種類、順序與位置，
// 不讀標記亮暗與政見。上線關卡「動態數量固定」會換一份政見資料重算，結果必須相同，關卡也要載入這裡 import 的 island-body.js。
// 市民是 Q 版零件，角色配件三類每格同組成，繞自己島的步道環並走上一座橋到拱頂折返；拉遠時依 citizenZoom 放大。

import { bridgeLift, islandBody, outerLoop, WALKWAY_APOTHEM } from './island-body.js';

// 循環動畫的題材，依議題區格子的順序輪替，與議題內容無關。
export const MOTION_THEMES = [
  { id: 'windmill', name: '風車' },
  { id: 'fountain', name: '噴泉' },
  { id: 'flag', name: '旗子' },
  { id: 'crane', name: '吊臂' },
  { id: 'boat', name: '小船' },
];

// 所有循環動畫同一個週期（秒），強度一致。
export const LOOP_SECONDS = 6;
// 市民走路的速度（場景單位／秒）與步伐週期（秒）。速度約每秒走一個身高（參考做法的比例），騎車的人也同速，每格強度相同。
export const CITIZEN_SPEED = 0.18;
export const STEP_SECONDS = 0.7;
// 環線車輛的速度（場景單位／秒）。
export const TRAIN_SPEED = 0.9;
export const BUS_SPEED = 0.6;

// 每種畫質的數量。低畫質減少市民與車輛，但每格仍相同。
export const MOTION_LEVELS = {
  high: { citizensPerTile: 3, buses: 2, trains: 1 },
  medium: { citizensPerTile: 2, buses: 2, trains: 1 },
  low: { citizensPerTile: 1, buses: 1, trains: 1 },
};

// 循環道具的位置（相對格心）：格子東西兩側、標記列北邊，左右對稱，與三個標記的距離對稱。
// 放大後底座仍不進北側的主題場景與元素區（z ≤ 0.24，見 island-body.js 的 TILE_SLOTS）、不碰標記與市民路線，測試會檢查。
export const LOOP_SPOTS = [{ x: -0.7, z: 0.34 }, { x: 0.7, z: 0.34 }];
// 市民走的路線：沿自己那座島的步道環，走在中線內側 CITIZEN_INSET（車輛走外側車道）。值是格心到邊的距離。
const CITIZEN_INSET = 0.075;
export const CITIZEN_APOTHEM = WALKWAY_APOTHEM - CITIZEN_INSET;

// 道具與市民的放大倍率：模型在 island-motion-view.js 以原尺寸組好，放上格子時乘這個倍率，讓全景第一眼就看得到動態。
// 倍率是動態強度的一部分，每格相同（motionSignature 會比對）。
// 市民沿格子南緣走過外側標記前方，再高就會在手機的預設視角擋住標記；身寬受步道上的車道限制（市民走內側，公車靠中線）。
// 市民另隨鏡頭距離放大（citizenZoom），放大到上限時仍要守住這兩個限制。
export const LOOP_SCALE = 2;
export const CITIZEN_SCALE = 1.05;
// 放大後的外形（場景單位），測試用來確認不擋住標記、不進元素區、不碰市民。道具：半徑 LOOP_CORE 的柱子高到 LOOP_HEIGHT，
// 會動零件（風車葉、旗、吊臂）只在 LOOP_REACH_FROM 以上，掃過半徑 LOOP_REACH。
// 原尺寸見 island-motion-view.js 的 LOOP_PROPS，改形狀時要守住這些範圍。市民的外形範圍在 CITIZEN_FIGURE 之後。
export const LOOP_HEIGHT = 0.45 * LOOP_SCALE;
export const LOOP_CORE = 0.05 * LOOP_SCALE;
export const LOOP_REACH = 0.15 * LOOP_SCALE;
export const LOOP_REACH_FROM = 0.18 * LOOP_SCALE;

// 市民是 Q 版大頭小人：原尺寸（乘 CITIZEN_SCALE 前）身高 height，頭的直徑約占身高四成。y 朝上、腳底在 0，臉朝 +x（行進方向），z 是左右。
// 每種零件在 island-motion-view.js 是一個 InstancedMesh；腿與手臂的 at 是零件中心，擺動時繞上端（髖、肩）轉。
// 身體是膠囊（radius、length 是中段圓柱長）；髮殼蓋住頭頂 cover × 180 度，往後腦傾斜 tilt 弧度，露出前額與臉；
// 臉上有圓點眼睛、腮紅（disc）與微笑線（arc，半圓弧），與候選人人物同一套臉（island-plaza.js）。
export const CITIZEN_FIGURE = {
  height: 0.16,
  parts: [
    { part: 'leg', shape: 'box', width: 0.012, height: 0.042, at: [0, 0.024, -0.008] },
    { part: 'leg', shape: 'box', width: 0.012, height: 0.042, at: [0, 0.024, 0.008] },
    { part: 'body', shape: 'capsule', radius: 0.018, length: 0.022, at: [0, 0.068, 0] },
    { part: 'arm', shape: 'box', width: 0.008, height: 0.038, at: [0, 0.07, -0.022] },
    { part: 'arm', shape: 'box', width: 0.008, height: 0.038, at: [0, 0.07, 0.022] },
    { part: 'head', shape: 'sphere', radius: 0.032, at: [0, 0.125, 0] },
    { part: 'hair', shape: 'dome', radius: 0.035, cover: 0.42, tilt: 1, at: [-0.003, 0.125, 0] },
    { part: 'eye', shape: 'sphere', radius: 0.0045, at: [0.029, 0.133, -0.011] },
    { part: 'eye', shape: 'sphere', radius: 0.0045, at: [0.029, 0.133, 0.011] },
    { part: 'cheek', shape: 'disc', radius: 0.005, thickness: 0.0012, at: [0.027, 0.123, -0.017] },
    { part: 'cheek', shape: 'disc', radius: 0.005, thickness: 0.0012, at: [0.027, 0.123, 0.017] },
    { part: 'mouth', shape: 'arc', radius: 0.006, tube: 0.0014, at: [0.0314, 0.119, 0] },
  ],
  // 腳下的圓形假影子（不用即時陰影，貼在地面上）。
  shadow: { radius: 0.03, opacity: 0.22 },
};

// 角色配件：依格子與市民的順序決定（不讀議題區內容與政見），每格的人數固定。
// 配件的形狀在 island-motion-view.js 的 ACCESSORIES，大小守住這幾個範圍（原尺寸）：全部在 ACCESSORY_TOP 以下；
// 帽子離身體中心 ACCESSORY_CROWN 以內；嬰兒車、腳踏車這類低處的配件在 ACCESSORY_LOW 以下、離身體中心 ACCESSORY_REACH 以內。
// 角色（識別碼依序是學童、長者、通勤族、農夫、工人、旅客、推嬰兒車的家長）分三類配件：
// wheeled 是地上有車輪或箱子的大件、hat 是帽子、hand 是手上的小件。每格第 i 位市民的類別相同（ROLE_GROUPS 的順序），
// 各格的配件大小組成一樣，動態簽章會比對類別；同類別內的角色依格子順序輪替。
export const CITIZEN_ROLES = [
  { id: 'student', group: 'hat', accessory: 'cap' },
  { id: 'elder', group: 'hand', accessory: 'cane' },
  { id: 'commuter', group: 'wheeled', accessory: 'bicycle' },
  { id: 'farmer', group: 'hat', accessory: 'strawHat' },
  { id: 'worker', group: 'hat', accessory: 'helmet' },
  { id: 'traveler', group: 'wheeled', accessory: 'suitcase' },
  { id: 'parent', group: 'wheeled', accessory: 'stroller' },
];
export const ROLE_GROUPS = ['wheeled', 'hat', 'hand'];
// 騎腳踏車時身體抬高的量（原尺寸）。
export const RIDE_LIFT = 0.01;
export const ACCESSORY_TOP = CITIZEN_FIGURE.height + RIDE_LIFT;
export const ACCESSORY_CROWN = 0.042;
export const ACCESSORY_LOW = 0.075;
export const ACCESSORY_REACH = 0.065;

// 走路的擺幅（弧度）與起伏（原尺寸）：腿前後 ±0.55、手臂反向 ±0.45，身體每一步上下起伏一次。
const LEG_SWING = 0.55;
const ARM_SWING = 0.45;
export const CITIZEN_BOB = 0.006;

// 鏡頭拉遠時市民放大，全景也看得到：距離超過 from 後依比例放大，最多 max 倍。每個市民同一倍率。
export const CITIZEN_ZOOM = { from: 20, max: 1.17 };
export const citizenZoom = (distance) => Math.min(CITIZEN_ZOOM.max, Math.max(1, distance / CITIZEN_ZOOM.from));

// 市民放大到上限時的外形（場景單位），測試用來確認不擋住標記、不出步道、不碰其他車道與道具：
// 最高到 CITIZEN_HEIGHT（含離地 0.006、配件與起伏）；身體與手臂的半寬 CITIZEN_RADIUS；
// 整個人含帽子是半徑 CITIZEN_CROWN 的柱子，低處配件另外伸出到半徑 CITIZEN_REACH、高 CITIZEN_REACH_HEIGHT。
const CITIZEN_MAX_SCALE = CITIZEN_SCALE * CITIZEN_ZOOM.max;
const CITIZEN_HALF_WIDTH = Math.max(...CITIZEN_FIGURE.parts.filter((p) => p.part === 'arm').map((p) => Math.abs(p.at[2]) + p.width / 2));
export const CITIZEN_HEIGHT = 0.006 + (ACCESSORY_TOP + CITIZEN_BOB) * CITIZEN_MAX_SCALE;
export const CITIZEN_RADIUS = CITIZEN_HALF_WIDTH * CITIZEN_MAX_SCALE;
export const CITIZEN_CROWN = ACCESSORY_CROWN * CITIZEN_MAX_SCALE;
export const CITIZEN_REACH = ACCESSORY_REACH * CITIZEN_MAX_SCALE;
export const CITIZEN_REACH_HEIGHT = 0.006 + (ACCESSORY_LOW + CITIZEN_BOB) * CITIZEN_MAX_SCALE;

// 環線（公車與火車）：沿步道環與橋繞整群島的外側一圈（island-body.js 的 outerLoop），過橋時跟著拱起。
// 車道是離步道中線往外的距離：火車走外側，公車靠中線，市民走內側，三者不重疊。
export const RING_LANES = { train: 0.05, bus: -0.012 };
// 車身半寬（island-motion-view.js 依此建車身），測試用來確認車道不出步道、不穿過橋的欄杆與路燈。
export const VEHICLE_HALF_WIDTH = { train: 0.035, bus: 0.0325 };

// 尖頂六角格的六個頂點（相對格心），從東南起逆時針（俯視時 +z 朝下，所以是順時針繞）。
function hexVertices(apothem) {
  const r = apothem / Math.cos(Math.PI / 6);
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

// 過橋往返時去、回兩條線離橋中線的距離，與橋上拱起取的分段數。環線來回經過同一座橋時兩側都有車，
// 市民走在兩種車道外側（火車車身外緣再留 0.01），含帽子的半徑也不碰車；橋寬（island-body.js 的 BRIDGE）依此加寬。
export const SPUR_LANE = RING_LANES.train + VEHICLE_HALF_WIDTH.train + 0.01 + CITIZEN_CROWN;
const SPUR_STEPS = 8;

// 市民繞的步道環內側一圈（相對格心），點是 [x, z, y]。
const citizenRing = () => hexVertices(CITIZEN_APOTHEM).map(([x, z]) => [x, z, 0]);

// 市民路線的形狀（相對格心、過橋方向朝 +x 時）：沿步道環內側繞一圈，經過東邊中點時走上橋，到橋中央拱頂折返。
// 不走進鄰島，每座島上的市民只有自己那幾位，不會因為被較多鄰島選為過橋對象而比較熱鬧（ADR 0001）。
// 點是 [x, z, y]，y 是過橋的拱起。centers 是兩島格心距離，每格相同，所以每格的形狀相同，只差旋轉。
function citizenRoute(centers) {
  const span = centers - 2 * WALKWAY_APOTHEM;
  const crossing = Array.from({ length: SPUR_STEPS / 2 }, (_, k) => (k + 1) / SPUR_STEPS)
    .map((t) => [WALKWAY_APOTHEM + span * t, bridgeLift(t)]);
  // 去回都走北側（-z）的人行道，在拱頂原地折返，不橫越中間的車道；頂點順序經過東邊（最後一個頂點到第一個）時接上。
  // 市民在路線上的間隔遠大於過橋那一段，同一時間一條人行道上最多一位，去回同一條線不會相撞。
  const out = [[CITIZEN_APOTHEM, 0], [WALKWAY_APOTHEM, 0], ...crossing].map(([x, y]) => [x, -SPUR_LANE, y]);
  const back = out.slice(0, -1).reverse();
  return [...citizenRing(), ...out, ...back];
}

// 俯視平面上一點的比對鍵（環線上的點與橋中點比對用）。
const pointKey = ([x, z]) => `${x.toFixed(6)},${z.toFixed(6)}`;

// 每格上哪座橋：優先選沒有環線車輛的橋（環線經過的橋，橋中點會在環線上），同樣條件時依方位取第一座：
// 從正東起依東、東南、西南、西、西北、東北的順序（俯視 +z 朝南，是順時針）。
function spurOf(tile, body, ringKeys) {
  const options = body.bridges
    .filter((b) => b.tiles.includes(tile.id))
    .map((b) => {
      const [from, to] = b.tiles[0] === tile.id ? [b.from, b.to] : [b.to, b.from];
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
      return {
        tileId: b.tiles.find((id) => id !== tile.id),
        angle,
        side: (Math.round(angle / (Math.PI / 3)) + 6) % 6,
        busy: ringKeys.has(pointKey([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2])),
        centers: Math.hypot(to[0] - from[0], to[1] - from[1]) + 2 * WALKWAY_APOTHEM,
      };
    })
    .sort((a, b) => a.busy - b.busy || a.side - b.side);
  return options[0] ?? null;
}

// 把路線形狀轉到過橋方向 angle、移到格心。
const placeRoute = (route, angle, { x: cx, z: cz }) => {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return route.map(([x, z, y]) => [cx + x * c - z * s, cz + x * s + z * c, y]);
};

// 每格的動態。layout 是 islandLayout 的結果，只用 tiles 的 kind、id、axial、position。
export function motionPlan(layout, { level = 'high' } = {}) {
  const counts = MOTION_LEVELS[level] ?? MOTION_LEVELS.high;
  const body = islandBody(layout);
  const ring = outerLoop(body);
  const ringKeys = new Set(ring.map(pointKey));
  let areaIndex = 0;
  const tiles = layout.tiles.map((tile) => {
    const { id, kind, position } = tile;
    const center = { x: position.x, z: position.z };
    if (kind !== 'area') return { id, kind, center, theme: null, loops: [], citizens: [], spur: null, path: [], pathLength: 0 };
    const theme = MOTION_THEMES[areaIndex % MOTION_THEMES.length].id;
    areaIndex += 1;
    const spur = spurOf(tile, body, ringKeys);
    // 只有一格、沒有鄰島時只繞自己的步道環。
    const path = spur
      ? placeRoute(citizenRoute(spur.centers), spur.angle, center)
      : placeRoute(citizenRing(), 0, center);
    return {
      id,
      kind,
      center,
      theme,
      spur: spur && { tileId: spur.tileId, angle: spur.angle },
      loops: LOOP_SPOTS.map((spot, i) => ({ ...spot, mirror: i === 1, periodSeconds: LOOP_SECONDS, scale: LOOP_SCALE })),
      // 市民平均分散在路線上，同速同向。第 i 位的配件類別每格相同（ROLE_GROUPS），類別內的角色依議題區格子的順序輪替。
      citizens: Array.from({ length: counts.citizensPerTile }, (_, i) => {
        const group = ROLE_GROUPS[i % ROLE_GROUPS.length];
        const roles = CITIZEN_ROLES.filter((r) => r.group === group);
        return {
          phase: i / counts.citizensPerTile,
          speed: CITIZEN_SPEED,
          stepSeconds: STEP_SECONDS,
          scale: CITIZEN_SCALE,
          group,
          role: roles[(areaIndex - 1) % roles.length].id,
        };
      }),
      path,
      pathLength: pathLength(path),
    };
  });
  const vehicles = [
    ...Array.from({ length: counts.trains }, (_, i) => ({ kind: 'train', phase: i / counts.trains, speed: TRAIN_SPEED, direction: 1, lane: RING_LANES.train, cars: 3 })),
    ...Array.from({ length: counts.buses }, (_, i) => ({ kind: 'bus', phase: (i + 0.5) / counts.buses, speed: BUS_SPEED, direction: -1, lane: RING_LANES.bus, cars: 1 })),
  ];
  return { level, tiles, ring, ringLength: pathLength(ring), vehicles };
}

// 封閉折線的總長。
export function pathLength(points) {
  return points.reduce((sum, [x, z], i) => {
    const [nx, nz] = points[(i + 1) % points.length];
    return sum + Math.hypot(nx - x, nz - z);
  }, 0);
}

// 沿封閉折線走 s 的位置與行進方向（heading = atan2(dz, dx)），s 可為負或超過一圈。
// lane 是往行進方向右側（俯視、+z 朝下時的右手邊）的偏移；total 是預先算好的總長（每幀呼叫時省得重算）。
export function pointAlong(points, s, { lane = 0, total = pathLength(points) } = {}) {
  let rest = ((s % total) + total) % total;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const [nx, nz] = points[(i + 1) % points.length];
    const length = Math.hypot(nx - x, nz - z);
    if (rest <= length || i === points.length - 1) {
      const k = length === 0 ? 0 : rest / length;
      const [dx, dz] = [(nx - x) / length, (nz - z) / length];
      const pose = { x: x + (nx - x) * k - dz * lane, z: z + (nz - z) * k + dx * lane, heading: Math.atan2(dz, dx) };
      // 點有第三個值（高度，例如過橋的拱起）時一併內插。
      if (points[i].length > 2) pose.y = points[i][2] + (points[(i + 1) % points.length][2] - points[i][2]) * k;
      return pose;
    }
    rest -= length;
  }
}

const TAU = Math.PI * 2;
// 0~1 的循環進度。
const cycle = (t, period) => ((t / period) % 1 + 1) % 1;

// 市民的位置、朝向、過橋的拱起 y、腿與手臂的擺角（弧度，前後對稱，手臂與腿反向）與起伏 bob（原尺寸）。
export function citizenPose(tile, citizen, t) {
  const s = citizen.phase * tile.pathLength + citizen.speed * t;
  const { x, z, y = 0, heading } = pointAlong(tile.path, s, { total: tile.pathLength });
  const swing = Math.sin(TAU * (cycle(t, citizen.stepSeconds) + citizen.phase));
  return { x, z, y, heading, legSwing: LEG_SWING * swing, armSwing: -ARM_SWING * swing, bob: CITIZEN_BOB * Math.abs(swing) };
}

// 車廂之間的距離（場景單位，車頭到車頭）。
export const CAR_SPACING = 0.36;

// 車輛每節車廂的位置與朝向。direction 為 -1 時逆著環線的頂點順序走。total 是環線總長（motionPlan 的 ringLength）。
export function vehiclePose(ring, vehicle, t, total = pathLength(ring)) {
  const head = vehicle.phase * total + vehicle.direction * vehicle.speed * t;
  return Array.from({ length: vehicle.cars }, (_, i) => {
    const pose = pointAlong(ring, head - vehicle.direction * i * CAR_SPACING, { lane: vehicle.lane, total });
    if (vehicle.direction < 0) pose.heading += Math.PI;
    return pose;
  });
}

// 循環動畫每個題材的姿勢，週期都是 LOOP_SECONDS，擺幅相近。數值的用法見 island-motion-view.js。
export function loopPose(theme, t) {
  const k = cycle(t, LOOP_SECONDS);
  switch (theme) {
    case 'windmill':
      return { spin: TAU * k };
    case 'fountain':
      return { jet: 0.75 + 0.25 * Math.sin(TAU * 3 * k), spin: TAU * k };
    case 'flag':
      return { wave: 0.35 * Math.sin(TAU * 3 * k), ripple: 0.2 * Math.sin(TAU * 6 * k) };
    case 'crane':
      return { swing: 0.35 * Math.sin(TAU * k), hook: 0.04 * (1 - Math.cos(TAU * 2 * k)) };
    case 'boat':
      return { drift: 0.02 * Math.sin(TAU * k), bob: 0.012 * Math.sin(TAU * 3 * k), roll: 0.12 * Math.sin(TAU * 2 * k) };
    default:
      return {};
  }
}

// 一格動態的數量與強度，不含格子識別碼、位置、題材與市民的角色。議題區格子之間必須完全相同。
// 市民路線轉回過橋方向朝東再比對：每格過的橋方向不同，但路線的形狀與長度必須相同。
export function motionSignature(tile) {
  const r = (v) => Math.round(v * 1e4) + 0;
  // 路線轉六個方向（每 60 度），取字串最小的那個當代表：同形狀、只差轉向的路線得到同一個代表。
  // 不讀配置自己寫的過橋方向，什麼算相同由這裡決定。
  const turned = (k) => {
    const [c, s] = [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)];
    return JSON.stringify(tile.path.map(([x, z, y = 0]) => {
      const [dx, dz] = [x - tile.center.x, z - tile.center.z];
      return [r(dx * c - dz * s), r(dx * s + dz * c), r(y)];
    }));
  };
  const path = Array.from({ length: 6 }, (_, k) => turned(k)).sort()[0];
  return JSON.stringify({
    loops: tile.loops.map(({ x, z, mirror, periodSeconds, scale }) => ({ x, z, mirror, periodSeconds, scale })),
    citizens: tile.citizens.map(({ phase, speed, stepSeconds, scale, group }) => ({ phase, speed, stepSeconds, scale, group })),
    path,
  });
}
