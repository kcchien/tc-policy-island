// 品牌用語清單的讀取與掃描器。上線關卡「品牌用語掃描」與測試共用。

import { readJson } from './raw-data.js';

// 品牌用語清單：data/rules/brand-terms.json。分兩級，見 docs/rules/brand-terms.md。
// brand 是品牌用語，整理者文字全面禁用；frequent 是陣營高頻詞，網站文案禁用，摘要不擋。
export const BRAND_TERMS_PATH = new URL('../../data/rules/brand-terms.json', import.meta.url);

export const TIER_NAMES = { brand: '品牌用語', frequent: '陣營高頻詞' };

export function loadBrandTerms(path = BRAND_TERMS_PATH) {
  return readJson(path);
}

export const TIERS = Object.keys(TIER_NAMES);

// 比對前的正規化：全半形統一、英文小寫、臺視為台，空白與標點符號（小數點除外）換成 separator。
// 文字比對把它們去掉（separator 為空字串），「臺中・啟程」「Taichung  Way」才會命中；
// 數字代號比對把它們換成空白，「12、345」「[16, 8]」才不會接成 12345、168。
export function normalizeForScan(text, separator = '') {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('臺', '台')
    .replace(/[\s\p{P}\p{S}]/gu, (c) => (c === '.' ? c : separator));
}

function matcher(term) {
  const normalized = normalizeForScan(term);
  // 純數字代號（如 168）前後不得緊接數字或小數，「1680 元」「0.168」「168.5」不算命中。
  if (/^\d+$/.test(normalized)) {
    const pattern = new RegExp(`(?<![\\d.])${normalized}(?!\\.?\\d)`);
    return ({ spaced }) => pattern.test(spaced);
  }
  // 結尾是英文字母的詞，後面不得緊接字母，「Taichung We」不擋「Taichung Weather」。
  if (/[a-z]$/.test(normalized)) {
    const pattern = new RegExp(`${RegExp.escape(normalized)}(?![a-z])`);
    return ({ compact }) => pattern.test(compact);
  }
  return ({ compact }) => compact.includes(normalized);
}

// 回傳 scan(text, tiers) → 命中的 { term, tier, candidate } 清單。tiers 預設兩級都掃。
export function createScanner(list) {
  const entries = TIERS.flatMap((tier) =>
    list[tier].map((entry) => ({ ...entry, tier, test: matcher(entry.term) })));
  return (text, tiers = TIERS) => {
    const forms = { compact: normalizeForScan(text), spaced: normalizeForScan(text, ' ') };
    return entries
      .filter((entry) => tiers.includes(entry.tier) && entry.test(forms))
      .map(({ term, tier, candidate }) => ({ term, tier, candidate }));
  };
}
