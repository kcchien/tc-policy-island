// 島外圍的地形與環境：西側海岸與海面、東側山稜、樹群、漂移的霧、雲與飛鳥。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 配置只讀格子位置（島的形狀），不讀政見資料（ADR 0001）；同一座島每次算出相同的結果。
// 色碼一律寫成 0xrrggbb，上線關卡「禁用色檢查」會掃這些色碼。地面用低飽和的沙色、橄欖灰與岩灰，不用綠與藍。

import { cameraLimits } from './island-layout.js';

// 各畫質的細節：地形網格每邊的分段數、樹、霧團、雲、飛鳥的數量。
export const OUTSKIRTS_DETAIL = {
  high: { segments: 160, trees: 480, fogBanks: 12, clouds: 9, birds: 9 },
  medium: { segments: 112, trees: 260, fogBanks: 8, clouds: 6, birds: 7 },
  low: { segments: 72, trees: 120, fogBanks: 4, clouds: 4, birds: 5 },
};

// 水面高度（island-environment.js 的水面）。
export const SEA_LEVEL = 0.12;

export const TERRAIN_PALETTE = {
  seabed: 0x6f7a76,
  sand: 0xcdb898,
  plain: 0x9c9670,
  meadow: 0x87835d,
  slope: 0x8a7f6c,
  rock: 0x7a7068,
  ridge: 0x9d958b,
  trunk: 0x5e5148,
  canopy: [0x8c8a62, 0x7a7a52, 0x6f6d4f, 0x8f845c],
  cloud: 0xe6e1d8,
  bird: 0x3f3a36,
};

// 外圍物件的高度上限是「離最近格子邊緣的距離 × 斜率」：斜率小於鏡頭最低仰角的正切，
// 從任何允許的視角看，山、樹、霧、雲、鳥都在島的視線下方，不會擋住格子與標記。
const MARGIN = 0.6;
const SLOPE_SAFETY = 0.92;

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

