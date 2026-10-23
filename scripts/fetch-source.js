// 擷取一個出處：node scripts/fetch-source.js --candidate <id> --id <sourceId> --url <url> --type <來源類型>
//   [--title <頁面標題>] [--html <本機 HTML 檔>] [--no-archive] [--raw data/raw] [--snapshots data/snapshots] [--date YYYY-MM-DD]
// 抓取頁面存成出處快照 <snapshots>/<sourceId>.txt，送 Wayback Machine 存檔，
// 再把出處紀錄寫進 <raw>/sources/<candidateId>.json（同識別碼取代，否則加在最後）。
// 頁面要登入或由瀏覽器渲染時，先在瀏覽器另存 HTML，用 --html 指定，--url 仍填原網址。
// 存檔失敗只記錄原因，不中止；--no-archive 不送存檔（已有存檔網址時保留原紀錄的存檔欄位）。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SOURCE_TYPES } from '../site/js/dataset.js';
import { readJson } from './lib/raw-data.js';
import { htmlToSnapshotText, pageTitle, requestArchive } from './lib/source-capture.js';

// snapshotPath 相對於 repo 根目錄，與 build.js、verify.js 相同。
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FETCH_TIMEOUT_MS = 60 * 1000;
const USER_AGENT = 'Mozilla/5.0 (compatible; tc-policy-island source capture)';

const { values } = parseArgs({
  options: {
    candidate: { type: 'string' },
    id: { type: 'string' },
    url: { type: 'string' },
    type: { type: 'string' },
    title: { type: 'string' },
    html: { type: 'string' },
    'no-archive': { type: 'boolean', default: false },
    raw: { type: 'string', default: 'data/raw' },
    snapshots: { type: 'string', default: 'data/snapshots' },
    date: { type: 'string', default: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) },
  },
});

function checkArgs() {
  for (const name of ['candidate', 'id', 'url', 'type']) {
    if (!values[name]) throw new Error(`缺少 --${name}`);
  }
  if (!Object.hasOwn(SOURCE_TYPES, values.type)) {
    throw new Error(`--type 應為其中之一：${Object.keys(SOURCE_TYPES).join('、')}，實際為 ${values.type}`);
  }
  if (!/^https?:\/\/\S+$/.test(values.url)) throw new Error(`--url 應為 http(s) 網址，實際為 ${values.url}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(values.id)) throw new Error(`--id 只能用小寫英數與連字號，實際為 ${values.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw new Error(`--date 應為 YYYY-MM-DD，實際為 ${values.date}`);
}

// 依回應標頭的 charset 解碼，沒寫時當 UTF-8。
async function fetchHtml(url) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`抓取 ${url} 失敗：HTTP ${response.status}`);
  const charset = response.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1] ?? 'utf-8';
  return new TextDecoder(charset).decode(await response.arrayBuffer());
}

async function main() {
  checkArgs();
  const html = values.html ? readFileSync(resolve(values.html), 'utf8') : await fetchHtml(values.url);
  const text = htmlToSnapshotText(html);
  const title = values.title ?? pageTitle(html);
  if (!title) throw new Error('頁面沒有 <title>，用 --title 指定標題');

  const sourcesPath = join(resolve(values.raw), 'sources', `${values.candidate}.json`);
  const sources = existsSync(sourcesPath) ? readJson(sourcesPath) : [];
  const previous = sources.find((s) => s.id === values.id);
  const archive = values['no-archive']
    ? (previous?.archiveUrl ? { archiveUrl: previous.archiveUrl, archiveError: null } : { archiveUrl: null, archiveError: '未送存檔（--no-archive）' })
    : await requestArchive(values.url);

  const snapshotFile = join(resolve(values.snapshots), `${values.id}.txt`);
  mkdirSync(dirname(snapshotFile), { recursive: true });
  writeFileSync(snapshotFile, text);
  const record = {
    id: values.id,
    candidateId: values.candidate,
    url: values.url,
    ...archive,
    snapshotPath: relative(REPO_ROOT, snapshotFile),
    snapshotSha256: createHash('sha256').update(text).digest('hex'),
    sourceType: values.type,
    title,
    retrievedAt: values.date,
  };
  const next = previous ? sources.map((s) => (s.id === values.id ? record : s)) : [...sources, record];
  mkdirSync(dirname(sourcesPath), { recursive: true });
  writeFileSync(sourcesPath, `${JSON.stringify(next, null, 2)}\n`);

  const archiveNote = record.archiveUrl ? `存檔 ${record.archiveUrl}` : `存檔失敗：${record.archiveError}`;
  console.log(`出處 ${record.id}：快照 ${record.snapshotPath}（${text.split('\n').length - 1} 行），${archiveNote}`);
}

try {
  await main();
} catch (error) {
  console.error(`擷取出處失敗：${error.message}`);
  process.exitCode = 1;
}
