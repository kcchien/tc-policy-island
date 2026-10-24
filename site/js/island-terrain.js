// 島外圍的地形與環境：西側開闊的海與海岸浪花線、南北兩側的平原（田塊、河流、聚落）、東側由丘陵升高的山脈，
// 加上樹群、漂移的霧、雲與飛鳥。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 配置只讀格子位置（島的形狀），不讀政見資料（ADR 0001）；同一座島每次算出相同的結果。
// 高度不超過「離島距離 × 斜率」，不擋格子；背景樹數量依畫質。
// 色碼一律寫成 0xrrggbb，上線關卡「禁用色檢查」會掃這些色碼。地面用低飽和的沙色、橄欖灰與岩灰，不用綠與藍。

import { cameraLimits } from './island-layout.js';

// 各畫質的細節：地形網格每邊的分段數、背景樹、霧團、雲、聚落、飛鳥、海上小島與帆船的數量，遠山剪影每圈的分段數。
export const OUTSKIRTS_DETAIL = {
  high: { segments: 160, trees: 3200, fogBanks: 12, clouds: 12, villages: 16, birds: 9, islets: 4, boats: 4, ridgeSegments: 180 },
  medium: { segments: 112, trees: 1700, fogBanks: 8, clouds: 8, villages: 10, birds: 7, islets: 3, boats: 3, ridgeSegments: 120 },
  low: { segments: 72, trees: 700, fogBanks: 4, clouds: 5, villages: 6, birds: 5, islets: 2, boats: 2, ridgeSegments: 72 },
};

// 水面高度（island-environment.js 的水面讀這個值）。
export const SEA_LEVEL = 0.12;

// 東側丘陵的梯田台階高度。
export const TERRACE_STEP = 0.45;
// 遠山剪影的圈數。
export const RIDGE_RINGS = 3;

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
  // 闊葉樹（平原與低丘）與針葉樹（山坡）的樹冠，每棵取一色。
  canopy: [0x86884f, 0x7a7f4a, 0x6f6d4f, 0x938a58, 0xa59155, 0x9d9d58],
  conifer: [0x5a5d3c, 0x707345, 0x5d6345, 0x797a52],
  wall: 0xd8ccb8,
  roof: [0x7c5c4c, 0x6a625c],
  cloud: 0xe6e1d8,
  bird: 0x3f3a36,
  // 遠山剪影：白天與夜晚的山色，再依圈數往地平線色混（silhouetteColor）。
  farRidge: 0x968c79,
  farRidgeNight: 0x2a2d32,
  // 海上小島、燈塔、帆船。
  islet: 0x8c8073,
  lighthouse: 0xe0dbd1,
  lighthouseBand: 0x9c5344,
  hull: 0x6e5949,
  sail: 0xeae3d7,
};

// 遠山剪影第 ring 圈（0 最內圈）在某組光線下的顏色：山色依夜間係數變暗，越外圈越往地平線色混，像隔著一層霧。
// lighting 是 island-daylight.js 的關鍵影格或補間結果。
export function silhouetteColor(lighting, ring) {
  const shade = mixColor(TERRAIN_PALETTE.farRidge, TERRAIN_PALETTE.farRidgeNight, lighting.night);
  return mixColor(shade, lighting.skyHorizon, 0.45 + 0.18 * ring);
}

