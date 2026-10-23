// 測試用原始資料產生器。候選人為虛構的「候選人甲乙丙」，不得換成真實候選人。

export const passedVerification = () => ({
  layer1: { status: 'pass', checkedAt: '2026-10-24' },
  layer2: {
    status: 'pass',
    reason: '摘要忠於原文',
    checklistVersion: '1',
    model: 'test-model',
    checkedAt: '2026-10-24',
  },
});

export const pendingVerification = () => ({
  layer1: { status: 'pending', checkedAt: null },
  layer2: { status: 'pending', reason: null, checklistVersion: null, model: null, checkedAt: null },
});

export const candidate = (id, name, nameStrokes, ballotNumber = null) => ({
  id,
  name,
  party: `${name}所屬政黨`,
  ballotNumber,
  nameStrokes,
  rawPolicyItems: { total: null, sourceIds: [] },
  dataStatus: null,
});

export const policy = (id, candidateId, verification = passedVerification(), issueAreaId = 'area-a') => ({
  id,
  candidateId,
  issueAreaId,
  summary: `${id} 的摘要`,
  quotes: [{ text: `${id} 的原文`, sourceId: `src-${candidateId}` }],
  districts: [],
  conflictNote: null,
  verification,
});

// 合法的最小原始資料。各測試在複本上改出要驗證的情境。
// 候選人刻意不依筆畫順序列出，排序測試才有意義。
export function makeRaw() {
  return {
    meta: { dataCutoffDate: '2026-10-23', checklistVersion: '1' },
    candidates: [
      candidate('cand-b', '候選人乙', 7),
      candidate('cand-c', '候選人丙', 9),
      candidate('cand-a', '候選人甲', 6),
    ],
    issueAreas: [
      {
        id: 'area-a',
        name: '議題區一',
        departments: ['交通局'],
        description: '測試用議題區',
        axial: [0, 0],
        localElementId: null,
      },
      {
        id: 'area-b',
        name: '議題區二',
        departments: ['社會局'],
        description: '測試用議題區',
        axial: [1, 0],
        localElementId: null,
      },
    ],
    sources: ['cand-a', 'cand-b', 'cand-c'].map((candidateId) => ({
      id: `src-${candidateId}`,
      candidateId,
      url: `https://example.org/${candidateId}`,
      archiveUrl: null,
      archiveError: '測試夾具未存檔',
      snapshotPath: `data/snapshots/src-${candidateId}.txt`,
      snapshotSha256: 'a'.repeat(64),
      sourceType: 'official-website',
      title: '測試出處',
      retrievedAt: '2026-10-23',
    })),
    policies: [policy('p-a1', 'cand-a'), policy('p-b1', 'cand-b')],
  };
}
