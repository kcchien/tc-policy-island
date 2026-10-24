// 建置公開資料集：原始資料 → 公開資料集。參數與注意事項見 USAGE（--help）。
// 公開出處的出處快照一併複製到資料集旁，位置規則見 view-model.js 的 SNAPSHOT_DIR；
// 整理方法頁的引用 repo 文件也逐字複製到資料集旁，見 repo-documents.js。
// 政見語音全有或全無：每條公開政見都有相符音檔才複製音檔並加 audioUrl，見 scripts/lib/speech.js。
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { SNAPSHOT_DIR, snapshotFileName } from '../site/js/view-model.js';
import { REPO_DOCUMENTS, REPO_FILES_DIR, REPO_FILES_MANIFEST } from '../site/js/repo-documents.js';
import { loadRawData, readJson } from './lib/raw-data.js';
import { AUDIO_DIR, AUDIO_MANIFEST, audioProblems, audioUrlOf, sha256 } from './lib/speech.js';
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
        ['--audio <目錄>', '政見語音的音檔目錄，清單是其中的 manifest.json（預設 data/audio）'],
      ],
    },
  ],
  notes: [
    '原始資料驗證失敗時列出全部錯誤並以結束碼 1 退出，不寫出檔案。',
    '只有兩層核對都通過的政見進公開資料集，輸出會列出未通過核對而排除的筆數。',
    '政見語音全有或全無：每條公開政見在清單裡都有、文字雜湊相符、音檔存在且雜湊相符，才把音檔與清單複製到輸出目錄的 audio/ 並給每條政見加 audioUrl；缺任何一條就全部不加，輸出列出缺哪些。',
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
    audio: { type: 'string', default: 'data/audio' },
  },
});

// 政見語音全有或全無。齊全時把音檔與清單複製到公開資料集旁的 audio/，並給每條政見加 audioUrl；
// 否則不複製任何音檔、不加 audioUrl。上一次建置留下的音檔一律先清掉。回傳要印的說明。
function attachAudio(dataset, datasetDir) {
  const outDir = join(datasetDir, AUDIO_DIR);
  rmSync(outDir, { recursive: true, force: true });
  for (const policy of dataset.policies) delete policy.audioUrl;
  const audioDir = resolve(values.audio);
  const manifestPath = join(audioDir, AUDIO_MANIFEST);
  if (!existsSync(manifestPath)) return [`沒有政見語音清單 ${values.audio}/${AUDIO_MANIFEST}，政見不帶音檔`];
  const manifest = readJson(manifestPath);
  const fileSha256Of = (file) => (existsSync(join(audioDir, file)) ? sha256(readFileSync(join(audioDir, file))) : null);
  const problems = audioProblems(dataset.policies, manifest, fileSha256Of);
  if (problems.length > 0) {
    return [`政見語音不齊全（${problems.length} 處），全部政見都不帶音檔：`, ...problems.map((p) => `  ${p}`)];
  }
  mkdirSync(outDir, { recursive: true });
  for (const policy of dataset.policies) {
    const item = manifest.items[policy.id];
    copyFileSync(join(audioDir, item.file), join(outDir, item.file));
    policy.audioUrl = audioUrlOf(item);
  }
  copyFileSync(manifestPath, join(outDir, AUDIO_MANIFEST));
  return [`政見語音 ${dataset.policies.length} 條齊全，音檔已複製到 ${join(dirname(values.out), AUDIO_DIR)}`];
}

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
  const audioNotes = attachAudio(dataset, dirname(out));
  writeFileSync(out, `${JSON.stringify(dataset, null, 2)}\n`);
  for (const note of audioNotes) console.log(note);
  const excluded = raw.policies.length - dataset.policies.length;
  console.log(`公開資料集已寫入 ${values.out}：候選人 ${dataset.candidates.length} 位、議題區 ${dataset.issueAreas.length} 個、公開政見 ${dataset.policies.length} 筆（未通過核對排除 ${excluded} 筆）`);
} catch (error) {
  if (error instanceof DatasetValidationError) console.error(error.message);
  else console.error(`建置失敗：${error.message}`);
  process.exitCode = 1;
}
