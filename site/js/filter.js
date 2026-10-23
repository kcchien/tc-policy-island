// 搜尋與行政區篩選：檢視模型 → 只含符合條件政見的檢視模型。表格檢視與島嶼檢視共用。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

import { TAICHUNG_DISTRICTS } from './dataset.js';

// 篩選中某格沒有符合的政見。與 no-policies（該候選人在此區未提出相關政見）分開，避免誤導。
export const NO_MATCH_TEXT = '沒有符合篩選條件的政見';

// 全形轉半形、英文字母轉小寫。
const normalize = (text) => text.normalize('NFKC').toLowerCase();

function searchText(policy) {
  return normalize([policy.summary, ...policy.quotes.map((q) => q.text), ...policy.districts].join('\n'));
}

// 關鍵字比對摘要、原文引述與適用行政區；以空白分開的每個詞都要符合。
// district 須是 29 區正式名稱之一，其他值視為未篩選。全站篩選與政見卡片的欄內篩選共用。
// 回傳 { active, district, matches(policy) }；district 是生效的行政區（沒有時為 null）。
export function policyMatcher({ query = '', district = '' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const districtFilter = TAICHUNG_DISTRICTS.includes(district) ? district : null;
  return {
    active: terms.length > 0 || districtFilter !== null,
    district: districtFilter,
    matches(policy) {
      if (districtFilter !== null && !policy.districts.includes(districtFilter)) return false;
      const text = searchText(policy);
      return terms.every((term) => text.includes(term));
    },
  };
}

export function filterViewModel(vm, { query = '', district = '' } = {}) {
  const { active, district: districtFilter, matches } = policyMatcher({ query, district });
  if (!active) return { ...vm, filter: { active, query: '', district: null, matchCount: null } };

  const rows = vm.rows
    .map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        const policies = cell.policies.filter(matches);
        return { ...cell, status: policies.length > 0 ? 'has-policies' : 'no-matches', policies };
      }),
    }))
    .filter((row) => row.cells.some((cell) => cell.policies.length > 0));
  const matchCount = rows.reduce((sum, row) => sum + row.cells.reduce((n, cell) => n + cell.policies.length, 0), 0);
  return { ...vm, rows, filter: { active, query: query.trim(), district: districtFilter, matchCount } };
}
