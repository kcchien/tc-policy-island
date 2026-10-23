// 建置公開資料集：node scripts/build.js [--raw data/raw] [--out site/data/dataset.json]
// 原始資料驗證失敗時列出全部錯誤，以結束碼 1 退出，不寫出檔案。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { loadRawData } from './lib/raw-data.js';

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: 'data/raw' },
    out: { type: 'string', default: 'site/data/dataset.json' },
  },
});

try {
  const raw = loadRawData(resolve(values.raw));
  const dataset = buildPublicDataset(raw, { builtAt: new Date().toISOString() });
  const out = resolve(values.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(dataset, null, 2)}\n`);
  const excluded = raw.policies.length - dataset.policies.length;
  console.log(`公開資料集已寫入 ${values.out}：候選人 ${dataset.candidates.length} 位、議題區 ${dataset.issueAreas.length} 個、公開政見 ${dataset.policies.length} 筆（未通過核對排除 ${excluded} 筆）`);
} catch (error) {
  if (error instanceof DatasetValidationError) console.error(error.message);
  else console.error(`建置失敗：${error.message}`);
  process.exitCode = 1;
}
