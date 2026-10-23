// 島外圍的地形與環境：西側開闊的海與海岸浪花線、南北兩側的平原（田塊、河流、聚落）、東側由丘陵升高的山脈，
// 加上樹群、漂移的霧、雲與飛鳥。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 配置只讀格子位置（島的形狀），不讀政見資料（ADR 0001）；同一座島每次算出相同的結果。
// 色碼一律寫成 0xrrggbb，上線關卡「禁用色檢查」會掃這些色碼。地面用低飽和的沙色、橄欖灰與岩灰，不用綠與藍。

import { cameraLimits } from './island-layout.js';

// 各畫質的細節：地形網格每邊的分段數、樹、霧團、雲、聚落、飛鳥的數量。
export const OUTSKIRTS_DETAIL = {
  high: { segments: 160, trees: 480, fogBanks: 12, clouds: 9, villages: 16, birds: 9 },
  medium: { segments: 112, trees: 260, fogBanks: 8, clouds: 6, villages: 10, birds: 7 },
  low: { segments: 72, trees: 120, fogBanks: 4, clouds: 4, villages: 6, birds: 5 },
};

// 水面高度（island-environment.js 的水面讀這個值）。
export const SEA_LEVEL = 0.12;

export const TERRAIN_PALETTE = {
  seabed: 0x6f7a76,
  foam: 0xe2dbcd,
  sand: 0xcdb898,
  // 平原的田塊，每塊取一色。
  fields: [0x9c9670, 0xc4b07a, 0xa8957a, 0x9a9a5c, 0xb5ad86],
  meadow: 0x87835d,
  slope: 0x8a7f6c,
  rock: 0x7a7068,
  ridge: 0x9d958b,
  trunk: 0x5e5148,
  canopy: [0x86884f, 0x7a7f4a, 0x6f6d4f, 0x938a58],
  wall: 0xd8ccb8,
  roof: [0x7c5c4c, 0x6a625c],
  cloud: 0xe6e1d8,
  bird: 0x3f3a36,
};

// 外圍物件的高度上限是「離最近格子邊緣的距離 × 斜率」：斜率小於鏡頭最低仰角的正切，
// 從任何允許的視角看，山、樹、霧、雲、鳥都在島的視線下方，不會擋住格子與標記。
// 緊鄰島邊的平地另有 FLOOR 的上限，低於格子頂面（0.44），平原可以直接接到島邊，不留水道。
const MARGIN = 0.6;
const SLOPE_SAFETY = 0.92;
const FLOOR = 0.3;
// 平原的高度範圍：田塊、聚落與平地的樹群都在這之間。
const PLAIN_TOP = 1;
// 樹只種到這個高度（再上去是岩與稜線）。
const TREE_LINE = 7;

// 以種子產生的偽亂數（mulberry32），同一座島每次配置相同。
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 值雜訊（value noise）：整數格點上的雜湊值，格點之間平滑內插，回傳 0~1。
function hash(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
// 多層疊加（fbm），回傳 0~1。
function fbm(x, z, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x, z, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    z *= 2.03;
  }
  return sum / norm;
}
// 稜線雜訊：把雜訊折成尖脊，回傳 0~1。
const ridged = (x, z, seed) => {
  const n = 1 - Math.abs(2 * fbm(x, z, seed) - 1);
  return n * n;
};
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (a, b, t) => smooth(clamp01((t - a) / (b - a)));

