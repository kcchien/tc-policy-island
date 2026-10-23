// 晝夜：四個時段的關鍵影格與切換補間。只做計算，不碰 three.js，瀏覽器與 Node 共用。
// 色碼一律寫成 0xrrggbb，上線關卡「禁用色檢查」會掃這些色碼（ADR 0001）；
// 天空與霧不用藍色，白天沿用本站的米色系，預設白天（ADR 0001 參考網站一條）。

import { easeInOut } from './island-layout.js';

export const TIMES_OF_DAY = [
  { id: 'dawn', name: '清晨' },
  { id: 'day', name: '白天' },
  { id: 'dusk', name: '黃昏' },
  { id: 'night', name: '夜晚' },
];
export const DEFAULT_TIME_OF_DAY = 'day';
export const TRANSITION_MS = 1400;

// 每個時段的光線。sunDirection 是從島中心指向太陽（夜晚是月亮）的方向，不必是單位向量；
// night 是夜間係數（0 白天、1 深夜），決定發光材質的亮度；exposure 是色調映射的曝光。
export const KEYFRAMES = {
  dawn: {
    skyTop: 0xb9b7c2, skyHorizon: 0xe2cdb6, fog: 0xd9cbbb, fogNear: 55, fogFar: 145,
    sunColor: 0xeedcc8, sunIntensity: 1.4, sunDirection: [14, 7, 6],
    hemiSky: 0xd8cfc8, hemiGround: 0x7a5040, hemiIntensity: 1.4,
    water: 0x9aa6a4, night: 0.25, exposure: 1,
  },
  day: {
    skyTop: 0xc3cbca, skyHorizon: 0xeee6d8, fog: 0xe8e0d2, fogNear: 60, fogFar: 140,
    sunColor: 0xf2e6d4, sunIntensity: 2.2, sunDirection: [-10, 22, 12],
    hemiSky: 0xf4efe6, hemiGround: 0x8e4b32, hemiIntensity: 1.6,
    water: 0x7d9a98, night: 0, exposure: 1,
  },
  dusk: {
    skyTop: 0xa9a0a8, skyHorizon: 0xdcb9a0, fog: 0xcdb4a2, fogNear: 55, fogFar: 140,
    sunColor: 0xe6cdb8, sunIntensity: 1.7, sunDirection: [-16, 9, 5],
    hemiSky: 0xd6c9c0, hemiGround: 0x86705e, hemiIntensity: 1.6,
    water: 0x8fa8a2, night: 0.55, exposure: 1.2,
  },
  night: {
    skyTop: 0x1d1f27, skyHorizon: 0x3b3c46, fog: 0x34353e, fogNear: 45, fogFar: 125,
    sunColor: 0xb4b8c4, sunIntensity: 0.9, sunDirection: [-6, 18, -8],
    hemiSky: 0x70737e, hemiGround: 0x3a302a, hemiIntensity: 1,
    water: 0x46524f, night: 1, exposure: 1.2,
  },
};

// 關鍵影格裡是色碼的欄位，補間時逐色版內插。
export const COLOR_KEYS = new Set(['skyTop', 'skyHorizon', 'fog', 'sunColor', 'hemiSky', 'hemiGround', 'water']);

const lerp = (a, b, k) => a + (b - a) * k;

function lerpColor(a, b, k) {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    out |= Math.round(lerp((a >> shift) & 0xff, (b >> shift) & 0xff, k)) << shift;
  }
  return out;
}

// 兩組光線之間 k（0~1）處的光線。
export function blendLighting(a, b, k) {
  return Object.fromEntries(Object.keys(a).map((key) => {
    if (COLOR_KEYS.has(key)) return [key, lerpColor(a[key], b[key], k)];
    if (Array.isArray(a[key])) return [key, a[key].map((v, i) => lerp(v, b[key][i], k))];
    return [key, lerp(a[key], b[key], k)];
  }));
}

// 發光材質（不受色調映射）的顏色倍率：白天暗淡像沒開的燈，夜晚超過 1 看起來自己發光。不用 bloom。
export const glowLevel = (night) => 0.28 + night * 1.5;

// 目前時段與切換補間。now 是毫秒（performance.now()）。
export function createDaylight({ initial = DEFAULT_TIME_OF_DAY } = {}) {
  let current = initial;
  let from = KEYFRAMES[initial];
  let start = -Infinity;

  const at = (now) => {
    const t = Math.min(1, Math.max(0, (now - start) / TRANSITION_MS));
    if (t >= 1) return { lighting: KEYFRAMES[current], settled: true };
    return { lighting: blendLighting(from, KEYFRAMES[current], easeInOut(t)), settled: false };
  };

  return {
    get current() {
      return current;
    },
    // 切換到 id 時段，從目前的光線（可能正在補間）接著補。instant 為 true 時直接切過去（減少動態）。
    set(id, now, { instant = false } = {}) {
      if (!KEYFRAMES[id]) return false;
      from = at(now).lighting;
      current = id;
      start = instant ? -Infinity : now;
      return true;
    },
    at,
  };
}