// 外圍物件的高度上限是「離最近格子邊緣的距離 × 斜率」：斜率小於鏡頭最低仰角的正切，
// 從任何允許的視角看，山、樹、霧、雲、鳥都在島的視線下方，不會擋住格子與標記。
// 緊鄰島邊的平地另有 FLOOR 的上限，低於格子頂面（0.44），平原可以直接接到島邊，不留水道。
const MARGIN = 0.6;
const SLOPE_SAFETY = 0.92;
const FLOOR = 0.3;
// 環線堤離格子邊緣約 0.17、寬 0.17；這個距離內的地面留在水面下。
const RING_CLEAR = 0.45;
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
  // 格子外緣 RING_CLEAR 內壓到水面下，留一圈窄水面給環線堤（island-motion-view.js，堤頂 0.18），
  // 再到 RING_CLEAR + 0.8 平順升到 FLOOR。
  const clearanceAt = (x, z) => {
    const d = distanceToIsland(x, z);
    const near = SEA_LEVEL - 0.04 + (FLOOR - SEA_LEVEL + 0.04) * smoothstep(RING_CLEAR, RING_CLEAR + 0.8, d);
    return Math.max(near, slopeLimit(x, z));
  };

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
  // 梯田：每 TERRACE_STEP 一階，階內往下壓成平的踏面與陡的階緣。只會降低高度，仍在高度上限下方。
  const terrace = (h) => {
    const q = Math.floor(h / TERRACE_STEP) * TERRACE_STEP;
    return q + TERRACE_STEP * ((h - q) / TERRACE_STEP) ** 4;
  };
  // 高度：原始地形壓在高度上限下方；東側丘陵（平原以上、樹線以下）再做梯田，上下兩端平順接回原坡。
  const heightAt = (x, z) => {
    const s = shape(x, z);
    const h = Math.min(s.h, clearanceAt(x, z));
    const w = smoothstep(0.08, 0.3, s.east) * smoothstep(PLAIN_TOP, PLAIN_TOP + 0.6, h) * (1 - smoothstep(TREE_LINE - 1, TREE_LINE, h));
    return w > 0 ? h + (terrace(h) - h) * w : h;
  };

  // 地面色：海岸線一圈淺色浪花、沙灘、平原的田塊、山坡依高度。田塊是斜放的長方格，每格依雜湊取一色。
  const FIELD_ANGLE = 0.35;
  const [fc, fs] = [Math.cos(FIELD_ANGLE), Math.sin(FIELD_ANGLE)];
  const colorAt = (x, z) => {
    const s = shape(x, z);
    const { fromCoast, east, wet } = s;
    const h = heightAt(x, z);
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

  // 背景樹：先撒群心，再在群心附近撒樹。種在沙灘以上、樹線以下、樹頂不超過高度上限的地方。
  // 兩種樹：闊葉（4 顆多面體）多在平原與低丘，針葉（3 層圓錐）多在山坡。
  const groveCenters = [];
  for (let attempt = 0; groveCenters.length < Math.ceil(detail.trees / 10) && attempt < 40000; attempt++) {
    const [x, z] = around(R * 0.6 + 2, extent * 0.8, 1.5);
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
    const kind = rand() < (y > 2 ? 0.85 : 0.2) ? 'conifer' : 'broadleaf';
    const colors = kind === 'conifer' ? TERRAIN_PALETTE.conifer : TERRAIN_PALETTE.canopy;
    trees.push({
      kind, x, y, z, height,
      // 樹幹露出樹冠下方的高度：針葉樹冠低垂，闊葉樹幹較長。
      trunk: height * (kind === 'conifer' ? 0.18 : 0.3),
      radius: height * (kind === 'conifer' ? 0.3 + rand() * 0.08 : 0.4 + rand() * 0.1),
      rotation: rand() * Math.PI * 2,
      color: colors[Math.floor(rand() * colors.length)],
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
      // 約四成的小屋正面有一扇亮燈的窗（夜裡點綴，依種子決定，不讀政見）。y 是窗心離地高度。
      house.window = rand() < 0.4 ? { y: house.height * 0.55 } : null;
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

  // 三圈遠山剪影：在地形網格外圍，從北繞過東邊到南，往西降到海面下（西側是海）。越外圈越高、越淡。
  // points 的角度從 +x（東）量起，高度依稜線雜訊起伏，壓在高度上限下方。
  const ridges = Array.from({ length: RIDGE_RINGS }, (_, i) => {
    const radius = extent * Math.SQRT2 + 10 + i * 16;
    const points = [];
    for (let k = 0; k <= detail.ridgeSegments; k++) {
      const angle = -Math.PI + (2 * Math.PI * k) / detail.ridgeSegments;
      const land = smoothstep(-0.75, 0.1, Math.cos(angle));
      const crest = (10 + i * 7) * (0.45 + 0.55 * ridged(Math.cos(angle) * 2.4 + i * 7.3, Math.sin(angle) * 2.4, seed + 31 + i));
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      points.push({ angle, height: Math.min(SEA_LEVEL - 0.5 + crest * land, clearanceAt(x, z)) });
    }
    return { radius, points };
  });

  // 海上：島西側的海裡幾座小島，一座立著燈塔；帆船沿著各自的圓圈航行，整圈都在海上。
  const seaClear = (x, z, r) => {
    if (x >= bounds.minX - r) return false;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      if (heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) >= SEA_LEVEL - 0.3) return false;
    }
    return heightAt(x, z) < SEA_LEVEL - 0.3;
  };
  const westward = (rMin, span) => {
    const a = Math.PI + (rand() - 0.5) * 1.6;
    const r = rMin + span * rand();
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
  };
  // 每座小島：top 是島頂高度；第一座放得下燈塔的立燈塔（lighthouse 為 true），其餘各種一棵闊葉樹（tree）。
  // 燈塔或樹的頂端都在高度上限下方；還沒有燈塔時，最後一個名額留給放得下燈塔的小島。
  const islets = [];
  let lighthouse = null;
  const LIGHTHOUSE_HEIGHT = 2.2;
  const ISLET_TREE = { height: 0.6, radius: 0.35 };
  for (let attempt = 0; islets.length < detail.islets && attempt < 5000; attempt++) {
    const [x, z] = westward(R * 0.5 + 6, extent * 0.8);
    const radius = 0.8 + rand() * 0.9;
    const height = 0.5 + rand() * 0.6;
    const top = SEA_LEVEL + height;
    if (!seaClear(x, z, radius + 0.6) || islets.some((o) => Math.hypot(o.x - x, o.z - z) < 7)) continue;
    const canLight = top + LIGHTHOUSE_HEIGHT <= clearanceAt(x, z);
    const hasLight = !lighthouse && canLight;
    if (!lighthouse && !canLight && islets.length === detail.islets - 1) continue;
    if (!hasLight && top + ISLET_TREE.height > clearanceAt(x, z)) continue;
    const islet = { x, z, radius, height, top, rotation: rand() * Math.PI * 2, lighthouse: hasLight, tree: null };
    if (hasLight) lighthouse = { x, z, y: top, height: LIGHTHOUSE_HEIGHT };
    else islet.tree = { ...ISLET_TREE, color: TERRAIN_PALETTE.canopy[Math.floor(rand() * TERRAIN_PALETTE.canopy.length)] };
    islets.push(islet);
  }
  // 帆船：top 是桅杆頂離海面的高度（帆高乘上船的大小，加上隨波起伏的振幅）。整圈每一點都要放得下桅杆。
  const SAIL_HEIGHT = 1.1;
  const boats = [];
  for (let attempt = 0; boats.length < detail.boats && attempt < 5000; attempt++) {
    const [x, z] = westward(R * 0.5 + 8, extent * 0.7);
    const radius = 3 + rand() * 3;
    const size = 0.8 + rand() * 0.25;
    const top = SAIL_HEIGHT * size + BOAT_BOB;
    if (!seaClear(x, z, radius + 0.6)) continue;
    let fits = true;
    for (let k = 0; k < 16 && fits; k++) {
      const a = (k / 16) * Math.PI * 2;
      fits = SEA_LEVEL + top <= clearanceAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
    }
    if (!fits || islets.some((o) => Math.hypot(o.x - x, o.z - z) < radius + o.radius + 1)) continue;
    boats.push({ x, z, radius, size, top, speed: (0.02 + rand() * 0.015) * (rand() < 0.5 ? 1 : -1), phase: rand() * Math.PI * 2 });
  }

  return {
    quality, detail, extent, center: { x: cx, z: cz }, heightAt, colorAt, clearanceAt,
    trees, houses, fogBanks, clouds, flock, birds, ridges, islets, lighthouse, boats, sailHeight: SAIL_HEIGHT,
  };
}

// 帆船隨波上下的振幅。
const BOAT_BOB = 0.03;

// 動畫時間 t（秒，見 island-clock.js）時雲、霧團、飛鳥、帆船的位置與水面波紋的時間。只依 t 決定，t 停住就全部靜止。
export function ambientAt(plan, t) {
  const boats = plan.boats.map((b, i) => {
    const a = b.phase + b.speed * t;
    return {
      x: b.x + Math.cos(a) * b.radius,
      z: b.z + Math.sin(a) * b.radius,
      // 繞 y 軸的轉角：船身（區域 z 軸）朝前進方向的圓周切線（speed 為負時反向）。隨波輕微上下與左右搖。
      heading: -a + (b.speed < 0 ? Math.PI : 0),
      bob: BOAT_BOB * Math.sin(t * 1.3 + i * 2.1),
      roll: 0.05 * Math.sin(t * 0.9 + i),
    };
  });
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
  // 水面波紋與閃光的時間（秒），island-environment.js 的水面著色器照用。
  return { clouds, fogBanks, birds, boats, waterTime: t };
}
