// 整理方法頁呈現 repo 內 Markdown 文件用的解析器。瀏覽器與 Node 共用，不得引用 node: 模組。
// 只支援本 repo 文件用到的寫法：標題、段落、有序與無序清單（可巢狀）、表格、程式碼區塊，
// 行內的程式碼、粗體與連結。輸出是純資料的區塊樹，由頁面轉成 DOM（不用 innerHTML）。

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^(\s*)([-*]|(\d+)\.)\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text) {
  const inlines = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) inlines.push({ type: 'text', text: text.slice(last, match.index) });
    const [, code, strong, linkText, href] = match;
    if (code !== undefined) inlines.push({ type: 'code', text: code });
    else if (strong !== undefined) inlines.push({ type: 'strong', text: strong });
    else inlines.push({ type: 'link', text: linkText, href });
    last = match.index + match[0].length;
  }
  if (last < text.length) inlines.push({ type: 'text', text: text.slice(last) });
  return inlines;
}

// 表格的一列切成儲存格；行內程式碼裡的 | 不切。
function tableCells(line) {
  const cells = [];
  let cell = '';
  let inCode = false;
  for (const char of line.trim().replace(/^\|/, '').replace(/\|$/, '')) {
    if (char === '`') inCode = !inCode;
    if (char === '|' && !inCode) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((c) => parseInline(c.trim()));
}

const indentOf = (line) => line.match(/^\s*/)[0].length;
const isBlank = (line) => line.trim() === '';

function startsBlock(lines, i) {
  const line = lines[i];
  return FENCE.test(line) || HEADING.test(line) || LIST_ITEM.test(line)
    || (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[i + 1] ?? ''));
}

// 從 lines[i] 開始解析一個清單，回傳 [清單區塊, 下一個未處理的行號]。
function parseList(lines, i) {
  const [, indentText, marker, number] = lines[i].match(LIST_ITEM);
  const indent = indentText.length;
  const ordered = number !== undefined;
  const list = { type: 'list', ordered, start: ordered ? Number(number) : 1, items: [] };
  let item = null;
  let text = '';
  const finishItem = () => {
    if (item) item.inlines = parseInline(text);
  };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      // 空行後接著同一層或更深的清單項目時，清單繼續。
      const next = lines.slice(i + 1).findIndex((l) => !isBlank(l));
      const nextLine = next === -1 ? null : lines[i + 1 + next];
      if (nextLine && LIST_ITEM.test(nextLine) && indentOf(nextLine) >= indent) {
        i += 1 + next;
        continue;
      }
      break;
    }
    const match = line.match(LIST_ITEM);
    if (match && match[1].length === indent && (match[3] !== undefined) === ordered) {
      finishItem();
      item = { inlines: [], children: [] };
      list.items.push(item);
      text = match[4];
      i += 1;
    } else if (match && match[1].length > indent && item) {
      const [child, next] = parseList(lines, i);
      item.children.push(child);
      i = next;
    } else if (!match && item && indentOf(line) > indent) {
      text += `\n${line.trim()}`;
      i += 1;
    } else {
      break;
    }
  }
  finishItem();
  return [list, i];
}

export function parseMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
    } else if (FENCE.test(line)) {
      const end = lines.findIndex((l, j) => j > i && FENCE.test(l));
      const stop = end === -1 ? lines.length : end;
      blocks.push({ type: 'code', text: lines.slice(i + 1, stop).join('\n') });
      i = stop + 1;
    } else if (HEADING.test(line)) {
      const [, hashes, text] = line.match(HEADING);
      blocks.push({ type: 'heading', level: hashes.length, inlines: parseInline(text.trim()) });
      i += 1;
    } else if (LIST_ITEM.test(line)) {
      const [list, next] = parseList(lines, i);
      blocks.push(list);
      i = next;
    } else if (TABLE_ROW.test(line) && TABLE_SEPARATOR.test(lines[i + 1] ?? '')) {
      const header = tableCells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(tableCells(lines[i++]));
      blocks.push({ type: 'table', header, rows });
    } else {
      const paragraph = [line.trim()];
      i += 1;
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) paragraph.push(lines[i++].trim());
      blocks.push({ type: 'paragraph', inlines: parseInline(paragraph.join('\n')) });
    }
  }
  return blocks;
}

// 區塊樹的全部文字，依出現順序以換行連接。供測試確認呈現時不漏字。
export function plainText(blocks) {
  const inlineText = (inlines) => inlines.map((n) => n.text).join('');
  return blocks.map((block) => {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        return inlineText(block.inlines);
      case 'code':
        return block.text;
      case 'table':
        return [block.header, ...block.rows].map((row) => row.map(inlineText).join(' ')).join('\n');
      case 'list':
        return block.items.map((item) => [inlineText(item.inlines), plainText(item.children)].join('\n')).join('\n');
      default:
        return '';
    }
  }).join('\n');
}
