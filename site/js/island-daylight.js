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

// 每個時段的光線，欄位結構與光照強度參考黏土微縮城市的日夜表；天空與水不用藍，改灰青與暖灰。
// sunDirection 是從島中心指向太陽（夜晚是月亮）的方向，不必是單位向量；sunGlow 是天空的太陽光暈與水面閃光的顏色；
// fill 是不投影的補光；waterShallow 與 waterDeep 是近島與遠處的水色；霧色永遠等於地平線色，遠景融進天空。
// night 是夜間係數（0 白天、1 深夜），決定發光材質的亮度與星星；exposure 是色調映射的曝光。
export const KEYFRAMES = {
  dawn: {
    skyTop: 0x9eb3b2, skyHorizon: 0xe6d0bc, fog: 0xe6d0bc, fogNear: 50, fogFar: 145,
    sunColor: 0xebd3c2, sunIntensity: 1.8, sunDirection: [14, 7, 6], sunGlow: 0xeddbc9,
    hemiSky: 0xe7d3c6, hemiGround: 0x6b5a5a, hemiIntensity: 1.2,
    fillColor: 0xc4d4d2, fillIntensity: 0.3,
    waterShallow: 0xa1bab8, waterDeep: 0x6c9391, landTint: 0xd2beac, landTintStrength: 0.25, night: 0.3, exposure: 1,
  },
  day: {
    skyTop: 0xb8cccb, skyHorizon: 0xf4eee3, fog: 0xf4eee3, fogNear: 55, fogFar: 150,
    sunColor: 0xf6efe4, sunIntensity: 2.9, sunDirection: [-10, 22, 12], sunGlow: 0xf5eee0,
    hemiSky: 0xf0f4f3, hemiGround: 0x8f8270, hemiIntensity: 1.35,
    fillColor: 0xc4d4d2, fillIntensity: 0.35,
    waterShallow: 0xabc4c2, waterDeep: 0x769e9c, landTint: 0xd2beac, landTintStrength: 0, night: 0, exposure: 1,
  },
  dusk: {
    skyTop: 0x768293, skyHorizon: 0xe0bca3, fog: 0xe0bca3, fogNear: 50, fogFar: 145,
    sunColor: 0xdbae94, sunIntensity: 1.8, sunDirection: [-16, 9, 5], sunGlow: 0xe6cab3,
    hemiSky: 0xe3ccbf, hemiGround: 0x7d6660, hemiIntensity: 1.2,
    fillColor: 0x8f9ca3, fillIntensity: 0.3,
    waterShallow: 0x92aaa7, waterDeep: 0x65817f, landTint: 0xcfa281, landTintStrength: 0.5, night: 0.4, exposure: 1,
  },
  night: {
    skyTop: 0x1d2026, skyHorizon: 0x3d434d, fog: 0x3d434d, fogNear: 40, fogFar: 130,
    sunColor: 0xc6cad2, sunIntensity: 1.15, sunDirection: [-6, 18, -8], sunGlow: 0x818898,
    hemiSky: 0x9aa0ae, hemiGround: 0x605a63, hemiIntensity: 1.85,
    fillColor: 0x8f9ca3, fillIntensity: 0.25,
    waterShallow: 0x455454, waterDeep: 0x2d3939, landTint: 0x5c6370, landTintStrength: 0.85, night: 1, exposure: 1,
  },
};

// 關鍵影格裡是色碼的欄位，補間時逐色版內插。
export const COLOR_KEYS = new Set([
  'skyTop', 'skyHorizon', 'fog', 'sunColor', 'sunGlow', 'hemiSky', 'hemiGround', 'fillColor', 'waterShallow', 'waterDeep', 'landTint',
]);

// 外圍陸地（地形、背景樹、聚落、海上小島與船、雲）的色調倍率 [r, g, b]（sRGB，0~1）。
// 外圍材質用固定的頂點色與材質色，夜晚半球光又強，不另外壓暗會跟白天一樣亮；
// 所以依時段把材質色乘上 landTint，強度 landTintStrength（白天 0 不改色，黃昏偏暖，夜晚最暗偏冷）。
export function landShade(lighting) {
  const k = lighting.landTintStrength;
  return [16, 8, 0].map((shift) => 1 + ((((lighting.landTint >> shift) & 0xff) / 255) - 1) * k);
}

// 著色器的混色比例（island-environment.js 照用，禁用色測試也照這些比例檢查）：
// 天空往太陽光暈色最多混到 SKY_HALO；星星往 STAR_COLOR 混，夜間係數 1 時混滿；水面閃光往太陽光暈色最多混到 WATER_SPARKLE。
export const SKY_HALO = 0.35;
export const STAR_COLOR = 0xf2edd9;
export const WATER_SPARKLE = 0.6;
// 夜裡海面映著的星光：往 STAR_COLOR 最多混到 WATER_STARS（乘上夜間係數）。鏡頭的俯角看不到地平線以上的天空，
// 星星主要靠海面倒影呈現。
export const WATER_STARS = 0.8;

// 自動時段：依台灣時間（UTC+8，沒有日光節約時間）選時段，不看瀏覽者的時區。
// 每段的開始時刻（當天第幾分鐘），19:00 以後到隔天 05:00 是夜晚。
const TAIPEI_OFFSET_MINUTES = 8 * 60;
const AUTO_STARTS = [[5 * 60, 'dawn'], [8 * 60, 'day'], [16 * 60, 'dusk'], [19 * 60, 'night']];

// now 是毫秒時間戳或 Date，回傳時段的 id。
export function timeOfDayAt(now) {
  const minutes = Math.floor(Number(now) / 60000) + TAIPEI_OFFSET_MINUTES;
  const ofDay = ((minutes % 1440) + 1440) % 1440;
  let id = 'night';
  for (const [start, name] of AUTO_STARTS) if (ofDay >= start) id = name;
  return id;
}

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
  // 不認得的初始時段（例如沒有給）用預設時段。
  let current = KEYFRAMES[initial] ? initial : DEFAULT_TIME_OF_DAY;
  let from = KEYFRAMES[current];
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
