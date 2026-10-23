// 整理方法頁由資料產生的內容。瀏覽器與 Node 共用，不得引用 node: 模組。
import { CANDIDATE_ORDER_RULES } from './dataset.js';
import { repoDocumentByPath, repoFileUrl } from './repo-documents.js';
import { METHOD_TEXT } from './ui-text.js';

// repo 文件內的相對連結：方法頁有收錄的文件連到頁內容器，其餘連到 GitHub 上的原檔。
export function resolveDocLink(fromPath, href) {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return href;
  const [target, hash] = href.split('#');
  const parts = fromPath.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  const path = parts.join('/');
  const doc = repoDocumentByPath(path);
  if (doc) return `#doc-${doc.id}`;
  return repoFileUrl(path) + (hash ? `#${hash}` : '');
}

export const dataStatusItems = (candidates) => candidates
  .filter((c) => c.dataStatus !== null)
  .map((c) => METHOD_TEXT.dataStatus(c.name, c.dataStatus));

// 檢核表與品牌用語清單（JSON）排成清單與表格時的內容。欄位值照原檔，不換字、不省略。
export const checklistView = ({ version, items }) => ({
  version,
  items: items.map(({ id, title, rule }) => ({ id, title, rule })),
});

export const brandTermsView = (list) => ({
  version: list.version,
  tiers: Object.entries(METHOD_TEXT.brandTermTiers).map(([tier, label]) => ({
    tier,
    label,
    rows: list[tier].map(({ term, candidate, note }) => [term, candidate, note ?? '']),
  })),
});

export const candidateOrderItems = (candidateOrder) => Object.entries(CANDIDATE_ORDER_RULES)
  .map(([id, rule]) => ({ text: rule.note, current: id === candidateOrder }));
