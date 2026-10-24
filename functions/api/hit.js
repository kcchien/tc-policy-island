// 統計端點（POST /api/hit）：頁面瀏覽與出處點擊各記一筆，寫進統計資料集綁定 env.HITS。
// 本站唯一的後端程式（ADR 0003）。只收 { kind, id, view } 三個欄位，格式不合回 400、不是 POST 回 405。
// 不讀請求標頭與連線資訊（IP、裝置、來源網址、cookie），不設回應 cookie，資料點只有這三個欄位。
// 以 Node 直接 import 測試（test/hit-endpoint.test.js），只用 Request 與 Response。

const KINDS = new Set(['pageview', 'source']);
const VIEWS = new Set(['island', 'table', 'method']);
const SOURCE_ID = /^[A-Za-z0-9_-]{1,80}$/;
// 合格的內容不到 150 字元，超過就不解析（內容已讀進來，這裡只擋解析與寫入）。
const MAX_BODY = 512;

const respond = (status, headers = {}) => new Response(null, { status, headers: { 'cache-control': 'no-store', ...headers } });

// 合格時回傳 { kind, id, view }，不合格回傳 null。
function parseHit(text) {
  if (text.length > MAX_BODY) return null;
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body).sort().join(',');
  if (keys !== 'id,kind,view') return null;
  const { kind, id, view } = body;
  if (!KINDS.has(kind) || !VIEWS.has(view)) return null;
  if (kind === 'pageview' ? id !== null : typeof id !== 'string' || !SOURCE_ID.test(id)) return null;
  return { kind, id, view };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return respond(405, { allow: 'POST' });
  const hit = parseHit(await request.text());
  if (!hit) return respond(400);
  env.HITS.writeDataPoint({ blobs: [hit.kind, hit.id ?? '', hit.view], doubles: [1], indexes: [hit.kind] });
  return respond(204);
}
