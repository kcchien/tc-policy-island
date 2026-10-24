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

export const profileVerification = (status = 'pass') => ({
  layer1: { status, checkedAt: status === 'pending' ? null : '2026-10-24' },
});

// 候選人資料的出處識別碼是 profile-src-<candidateId>，學歷與經歷寫在 profileSnapshot 產生的快照裡。
export const profile = (candidateId, verification = profileVerification()) => ({
  birthYear: 1970,
  education: [`${candidateId} 測試大學學士`],
  experience: [`${candidateId} 測試協會理事長`, `${candidateId} 測試里里長`],
  sourceId: `profile-src-${candidateId}`,
  electionYear: 2024,
  electionName: '第11屆立法委員選舉（測試選舉區）',
  verification,
});

// 與 profile() 相符的出處快照文字：學歷與經歷分行、帶項目符號，照公報版面。
export const profileSnapshot = (candidateId) => [
  '學歷',
  `•${candidateId} 測試大學學士`,
  '經歷',
  `•${candidateId} 測試協會理事長`,
  `•${candidateId} 測試里`,
  '里長',
  '',
].join('\n');

export const candidate = (id, name, nameStrokes, ballotNumber = null) => ({
  id,
  name,
  party: `${name}所屬政黨`,
  ballotNumber,
  nameStrokes,
  rawPolicyItems: { total: null, sourceIds: [] },
  dataStatus: null,
  profile: profile(id),
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

export const localElement = (id, category = '自然景觀') => ({
  id,
  name: `元素${id}`,
  category,
  place: '測試地點',
  reason: '測試用元素，與任何市長任期的政績無關',
});

// 合法的最小原始資料。各測試在複本上改出要驗證的情境。
// 候選人刻意不依筆畫順序列出，排序測試才有意義。
export function makeRaw() {
  return {
    meta: { dataCutoffDate: '2026-10-23', checklistVersion: '1', electionSchedule: null },
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
    localElements: [],
    decorativeTiles: [],
    sources: ['cand-a', 'cand-b', 'cand-c'].flatMap((candidateId) => [
      {
        id: `src-${candidateId}`,
        candidateId,
        url: `https://example.org/${candidateId}`,
        archiveUrl: null,
        archiveError: '測試夾具未存檔',
        snapshotPath: `data/snapshots/src-${candidateId}.txt`,
        snapshotSha256: 'a'.repeat(64),
        snapshotNote: null,
        sourceType: 'official-website',
        title: '測試出處',
        retrievedAt: '2026-10-23',
      },
      {
        id: `profile-src-${candidateId}`,
        candidateId,
        url: `https://bulletin.cec.gov.tw/test-fixture/${candidateId}.pdf`,
        archiveUrl: null,
        archiveError: '測試夾具未存檔',
        snapshotPath: `data/snapshots/profile-src-${candidateId}.txt`,
        snapshotSha256: 'b'.repeat(64),
        snapshotNote: 'PDF 第 1 頁以 pdftotext 轉成文字',
        sourceType: 'election-bulletin',
        title: '測試選舉公報',
        retrievedAt: '2026-10-23',
      },
    ]),
    policies: [policy('p-a1', 'cand-a'), policy('p-b1', 'cand-b')],
  };
}
