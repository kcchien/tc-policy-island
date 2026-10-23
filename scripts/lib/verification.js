// 核對（見 ADR 0002）。第一層：原文引述須逐字出現在出處快照中。

// 比對用的正規化：全形半形統一、移除空白與換行、移除標點。
// 夾在兩個數字之間的標點保留（小數點、千分位、日期與時間），避免「1.5」與「15」被視為相同。
export function normalizeForMatch(text) {
  return text
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/\p{P}+/gu, (run, offset, all) => {
      const between = /\d/.test(all[offset - 1] ?? '') && /\d/.test(all[offset + run.length] ?? '');
      return between ? run : '';
    });
}

// snapshots：sourceId → 出處快照文字（快照缺失時為 null）。
// 回傳 { status: 'pass' | 'fail', problems: [說明] }。
export function checkLayer1(policy, snapshots) {
  const problems = [];
  policy.quotes.forEach((quote, index) => {
    const snapshot = snapshots.get(quote.sourceId) ?? null;
    const text = normalizeForMatch(quote.text);
    if (snapshot === null) {
      problems.push(`quotes[${index}] 的出處 ${quote.sourceId} 沒有可用的快照`);
    } else if (text === '') {
      problems.push(`quotes[${index}] 正規化後沒有任何文字`);
    } else if (!normalizeForMatch(snapshot).includes(text)) {
      problems.push(`quotes[${index}] 未逐字出現在出處 ${quote.sourceId} 的快照中`);
    }
  });
  return { status: problems.length === 0 ? 'pass' : 'fail', problems };
}
