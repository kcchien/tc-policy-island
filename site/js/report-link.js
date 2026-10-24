// 市民補件的回報網址（Node 可測）：政見卡片的空欄位連到本 repo 的 GitHub Issue 回報範本，
// 預填議題區與候選人姓名，並標上待分類。只收一手來源連結，範本內容見 .github/ISSUE_TEMPLATE/。
// 標題句型取自 ui-text.js；三位候選人同一句型。

import { REPO_URL } from './repo-documents.js';
import { POLICY_CARD_TEXT } from './ui-text.js';

export const SOURCE_REPORT_TEMPLATE = 'source-report.yml';

// 參數名 area、candidate 對應範本欄位的 id，GitHub 依此預填。
export function sourceReportHref({ areaName, candidateName }) {
  const params = new URLSearchParams({
    template: SOURCE_REPORT_TEMPLATE,
    labels: 'needs-triage',
    title: POLICY_CARD_TEXT.reportTitle(areaName, candidateName),
    area: areaName,
    candidate: candidateName,
  });
  return `${REPO_URL}/issues/new?${params}`;
}
