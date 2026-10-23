// 整理方法頁由資料產生的內容。瀏覽器與 Node 共用，不得引用 node: 模組。
import { CANDIDATE_ORDER_RULES } from './dataset.js';
import { repoDocumentByPath, repoFileUrl } from './repo-documents.js';

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
  .map((c) => `${c.name}（${c.party}）：${c.dataStatus}`);

export const candidateOrderItems = (candidateOrder) => Object.entries(CANDIDATE_ORDER_RULES)
  .map(([id, rule]) => ({ text: rule.note, current: id === candidateOrder }));
