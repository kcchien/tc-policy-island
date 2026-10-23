// 島嶼的動態配置：每格的循環動畫、市民、環線上的車輛與路網。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 動態數量固定（ADR 0001）：每個議題區格子的動態元素數量與強度相同，配置只讀格子的種類、順序與位置，
// 不讀標記亮暗與政見。上線關卡「動態數量固定」會換一份政見資料重算，結果必須相同。

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
// 市民走路的速度（場景單位／秒）與步伐週期（秒）。
export const CITIZEN_SPEED = 0.12;
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
// 放大後底座仍不進元素區（z ≤ 0.24，見 island-models.js 的 ELEMENT_AREA）、不碰標記與市民路線，測試會檢查。
export const LOOP_SPOTS = [{ x: -0.7, z: 0.34 }, { x: 0.7, z: 0.34 }];
// 市民走的路線：沿格子的六條邊，比格線往格內縮一點，避開路燈與標記。值是格心到邊的距離。
export const CITIZEN_APOTHEM = 0.845;

// 道具與市民的放大倍率：模型在 island-motion-view.js 以原尺寸組好，放上格子時乘這個倍率，讓全景第一眼就看得到動態。
// 倍率是動態強度的一部分，每格相同（motionSignature 會比對）。
// 市民沿格子南緣走過外側標記前方，再高就會在手機的預設視角擋住標記，所以只放大 1.2 倍。
export const LOOP_SCALE = 2;
export const CITIZEN_SCALE = 1.2;
// 放大後的外形（場景單位），測試用來確認不擋住標記、不進元素區、不碰市民。道具：半徑 LOOP_CORE 的柱子高到 LOOP_HEIGHT，
// 會動零件（風車葉、旗、吊臂）只在 LOOP_REACH_FROM 以上，掃過半徑 LOOP_REACH。
// 市民最高到 CITIZEN_HEIGHT（含離地 0.006 與走路起伏）、身寬半徑 CITIZEN_RADIUS。
// 原尺寸見 island-motion-view.js 的 LOOP_PROPS 與 CITIZEN，改形狀時要守住這些範圍。
export const LOOP_HEIGHT = 0.45 * LOOP_SCALE;
export const LOOP_CORE = 0.05 * LOOP_SCALE;
export const LOOP_REACH = 0.15 * LOOP_SCALE;
export const LOOP_REACH_FROM = 0.18 * LOOP_SCALE;
export const CITIZEN_HEIGHT = 0.006 + (0.16 + 0.006) * CITIZEN_SCALE;
export const CITIZEN_RADIUS = 0.025 * CITIZEN_SCALE;

// 環線（公車與火車）：繞島外緣一圈，在格子外側、貼著水面的堤上，不壓到標記與路燈。
// 值是環線中心離格線的距離；兩條車道各往內外偏 RING_LANE。
export const RING_OFFSET = 0.17;
export const RING_LANE = 0.045;

