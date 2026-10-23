// 檢視模型：公開資料集 → 議題區 × 候選人矩陣。島嶼檢視與表格檢視都只讀這個矩陣。
// 瀏覽器與 Node 共用，不得引用 node: 模組。

export const NO_POLICY_LABEL = '未提出相關政見';

const CANDIDATE_ORDER_NOTES = {
  'name-strokes': '候選人排列依姓名筆畫由少到多（號次抽籤前）',
  'ballot-number': '候選人排列依選委會抽籤號次',
};

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
    candidateOrderNote: CANDIDATE_ORDER_NOTES[dataset.meta.candidateOrder],
    candidates,
    rows,
  };
}
