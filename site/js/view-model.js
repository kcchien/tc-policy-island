// 檢視模型：公開資料集 → 議題區 × 候選人矩陣。島嶼檢視與表格檢視都只讀這個矩陣。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

import { CANDIDATE_ORDER_RULES, SOURCE_TYPES } from './dataset.js';

export const NO_POLICY_LABEL = '未提出相關政見';

// 出處快照在網站上的目錄。建置指令把公開出處的快照複製到 site/data/snapshots/。
export const SNAPSHOT_URL_DIR = './data/snapshots/';

function sourceView(source) {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    archiveUrl: source.archiveUrl,
    snapshotUrl: SNAPSHOT_URL_DIR + source.snapshotPath.split('/').pop(),
    sourceType: source.sourceType,
    sourceTypeName: SOURCE_TYPES[source.sourceType],
    retrievedAt: source.retrievedAt,
  };
}

export function buildViewModel(dataset) {
  const sources = new Map(dataset.sources.map((s) => [s.id, sourceView(s)]));
  const policyView = (policy) => ({
    ...policy,
    quotes: policy.quotes.map((quote) => ({ ...quote, source: sources.get(quote.sourceId) })),
  });
  const rows = dataset.issueAreas.map((issueArea) => ({
    issueArea,
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
  }));
  return {
    meta: dataset.meta,
    noPolicyText: `${NO_POLICY_LABEL}（截至 ${dataset.meta.dataCutoffDate}）`,
    candidateOrderNote: CANDIDATE_ORDER_RULES[dataset.meta.candidateOrder].note,
    candidates,
    rows,
  };
}
