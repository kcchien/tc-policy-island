// PDF 字型對照還原：改寫指定字型的 ToUnicode 對照表，讓 pdftotext 轉出原本抽不出的字。
// 有些公報 PDF 的 ToUnicode 把部分字形（例如數字）對到 U+FFFD，轉文字時變成「�」。
// 修補以 PDF 的增量更新附加在原檔之後：原檔位元組不變，只多出新版的對照表物件與 xref。
// 只支援傳統 xref 表與未壓縮的物件（公報 PDF 由 InDesign 輸出，屬於這種）。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

// 物件編號 → { dict, data }。同一編號出現多次（已有增量更新）時取最後一個。
function readObjects(pdf) {
  const text = pdf.toString('latin1');
  const objects = new Map();
  for (const m of text.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)) {
    const body = m[2];
    const head = body.match(/^([\s\S]*?)stream\r?\n/);
    if (!head) {
      objects.set(m[1], { dict: body, data: null });
      continue;
    }
    const start = m.index + m[0].indexOf(body) + head[0].length;
    const end = text.lastIndexOf('endstream', m.index + m[0].length);
    objects.set(m[1], { dict: head[1], data: { start, end } });
  }
  return { text, objects };
}

function streamBytes(pdf, objects, id) {
  const object = objects.get(id);
  if (!object?.data) throw new Error(`物件 ${id} 不是串流`);
  // 長度可能是直接的數字，或指向另一個物件（/Length 12 0 R）。
  const length = object.dict.match(/\/Length\s+(\d+)(\s+0\s+R)?/);
  const value = length?.[2] ? Number(objects.get(length[1])?.dict.trim()) : Number(length?.[1]);
  const end = Number.isInteger(value) ? object.data.start + value : object.data.end;
  const raw = pdf.subarray(object.data.start, end);
  return /\/FlateDecode/.test(object.dict) ? inflateSync(raw) : raw;
}

// 子集字型的名稱帶 6 個大寫字母前綴（例如 FAUZXX+），比對時忽略。
function toUnicodeIds(objects, baseFont) {
  const ids = [];
  for (const { dict } of objects.values()) {
    const name = dict.match(/\/BaseFont\s*\/([^\s/<>[\]]+)/)?.[1];
    if (!/\/Subtype\s*\/Type0/.test(dict) || name?.replace(/^[A-Z]{6}\+/, '') !== baseFont) continue;
    const ref = dict.match(/\/ToUnicode (\d+) 0 R/)?.[1];
    if (ref) ids.push(ref);
  }
  if (ids.length === 0) throw new Error(`找不到字型 ${baseFont} 的 ToUnicode 對照表`);
  return [...new Set(ids)];
}

const utf16Hex = (text) => [...Buffer.from(text, 'utf16le').swap16()].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
const fromUtf16Hex = (hex) => Buffer.from(hex, 'hex').swap16().toString('utf16le');

// 讀出字型最新版 ToUnicode 的單字對照（bfchar），代碼為大寫十六進位字串。
export function toUnicodeEntries(pdf, baseFont) {
  const { objects } = readObjects(pdf);
  const entries = new Map();
  for (const id of toUnicodeIds(objects, baseFont)) {
    const cmap = streamBytes(pdf, objects, id).toString('latin1');
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) entries.set(pair[1].toUpperCase(), fromUtf16Hex(pair[2]));
    }
  }
  return entries;
}

