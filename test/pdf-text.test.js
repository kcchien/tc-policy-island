import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchToUnicode, toUnicodeEntries } from '../scripts/lib/pdf-text.js';
import { makePdf, TEST_FONT } from './fixtures/make-pdf.js';

const DIGITS = { F356: '0', F357: '1' };

test('ToUnicode 修補：指定字型的替代字元對到還原的文字，其他對照不變', () => {
  const { pdf, patched } = patchToUnicode(makePdf(), TEST_FONT, DIGITS);

  assert.equal(patched, 2);
  const entries = toUnicodeEntries(pdf, TEST_FONT);
  assert.equal(entries.get('F356'), '0');
  assert.equal(entries.get('F357'), '1');
  assert.equal(entries.get('0001'), ' ');
});

test('ToUnicode 修補：以增量更新附加在原檔之後，原檔位元組不變，新 trailer 指回原本的 xref', () => {
  const original = makePdf();

  const { pdf } = patchToUnicode(original, TEST_FONT, DIGITS);

  assert.ok(pdf.subarray(0, original.length).equals(original));
  const appended = pdf.subarray(original.length).toString('latin1');
  const previous = original.toString('latin1').match(/startxref\n(\d+)/)[1];
  assert.match(appended, new RegExp(`/Prev ${previous}\\b`));
  assert.match(appended, /\/Root 1 0 R/);
});

test('ToUnicode 修補：壓縮的對照表一樣可讀可改，原本沒有的代碼另外加上', () => {
  const { pdf, patched } = patchToUnicode(makePdf({ compress: true }), TEST_FONT, { ...DIGITS, F358: '2' });

  assert.equal(patched, 3);
  assert.equal(toUnicodeEntries(pdf, TEST_FONT).get('F358'), '2');
});

test('ToUnicode 修補：找不到字型時丟出錯誤並寫明字型名稱', () => {
  assert.throws(() => patchToUnicode(makePdf(), 'OtherFont', DIGITS), /找不到字型 OtherFont/);
});
