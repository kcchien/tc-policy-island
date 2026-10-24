// 建置公開資料集：原始資料 → 公開資料集。參數與注意事項見 USAGE（--help）。
// 公開出處的出處快照一併複製到資料集旁，位置規則見 view-model.js 的 SNAPSHOT_DIR；
// 整理方法頁的引用 repo 文件也逐字複製到資料集旁，見 repo-documents.js。
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { SNAPSHOT_DIR, snapshotFileName } from '../site/js/view-model.js';
import { REPO_DOCUMENTS, REPO_FILES_DIR, REPO_FILES_MANIFEST } from '../site/js/repo-documents.js';
import { loadRawData } from './lib/raw-data.js';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '建置公開資料集：原始資料 → 公開資料集，連同公開出處的出處快照與整理方法頁引用的 repo 文件。',
  usage: [
    ['node scripts/build.js [參數]', '驗證原始資料並寫出公開資料集'],
    ['node scripts/build.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  sections: [
    {
      title: '參數',
      rows: [
        ['--raw <目錄>', '原始資料目錄（預設 data/raw）；看夾具資料用 test/fixtures/raw-sample'],
        ['--out <路徑>', '公開資料集的輸出檔（預設 site/data/dataset.json）'],
      ],
    },
  ],
  notes: [
    '原始資料驗證失敗時列出全部錯誤並以結束碼 1 退出，不寫出檔案。',
    '只有兩層核對都通過的政見進公開資料集，輸出會列出未通過核對而排除的筆數。',
    '輸出目錄（預設 site/data/）是建置產物、不進版控，內容取決於上一次用的原始資料；看完夾具記得用正式資料重建。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

// snapshotPath 相對於 repo 根目錄。
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: 'data/raw' },
    out: { type: 'string', default: 'site/data/dataset.json' },
  },
});

// 整理方法頁照原文公開的 repo 文件逐字複製到公開資料集旁，不經任何轉換，見 site/js/repo-documents.js。
function copyRepoDocuments(datasetDir) {
  const missing = REPO_DOCUMENTS.filter((doc) => !doc.optional && !existsSync(join(REPO_ROOT, doc.path)));
  if (missing.length > 0) throw new Error(missing.map((doc) => `整理方法頁引用的 repo 文件 ${doc.path} 不存在`).join('\n'));
  const dir = join(datasetDir, REPO_FILES_DIR);
  rmSync(dir, { recursive: true, force: true });
  const documents = REPO_DOCUMENTS.map((doc) => doc.path).filter((path) => existsSync(join(REPO_ROOT, path)));
  for (const path of documents) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    copyFileSync(join(REPO_ROOT, path), join(dir, path));
  }
  writeFileSync(join(datasetDir, REPO_FILES_MANIFEST), `${JSON.stringify({ documents }, null, 2)}\n`);
}

try {
  const raw = loadRawData(resolve(values.raw));
  const dataset = buildPublicDataset(raw, { builtAt: new Date().toISOString() });
  const snapshots = dataset.sources.map((s) => ({ source: s, from: join(REPO_ROOT, s.snapshotPath) }));
  const missing = snapshots.filter(({ from }) => !existsSync(from));
  if (missing.length > 0) {
    throw new Error(missing.map(({ source }) => `出處 ${source.id} 的出處快照 ${source.snapshotPath} 不存在`).join('\n'));
  }
  const out = resolve(values.out);
  const snapshotDir = join(dirname(out), SNAPSHOT_DIR);
  rmSync(snapshotDir, { recursive: true, force: true });
  mkdirSync(snapshotDir, { recursive: true });
  for (const { source, from } of snapshots) copyFileSync(from, join(snapshotDir, snapshotFileName(source)));
  copyRepoDocuments(dirname(out));
  writeFileSync(out, `${JSON.stringify(dataset, null, 2)}\n`);
  const excluded = raw.policies.length - dataset.policies.length;
  console.log(`公開資料集已寫入 ${values.out}：候選人 ${dataset.candidates.length} 位、議題區 ${dataset.issueAreas.length} 個、公開政見 ${dataset.policies.length} 筆（未通過核對排除 ${excluded} 筆）`);
} catch (error) {
  if (error instanceof DatasetValidationError) console.error(error.message);
  else console.error(`建置失敗：${error.message}`);
  process.exitCode = 1;
}
