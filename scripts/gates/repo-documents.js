// 上線關卡「引用 repo 文件」：整理方法頁照原文公開的檔案要與 repo 檔案逐字相同。

import { readFileSync } from 'node:fs';
import { REPO_DOCUMENTS, repoDocumentByPath, repoFileSitePath } from '../../site/js/repo-documents.js';

// 品牌用語掃描不掃引用 repo 文件，這項關卡確保這個例外只能用來公開 repo 內的原檔：
// 網站目錄 data/repo-files/ 底下每個檔案都要在 REPO_DOCUMENTS 中、與 repo 檔案逐字相同；
// 必要文件都要在；頁面上 data-repo-file 容器只能標註清單中的文件。
const REPO_ROOT = new URL('../../', import.meta.url);
const PREFIX = repoFileSitePath('');
const HTML_FILE = /\.html$/;

function readRepoFile(path) {
  try {
    return readFileSync(new URL(path, REPO_ROOT));
  } catch {
    return null;
  }
}

// 網站目錄中的這個檔案是否為 repo 文件的逐字副本。品牌用語掃描只跳過逐字副本。
export function isVerbatimRepoFile(site, sitePath) {
  if (!sitePath.startsWith(PREFIX)) return false;
  const path = sitePath.slice(PREFIX.length);
  if (!repoDocumentByPath(path)) return false;
  const original = readRepoFile(path);
  return original !== null && original.equals(site.readBytes(sitePath));
}

export default {
  id: 'repo-documents',
  name: '引用 repo 文件與 repo 檔案逐字相同',
  check(site) {
    const failures = [];
    const files = site.files();
    for (const sitePath of files.filter((path) => path.startsWith(PREFIX))) {
      const path = sitePath.slice(PREFIX.length);
      if (!repoDocumentByPath(path)) failures.push(`${sitePath}：不在引用 repo 文件清單中`);
      else if (!isVerbatimRepoFile(site, sitePath)) failures.push(`${sitePath}：與 repo 檔案 ${path} 不一致`);
    }
    const present = new Set(files);
    for (const doc of REPO_DOCUMENTS) {
      if (!doc.optional && !present.has(repoFileSitePath(doc.path))) failures.push(`缺少引用 repo 文件 ${doc.path}`);
    }
    for (const page of files.filter((path) => HTML_FILE.test(path))) {
      for (const [, path] of site.readText(page).matchAll(/data-repo-file="([^"]*)"/g)) {
        if (!repoDocumentByPath(path)) failures.push(`${page}：引用 repo 文件的容器標註 ${path}，不在引用 repo 文件清單中`);
      }
    }
    return failures;
  },
};
