// 讀取原始資料目錄。檔案配置見 docs/architecture.md「頂層目錄」。
// sources/ 與 policies/ 內每位候選人一個檔案（<candidateId>.json），合併時依檔名排序。

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readJson(path) {
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

// 元素清單與裝飾格是島嶼檢視用的資料，夾具可以省略，省略時視為空陣列。
function readOptionalArray(path) {
  return existsSync(path) ? readJson(path) : [];
}

// 選舉時程放在自己的檔案，併進 meta.electionSchedule；沒有檔案時為 null（畫面不顯示時程）。
function readElectionSchedule(path) {
  return existsSync(path) ? readJson(path) : null;
}

export function loadRawData(rawDir) {
  const meta = readJson(join(rawDir, 'meta.json'));
  if (meta !== null && typeof meta === 'object' && 'electionSchedule' in meta) {
    throw new Error(`原始資料 ${join(rawDir, 'meta.json')} 不應有 electionSchedule，選舉時程放 election-schedule.json`);
  }
  return {
    meta: { ...meta, electionSchedule: readElectionSchedule(join(rawDir, 'election-schedule.json')) },
    candidates: readJson(join(rawDir, 'candidates.json')),
    issueAreas: readJson(join(rawDir, 'issue-areas.json')),
    localElements: readOptionalArray(join(rawDir, 'local-elements.json')),
    decorativeTiles: readOptionalArray(join(rawDir, 'decorative-tiles.json')),
    sources: readDirOfArrays(join(rawDir, 'sources')),
    policies: readDirOfArrays(join(rawDir, 'policies')),
  };
}
