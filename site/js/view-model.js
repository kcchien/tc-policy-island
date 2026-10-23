// 檢視模型：公開資料集 → 議題區 × 候選人矩陣。島嶼檢視與表格檢視都只讀這個矩陣。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

import { CANDIDATE_ORDER_RULES, SOURCE_TYPES } from './dataset.js';
import { noPolicyText } from './ui-text.js';

// 出處快照放在公開資料集（site/data/dataset.json）旁的 snapshots/，檔名沿用原快照檔名。
// 建置指令依此複製檔案，卡片依此產生連結。
export const SNAPSHOT_DIR = 'snapshots';
export const snapshotFileName = (source) => source.snapshotPath.split('/').pop();

function sourceView(source) {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    archiveUrl: source.archiveUrl,
    snapshotUrl: `./data/${SNAPSHOT_DIR}/${snapshotFileName(source)}`,
    sourceType: source.sourceType,
    sourceTypeName: SOURCE_TYPES[source.sourceType],
    retrievedAt: source.retrievedAt,
    snapshotNote: source.snapshotNote,
  };
}

// 議題區編號：依議題區清單的資料順序（分類規則的順序）從 01 起算，與政見數量和候選人無關。
// 篩選只移除列、不重編，島上名牌與索引用同一個編號。
export const areaNumber = (index) => String(index + 1).padStart(2, '0');

export function buildViewModel(dataset) {
  const sources = new Map(dataset.sources.map((s) => [s.id, sourceView(s)]));
  const policyView = (policy) => ({
    ...policy,
    quotes: policy.quotes.map((quote) => ({ ...quote, source: sources.get(quote.sourceId) })),
  });
  const elements = new Map(dataset.localElements.map((e) => [e.id, e]));
  const elementOf = (tile) => elements.get(tile.localElementId) ?? null;
  const rows = dataset.issueAreas.map((issueArea, index) => ({
    issueArea,
    number: areaNumber(index),
    localElement: elementOf(issueArea),
    cells: dataset.candidates.map((candidate) => {
      const policies = dataset.policies
        .filter((p) => p.issueAreaId === issueArea.id && p.candidateId === candidate.id)
        .map(policyView);
      return {
        candidateId: candidate.id,
        status: policies.length > 0 ? 'has-policies' : 'no-policies',
        policies,
      };
    }),
  }));
  const candidates = dataset.candidates.map((candidate) => ({
    ...candidate,
    policyCount: dataset.policies.filter((p) => p.candidateId === candidate.id).length,
    // 候選人資料卡用的出處；公開資料集的 profile 為 null（尚未收錄或未通過逐字比對）時也為 null。
    profileSource: candidate.profile ? sources.get(candidate.profile.sourceId) : null,
  }));
  return {
    meta: dataset.meta,
    noPolicyText: noPolicyText(dataset.meta.dataCutoffDate),
    candidateOrderNote: CANDIDATE_ORDER_RULES[dataset.meta.candidateOrder].note,
    candidates,
    rows,
    // 島上沒有議題區的格子，只有島嶼檢視使用。
    decorativeTiles: dataset.decorativeTiles.map((tile) => ({ ...tile, localElement: elementOf(tile) })),
  };
}