// codes：{ 代碼（十六進位）: 還原的文字 }。回傳 { pdf: 修補後的 PDF, patched: 改寫或新增的對照數 }。
export function patchToUnicode(pdf, baseFont, codes) {
  const { text, objects } = readObjects(pdf);
  const ids = toUnicodeIds(objects, baseFont);
  const trailer = [...text.matchAll(/trailer\s*<<([\s\S]*?)>>\s*startxref\s*(\d+)/g)].pop();
  if (!trailer) throw new Error('PDF 沒有傳統 xref 表的 trailer，不支援修補');
  const previous = [...text.matchAll(/startxref\s*(\d+)/g)].pop()[1];

  let patched = 0;
  const appended = [];
  let offset = pdf.length + (text.endsWith('\n') ? 0 : 1);
  const xref = [];
  for (const id of ids) {
    let cmap = streamBytes(pdf, objects, id).toString('latin1');
    const added = [];
    for (const [code, value] of Object.entries(codes)) {
      const entry = new RegExp(`<${code}>\\s*<[0-9A-Fa-f]+>`, 'i');
      const replacement = `<${code.toUpperCase()}> <${utf16Hex(value)}>`;
      if (entry.test(cmap)) cmap = cmap.replace(entry, replacement);
      else added.push(replacement);
      patched += 1;
    }
    if (added.length > 0) cmap = cmap.replace(/endcmap/, `${added.length} beginbfchar\n${added.join('\n')}\nendbfchar\nendcmap`);
    const object = `${id} 0 obj\n<</Length ${Buffer.byteLength(cmap, 'latin1')}>>stream\n${cmap}\nendstream\nendobj\n`;
    xref.push({ id, offset });
    appended.push(object);
    offset += Buffer.byteLength(object, 'latin1');
  }

  const keep = (key) => trailer[1].match(new RegExp(`/${key}\\s*(\\d+ 0 R|\\[[^\\]]*\\])`))?.[0] ?? '';
  const size = Math.max(Number(trailer[1].match(/\/Size (\d+)/)[1]), ...ids.map((id) => Number(id) + 1));
  const table = xref.map(({ id, offset: at }) => `${id} 1\n${String(at).padStart(10, '0')} 00000 n\r\n`).join('');
  const tail = `xref\n${table}trailer\n<</Size ${size}${keep('Root')}${keep('Info')}${keep('ID')}/Prev ${previous}>>\nstartxref\n${offset}\n%%EOF\n`;
  const update = `${text.endsWith('\n') ? '' : '\n'}${appended.join('')}${tail}`;
  return { pdf: Buffer.concat([pdf, Buffer.from(update, 'latin1')]), patched };
}

export const REPLACEMENT_CHAR = '�';

// PDF 的一頁 → 出處快照文字。glyphMap 是字型對照檔的內容 { fonts: [{ baseFont, codes }] }，
// 有給就先修補 ToUnicode 再轉。用 poppler 的 pdftotext（預設閱讀順序模式）。
// 回傳 { text, restored: [{ baseFont, count }], unmapped: 仍是 U+FFFD 的字數 }。
export function pdfPageText(pdf, { page = 1, glyphMap = null, pdftotext = 'pdftotext' } = {}) {
  let patchedPdf = pdf;
  const restored = [];
  for (const { baseFont, codes } of glyphMap?.fonts ?? []) {
    const result = patchToUnicode(patchedPdf, baseFont, codes);
    patchedPdf = result.pdf;
    restored.push({ baseFont, count: Object.keys(codes).length });
  }
  const dir = mkdtempSync(join(tmpdir(), 'pdf-text-'));
  try {
    const input = join(dir, 'input.pdf');
    const output = join(dir, 'output.txt');
    writeFileSync(input, patchedPdf);
    const run = spawnSync(pdftotext, ['-f', String(page), '-l', String(page), '-enc', 'UTF-8', input, output], { encoding: 'utf8' });
    if (run.error) throw new Error(`無法執行 ${pdftotext}：${run.error.message}`);
    if (run.status !== 0) throw new Error(`${pdftotext} 失敗（結束碼 ${run.status}）：${run.stderr.trim()}`);
    // 換行統一成 \n，去掉換頁字元與結尾空行，不動其他文字。
    const text = `${readFileSync(output, 'utf8').replace(/\r\n?/g, '\n').replaceAll('\f', '').trimEnd()}\n`;
    return { text, restored, unmapped: [...text].filter((c) => c === REPLACEMENT_CHAR).length };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