// 山坡依高度上的顏色：草坡、山坡、岩、稜線，相鄰兩色依高度內插。平原以下的顏色由 planOutskirts 的 colorAt 決定。
const BANDS = [
  [-0.4, TERRAIN_PALETTE.seabed],
  [SEA_LEVEL + 0.04, TERRAIN_PALETTE.sand],
  [SEA_LEVEL + 0.32, TERRAIN_PALETTE.fields[0]],
  [PLAIN_TOP, TERRAIN_PALETTE.meadow],
  [2.2, TERRAIN_PALETTE.slope],
  [4.5, TERRAIN_PALETTE.rock],
  [9, TERRAIN_PALETTE.ridge],
];
function mixColor(a, b, k) {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    out |= Math.round(ca + (cb - ca) * k) << shift;
  }
  return out;
}
export function terrainColor(height) {
  if (height <= BANDS[0][0]) return BANDS[0][1];
  for (let i = 1; i < BANDS.length; i++) {
    const [h1, c1] = BANDS[i];
    if (height <= h1) {
      const [h0, c0] = BANDS[i - 1];
      return mixColor(c0, c1, smoothstep(h0, h1, height));
    }
  }
  return BANDS[BANDS.length - 1][1];
}

// 地形網格的半邊長：手機直式的全景看得比較遠，至少 60。bounds 是 islandLayout 的範圍。
const outskirtsExtent = (bounds) => Math.max(60, bounds.radius * 7);
// 水面半徑：蓋過方形地形網格的角落，海床不會露出來，西側的海一直延伸到霧裡。
export const outskirtsWaterRadius = (bounds) => outskirtsExtent(bounds) * Math.SQRT2 + 4;

