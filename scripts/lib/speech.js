// 朗讀（GLOSSARY）：政見語音的固定設定與文字樣板。只給 Node 用。
// speechScript 把一條政見組成送語音合成服務的文字，三位候選人同一樣板、不帶候選人資訊；
// speechParts 把超過單次上限的文字依句子拆段。生成指令是 scripts/speak.js，清單格式見 data/audio/manifest.json。

import { createHash } from 'node:crypto';

// 三位候選人共用的語音設定，照原樣寫進清單的 voice。改任何一項，清單裡的音檔全部要重生成。
export const SPEECH_VOICE = { provider: 'voai', name: '國賢', style: '預設', model: 'Neo', speed: 1 };

// 語音合成服務單次請求的文字上限（字數）。
export const SPEECH_CHAR_LIMIT = 1000;

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export const charCount = (text) => [...text].length;

const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 1 到 99 的中文數字：一、十、十一、二十、二十一⋯
function chineseNumber(n) {
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10);
  return `${tens === 1 ? '' : DIGITS[tens]}十${DIGITS[n % 10]}`;
}

// 句尾已有句號、問號、驚嘆號（可再接引號或括號）就不補；結尾的逗號、頓號、分號、冒號換成句號。
function endSentence(text) {
  const trimmed = text.trim().replace(/[，、；：,;:]+$/u, '');
  return /[。！？!?…][」』）)]*$/u.test(trimmed) ? trimmed : `${trimmed}。`;
}

// 半形方括號是服務的停頓標籤語法，文字裡的換成全形，聽起來一樣。
const escapeTags = (text) => text.replaceAll('[', '［').replaceAll(']', '］');

const speakable = (text) => escapeTags(endSentence(text));

// 摘要。<summary>[:1]原文引述一。<quote1>[:0.8]原文引述二。<quote2>⋯；只有一則時寫「原文引述。」。
export function speechScript(policy) {
  const quotes = policy.quotes.map((quote, index) => {
    const label = policy.quotes.length === 1 ? '原文引述' : `原文引述${chineseNumber(index + 1)}`;
    return `${label}。${speakable(quote.text)}`;
  });
  return `摘要。${speakable(policy.summary)}[:1]${quotes.join('[:0.8]')}`;
}

// 句子的邊界：句尾標點（可再接引號、括號與停頓標籤）之後。
const SENTENCE_END = /(?<=[。！？!?][」』）)]*(?:\[:[\d.]+\])?)(?![」』）)[。！？!?])/u;
const CLAUSE_END = /(?<=[，、；,;])/u;

function splitLong(unit, limit) {
  if (charCount(unit) <= limit) return [unit];
  const clauses = unit.split(CLAUSE_END);
  if (clauses.length > 1) return pack(clauses, limit);
  const chars = [...unit];
  return Array.from({ length: Math.ceil(chars.length / limit) }, (_, i) => chars.slice(i * limit, (i + 1) * limit).join(''));
}

// 依序把片段塞進不超過上限的段落。
function pack(units, limit) {
  const parts = [];
  let current = '';
  for (const unit of units.flatMap((u) => splitLong(u, limit))) {
    if (current !== '' && charCount(current) + charCount(unit) > limit) {
      parts.push(current);
      current = '';
    }
    current += unit;
  }
  if (current !== '') parts.push(current);
  return parts;
}

// 超過上限時依句子拆段，句子本身超過上限才退到逗號處，仍超過才硬切。合起來等於原文。
export function speechParts(script, limit = SPEECH_CHAR_LIMIT) {
  return charCount(script) <= limit ? [script] : pack(script.split(SENTENCE_END), limit);
}
