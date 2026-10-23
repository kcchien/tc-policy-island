// 島嶼檢視的鏡頭：飛行、拖曳判斷、卡片造成的畫面偏移、預設視角（直式畫面另轉方位角）。
// 只做計算，不碰 three.js 與 DOM，瀏覽器與 Node 共用。

import { easeInOut, frameIsland } from './island-layout.js';

// 飛到議題區的時間（毫秒）。
export const FLIGHT_MS = 1150;
// 按下後移動超過這個像素數算拖曳（旋轉、縮放），在範圍內算點選。
export const DRAG_SLOP = 6;
// 畫面偏移跟上卡片的速度：每幀走 1 - e^(-dt·rate) 的距離。
const OFFSET_RATE = 6;
// 卡片蓋住大半畫面（手機抽屜拉到全螢幕）時，偏移後仍保留的可見高度與寬度比例，免得投影退化。
const MIN_VISIBLE = 0.2;
// 預設視角的俯角（與正上方的夾角）。直式畫面較低、並在 PORTRAIT_AZIMUTHS 裡挑讓島最大的方位角，
// 讓島的對角線沿著直式螢幕擺；橫式維持正南方。
const POLAR_LANDSCAPE = 0.68;
const POLAR_PORTRAIT = 0.9;
// 最多轉約 57 度，東西向長條的島沿直式螢幕的對角線擺（390 × 640 的對角線約 58 度）。
const PORTRAIT_AZIMUTHS = Array.from({ length: 41 }, (_, i) => (i - 20) / 20);
// 長寬比小於這個值算直式。
const PORTRAIT_BELOW = 0.85;

const lerp = (a, b, k) => a + (b - a) * k;
const lerpPoint = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });

// 鏡頭飛行。step(now) 依開始後實際經過的時間回傳這一幀的 { target, position }，不依畫了幾幀，
// 慢裝置也準時抵達；抵達或 cancel 時呼叫一次 onArrive。沒在飛時 step 回傳 null。
export function createCameraFlight() {
  let flight = null;
  const finish = () => {
    const { onArrive } = flight;
    flight = null;
    onArrive();
  };
  return {
    get active() {
      return flight !== null;
    },
    start({ from, to, now, durationMs = FLIGHT_MS, onArrive = () => {} }) {
      flight = { from, to, start: now, durationMs, onArrive };
    },
    step(now) {
      if (!flight) return null;
      const t = flight.durationMs > 0 ? Math.min(1, Math.max(0, (now - flight.start) / flight.durationMs)) : 1;
      const k = easeInOut(t);
      const pose = { target: lerpPoint(flight.from.target, flight.to.target, k), position: lerpPoint(flight.from.position, flight.to.position, k) };
      if (t >= 1) {
        const { to } = flight;
        finish();
        return to;
      }
      return pose;
    },
    // 使用者拖曳時取消：鏡頭停在原處，抵達後的動作（例如開卡片）照樣執行。
    cancel() {
      if (flight) finish();
    },
  };
}

// 飛行時間：減少動態時為 0，第一幀就落在目的地。
export const flightDuration = ({ reducedMotion }) => (reducedMotion ? 0 : FLIGHT_MS);

export function isDrag(down, point, slop = DRAG_SLOP) {
  return Boolean(down) && Math.hypot(point.x - down.x, point.y - down.y) > slop;
}

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

// 卡片（rect 是 getBoundingClientRect）遮住畫布的哪一邊：四種「這一邊被遮住」的算法中，留下可見面積最大的那一種。
// 停靠在下方的卡片算下緣被遮住，直立在右側的算右緣。卡片關閉時沒有大小，不遮住任何邊。
export function coverInsets(rect, { width, height }) {
  if (rect.right - rect.left <= 0 || rect.bottom - rect.top <= 0) return { ...ZERO };
  const options = [
    { ...ZERO, top: Math.max(0, rect.bottom) },
    { ...ZERO, bottom: Math.max(0, height - rect.top) },
    { ...ZERO, left: Math.max(0, rect.right) },
    { ...ZERO, right: Math.max(0, width - rect.left) },
  ];
  const area = (i) => Math.max(0, width - i.left - i.right) * Math.max(0, height - i.top - i.bottom);
  return options.reduce((best, option) => (area(option) > area(best) ? option : best));
}

// 浮動元件（工具列、索引面板）與卡片同時遮住畫布：同一邊取較寬的；剩下的可見區至少保留 MIN_VISIBLE。
export function combineInsets(base, cover, { width, height }) {
  const insets = Object.fromEntries(Object.keys(ZERO).map((side) => [side, Math.max(base[side], cover[side])]));
  const shrink = (a, b, size) => {
    const excess = insets[a] + insets[b] - size * (1 - MIN_VISIBLE);
    if (excess <= 0) return;
    // 超出的部分由兩邊依寬度比例退讓。
    const total = insets[a] + insets[b];
    insets[a] -= (excess * insets[a]) / total;
    insets[b] -= (excess * insets[b]) / total;
  };
  shrink('top', 'bottom', height);
  shrink('left', 'right', width);
  return insets;
}

// 畫面偏移以指數平滑跟上目標，dt 是這一幀的秒數。差不到半像素就直接到位；減少動態時直接到位。
export function approachInsets(current, target, dt, { reducedMotion = false } = {}) {
  const k = reducedMotion ? 1 : 1 - Math.exp(-dt * OFFSET_RATE);
  const next = {};
  for (const side of Object.keys(ZERO)) {
    const value = lerp(current[side], target[side], k);
    next[side] = Math.abs(target[side] - value) < 0.5 ? target[side] : value;
  }
  return next;
}

export const sameInsets = (a, b) => Object.keys(ZERO).every((side) => a[side] === b[side]);

// 預設視角：橫式畫面從正南方、較高的俯角看；直式畫面用較低的俯角，並挑讓島最大（距離最近）的方位角。
// azimuths 可指定候選方位角（測試用）。回傳 { polar, azimuth, target, distance }。
export function homeView(points, { fov, aspect, fill = 0.8, azimuths = PORTRAIT_AZIMUTHS }) {
  const portrait = aspect < PORTRAIT_BELOW;
  const polar = portrait ? POLAR_PORTRAIT : POLAR_LANDSCAPE;
  const candidates = portrait ? azimuths : [0];
  let best = null;
  for (const azimuth of candidates) {
    const framed = frameIsland(points, { fov, aspect, polar, fill, azimuth });
    // 方位角接近時偏好轉得少的，避免浮點誤差讓構圖在兩個角度間跳。
    if (!best || framed.distance < best.distance - 1e-6) best = { polar, azimuth, ...framed };
  }
  return best;
}
