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

test('圖例與導覽只描述本站收錄；篩選與空欄分開，核對附近說明其限制', () => {
  assert.equal(UI.MARKER_TEXT.lit, '本站已收錄這個議題的政見');
  assert.match(UI.MARKER_TEXT.legendNote, /尚未收錄不代表候選人未提出/);
  assert.match(UI.MARKER_TEXT.legendNote, /篩選/);
  assert.match(UI.TOUR_TEXT.steps.markers.body, /本站/);
  assert.match(UI.TOUR_TEXT.steps.markers.body, /尚未收錄不代表候選人未提出/);
  assert.equal(UI.NO_MATCH_TEXT, '沒有符合篩選條件的政見');
  assert.equal(UI.POLICY_CARD_TEXT.verificationScope, '只核對引用文字與摘要，不代表查核政見事實、評估可行性或保證履約。');
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

test('收錄說明保留此區與全站筆數、原始條目，尚未統計時照實寫出', () => {
  assert.equal(UI.COLLECTION_TEXT.areaCount(2), '此議題區收錄 2 筆政見');
  assert.equal(UI.COLLECTION_TEXT.totalCount(0), '本站共收錄 0 筆政見');
  assert.equal(UI.rawPolicyItemsText({ total: null }), '原始政見條目尚未統計');
});

test('政見卡片內篩選時，欄頭另列符合篩選的筆數，篩選總結列出三欄合計', () => {
  assert.equal(UI.POLICY_CARD_TEXT.columnMatch(3), '符合篩選條件 3 筆');
  assert.equal(UI.POLICY_CARD_TEXT.filterStatus({ active: false, matchCount: 5 }), '');
  assert.equal(UI.POLICY_CARD_TEXT.filterStatus({ active: true, matchCount: 0 }), '這個議題區沒有符合篩選條件的政見。');
  assert.equal(UI.POLICY_CARD_TEXT.filterStatus({ active: true, matchCount: 5 }), '這個議題區符合篩選條件的政見共 5 筆。');
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

// 畫面文字集中在 ui-text.js，關卡才掃得到。畫面模組是建立 DOM（引用 dom.js）或取用畫面文案（引用 ui-text.js）的模組；
// 其餘模組的中文是資料列舉、給維護者的錯誤訊息或程式內部名稱，不上畫面。dataset.js 上畫面的來源類型與排序說明
// 由關卡直接載入檢查。
const SCREEN_MODULE = /from '\.\/(dom|ui-text)\.js'/;
const CJK = /[㐀-鿿！-～]/;

test('畫面模組不寫中文字串，畫面文字一律從 ui-text.js 取用', () => {
  const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js') && f !== 'ui-text.js');
  for (const file of files) {
    const code = readFileSync(`${JS_DIR}${file}`, 'utf8');
    if (!SCREEN_MODULE.test(code)) continue;
    const chinese = stringLiterals(code).filter((s) => CJK.test(s));
    assert.deepEqual(chinese, [], `${file} 有中文字串`);
  }
});
