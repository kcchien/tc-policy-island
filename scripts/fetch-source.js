// 擷取一個出處：存出處快照、送 Wayback Machine 存檔、寫出處紀錄；或補送先前失敗的存檔。參數與注意事項見 USAGE（--help）。
// 網頁轉文字見 lib/source-capture.js、PDF 與字形還原見 lib/pdf-text.js、存檔的退避與跨程序鎖見 lib/archive-queue.js。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SOURCE_TYPES } from '../site/js/dataset.js';
import { GLYPH_RESTORED_MARK } from '../site/js/ui-text.js';
import { readJson } from './lib/raw-data.js';
import { pdfPageText } from './lib/pdf-text.js';
import { htmlToSnapshotText, pageTitle } from './lib/source-capture.js';
import { createArchiver, retryMissingArchives } from './lib/archive-queue.js';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '擷取一個出處：存出處快照、送 Wayback Machine 存檔、把出處紀錄寫進原始資料；也能補送先前失敗的存檔。',
  usage: [
    ['node scripts/fetch-source.js --candidate <id> --id <sourceId> --url <url> --type <來源類型> [參數]', ''],
    ['', '擷取一個出處'],
    ['node scripts/fetch-source.js --retry-archive [--candidate <id>] [--raw data/raw]', ''],
    ['', '補送 archiveUrl 為 null 的出處存檔'],
    ['node scripts/fetch-source.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  sections: [
    {
      title: '擷取時必填',
      rows: [
        ['--candidate <id>', '候選人識別碼；補送存檔時可省略，給了就只補這位'],
        ['--id <sourceId>', '出處識別碼，小寫英數與連字號'],
        ['--url <url>', '原網址（http 或 https）；用 --html 或 --pdf 時仍填原網址'],
        ['--type <來源類型>', `來源類型：${Object.keys(SOURCE_TYPES).join('、')}`],
      ],
    },
    {
      title: '內容來源',
      rows: [
        ['--title <標題>', '出處標題；不給時取頁面標題，PDF 出處必填'],
        ['--html <本機 HTML 檔>', '要登入或由瀏覽器渲染的頁面，先在瀏覽器另存 HTML 再指定'],
        ['--pdf <本機 PDF 檔>', 'PDF 出處（例如選舉公報）先下載再指定，與 --html 擇一'],
        ['--page <頁碼>', 'PDF 要轉出的頁（預設 1）'],
        ['--glyph-map <字型對照檔>', '字形抽不出文字時用來還原，只用於 --pdf'],
        ['--pdftotext <執行檔>', 'poppler 的 pdftotext 路徑（預設 pdftotext）'],
      ],
    },
    {
      title: '輸出',
      rows: [
        ['--no-archive', '不送存檔；同識別碼已有存檔網址時保留原紀錄的存檔欄位'],
        ['--raw <目錄>', '原始資料目錄（預設 data/raw）'],
        ['--snapshots <目錄>', '出處快照目錄（預設 data/snapshots）'],
        ['--date YYYY-MM-DD', '擷取日期（預設今天，台灣時間）'],
      ],
    },
  ],
  notes: [
    '頁面可見文字存成 <snapshots>/<sourceId>.txt，出處紀錄寫進 <raw>/sources/<candidateId>.json：同識別碼取代，否則加在最後。',
    'PDF 以 pdftotext 轉出 --page 那一頁；字形還原的做法見 data/extraction/candidate-profiles.md。出處紀錄的 snapshotNote 自動註明轉換方法。',
    '存檔失敗先依 60、120、240、480 秒退避重試，仍失敗只記錄原因（archiveError），不中止。',
    '存檔流程以跨程序鎖檔排隊，同一時間只有一個在送，兩次送出至少隔 20 秒；平行擷取時會互相等待。',
    '--retry-archive 對 <raw>/sources/*.json 中 archiveUrl 為 null 的出處逐一補送並寫回，仍有失敗時結束碼 1；不能和擷取參數一起用。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

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
    pdf: { type: 'string' },
    page: { type: 'string', default: '1' },
    'glyph-map': { type: 'string' },
    pdftotext: { type: 'string', default: 'pdftotext' },
    'no-archive': { type: 'boolean', default: false },
    'retry-archive': { type: 'boolean', default: false },
    raw: { type: 'string', default: 'data/raw' },
    snapshots: { type: 'string', default: 'data/snapshots' },
    date: { type: 'string', default: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) },
  },
});

