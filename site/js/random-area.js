// 隨機一題的選取：從檢視模型的全部議題區均勻隨機選一個，回傳議題區識別碼。
// 只以議題區為單位，不依政見數量加權、不排除沒有政見的議題區（ADR 0001）；呼叫端傳未篩選的 rows，
// 不受關鍵字與行政區篩選影響。連續兩次不選同一個（只有一個議題區時例外）。隨機函式可注入以便測試。Node 可測。

// random 回傳 [0, 1)；previousId 是上一次選中的議題區，從候選中排除。
export function pickRandomArea(rows, random = Math.random, previousId = null) {
  const ids = rows.map((row) => row.issueArea.id);
  const pool = ids.length > 1 ? ids.filter((id) => id !== previousId) : ids;
  return pool[Math.floor(random() * pool.length)];
}
