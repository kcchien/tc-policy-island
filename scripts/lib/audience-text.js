// 受眾文案檢查：整理者撰寫、給市民看的文字不得外漏內部實作細節（檔案路徑、副檔名、工具名、字型名、模型代號、
// 程式欄位名、內部版本識別碼、雜湊值、內部流程術語）。上線關卡「受眾文案」與測試共用。
// 只檢查整理者撰寫的文字；原文引述、候選人資料原文、引用 repo 文件與資料下載檔由呼叫端排除。

// 網址本身不是畫面文字（連結文字另外檢查），先移除，避免網址的路徑被當成檔案路徑。
const URL_PATTERN = /\b(?:https?|mailto):\S+/g;

// 依序檢查，同一段文字只報第一個符合的類別，例如 claude-opus-5-5 報模型代號，不再報工具名。
export const INTERNAL_DETAIL_RULES = [
  { kind: '模型代號', pattern: /\b(?:claude|gpt|gemini|llama|opus|sonnet|haiku|fable)-[\w.-]+/gi },
  // 路徑要有小寫英文字母，TCP/IP、日期 2026/10/23 這類不算。
  { kind: '檔案路徑', pattern: /(?:\.{1,2}\/)?[\w.-]+(?:\/[\w.-]+)+\/?/g, test: /[a-z]/ },
  { kind: '副檔名', pattern: /\.(?:json|md|js|mjs|html?|css|txt|pdf|csv|png|jpe?g|svg|ya?ml|sh|ts)\b/gi },
  // 指令名稱照指令的小寫寫法比對，Node 創客、Git 社群這類大寫開頭的一般用語不算。
  { kind: '工具名', pattern: /\b(?:pdftotext|pdftoppm|poppler|wrangler|claude|npm|npx|node|git|three\.js)\b|\bClaude\b/g },
  {
    kind: '字型名',
    pattern: /\b(?:Noto|Source ?Han|PingFang|Heiti|MingLiU|PMingLiU|DFKai|SimSun|Arial|Helvetica)[\w-]*|\b[A-Z][A-Za-z]+-(?:Light|ExtraLight|Regular|Medium|SemiBold|Bold|Heavy|Black|Thin)\b/g,
  },
  // camelCase 至少兩個小寫字母開頭，iBike、iPhone 這類單一字母開頭的服務與產品名稱不算。
  { kind: '程式欄位名', pattern: /\b[a-z]{2,}[a-z0-9]*(?:[A-Z][a-z0-9]*)+\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g },
  // 雜湊值同時有數字與 a–f 字母，純數字（計畫編號、電話）不算。
  { kind: '雜湊值', pattern: /\b[0-9a-f]{12,}\b/g, test: /(?=.*\d)(?=.*[a-f])/ },
  { kind: '內部版本識別碼', pattern: /版本\s*v?\d[\w.-]*/g },
  {
    kind: '內部流程術語',
    pattern: /\b(?:repo|session|commit|deploy|fixture|schema|snapshot|glyph)s?\b|出處快照|存檔網址|字型對照|對照檔|上線關卡/gi,
  },
];

// 回傳 [{ kind, text }]；沒有內部細節時為空陣列。
export function internalDetails(text) {
  const hits = [];
  const taken = [];
  const rest = text.replace(URL_PATTERN, (url) => ' '.repeat(url.length));
  for (const { kind, pattern, test } of INTERNAL_DETAIL_RULES) {
    for (const match of rest.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (test && !test.test(match[0])) continue;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      hits.push({ kind, text: match[0] });
    }
  }
  return hits;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (text) => text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, name) => {
  if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  return ENTITIES[name.toLowerCase()] ?? all;
});

// 讀者在 HTML 看得到或聽得到的文字：文字節點、<title>、說明用屬性（aria-label、title、placeholder、alt）、
// 按鈕的 value，以及 meta 的說明與社群分享標題（description、og:、twitter:）。
// 不含 <script>、<style>、註解；連結網址等其他屬性不是畫面文字。
const SHOWN_META = /\b(?:name|property)\s*=\s*["'](?:description|(?:og|twitter):(?:title|description))["']/i;
const BUTTON_INPUT = /^input\b[^>]*\btype\s*=\s*["']?(?:submit|button|reset)\b|^button\b/i;

export function htmlScreenText(html) {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const pieces = [];
  for (const [, tag] of source.matchAll(/<([a-z][^>]*)>/gi)) {
    for (const [, name, , value] of tag.matchAll(/\s(aria-label|title|placeholder|alt|content|value)\s*=\s*(["'])(.*?)\2/gi)) {
      const attr = name.toLowerCase();
      if (attr === 'content' && !SHOWN_META.test(tag)) continue;
      if (attr === 'value' && !BUTTON_INPUT.test(tag)) continue;
      pieces.push(decode(value));
    }
  }
  pieces.push(...decode(source.replace(/<[^>]*>/g, '\n')).split('\n'));
  return pieces.map((piece) => piece.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// 程式碼中引號或反引號包住的字串，略過 // 與 /* */ 註解（註解裡的引號不會吃掉後面的字串）。
// 樣板字串的 ${…} 是程式運算式，不是文案，換成空白；不支援 ${…} 裡再寫樣板字串。
export function stringLiterals(code) {
  const literals = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') {
      i = code.indexOf('\n', i);
      if (i === -1) break;
    } else if (c === '/' && code[i + 1] === '*') {
      i = code.indexOf('*/', i + 2);
      if (i === -1) break;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let text = '';
      while (j < code.length && code[j] !== c) {
        if (code[j] === '\\') {
          text += code.slice(j, j + 2);
          j += 2;
        } else if (c === '`' && code[j] === '$' && code[j + 1] === '{') {
          j = code.indexOf('}', j);
          if (j === -1) j = code.length;
          else j += 1;
          text += ' ';
        } else {
          text += code[j];
          j += 1;
        }
      }
      literals.push(text);
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return literals;
}
