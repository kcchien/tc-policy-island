import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateCountText, verificationText } from '../site/js/policy-card.js';
import { passedVerification } from './fixtures/make-raw.js';

test('核對紀錄摘要列出兩層結果、檢核表版本、模型與日期', () => {
  assert.deepEqual(verificationText(passedVerification()), [
    '第一層 逐字比對：通過（2026-10-24）',
    '第二層 檢核表（版本 1）：通過（test-model，2026-10-24）',
  ]);
});

test('卡片欄位顯示此區政見數與原始政見條目總數，尚未統計時照實寫出', () => {
  assert.equal(candidateCountText(2, { total: 117 }), '此議題區 2 筆政見，原始政見條目共 117 項');
  assert.equal(candidateCountText(0, { total: null }), '此議題區 0 筆政見，原始政見條目尚未統計');
});
