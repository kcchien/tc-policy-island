import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as UI from '../site/js/ui-text.js';
import { REPO_DOCUMENTS } from '../site/js/repo-documents.js';
import { internalDetails, stringLiterals } from '../scripts/lib/audience-text.js';
import { passedVerification, pendingVerification } from './fixtures/make-raw.js';

const JS_DIR = fileURLToPath(new URL('../site/js/', import.meta.url));

test('政見的核對紀錄用白話寫出兩道核對與日期，不列模型代號與檢核表版本', () => {
  assert.equal(UI.verificationText(passedVerification()), '已通過核對：原文逐字比對、AI 依公開檢核表檢查（2026-10-24）');
});

test('尚未通過的核對紀錄照實寫出每一道的結果', () => {
  assert.equal(UI.verificationText(pendingVerification()), '原文逐字比對：未核對；AI 依公開檢核表檢查：未核對');
});

test('候選人資料的核對紀錄寫出逐字比對的結果與日期', () => {
  assert.equal(UI.profileVerificationText({ layer1: { status: 'pass', checkedAt: '2026-10-24' } }), '已通過核對：學歷與經歷逐字比對原文（2026-10-24）');
  assert.equal(UI.profileVerificationText({ layer1: { status: 'pending', checkedAt: null } }), '學歷與經歷逐字比對原文：未核對');
});

test('原文存檔說明只在有字形還原時出現，改寫成白話，不寫工具名、字型名與檔案路徑', () => {
  const restored = 'PDF 第 1 頁以 pdftotext 轉成文字；字型 NotoSerifCJKtc-Light 的 10 個字形文字由 PDF 字型對照還原（對照檔 data/extraction/glyph-maps/x.json）';

  assert.equal(UI.snapshotNoteText(null), null);
  assert.equal(UI.snapshotNoteText('PDF 第 1 頁以 pdftotext 轉成文字'), null);
  assert.equal(UI.snapshotNoteText(restored), '部分文字因原始檔案的字型無法直接轉成文字，已比對公報影像逐字還原。');
});

test('卡片欄位顯示此區政見數與原始政見條目總數，尚未統計時照實寫出', () => {
  assert.equal(UI.candidateCountText(2, { total: 117 }), '此議題區 2 筆政見，原始政見條目共 117 項');
  assert.equal(UI.candidateCountText(0, { total: null }), '此議題區 0 筆政見，原始政見條目尚未統計');
});

test('整理方法頁的每份公開原文都有白話標題與說明', () => {
  for (const doc of REPO_DOCUMENTS) {
    const text = UI.REPO_DOCUMENT_TEXT[doc.id];
    assert.ok(text?.title && text?.description, `${doc.id} 缺少標題或說明`);
    assert.deepEqual(internalDetails(`${text.title} ${text.description}`), [], doc.id);
  }
});

test('畫面文案模組的每個字串與文字函式的輸出都不含內部細節', () => {
  const literals = stringLiterals(readFileSync(new URL('ui-text.js', `file://${JS_DIR}`), 'utf8'));
  const outputs = [
    UI.verificationText(passedVerification()),
    UI.verificationText(pendingVerification()),
    UI.resultStatusText({ filter: { active: true, matchCount: 3 }, rows: [1] }),
    UI.noPolicyText('2026-10-24'),
  ];
  for (const text of [...literals, ...outputs]) assert.deepEqual(internalDetails(text), [], text);
});

// 畫面文字集中在 ui-text.js，關卡才掃得到。dataset.js 的中文是資料列舉（行政區、來源類型、元素類別）、
// 排序規則的唯一定義與給維護者的驗證訊息；島嶼的時段與動態題材名稱不上畫面。
const EXEMPT = new Set(['ui-text.js', 'dataset.js', 'island-daylight.js', 'island-motion.js']);
const CJK = /[㐀-鿿！-～]/;

test('畫面模組不寫中文字串，畫面文字一律從 ui-text.js 取用', () => {
  for (const file of readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && !EXEMPT.has(f))) {
    const code = readFileSync(`${JS_DIR}${file}`, 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
    const chinese = stringLiterals(code).filter((s) => CJK.test(s));
    assert.deepEqual(chinese, [], `${file} 有中文字串`);
  }
});
