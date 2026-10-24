// 複製成一段話與朗讀的文字（Node 可測）：把檢視模型裡的一筆政見組成純文字。三人同一格式，不加任何評價字眼；
// 複製文字含出處網址與網頁備份，不含原文存檔的站內位置。各行的句型取自 ui-text.js。

import { POLICY_CARD_TEXT } from './ui-text.js';

const LINES = POLICY_CARD_TEXT.copyLines;

// policy 是檢視模型的政見（quotes[].source 已帶出處）；url 是這筆政見在本站的完整連結。
export function policyText(policy, { areaName, candidateName, cutoffDate, url }) {
  return [
    LINES.heading(areaName, candidateName),
    LINES.summary(policy.summary),
    policy.conflictNote && LINES.conflict(policy.conflictNote),
    ...policy.quotes.flatMap(({ text, source }) => [
      LINES.quote(text),
      LINES.source(source.title, source.retrievedAt, source.url),
      source.archiveUrl && LINES.archive(source.archiveUrl),
    ]),
    LINES.footer(cutoffDate, url),
  ].filter(Boolean).join('\n');
}

// 句尾沒有標點時補句號，語音才會停頓。
const sentence = (text) => (/[。！？!?]$/.test(text) ? text : text + POLICY_CARD_TEXT.sentenceEnd);

// 朗讀的文字：摘要與每則原文引述，不唸網址。
export function policySpeech(policy) {
  return [policy.summary, ...policy.quotes.map(({ text }) => POLICY_CARD_TEXT.speechQuote(text))].map(sentence).join('');
}
