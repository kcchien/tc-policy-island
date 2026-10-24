// 三人共用的收錄說明：把來源狀態、收錄筆數與原始條目放在可展開區塊，保留未知與資料截止日。
// 表格與政見卡片共用；不推論政見品質或完整度。瀏覽器使用，文字集中在 ui-text.js。
import { el } from './dom.js';
import { COLLECTION_TEXT as T, rawPolicyItemsText } from './ui-text.js';

export function collectionNote(candidate, { cutoffDate, areaPolicyCount = null }) {
  return el('details', { class: 'collection-note' },
    el('summary', {}, T.title),
    el('p', {}, candidate.sourceStatusText),
    areaPolicyCount !== null && el('p', {}, T.areaCount(areaPolicyCount)),
    el('p', {}, T.totalCount(candidate.policyCount)),
    el('p', {}, rawPolicyItemsText(candidate.rawPolicyItems)),
    el('p', {}, T.cutoff(cutoffDate)),
    el('p', {}, T.note));
}
