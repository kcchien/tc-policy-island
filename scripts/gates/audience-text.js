// 上線關卡「受眾文案」：給市民看的整理者文字不得外漏內部細節，判斷規則在 scripts/lib/audience-text.js。

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { htmlScreenText, internalDetails, stringLiterals } from '../lib/audience-text.js';
import { DATASET_PATH, THIRD_PARTY } from './site.js';
import { REPO_FILES_DIR } from '../../site/js/repo-documents.js';

// 網站上集中所有畫面文案的模組。其餘畫面模組不寫中文字串，由 test/ui-text.test.js 檢查。
export const UI_TEXT_MODULE = 'js/ui-text.js';

// 掃整理者撰寫的畫面文字：HTML 頁面的文字與說明屬性、畫面文案模組的字串、公開資料集中上畫面的整理者欄位。
// 不掃：原文引述、候選人資料的學歷與經歷、出處標題（候選人本人的文字）、引用 repo 文件（逐字公開）、
// 公開資料集與出處快照檔本身（資料下載檔），以及第三方程式碼。
const SKIP_PAGE = [THIRD_PARTY, new RegExp(`^data/${REPO_FILES_DIR}/`)];
const HTML_FILE = /\.html$/;

// 公開資料集中由整理者撰寫、會出現在畫面上的欄位。
const SCREEN_FIELDS = {
  candidates: (c) => [['name', c.name], ['party', c.party], ['dataStatus', c.dataStatus], ['profile.electionName', c.profile?.electionName]],
  issueAreas: (a) => [['name', a.name], ['description', a.description], ...a.departments.map((d, i) => [`departments[${i}]`, d])],
  localElements: (e) => [['name', e.name], ['category', e.category], ['place', e.place], ['reason', e.reason]],
  policies: (p) => [['summary', p.summary], ['conflictNote', p.conflictNote], ...p.districts.map((d, i) => [`districts[${i}]`, d])],
};

// 資料集模組裡會上畫面的文字：來源類型的中文名與排序規則說明（其餘中文是給維護者的驗證訊息與資料列舉）。
export const DATASET_MODULE = 'js/dataset.js';

const describe = (where, text) => internalDetails(text).map(({ kind, text: hit }) => `${where}：含${kind}「${hit}」`);

// 直接載入網站目錄裡的資料集模組，檢查的就是要上線的文字。Node 24 可以同步 require ES 模組。
function datasetModuleTexts(site) {
  const { SOURCE_TYPES, CANDIDATE_ORDER_RULES } = createRequire(import.meta.url)(join(site.dir, DATASET_MODULE));
  return [...Object.values(SOURCE_TYPES), ...Object.values(CANDIDATE_ORDER_RULES).flatMap((rule) => [rule.note, rule.keyName])];
}

export default {
  id: 'audience-text',
  name: '受眾文案不外漏內部細節：畫面文字不含路徑、副檔名、工具名、字型名、模型代號、程式欄位名',
  check(site) {
    const failures = [];
    const files = site.files();
    for (const path of files.filter((p) => HTML_FILE.test(p) && !SKIP_PAGE.some((pattern) => pattern.test(p)))) {
      for (const text of htmlScreenText(site.readText(path))) failures.push(...describe(path, text));
    }
    if (!files.includes(UI_TEXT_MODULE)) {
      failures.push(`找不到畫面文案模組 ${UI_TEXT_MODULE}`);
    } else {
      for (const text of stringLiterals(site.readText(UI_TEXT_MODULE))) failures.push(...describe(UI_TEXT_MODULE, text));
    }
    if (files.includes(DATASET_MODULE)) {
      for (const text of datasetModuleTexts(site)) failures.push(...describe(DATASET_MODULE, text));
    }
    const dataset = site.dataset();
    // 選舉時程的事件名稱是整理者寫的；公告標題是選委會的原文，不掃。
    for (const event of dataset.meta?.electionSchedule?.events ?? []) {
      failures.push(...describe(`${DATASET_PATH} meta.electionSchedule.events[${event.id}].name`, event.name));
    }
    for (const [key, fieldsOf] of Object.entries(SCREEN_FIELDS)) {
      for (const item of dataset[key] ?? []) {
        for (const [field, text] of fieldsOf(item)) {
          if (typeof text === 'string') failures.push(...describe(`${DATASET_PATH} ${key}[${item.id}].${field}`, text));
        }
      }
    }
    return failures;
  },
};
