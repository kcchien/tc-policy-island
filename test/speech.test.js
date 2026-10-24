import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speechParts, speechScript } from '../scripts/lib/speech.js';
import { policy } from './fixtures/make-raw.js';

const withText = (summary, quotes, candidateId = 'cand-a') => ({
  ...policy('p-1', candidateId),
  summary,
  quotes: quotes.map((text) => ({ text, sourceId: `src-${candidateId}` })),
});

test('朗讀文字照樣板：摘要、停頓一秒、原文引述逐則編號，引述之間停頓 0.8 秒', () => {
  const script = speechScript(withText('增設公車路線。', ['增設三條公車路線。', '每 15 分鐘一班。']));

  assert.equal(script, '摘要。增設公車路線。[:1]原文引述一。增設三條公車路線。[:0.8]原文引述二。每 15 分鐘一班。');
});

test('只有一則原文引述時寫「原文引述」，不編號', () => {
  assert.equal(speechScript(withText('增設公車路線。', ['增設三條公車路線。'])), '摘要。增設公車路線。[:1]原文引述。增設三條公車路線。');
});

test('句尾沒有句號就補；以引號或括號結尾的也補，已有句號、問號、驚嘆號的不補', () => {
  const script = speechScript(withText('推動「幸福專案」', ['爭取經費（中央補助）', '要不要蓋？', '一定蓋！', '說「好。」', '結尾逗號，']));

  assert.equal(
    script,
    '摘要。推動「幸福專案」。[:1]原文引述一。爭取經費（中央補助）。[:0.8]原文引述二。要不要蓋？[:0.8]原文引述三。一定蓋！'
      + '[:0.8]原文引述四。說「好。」[:0.8]原文引述五。結尾逗號。',
  );
});

test('引述超過九則時編號照中文數字接下去', () => {
  const quotes = Array.from({ length: 12 }, (_, i) => `第${i + 1}則。`);

  const script = speechScript(withText('摘要句。', quotes));

  assert.match(script, /原文引述九。第9則。\[:0\.8\]原文引述十。第10則。\[:0\.8\]原文引述十一。第11則。\[:0\.8\]原文引述十二。第12則。$/);
});

test('文字裡的半形方括號換成全形，不會被當成停頓標籤', () => {
  assert.equal(speechScript(withText('第[1]項。', ['見[:3]附表。'])), '摘要。第［1］項。[:1]原文引述。見［:3］附表。');
});

test('三位候選人同一樣板：內容相同時文字完全相同，不含候選人資訊', () => {
  const scripts = ['cand-a', 'cand-b', 'cand-c'].map((id) => speechScript(withText('增設公車路線。', ['增設三條公車路線。'], id)));

  assert.equal(new Set(scripts).size, 1);
  assert.doesNotMatch(scripts[0], /cand-/);
});

test('不超過上限時整段一份；超過時依句子拆成多段，每段不超過上限、合起來等於原文', () => {
  const short = speechScript(withText('短。', ['也短。']));
  assert.deepEqual(speechParts(short, 1000), [short]);

  const script = speechScript(withText('甲'.repeat(30) + '。', ['乙'.repeat(30) + '。', '丙'.repeat(30) + '。']));
  const parts = speechParts(script, 50);

  assert.ok(parts.length > 1);
  assert.equal(parts.join(''), script);
  for (const part of parts) {
    assert.ok([...part].length <= 50, part);
    // 每段都在句尾（或句尾後的停頓標籤）結束，不切在句子中間。
    assert.match(part, /[。！？]$|\[:[\d.]+\]$/, part);
  }
});

test('單一句子就超過上限時，退到逗號處切開，仍不超過上限', () => {
  const sentence = `${'丁'.repeat(30)}，${'戊'.repeat(30)}。`;

  const parts = speechParts(sentence, 40);

  assert.deepEqual(parts, [`${'丁'.repeat(30)}，`, `${'戊'.repeat(30)}。`]);
});
