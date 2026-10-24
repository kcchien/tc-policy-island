// 遮名閱讀的純函式（Node 可測）：讀者在政見卡片上主動開啟時，三欄順序隨機打亂、欄頭改用中性代號。
// 順序以「畫面位置 → 排序規則的位置」的陣列表示；揭曉時用它找回讀者停留的候選人在排序規則中的位置。
// 不記錄讀者的猜測，也不存狀態（ADR 0001）。代號文字取自 ui-text.js。

import { POLICY_CARD_TEXT } from './ui-text.js';

// Fisher-Yates 洗牌，每種排列機率相同。random 可注入，預設 Math.random；不改動傳入的陣列。
export function shuffleColumns(indices, random = Math.random) {
  const order = [...indices];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// 依畫面位置給的中性代號，三欄同一套。
export const maskedColumnLabel = (position) => POLICY_CARD_TEXT.maskedLabels[position];

// 畫面位置在排序規則中的位置；order 為 null（沒有遮名）時位置不變。
export const revealedIndex = (order, position) => (order ? order[position] : position);