// 依高度上的頂點色：海床、沙灘、平原、草坡、山坡、岩、稜線，相鄰兩色依高度內插。
const BANDS = [
  [-0.4, TERRAIN_PALETTE.seabed],
  [SEA_LEVEL + 0.04, TERRAIN_PALETTE.sand],
  [SEA_LEVEL + 0.32, TERRAIN_PALETTE.plain],
  [0.9, TERRAIN_PALETTE.meadow],
  [1.8, TERRAIN_PALETTE.slope],
  [3.2, TERRAIN_PALETTE.rock],
  [6.5, TERRAIN_PALETTE.ridge],
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
// 水面半徑：蓋過方形地形網格的角落，海床不會露出來。
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

  // 離最近格子邊緣的距離（以格子外接圓近似）。
  const distanceToIsland = (x, z) => {
    let best = Infinity;
    for (const [tx, tz] of tiles) best = Math.min(best, Math.hypot(x - tx, z - tz));
    return best - hexSize;
  };
  const clearanceAt = (x, z) => slope * Math.max(0, distanceToIsland(x, z) - MARGIN);

  // 海岸線：南北向、帶一點彎曲，大約在島的西半部；以西是台灣海峽方向的海，島的西半部浮在海上。
  const westEdge = bounds.minX - cx;
  const eastEdge = bounds.maxX - cx;
  const coastAt = (v) => westEdge * 0.4 + 4 * (fbm(v * 0.08, 3.1, seed + 5) - 0.5) - Math.max(0, Math.abs(v) - R) * 0.2;

  const rawHeight = (x, z) => {
    const u = x - cx;
    const v = z - cz;
    const d = u - coastAt(v);
    // 海床往海岸升起，岸邊一條低平的沙灘，再往內陸才是平原。
    const shore = -1.5 + 1.75 * smoothstep(-3, 0.6, d);
    const inland = smoothstep(0.6, 4, d);
    // 平原的起伏。
    const plain = 0.4 + 0.5 * fbm(x * 0.09, z * 0.09, seed);
    // 海岸內側的低台地（大肚山方向）。
    const tableland = 1.4 * Math.exp(-(((d - 6) / 3) ** 2)) * fbm(x * 0.05, z * 0.05, seed + 3);
    // 東側山稜：往東越高，稜線以雜訊折出尖脊（中央山脈方向）。山腳往南北兩端斜向西伸，
    // 島占滿畫面寬度時（手機直式）也看得到島的東北與東南方的山。
    const foot = eastEdge - 5 - 0.9 * Math.max(0, Math.abs(v) - 4);
    const east = smoothstep(foot, foot + 24, u);
    const mountains = east * (3 + 15 * east) * (0.35 + 0.65 * ridged(x * 0.06, z * 0.035, seed + 9));
    return shore + inland * (plain + tableland + mountains);
  };
  // 高度：原始地形壓在斜面上限下方；島周圍因此留一圈水道。
  const heightAt = (x, z) => Math.min(rawHeight(x, z), clearanceAt(x, z) - 0.25);

  const rand = random(seed);
  const inside = (x, z, pad) => Math.abs(x - cx) < extent - pad && Math.abs(z - cz) < extent - pad;

  // 樹群：先撒群心，再在群心附近撒樹。只種在平原到山坡之間、樹頂不超過高度上限的地方。
  const groveCenters = [];
  while (groveCenters.length < Math.ceil(detail.trees / 10)) {
    const a = rand() * Math.PI * 2;
    const r = R * 0.6 + 2 + (extent * 0.55) * rand() ** 2;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h > SEA_LEVEL + 0.35 && h < 6) groveCenters.push([x, z]);
  }
  const trees = [];
  for (let attempt = 0; trees.length < detail.trees && attempt < detail.trees * 400; attempt++) {
    const [gx, gz] = groveCenters[attempt % groveCenters.length];
    const a = rand() * Math.PI * 2;
    const r = 2.6 * Math.sqrt(rand());
    const x = gx + Math.cos(a) * r;
    const z = gz + Math.sin(a) * r;
    if (!inside(x, z, 1)) continue;
    const y = heightAt(x, z);
    const height = 0.32 + rand() * 0.38;
    if (y < SEA_LEVEL + 0.3 || y > 6 || y + height > clearanceAt(x, z)) continue;
    trees.push({
      x, y, z, height,
      radius: height * (0.36 + rand() * 0.1),
      rotation: rand() * Math.PI * 2,
      color: TERRAIN_PALETTE.canopy[Math.floor(rand() * TERRAIN_PALETTE.canopy.length)],
    });
  }

  // 霧團：貼著地面的扁平霧，繞著自己的位置緩慢漂移。整團（含漂移範圍）都在高度上限下方。
  const fogBanks = [];
  for (let attempt = 0; fogBanks.length < detail.fogBanks && attempt < 5000; attempt++) {
    const a = rand() * Math.PI * 2;
    const r = R * 0.5 + 4 + extent * 0.5 * rand() ** 1.3;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const size = 2.5 + rand() * 4;
    const drift = 1.5 + rand() * 1.5;
    const ground = Math.max(SEA_LEVEL, heightAt(x, z));
    const y = ground + 0.4 + rand() * 0.6;
    // 漂移在 x、z 兩軸各有 drift 的振幅，離原位最遠 √2 · drift。
    const reach = size + drift * Math.SQRT2;
    if (!inside(x, z, reach)) continue;
    if (y > slope * Math.max(0, distanceToIsland(x, z) - reach - MARGIN)) continue;
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

  // 飛鳥：一群鳥繞著島北側水面上空的一點盤旋，整圈都在高度上限下方。
  const flock = (() => {
    const radius = 2.2;
    for (let d = 3; d < extent; d += 0.5) {
      for (const angle of [-Math.PI / 2, -Math.PI * 0.65, -Math.PI * 0.35, Math.PI]) {
        const x = cx + Math.cos(angle) * (R * 0.5 + d);
        const z = cz + Math.sin(angle) * (R * 0.5 + d);
        const lowest = slope * Math.max(0, distanceToIsland(x, z) - radius - 0.3 - MARGIN);
        if (lowest >= 1.4) return { x, z, radius, y: Math.min(lowest - 0.3, 3), speed: 0.35 };
      }
    }
    return null;
  })();
  const birds = flock ? Array.from({ length: detail.birds }, (_, i) => ({ lead: (i / detail.birds) * 0.9, lift: (rand() - 0.5) * 0.4, spread: (rand() - 0.5) * 0.6 })) : [];

  return { quality, detail, extent, segments: detail.segments, center: { x: cx, z: cz }, heightAt, clearanceAt, trees, fogBanks, clouds, flock, birds };
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
