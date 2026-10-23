// 檢視模型：公開資料集 → 議題區 × 候選人矩陣。島嶼檢視與表格檢視都只讀這個矩陣。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

import { CANDIDATE_ORDER_RULES } from './dataset.js';

export const NO_POLICY_LABEL = '未提出相關政見';

export function buildViewModel(dataset) {
  const rows = dataset.issueAreas.map((issueArea) => ({
    issueArea,
    cells: dataset.candidates.map((candidate) => {
      const policies = dataset.policies.filter(
        (p) => p.issueAreaId === issueArea.id && p.candidateId === candidate.id,
      );
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
