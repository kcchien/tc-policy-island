// 我的對照單的純函式（Node 可測）：讀者勾選的政見（只存在讀者的瀏覽器 PICKS_KEY 與讀者自己分享的網址 pick 參數）、
// 對照單要列出的議題區列。勾選只決定「哪些議題區」出現，不決定「哪位候選人」出現：每列三欄都帶、沒有政見的欄位照常保留，
// 只標出被勾的政見（ADR 0001）。網址參數的讀寫在 app-state.js。

export const PICKS_KEY = 'policy-island:picks';

export const serializePicks = (picks) => JSON.stringify([...picks]);

// 解析 localStorage 讀到的文字；不是文字陣列時回空集合，陣列裡不是文字的項目略過。
export function parsePicks(text) {
  try {
    const value = JSON.parse(text);
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

// 只留下檢視模型裡存在的政見識別碼（網址或舊紀錄裡的壞值、已下架的政見都略過）。
export function knownPicks(vm, ids) {
  const known = new Set(vm.rows.flatMap((row) => row.cells.flatMap((cell) => cell.policies.map((p) => p.id))));
  return new Set([...ids].filter((id) => known.has(id)));
}

// 回傳有勾選政見的議題區列（依議題區編號），每列三欄都帶，政見附 picked 標記。
export function shortlistRows(vm, picks) {
  return vm.rows
    .filter((row) => row.cells.some((cell) => cell.policies.some((p) => picks.has(p.id))))
    .map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({ ...cell, policies: cell.policies.map((p) => ({ ...p, picked: picks.has(p.id) })) })),
    }));
}