// 尖頂六角格的六個頂點（相對格心），從東南起逆時針（俯視時 +z 朝下，所以是順時針繞）。
function hexVertices(apothem) {
  const r = apothem / Math.cos(Math.PI / 6);
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

// 每格的動態。layout 是 islandLayout 的結果，只用 tiles 的 kind、id、position。
export function motionPlan(layout, { level = 'high' } = {}) {
  const counts = MOTION_LEVELS[level] ?? MOTION_LEVELS.high;
  let areaIndex = 0;
  const tiles = layout.tiles.map(({ id, kind, position }) => {
    if (kind !== 'area') return { id, kind, center: { x: position.x, z: position.z }, theme: null, loops: [], citizens: [], path: [], pathLength: 0 };
    const theme = MOTION_THEMES[areaIndex % MOTION_THEMES.length].id;
    areaIndex += 1;
    const path = hexVertices(CITIZEN_APOTHEM).map(([x, z]) => [position.x + x, position.z + z]);
    return {
      id,
      kind,
      center: { x: position.x, z: position.z },
      theme,
      loops: LOOP_SPOTS.map((spot, i) => ({ ...spot, mirror: i === 1, periodSeconds: LOOP_SECONDS, scale: LOOP_SCALE })),
      // 市民平均分散在路線上，同速同向。
      citizens: Array.from({ length: counts.citizensPerTile }, (_, i) => ({
        phase: i / counts.citizensPerTile,
        speed: CITIZEN_SPEED,
        stepSeconds: STEP_SECONDS,
        scale: CITIZEN_SCALE,
      })),
      path,
      pathLength: pathLength(path),
    };
  });
  const { roads, ring } = roadNetwork(layout);
  const vehicles = [
    ...Array.from({ length: counts.trains }, (_, i) => ({ kind: 'train', phase: i / counts.trains, speed: TRAIN_SPEED, direction: 1, lane: RING_LANE, cars: 3 })),
    ...Array.from({ length: counts.buses }, (_, i) => ({ kind: 'bus', phase: (i + 0.5) / counts.buses, speed: BUS_SPEED, direction: -1, lane: -RING_LANE, cars: 1 })),
  ];
  return { level, tiles, roads, ring, ringLength: pathLength(ring), vehicles };
}

const keyOf = ([x, z]) => `${Math.round(x * 1e4) + 0},${Math.round(z * 1e4) + 0}`;

// 路網與環線。每條格子邊一段路，shared 表示兩格共用（格子間的路）；
// 只屬於一格的邊是島的外緣，依格子頂點順序首尾相接成一圈，往外推 RING_OFFSET 就是環線。
function roadNetwork(layout) {
  const edges = new Map();
  for (const { position } of layout.tiles) {
    const vertices = hexVertices((layout.hexSize * Math.sqrt(3)) / 2).map(([x, z]) => [position.x + x, position.z + z]);
    vertices.forEach((from, i) => {
      const to = vertices[(i + 1) % 6];
      const key = [keyOf(from), keyOf(to)].sort().join('|');
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const length = Math.hypot(mid[0] - position.x, mid[1] - position.z);
      const outward = [(mid[0] - position.x) / length, (mid[1] - position.z) / length];
      if (edges.has(key)) edges.get(key).shared = true;
      else edges.set(key, { from, to, shared: false, outward });
    });
  }
  const roads = [...edges.values()];

  // 外緣的邊依起點索引，從任一條開始接成一圈；有多圈時取最長的一圈。
  const byStart = new Map(roads.filter((r) => !r.shared).map((r) => [keyOf(r.from), r]));
  const seen = new Set();
  let longest = [];
  for (const startKey of byStart.keys()) {
    const loop = [];
    for (let key = startKey; !seen.has(key) && byStart.has(key); key = keyOf(byStart.get(key).to)) {
      seen.add(key);
      loop.push(byStart.get(key));
    }
    if (loop.length > longest.length) longest = loop;
  }
  // 每個頂點沿前後兩條邊的外法線平均方向往外推，與兩條邊的距離都是 RING_OFFSET。
  const ring = longest.map((edge, i) => {
    const prev = longest[(i - 1 + longest.length) % longest.length].outward;
    const next = edge.outward;
    const k = RING_OFFSET / (1 + prev[0] * next[0] + prev[1] * next[1]);
    return [edge.from[0] + (prev[0] + next[0]) * k, edge.from[1] + (prev[1] + next[1]) * k];
  });
  return { roads, ring };
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
      return { x: x + (nx - x) * k - dz * lane, z: z + (nz - z) * k + dx * lane, heading: Math.atan2(dz, dx) };
    }
    rest -= length;
  }
}

const TAU = Math.PI * 2;
// 0~1 的循環進度。
const cycle = (t, period) => ((t / period) % 1 + 1) % 1;

// 市民的位置、朝向與腿的擺角（弧度，前後對稱）。
export function citizenPose(tile, citizen, t) {
  const s = citizen.phase * tile.pathLength + citizen.speed * t;
  const { x, z, heading } = pointAlong(tile.path, s, { total: tile.pathLength });
  const step = TAU * (cycle(t, citizen.stepSeconds) + citizen.phase);
  return { x, z, heading, legSwing: 0.45 * Math.sin(step), bob: 0.006 * Math.abs(Math.cos(step)) };
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

// 一格動態的數量與強度，不含格子識別碼、位置與題材。議題區格子之間必須完全相同。
export function motionSignature(tile) {
  return JSON.stringify({
    loops: tile.loops.map(({ x, z, mirror, periodSeconds, scale }) => ({ x, z, mirror, periodSeconds, scale })),
    citizens: tile.citizens.map(({ phase, speed, stepSeconds, scale }) => ({ phase, speed, stepSeconds, scale })),
    path: tile.path.map(([x, z]) => [Math.round((x - tile.center.x) * 1e4), Math.round((z - tile.center.z) * 1e4)]),
  });
}
