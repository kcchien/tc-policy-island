// 頁面狀態與網址參數的對應，以及進站時要用哪一種檢視。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

export const VIEWS = ['island', 'table'];

// 網址參數：view 檢視、area 議題區識別碼、policy 政見識別碼、candidate 候選人識別碼（候選人資料卡）、q 關鍵字、district 適用行政區。
export function parseSearch(search) {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  return {
    view: VIEWS.includes(view) ? view : null,
    area: params.get('area') || null,
    policy: params.get('policy') || null,
    candidate: params.get('candidate') || null,
    query: params.get('q') ?? '',
    district: params.get('district') ?? '',
  };
}

export function formatSearch({ view, area, policy, candidate, query, district }) {
  const params = new URLSearchParams();
  if (view) params.set('view', view);
  if (area) params.set('area', area);
  if (policy) params.set('policy', policy);
  if (candidate) params.set('candidate', candidate);
  if (query) params.set('q', query);
  if (district) params.set('district', district);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

// 不支援 WebGL 時一律用表格檢視；否則依網址，預設島嶼檢視。
export function chooseView({ requested, webgl }) {
  if (!webgl) return 'table';
  return requested ?? 'island';
}