// 補送存檔只用 --raw 與 --candidate（可省略），其餘擷取參數不能同時給。
function checkRetryArgs() {
  const extra = ['id', 'url', 'type', 'title', 'html', 'pdf', 'glyph-map', 'no-archive'].filter((name) => values[name]);
  if (extra.length > 0) throw new Error(`--retry-archive 不能和 ${extra.map((n) => `--${n}`).join('、')} 一起用`);
}

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
  if (values.pdf && values.html) throw new Error('--pdf 與 --html 只能擇一');
  if (values.pdf && !values.title) throw new Error('PDF 出處要用 --title 指定標題');
  if (!/^[1-9]\d*$/.test(values.page)) throw new Error(`--page 應為正整數，實際為 ${values.page}`);
  if (values['glyph-map'] && !values.pdf) throw new Error('--glyph-map 只用於 --pdf');
}

// PDF 的一頁轉成出處快照文字，snapshotNote 寫明轉換方法與字型對照還原。
function capturePdf() {
  const glyphMapPath = values['glyph-map'] ? resolve(values['glyph-map']) : null;
  const { text, restored, unmapped } = pdfPageText(readFileSync(resolve(values.pdf)), {
    page: Number(values.page),
    glyphMap: glyphMapPath ? readJson(glyphMapPath) : null,
    pdftotext: values.pdftotext,
  });
  const notes = [`PDF 第 ${values.page} 頁以 pdftotext 轉成文字`];
  for (const { baseFont, count } of restored) {
    // 畫面依 GLYPH_RESTORED_MARK 判斷要不要顯示白話的還原說明，措辭改了要一起改。
    notes.push(`字型 ${baseFont} 的 ${count} 個字形文字由 PDF 字型${GLYPH_RESTORED_MARK}（對照檔 ${relative(REPO_ROOT, glyphMapPath)}）`);
  }
  if (unmapped > 0) console.log(`注意：快照仍有 ${unmapped} 個字元無法轉成文字（U+FFFD）`);
  return { text, snapshotNote: notes.join('；') };
}

// 依回應標頭的 charset 解碼，沒寫時當 UTF-8。
async function fetchHtml(url) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`抓取 ${url} 失敗：HTTP ${response.status}`);
  const charset = response.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1] ?? 'utf-8';
  return new TextDecoder(charset).decode(await response.arrayBuffer());
}

async function retryArchives(archiver) {
  checkRetryArgs();
  const { attempted, archived, failed } = await retryMissingArchives({ rawDir: resolve(values.raw), candidate: values.candidate ?? null, archiver });
  if (attempted === 0) {
    console.log('沒有缺存檔網址的出處');
    return;
  }
  console.log(`補送存檔 ${attempted} 筆：成功 ${archived} 筆${failed.length > 0 ? `，仍失敗 ${failed.length} 筆（${failed.join('、')}）` : ''}`);
  if (failed.length > 0) process.exitCode = 1;
}

async function main(archiver) {
  if (values['retry-archive']) return retryArchives(archiver);
  checkArgs();
  let text;
  let title = values.title;
  let snapshotNote = null;
  if (values.pdf) {
    ({ text, snapshotNote } = capturePdf());
  } else {
    const html = values.html ? readFileSync(resolve(values.html), 'utf8') : await fetchHtml(values.url);
    text = htmlToSnapshotText(html);
    title ??= pageTitle(html);
  }
  if (!title) throw new Error('頁面沒有 <title>，用 --title 指定標題');

  const sourcesPath = join(resolve(values.raw), 'sources', `${values.candidate}.json`);
  const sources = existsSync(sourcesPath) ? readJson(sourcesPath) : [];
  const previous = sources.find((s) => s.id === values.id);
  const archive = values['no-archive']
    ? (previous?.archiveUrl ? { archiveUrl: previous.archiveUrl, archiveError: null } : { archiveUrl: null, archiveError: '未送存檔（--no-archive）' })
    : await archiver.archive(values.url);

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
    snapshotNote,
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

const archiver = createArchiver();
// 退避等待時按 Ctrl+C 也要釋放鎖檔，別讓下一個存檔流程空等。
process.once('SIGINT', () => {
  archiver.close();
  process.exit(130);
});
try {
  await main(archiver);
} catch (error) {
  console.error(`擷取出處失敗：${error.message}`);
  process.exitCode = 1;
} finally {
  archiver.close();
}
