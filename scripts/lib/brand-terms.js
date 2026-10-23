import { readJson } from './raw-data.js';

// 品牌用語清單：data/rules/brand-terms.json。分兩級，見 docs/rules/brand-terms.md。
// brand 是品牌用語，整理者文字全面禁用；frequent 是陣營高頻詞，網站文案禁用，摘要不擋。
export const BRAND_TERMS_PATH = new URL('../../data/rules/brand-terms.json', import.meta.url);

export const TIER_NAMES = { brand: '品牌用語', frequent: '陣營高頻詞' };

export function loadBrandTerms(path = BRAND_TERMS_PATH) {
  return readJson(path);
}

// 比對前的正規化：全半形統一、英文小寫、臺視為台、去掉空白與標點符號。
// 保留小數點，避免「16.8」被讀成「168」。
export function normalizeForScan(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('臺', '台')
    .replace(/[\s\p{P}\p{S}]/gu, (c) => (c === '.' ? c : ''));
}

function matcher(term) {
  const normalized = normalizeForScan(term);
  // 純數字代號（如 168）前後不得緊接數字，「1680 元」不算命中。
  if (/^\d+$/.test(normalized)) {
    const pattern = new RegExp(`(?<!\\d)${normalized}(?!\\d)`);
    return (text) => pattern.test(text);
  }
  return (text) => text.includes(normalized);
}

// 回傳 scan(text, tiers) → 命中的 { term, tier, candidate } 清單。tiers 預設兩級都掃。
export function createScanner(list) {
  const entries = ['brand', 'frequent'].flatMap((tier) =>
    list[tier].map((entry) => ({ ...entry, tier, test: matcher(entry.term) })));
  return (text, tiers = ['brand', 'frequent']) => {
    const normalized = normalizeForScan(text);
    return entries
      .filter((entry) => tiers.includes(entry.tier) && entry.test(normalized))
      .map(({ term, tier, candidate }) => ({ term, tier, candidate }));
  };
}
