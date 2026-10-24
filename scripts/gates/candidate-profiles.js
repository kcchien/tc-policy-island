// 上線關卡：公開的候選人資料欄位固定、三人一致，並通過逐字比對。

import { dirname } from 'node:path';
import { SNAPSHOT_DIR, snapshotFileName } from '../../site/js/view-model.js';
import { checkProfileLayer1 } from '../lib/verification.js';
import { DATASET_PATH } from './site.js';

// 候選人資料固定的欄位（姓名與政黨是候選人本身的欄位）。見 ADR 0001。
export const PROFILE_FIELDS = {
  birthYear: '出生年',
  education: '學歷',
  experience: '經歷',
  sourceId: '出處識別碼',
  electionYear: '選舉年份',
  electionName: '選舉別',
  verification: '核對紀錄',
};

const isEmpty = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

function fieldFailures(candidates) {
  const failures = [];
  for (const c of candidates) {
    for (const [field, label] of Object.entries(PROFILE_FIELDS)) {
      if (isEmpty(c.profile[field])) failures.push(`候選人 ${c.id} 的候選人資料缺少${label}（${field}）`);
    }
    if (c.profile.verification?.layer1?.status !== 'pass') failures.push(`候選人 ${c.id} 的候選人資料未通過逐字比對`);
  }
  const keysOf = (c) => Object.keys(c.profile).sort();
  const all = [...new Set(candidates.flatMap(keysOf))];
  for (const c of candidates) {
    const extra = keysOf(c).filter((key) => !Object.hasOwn(PROFILE_FIELDS, key));
    const missing = all.filter((key) => !keysOf(c).includes(key));
    if (extra.length > 0) failures.push(`三位候選人的候選人資料欄位不同：${c.id} 多了 ${extra.join('、')}`);
    if (missing.length > 0) failures.push(`三位候選人的候選人資料欄位不同：${c.id} 少了 ${missing.join('、')}`);
  }
  return failures;
}

// 候選人資料只用中選會來源（ADR 0001）：出處須是選舉公報，網址在中選會網站。
const isCecHost = (host) => host === 'cec.gov.tw' || host.endsWith('.cec.gov.tw');

// 出處須來自中選會；讀網站目錄裡的出處快照（建置時複製的副本），學歷與經歷須逐字出現在其中。
function sourceFailures(site, candidates, sourcesById) {
  const failures = [];
  for (const c of candidates) {
    const source = sourcesById.get(c.profile.sourceId);
    if (!source) {
      failures.push(`候選人 ${c.id}：候選人資料的出處 ${c.profile.sourceId} 不在公開資料集`);
      continue;
    }
    if (source.sourceType !== 'election-bulletin') {
      failures.push(`候選人 ${c.id}：候選人資料的出處 ${source.id} 不是選舉公報（來源類型 ${source.sourceType}）`);
    }
    const host = URL.canParse(source.url) ? new URL(source.url).hostname : source.url;
    if (!isCecHost(host)) failures.push(`候選人 ${c.id}：候選人資料的出處 ${source.id} 不是中選會網站（${host}）`);
    const path = `${dirname(DATASET_PATH)}/${SNAPSHOT_DIR}/${snapshotFileName(source)}`;
    if (!site.files().includes(path)) {
      failures.push(`候選人 ${c.id}：出處 ${source.id} 的出處快照 ${path} 不在網站目錄`);
      continue;
    }
    const snapshots = new Map([[source.id, site.readText(path)]]);
    for (const problem of checkProfileLayer1(c.profile, snapshots).problems) failures.push(`候選人 ${c.id}：${problem}`);
  }
  return failures;
}

export default {
  id: 'candidate-profiles',
  name: '候選人資料欄位齊全且三人相同，出自中選會選舉公報，學歷與經歷逐字出自出處快照',
  check(site) {
    const dataset = site.dataset();
    const missing = dataset.candidates.filter((c) => !c.profile);
    const failures = missing.map((c) => `候選人 ${c.id} 沒有公開的候選人資料（尚未收錄或未通過逐字比對）`);
    const withProfile = dataset.candidates.filter((c) => c.profile);
    const sourcesById = new Map(dataset.sources.map((s) => [s.id, s]));
    const complete = withProfile.filter((c) => Array.isArray(c.profile.education) && Array.isArray(c.profile.experience));
    return [...failures, ...fieldFailures(withProfile), ...sourceFailures(site, complete, sourcesById)];
  },
};
