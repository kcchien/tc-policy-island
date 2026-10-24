// 朗讀（GLOSSARY）：政見語音的固定設定與文字樣板。只給 Node 用。
// speechScript 把一條政見組成送語音合成服務的文字，三位候選人同一樣板、不帶候選人資訊；
// speechParts 把超過單次上限的文字依句子拆段。生成指令是 scripts/speak.js，清單 data/audio/manifest.json 由它寫出。
// audioProblems 對照公開政見與清單找出缺少或不符的音檔，生成指令、建置指令與上線關卡「音檔只來自政見語音清單」共用。

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

// 句子的邊界：句尾標點（可再接引號、括號）與緊接的停頓標籤之後。停頓標籤跟著前一句，不單獨成段。
const SENTENCE_END = /(?<=[。！？!?…][」』）)]*(?:\[:[\d.]+\])?)(?![」』）)[。！？!?…\[])/u;
const CLAUSE_END = /(?<=[，、；,;])/u;
const TRAILING_TAG = /^(.*?)(\[:[\d.]+\])?$/su;

// 句子超過上限時先在逗號處切，仍超過才硬切；句尾的停頓標籤先拿開，切完再接回最後一段，不會被切斷。
function splitLong(unit, limit) {
  if (charCount(unit) <= limit) return [unit];
  const [, body, tag = ''] = unit.match(TRAILING_TAG);
  const room = limit - charCount(tag);
  const clauses = body.split(CLAUSE_END);
  const pieces = clauses.length > 1
    ? pack(clauses, room)
    : Array.from({ length: Math.ceil(charCount(body) / room) }, (_, i) => [...body].slice(i * room, (i + 1) * room).join(''));
  pieces[pieces.length - 1] += tag;
  return pieces;
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

// 網站上的政見音檔與清單放在公開資料集旁的 audio/，公開資料集的 audioUrl 相對網站根目錄。
export const AUDIO_DIR = 'audio';
export const AUDIO_MANIFEST = 'manifest.json';
export const audioUrlOf = (item) => `data/${AUDIO_DIR}/${item.file}`;

// 對照公開政見與清單，回傳缺少的音檔與原因；空陣列表示齊全（全有或全無的「全有」）。
// fileSha256Of(file) 回傳音檔的 sha256，檔案不存在時回傳 null。
export function audioProblems(policies, manifest, fileSha256Of) {
  if (JSON.stringify(manifest.voice) !== JSON.stringify(SPEECH_VOICE)) {
    return [`清單的語音設定 ${JSON.stringify(manifest.voice)} 與現行設定 ${JSON.stringify(SPEECH_VOICE)} 不同`];
  }
  return policies.flatMap((policy) => {
    const item = manifest.items?.[policy.id];
    const where = `政見 ${policy.id}`;
    if (!item) return [`${where}：清單沒有這條`];
    if (item.textSha256 !== sha256(speechScript(policy))) return [`${where}：文字已變，音檔要重生成`];
    const actual = fileSha256Of(item.file);
    if (actual === null) return [`${where}：音檔 ${item.file} 不存在`];
    if (actual !== item.fileSha256) return [`${where}：音檔與清單的雜湊不符`];
    return [];
  });
}