// layout 是 islandLayout 的結果，只用格子位置、格徑與範圍。quality 是 'high'、'medium'、'low'。
export function planOutskirts(layout, { quality = 'high', seed = 2026 } = {}) {
  const detail = OUTSKIRTS_DETAIL[quality] ?? OUTSKIRTS_DETAIL.medium;
  const { bounds, hexSize } = layout;
  const tiles = layout.tiles.map((t) => [t.position.x, t.position.z]);
  const cx = bounds.center.x;
  const cz = bounds.center.z;
  const R = bounds.radius;
  const extent = outskirtsExtent(bounds);
  const slope = SLOPE_SAFETY / Math.tan(cameraLimits(bounds, 0).maxPolarAngle);
  const rand = random(seed);

  // 離最近格子邊緣的距離（以格子外接圓近似）。
  const distanceToIsland = (x, z) => {
    let best = Infinity;
    for (const [tx, tz] of tiles) best = Math.min(best, Math.hypot(x - tx, z - tz));
    return best - hexSize;
  };
  const slopeLimit = (x, z, pad = 0) => slope * Math.max(0, distanceToIsland(x, z) - pad - MARGIN);
  const clearanceAt = (x, z) => Math.max(FLOOR, slopeLimit(x, z));

  // 海岸線：南北向、略往東北偏，大約通過島的西側三分之一；以西是台灣海峽方向的海，島的西端浮在海上。
  const westEdge = bounds.minX - cx;
  const eastEdge = bounds.maxX - cx;
  const halfDepth = (bounds.maxZ - bounds.minZ) / 2;
  const coastAt = (v) => westEdge * 0.4 + 4 * (fbm(v * 0.06, 3.1, seed + 5) - 0.5) - 0.12 * v;

  // 東側山脈：山腳在島東緣附近，往東升高；幾座主峰讓遠處的稜線剪影有高低。
  const peaks = Array.from({ length: 5 }, (_, i) => ({
    u: eastEdge + 26 + rand() * 22,
    v: (i - 2) * 14 + (rand() - 0.5) * 8,
    r: 6 + rand() * 5,
  }));
  const eastnessAt = (u, v) => {
    const foot = eastEdge - 1 - 0.3 * Math.max(0, Math.abs(v) - halfDepth - 3);
    return smoothstep(foot, foot + 28, u);
  };

  // 兩條河從東側山裡往西流進海，一條在島北、一條在島南（大甲溪與大肚溪的方向），越往下游越寬。
  // 兩條河離島的距離不同，不對稱地夾住島。
  const rivers = [[-1, 5], [1, 12]].map(([side, gap], i) => ({ side, base: side * (halfDepth + gap + rand() * 2), phase: rand() * 10 + i }));
  const riverAt = (u, v, coast) => {
    let wet = 0;
    for (const river of rivers) {
      const center = river.base + 2.2 * Math.sin(u * 0.09 + river.phase) + 1.2 * Math.sin(u * 0.23 + river.phase * 2);
      const width = 0.2 + 0.35 * (1 - smoothstep(coast, coast + 45, u));
      wet = Math.max(wet, 1 - smoothstep(width, width + 0.5, Math.abs(v - center)));
    }
    return wet;
  };

  const shape = (x, z) => {
    const u = x - cx;
    const v = z - cz;
    const coast = coastAt(v);
    const d = u - coast;
    // 海床往海岸升起，岸邊一條低平的沙灘，再往內陸才是平原。
    const shore = -1.6 + 1.82 * smoothstep(-4, 0.8, d);
    const inland = smoothstep(0.8, 5, d);
    const plain = 0.08 + 0.3 * fbm(x * 0.08, z * 0.08, seed);
    const east = eastnessAt(u, v);
    // 山的高度向高度上限看齊：離島越遠允許越高，稜線與主峰在上限的四成到滿格之間起伏。
    let peak = 0;
    for (const p of peaks) peak = Math.max(peak, Math.exp(-(((u - p.u) ** 2 + (v - p.v) ** 2) / (p.r * p.r))));
    const relief = 0.4 + 0.35 * ridged(x * 0.05, z * 0.028, seed + 9) + 0.3 * peak;
    const mountains = east ** 0.9 * slopeLimit(x, z) * relief;
    // 網格最外圈往下收進海裡，從遠處看不到地形邊緣的斷崖。
    const rim = 1 - smoothstep(extent - 12, extent - 1, Math.max(Math.abs(u), Math.abs(v)));
    let h = -1.6 + (shore + 1.6 + inland * (plain + mountains)) * rim;
    // 河道：下切到水面下，水面就從河道露出來。
    const wet = riverAt(u, v, coast) * smoothstep(-1, 2, d);
    h += (SEA_LEVEL - 0.2 - h) * wet;
    // fromCoast 是往內陸離海岸線的距離（海上為負）。
    return { h, fromCoast: d, east, wet };
  };
  // 高度：原始地形壓在高度上限下方。
  const heightAt = (x, z) => Math.min(shape(x, z).h, clearanceAt(x, z));

  // 地面色：海岸線一圈淺色浪花、沙灘、平原的田塊、山坡依高度。田塊是斜放的長方格，每格依雜湊取一色。
  const FIELD_ANGLE = 0.35;
  const [fc, fs] = [Math.cos(FIELD_ANGLE), Math.sin(FIELD_ANGLE)];
  const colorAt = (x, z) => {
    const s = shape(x, z);
    const { fromCoast, east, wet } = s;
    const h = Math.min(s.h, clearanceAt(x, z));
    if (h < SEA_LEVEL - 0.2) return TERRAIN_PALETTE.seabed;
    if (h < SEA_LEVEL + 0.06 && fromCoast < 3 && wet < 0.5) return TERRAIN_PALETTE.foam;
    if (h < SEA_LEVEL + 0.2 || wet > 0.3) return TERRAIN_PALETTE.sand;
    // 東側山腳以東是丘陵，不畫田塊，用草坡到岩的高度色。
    if (east > 0.08) return terrainColor(Math.max(h, PLAIN_TOP * 0.8));
    if (h < PLAIN_TOP) {
      const a = x * fc - z * fs;
      const b = x * fs + z * fc;
      const pick = hash(Math.floor(a / 2.6), Math.floor(b / 1.8), seed + 11);
      return TERRAIN_PALETTE.fields[Math.floor(pick * TERRAIN_PALETTE.fields.length)];
    }
    return terrainColor(h);
  };

  const inside = (x, z, pad) => Math.abs(x - cx) < extent - pad && Math.abs(z - cz) < extent - pad;
  // 繞島中心在 [rMin, rMin + span] 之間取一點，power 越大越集中在內圈。
  const around = (rMin, span, power = 1) => {
    const a = rand() * Math.PI * 2;
    const r = rMin + span * rand() ** power;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  };
  const onLand = (x, z) => {
    const s = shape(x, z);
    return s.wet < 0.1 && s.fromCoast > 1.5;
  };

  // 樹群：先撒群心，再在群心附近撒樹。種在沙灘以上、樹線以下、樹頂不超過高度上限的地方。
  const groveCenters = [];
  for (let attempt = 0; groveCenters.length < Math.ceil(detail.trees / 10) && attempt < 20000; attempt++) {
    const [x, z] = around(R * 0.6 + 2, extent * 0.55, 2);
    const h = heightAt(x, z);
    if (h > SEA_LEVEL + 0.35 && h < TREE_LINE && onLand(x, z)) groveCenters.push([x, z]);
  }
  const trees = [];
  for (let attempt = 0; groveCenters.length && trees.length < detail.trees && attempt < detail.trees * 400; attempt++) {
    const [gx, gz] = groveCenters[attempt % groveCenters.length];
    const a = rand() * Math.PI * 2;
    const r = 2.6 * Math.sqrt(rand());
    const x = gx + Math.cos(a) * r;
    const z = gz + Math.sin(a) * r;
    if (!inside(x, z, 1) || !onLand(x, z)) continue;
    const y = heightAt(x, z);
    const height = 0.32 + rand() * 0.38;
    if (y < SEA_LEVEL + 0.2 || y > TREE_LINE || y + height > clearanceAt(x, z)) continue;
    trees.push({
      x, y, z, height,
      radius: height * (0.36 + rand() * 0.1),
      rotation: rand() * Math.PI * 2,
      color: TERRAIN_PALETTE.canopy[Math.floor(rand() * TERRAIN_PALETTE.canopy.length)],
    });
  }

  // 聚落：平原上幾戶小屋聚在一起，屋頂不超過高度上限。
  const houses = [];
  let villages = 0;
  for (let attempt = 0; villages < detail.villages && attempt < 20000; attempt++) {
    const [vx, vz] = around(R * 0.5 + 3, extent * 0.5, 1.6);
    const h = heightAt(vx, vz);
    if (h < SEA_LEVEL + 0.15 || h > PLAIN_TOP || !onLand(vx, vz) || shape(vx, vz).east > 0.3) continue;
    const count = 4 + Math.floor(rand() * 5);
    const placed = [];
    for (let k = 0; k < count * 6 && placed.length < count; k++) {
      const a = rand() * Math.PI * 2;
      const r = 1.3 * Math.sqrt(rand());
      const x = vx + Math.cos(a) * r;
      const z = vz + Math.sin(a) * r;
      const y = heightAt(x, z);
      const house = { x, y, z, width: 0.2 + rand() * 0.12, depth: 0.15 + rand() * 0.08, height: 0.12 + rand() * 0.06, roof: 0.08, rotation: FIELD_ANGLE + (rand() < 0.5 ? 0 : Math.PI / 2), roofColor: TERRAIN_PALETTE.roof[Math.floor(rand() * TERRAIN_PALETTE.roof.length)] };
      if (y < SEA_LEVEL + 0.15 || !onLand(x, z) || y + house.height + house.roof > clearanceAt(x, z)) continue;
      if (placed.some((o) => Math.hypot(o.x - x, o.z - z) < 0.36)) continue;
      placed.push(house);
    }
    if (placed.length < 3) continue;
    houses.push(...placed);
    villages += 1;
  }

  // 霧團：貼著地面的扁平霧，繞著自己的位置緩慢漂移。整團（含漂移範圍）都在高度上限下方。
  const fogBanks = [];
  for (let attempt = 0; fogBanks.length < detail.fogBanks && attempt < 5000; attempt++) {
    const [x, z] = around(R * 0.5 + 4, extent * 0.5, 1.3);
    const size = 2.5 + rand() * 4;
    const drift = 1.5 + rand() * 1.5;
    const ground = Math.max(SEA_LEVEL, heightAt(x, z));
    const y = ground + 0.4 + rand() * 0.6;
    // 漂移在 x、z 兩軸各有 drift 的振幅，離原位最遠 √2 · drift。
    const reach = size + drift * Math.SQRT2;
    if (!inside(x, z, reach)) continue;
    if (y > slopeLimit(x, z, reach)) continue;
    fogBanks.push({ x, y, z, size, drift, speed: 0.04 + rand() * 0.04, phase: rand() * Math.PI * 2, opacity: 0.5 + rand() * 0.2 });
  }

  // 雲：在島外圈的高空繞著島慢慢飄，高度在高度上限下方。
  const clouds = [];
  for (let attempt = 0; clouds.length < detail.clouds && attempt < 5000; attempt++) {
    const orbit = R + 26 + rand() * (extent - R - 34);
    const size = 1.6 + rand() * 1.6;
    const y = Math.min(7 + rand() * 4, slope * (orbit - R - size - MARGIN));
    if (y < 4) continue;
    clouds.push({ orbit, y, size, angle: rand() * Math.PI * 2, speed: 0.006 + rand() * 0.006, puffs: 3 + Math.floor(rand() * 3), seed: Math.floor(rand() * 1e6) });
  }

  // 飛鳥：一群鳥繞著島北側上空的一點盤旋，整圈都在高度上限下方。
  const flock = (() => {
    const radius = 2.2;
    for (let d = 3; d < extent; d += 0.5) {
      for (const angle of [-Math.PI / 2, -Math.PI * 0.65, -Math.PI * 0.35, Math.PI]) {
        const x = cx + Math.cos(angle) * (R * 0.5 + d);
        const z = cz + Math.sin(angle) * (R * 0.5 + d);
        const lowest = slopeLimit(x, z, radius + 0.3);
        // 每隻鳥的高低差（lift ±0.2）加上上下擺動（±0.15），最高比群高 0.35。
        if (lowest >= 1.4) return { x, z, radius, y: Math.min(lowest - 0.4, 3), speed: 0.35 };
      }
    }
    return null;
  })();
  const birds = flock ? Array.from({ length: detail.birds }, (_, i) => ({ lead: (i / detail.birds) * 0.9, lift: (rand() - 0.5) * 0.4, spread: (rand() - 0.5) * 0.6 })) : [];

  return { quality, detail, extent, center: { x: cx, z: cz }, heightAt, colorAt, clearanceAt, trees, houses, fogBanks, clouds, flock, birds };
}

