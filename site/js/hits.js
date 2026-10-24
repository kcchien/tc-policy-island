// 統計：頁面瀏覽與出處點擊各送一筆到統計端點（ADR 0003）。Node 可測，送出與否的判斷與送出內容都是純函式。
// 只送 { kind, id, view }：種類、出處識別碼（頁面瀏覽為 null）、當時的檢視。瀏覽器開啟「不要追蹤」或全域隱私控制時完全不送。
// 用 navigator.sendBeacon，失敗就放棄；點擊統計只旁聽，不攔截、不改連結，連結照常開啟。

export const HIT_URL = '/api/hit';

export const trackingAllowed = (nav) => nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;

export const pageviewHit = (view) => ({ kind: 'pageview', id: null, view });

// 送出成功排入佇列時回傳 true；不要追蹤、不支援或失敗時回傳 false，不丟錯誤。
export function sendHit(nav, hit) {
  if (!trackingAllowed(nav) || typeof nav.sendBeacon !== 'function') return false;
  try {
    return nav.sendBeacon(HIT_URL, JSON.stringify(hit)) === true;
  } catch {
    return false;
  }
}

// 原文存檔網址 → 出處識別碼。每個出處都有自己的原文存檔，網址不重複；出處網址與網頁備份可能共用，不拿來對照。
export function sourceIdsBySnapshot(vm) {
  const sources = [
    ...vm.rows.flatMap((row) => row.cells.flatMap((cell) => cell.policies.flatMap((p) => p.quotes.map((q) => q.source)))),
    ...vm.candidates.map((c) => c.profileSource).filter(Boolean),
  ];
  return new Map(sources.map((s) => [s.snapshotUrl, s.id]));
}

// 同一組出處連結（出處、原文存檔、網頁備份）的網址 → 出處點擊的資料；找不到出處時回傳 null。
export function sourceHitFromLinks(hrefs, bySnapshot, view) {
  const id = hrefs.map((href) => bySnapshot.get(href)).find(Boolean);
  return id ? { kind: 'source', id, view } : null;
}

// 在 root 上用事件委派旁聽出處連結（政見卡片與候選人資料卡的 .source-links）的點擊與中鍵點擊。
// view() 回傳點擊當下的檢視。
export function trackSourceClicks(root, { bySnapshot, view, nav = navigator }) {
  const onClick = (event) => {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const group = event.target.closest?.('.source-links');
    if (!group || !event.target.closest('a')) return;
    const hrefs = [...group.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const hit = sourceHitFromLinks(hrefs, bySnapshot, view());
    if (hit) sendHit(nav, hit);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('auxclick', onClick);
}
