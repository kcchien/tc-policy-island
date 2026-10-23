import { createScanner, loadBrandTerms, TIER_NAMES, TIERS } from '../lib/brand-terms.js';
import { DATASET_PATH, THIRD_PARTY } from './site.js';

// 掃描整理者撰寫的文字：網站文案、公開資料集、網址與檔名。
// 不掃候選人本人的文字：原文引述、出處快照、出處的原網址、存檔網址與標題。
// three.js 等第三方程式碼不是整理者文字，只掃檔名。
const SKIP_CONTENT = [THIRD_PARTY, /^data\/snapshots\//];
const TEXT_FILE = /(\.(html|css|js|mjs|json|svg|txt|md|webmanifest|xml)|\/?_headers|\/?_redirects)$/;
const CODE_FILE = /\.(css|js|mjs)$/;

// 引號或反引號包住的字串內容。
function stringLiterals(code) {
  return [...code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g)].map((m) => m[2]);
}

// 公開資料集中不掃的欄位：候選人本人的文字，以及雜湊、時間戳記這類非文字欄位。
const SKIP_FIELD = [
  /^policies\[[^\]]*\]\.quotes\[\d+\]\.text$/,
  /^sources\[[^\]]*\]\.(url|archiveUrl|title|snapshotSha256)$/,
  /^meta\.builtAt$/,
];
// 摘要與出處說法不一標註只擋品牌用語；陣營高頻詞在摘要中有中性替代詞時才換，由核對第二層判斷。
const BRAND_ONLY_FIELD = /^policies\[[^\]]*\]\.(summary|conflictNote)$/;

function* stringFields(value, path) {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const key = item !== null && typeof item === 'object' && typeof item.id === 'string' ? item.id : index;
      yield* stringFields(item, `${path}[${key}]`);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) yield* stringFields(item, path ? `${path}.${key}` : key);
  }
}

function describe(where, hits) {
  return hits.map((hit) => `${where}：含${TIER_NAMES[hit.tier]}「${hit.term}」`);
}

export default {
  id: 'brand-terms',
  name: '整理者撰寫的文字不含品牌用語與陣營高頻詞',
  check(site) {
    const scan = createScanner(loadBrandTerms());
    const failures = [];
    for (const path of site.files()) {
      failures.push(...describe(`檔名 ${path}`, scan(path)));
      // 公開資料集逐欄位掃，見下方。
      if (path === DATASET_PATH) continue;
      if (SKIP_CONTENT.some((pattern) => pattern.test(path)) || !TEXT_FILE.test(path)) continue;
      const text = site.readText(path);
      if (!CODE_FILE.test(path)) {
        failures.push(...describe(path, scan(text)));
        continue;
      }
      // 程式碼的註解與識別字不是讀者看到的文案，陣營高頻詞只掃字串；品牌用語整份都掃。
      failures.push(...describe(path, scan(text, ['brand'])));
      for (const literal of stringLiterals(text)) failures.push(...describe(path, scan(literal, ['frequent'])));
    }
    for (const [path, text] of stringFields(site.dataset(), '')) {
      if (SKIP_FIELD.some((pattern) => pattern.test(path))) continue;
      const tiers = BRAND_ONLY_FIELD.test(path) ? ['brand'] : TIERS;
      failures.push(...describe(`${DATASET_PATH} ${path}`, scan(text, tiers)));
    }
    return failures;
  },
};