// 動畫時間 t（秒，見 island-clock.js）時雲、霧團、飛鳥的位置。只依 t 決定，t 停住就全部靜止。
export function ambientAt(plan, t) {
  const { center } = plan;
  const clouds = plan.clouds.map((c) => {
    const a = c.angle + c.speed * t;
    return { x: center.x + Math.cos(a) * c.orbit, y: c.y, z: center.z + Math.sin(a) * c.orbit, heading: -a };
  });
  const fogBanks = plan.fogBanks.map((f) => {
    const a = f.phase + f.speed * t;
    return { x: f.x + Math.cos(a) * f.drift, y: f.y, z: f.z + Math.sin(a * 0.7) * f.drift, opacity: f.opacity };
  });
  const birds = plan.flock
    ? plan.birds.map((b, i) => {
      const { x, z, radius, y, speed } = plan.flock;
      const a = speed * t - b.lead;
      const r = radius + b.spread;
      return {
        x: x + Math.cos(a) * r,
        y: y + b.lift + 0.15 * Math.sin(t * 0.8 + i),
        z: z + Math.sin(a) * r,
        // 繞 y 軸的轉角：身體（區域 x 軸）朝圓周切線方向。
        heading: -a - Math.PI / 2,
        // 拍翅角度（弧度）。
        flap: 0.5 * Math.sin(t * 9 + i * 1.7),
      };
    })
    : [];
  return { clouds, fogBanks, birds };
}
