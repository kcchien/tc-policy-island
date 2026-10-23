// 建置公開資料集：node scripts/build.js [--raw data/raw] [--out site/data/dataset.json]
// 原始資料驗證失敗時列出全部錯誤，以結束碼 1 退出，不寫出檔案。
// 公開出處的出處快照一併複製到資料集旁的 snapshots/，檔名沿用快照檔名（見 view-model.js 的 SNAPSHOT_URL_DIR）。
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { loadRawData } from './lib/raw-data.js';

// snapshotPath 相對於 repo 根目錄。
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: 'data/raw' },
    out: { type: 'string', default: 'site/data/dataset.json' },
  },
});

try {
  const raw = loadRawData(resolve(values.raw));
  const dataset = buildPublicDataset(raw, { builtAt: new Date().toISOString() });
  const snapshots = dataset.sources.map((s) => ({ source: s, from: join(REPO_ROOT, s.snapshotPath) }));
  const missing = snapshots.filter(({ from }) => !existsSync(from));
  if (missing.length > 0) {
    throw new Error(missing.map(({ source }) => `出處 ${source.id} 的出處快照 ${source.snapshotPath} 不存在`).join('\n'));
  }
  const out = resolve(values.out);
  const snapshotDir = join(dirname(out), 'snapshots');
  rmSync(snapshotDir, { recursive: true, force: true });
  mkdirSync(snapshotDir, { recursive: true });
  for (const { from } of snapshots) copyFileSync(from, join(snapshotDir, basename(from)));
  writeFileSync(out, `${JSON.stringify(dataset, null, 2)}\n`);
  const excluded = raw.policies.length - dataset.policies.length;
  console.log(`公開資料集已寫入 ${values.out}：候選人 ${dataset.candidates.length} 位、議題區 ${dataset.issueAreas.length} 個、公開政見 ${dataset.policies.length} 筆（未通過核對排除 ${excluded} 筆）`);
} catch (error) {
  if (error instanceof DatasetValidationError) console.error(error.message);
  else console.error(`建置失敗：${error.message}`);
  process.exitCode = 1;
}
