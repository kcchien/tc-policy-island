// 出處擷取：抓取出處頁面 → 出處快照文字 → 送網頁存檔服務 → 出處紀錄。見 data/extraction/instructions.md「出處」。

// 內容不是可見文字的元素，連同內容整段移除。
const INVISIBLE_ELEMENTS = ['head', 'script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas'];

// 區塊元素前後斷行，其餘標籤（span、a、b 等行內元素）直接移除、不斷行。
const BLOCK_ELEMENTS = [
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre',
  'section', 'summary', 'table', 'td', 'th', 'tr', 'ul', 'button', 'option',
];

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', hellip: '…', mdash: '—', ndash: '–', middot: '·', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', times: '×', copy: '©', reg: '®', yen: '¥' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

// 頁面 HTML → 出處快照文字：只留可見文字，不改寫。一個區塊一行，行內連續空白併成一個，去掉空行。
export function htmlToSnapshotText(html) {
  let text = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const name of INVISIBLE_ELEMENTS) {
    text = text.replace(new RegExp(`<${name}\\b[\\s\\S]*?</${name}\\s*>`, 'gi'), '');
  }
  const block = new RegExp(`</?(?:${BLOCK_ELEMENTS.join('|')})\\b[^>]*>`, 'gi');
  text = text.replace(block, '\n').replace(/<[^>]*>/g, '');
  const lines = decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[\s ]+/g, ' ').trim())
    .filter((line) => line !== '');
  return `${lines.join('\n')}\n`;
}

// 頁面 <title> 的文字；沒有標題時為 null。
export function pageTitle(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1];
  if (title === undefined) return null;
  return decodeEntities(title).replace(/\s+/g, ' ').trim() || null;
}

const WAYBACK_SAVE = 'https://web.archive.org/save/';
const WAYBACK_SNAPSHOT = /^https:\/\/web\.archive\.org\/web\/\d{14}\//;
const ARCHIVE_TIMEOUT_MS = 3 * 60 * 1000;

// 送 Wayback Machine 存檔。成功時存檔服務會轉址到 /web/<時間戳>/<原網址>，那就是存檔網址。
// 失敗不擲錯，回傳失敗原因，出處快照照常保留。fetch 可注入，供測試使用。
export async function requestArchive(url, { fetch = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetch(`${WAYBACK_SAVE}${url}`, { redirect: 'follow', signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS) });
  } catch (error) {
    // fetch 的錯誤訊息只有「fetch failed」，底層原因在 cause。
    const cause = error.cause?.code ?? error.cause?.message;
    return { archiveUrl: null, archiveError: `Wayback Machine 連線失敗：${error.message}${cause ? `（${cause}）` : ''}` };
  }
  if (!response.ok) return { archiveUrl: null, archiveError: `Wayback Machine 回應 HTTP ${response.status}` };
  const location = response.headers.get('content-location');
  const candidates = [response.url, location && new URL(location, 'https://web.archive.org').href];
  const archiveUrl = candidates.find((u) => u && WAYBACK_SNAPSHOT.test(u)) ?? null;
  return archiveUrl
    ? { archiveUrl, archiveError: null }
    : { archiveUrl: null, archiveError: 'Wayback Machine 沒有回傳存檔網址' };
}
