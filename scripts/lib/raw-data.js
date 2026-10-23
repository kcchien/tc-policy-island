import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 原始資料目錄的檔案配置，見 AGENTS.md「目錄慣例」。
// sources/ 與 policies/ 內每位候選人一個檔案（<candidateId>.json），合併時依檔名排序。
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`讀取原始資料 ${path} 失敗：${error.message}`);
  }
}

function readDirOfArrays(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => {
      const records = readJson(join(dir, name));
      if (!Array.isArray(records)) throw new Error(`原始資料 ${join(dir, name)} 應為陣列`);
      return records;
    });
}

export function loadRawData(rawDir) {
  return {
    meta: readJson(join(rawDir, 'meta.json')),
    candidates: readJson(join(rawDir, 'candidates.json')),
    issueAreas: readJson(join(rawDir, 'issue-areas.json')),
    sources: readDirOfArrays(join(rawDir, 'sources')),
    policies: readDirOfArrays(join(rawDir, 'policies')),
  };
}
