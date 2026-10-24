// 上手導覽的步驟狀態機（Node 可測，不 import 其他模組）：三步依序是議題區格子、三個標記、隨機一題。
// 每一步只以議題區為單位，不以候選人為單位（ADR 0001）。狀態是 { step, seen }：step 為目前步驟的索引，
// 沒有顯示導覽時為 null；seen 表示看過或跳過（main.js 記進 localStorage）。畫面由 tour-view.js 負責。

export const TOUR_STEPS = ['area', 'markers', 'random'];

export const initialTour = ({ seen }) => ({ step: null, seen: Boolean(seen) });

export const currentTourStep = (state) => (state.step === null ? null : TOUR_STEPS[state.step]);

// 自動出現：沒看過、正在島嶼檢視且 WebGL 可用時才出現。cardOpen 表示讀者正在看卡片（包括網址指定要開的卡片），
// 這次不出現也不記為看過，不收掉讀者正在看的卡片。
export function autoStartTour(state, { view, webgl, cardOpen = false }) {
  if (state.seen || state.step !== null || view !== 'island' || !webgl || cardOpen) return state;
  return { ...state, step: 0 };
}

// 下一步；最後一步之後結束並記為看過。
export function nextTourStep(state) {
  if (state.step === null) return state;
  if (state.step + 1 >= TOUR_STEPS.length) return { step: null, seen: true };
  return { ...state, step: state.step + 1 };
}

// 跳過：結束並記為看過。
export const skipTour = () => ({ step: null, seen: true });

// 頁首「怎麼看」重開：看過也從第一步開始，只在島嶼檢視且 WebGL 可用時。
export function reopenTour(state, { view, webgl }) {
  if (view !== 'island' || !webgl) return state;
  return { ...state, step: 0 };
}

// 以下是框線與說明框的位置，矩形都是視窗座標 { left, top, right, bottom }。

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inside = (r, box) => r.left >= box.left && r.top >= box.top && r.right <= box.right && r.bottom <= box.bottom;
const centerOf = (r) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });

// 第一、二步框哪一格。candidates 是 [{ id, label, markers }]：議題區名牌與三個標記在畫面上的範圍
// （不在畫面上或名牌被避讓隱藏時為 null）。visible 是畫布沒被浮動元件遮住的範圍，obstacles 是浮動元件。
// 只依畫面位置挑，不讀政見；回傳議題區識別碼，沒有合適的格子時為 null。
export function pickTourArea(candidates, { visible, obstacles = [] }) {
  const center = centerOf(visible);
  let best = null;
  for (const { id, label, markers } of candidates) {
    if (!label || !markers) continue;
    const ok = [label, markers].every((r) => inside(r, visible) && !obstacles.some((o) => overlaps(r, o)));
    if (!ok) continue;
    const c = centerOf(label);
    const distance = Math.hypot(c.x - center.x, c.y - center.y);
    if (!best || distance < best.distance) best = { id, distance };
  }
  return best?.id ?? null;
}

// 說明框的位置：放在框線下方，放不下改放上方，都放不下就放在空間較大的一側並貼齊視窗邊距；水平置中於框線。
// previous 是上一次的那一側，仍放得下就不換，框線跟著鏡頭移動時不會來回跳。沒有框線時置中。
export function placeTourBubble({ target, bubble, viewport, gutter = 16, gap = 12, previous = null }) {
  const clamp = (value, max) => Math.max(gutter, Math.min(value, max));
  const maxLeft = viewport.width - gutter - bubble.width;
  const maxTop = viewport.height - gutter - bubble.height;
  if (!target) {
    return { left: Math.max(gutter, (viewport.width - bubble.width) / 2), top: Math.max(gutter, (viewport.height - bubble.height) / 2), side: 'center' };
  }
  const tops = { below: target.bottom + gap, above: target.top - gap - bubble.height };
  const fits = (side) => tops[side] >= gutter && tops[side] <= maxTop;
  const side = [previous, 'below', 'above'].find((s) => s in tops && fits(s))
    ?? (viewport.height - target.bottom >= target.top ? 'below' : 'above');
  const left = clamp(centerOf(target).x - bubble.width / 2, maxLeft);
  return { left, top: clamp(tops[side], maxTop), side };
}
