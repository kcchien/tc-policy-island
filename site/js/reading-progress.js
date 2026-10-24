// 下一題與閱讀進度（Node 可測）：依議題區編號找上一題或下一題，讀者看過哪些議題區的紀錄，以及索引與表格共用的淡勾。
// 下一題只依完整議題區清單的順序，不看篩選、不看政見數量。看過紀錄只存在讀者自己的瀏覽器（SEEN_KEY），
// 不回傳本站，沒有獎勵與完成訊息（ADR 0001）。

import { el } from './dom.js';
import { READING_TEXT } from './ui-text.js';

export const SEEN_KEY = 'policy-island:areas-seen';

// rows 是檢視模型的完整議題區列。step 為 1（下一題）或 -1（上一題），頭尾相接；
// currentId 不在清單裡（還沒開過）時，下一題從第一題、上一題從最後一題開始。
export function nextAreaId(rows, currentId, step) {
  const count = rows.length;
  const index = rows.findIndex((row) => row.issueArea.id === currentId);
  const next = index < 0 ? (step > 0 ? 0 : count - 1) : (index + step + count) % count;
  return rows[next].issueArea.id;
}

// 回傳加入 areaId 後的新集合，不改動傳入的集合。
export const markSeen = (seen, areaId) => new Set([...seen, areaId]);

export const serializeSeen = (seen) => JSON.stringify([...seen]);

// 解析 localStorage 讀到的文字；不是文字陣列時回空集合，陣列裡不是文字的項目略過。
export function parseSeen(text) {
  try {
    const value = JSON.parse(text);
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

// 淡勾：只是視覺標記，不影響排序與篩選；輔助科技讀成「已看過」。索引面板與表格檢視共用。
export const seenMark = () => el(
  'span',
  { class: 'seen-mark' },
  el('span', { 'aria-hidden': 'true' }, READING_TEXT.mark),
  el('span', { class: 'visually-hidden' }, READING_TEXT.seen),
);
