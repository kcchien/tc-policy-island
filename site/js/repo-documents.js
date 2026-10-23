// 引用 repo 文件：整理方法頁照原文公開的規則文件與清單。瀏覽器與 Node 共用，不得引用 node: 模組。
// 建置指令把每份文件逐字複製到網站目錄的 data/repo-files/<repo 路徑>，頁面在標了 data-repo-file 的容器裡呈現。
// 品牌用語掃描不掃這些檔案，改由上線關卡「引用 repo 文件」驗證與 repo 檔案逐字相同，見 docs/rules/brand-terms.md。

export const REPO_URL = 'https://github.com/kcchien/tc-policy-island';

// 引用 repo 文件放在公開資料集旁（網站目錄的 data/repo-files/），與出處快照的 snapshots/ 同一層。
export const REPO_FILES_DIR = 'repo-files';
// 建置時寫在公開資料集旁的清單：實際複製了哪些文件。選用文件（核對報告）尚未產生時不在清單中。
export const REPO_FILES_MANIFEST = 'repo-files.json';

// 相對網站根目錄的位置，關卡與頁面都用這個。
export const repoFileSitePath = (path) => `data/${REPO_FILES_DIR}/${path}`;
export const repoFileUrl = (path) => `${REPO_URL}/blob/main/${path}`;

// format：markdown 依 Markdown 排版；text 照原樣逐行呈現；checklist、brand-terms 是 JSON 清單，排成表格。
// optional：檔案還不存在也能建置與上線，頁面顯示「尚未產生」。
export const REPO_DOCUMENTS = [
  { id: 'classification-rules', path: 'docs/rules/classification-rules.md', title: '分類規則', format: 'markdown' },
  { id: 'checklist', path: 'data/verification/checklist.json', title: '檢核表', format: 'checklist' },
  { id: 'layer2-prompt', path: 'data/verification/layer2-prompt.md', title: '核對第二層提示詞', format: 'text' },
  { id: 'extraction-instructions', path: 'data/extraction/instructions.md', title: '政見抽取指示', format: 'markdown' },
  { id: 'candidate-profiles', path: 'data/extraction/candidate-profiles.md', title: '候選人資料抽取方法', format: 'markdown' },
  { id: 'verification-report', path: 'data/verification/report.md', title: '核對報告', format: 'markdown', optional: true },
  { id: 'local-elements', path: 'docs/rules/local-elements.md', title: '元素清單', format: 'markdown' },
  { id: 'brand-terms-rules', path: 'docs/rules/brand-terms.md', title: '品牌用語清單說明', format: 'markdown' },
  { id: 'brand-terms', path: 'data/rules/brand-terms.json', title: '品牌用語清單', format: 'brand-terms' },
  { id: 'forbidden-colors', path: 'docs/rules/forbidden-colors.md', title: '禁用色範圍', format: 'markdown' },
  { id: 'adr-neutrality', path: 'docs/adr/0001-neutrality-rules.md', title: '中立規則（決策紀錄）', format: 'markdown' },
  { id: 'adr-verification', path: 'docs/adr/0002-ai-verification-instead-of-human-review.md', title: '以 AI 核對取代人工審查（決策紀錄）', format: 'markdown' },
];

export const repoDocumentByPath = (path) => REPO_DOCUMENTS.find((doc) => doc.path === path);
