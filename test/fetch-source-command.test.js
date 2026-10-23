import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePdf, TEST_FONT } from './fixtures/make-pdf.js';

const FETCH_SCRIPT = fileURLToPath(new URL('../scripts/fetch-source.js', import.meta.url));

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'fetch-source-'));
  mkdirSync(join(dir, 'raw', 'sources'), { recursive: true });
  const html = join(dir, 'page.html');
  writeFileSync(html, '<html><head><title>範例甲 &amp; 政見</title></head><body><ul><li>增設公車路線</li></ul></body></html>');
  return { dir, html, raw: join(dir, 'raw'), snapshots: join(dir, 'snapshots') };
}

function fetchSource(ws, args) {
  const result = spawnSync(
    process.execPath,
    [FETCH_SCRIPT, '--raw', ws.raw, '--snapshots', ws.snapshots, '--date', '2026-10-23', '--no-archive', ...args],
    { encoding: 'utf8' },
  );
  return { code: result.status, output: result.stdout + result.stderr };
}

const readSources = (ws, candidateId) => JSON.parse(readFileSync(join(ws.raw, 'sources', `${candidateId}.json`), 'utf8'));

test('抓取指令存下出處快照，並把出處紀錄寫進該候選人的出處檔', () => {
  const ws = workspace();

  const { code, output } = fetchSource(ws, [
    '--candidate', 'sample-jia', '--id', 'sample-src-jia', '--url', 'https://example.org/policy',
    '--type', 'official-website', '--html', ws.html,
  ]);

  assert.equal(code, 0, output);
  const snapshot = readFileSync(join(ws.snapshots, 'sample-src-jia.txt'), 'utf8');
  assert.equal(snapshot, '增設公車路線\n');
  const [source] = readSources(ws, 'sample-jia');
  assert.equal(source.snapshotPath.endsWith('snapshots/sample-src-jia.txt'), true);
  assert.deepEqual({ ...source, snapshotPath: null }, {
    id: 'sample-src-jia',
    candidateId: 'sample-jia',
    url: 'https://example.org/policy',
    archiveUrl: null,
    archiveError: '未送存檔（--no-archive）',
    snapshotPath: null,
    snapshotSha256: createHash('sha256').update('增設公車路線\n').digest('hex'),
    snapshotNote: null,
    sourceType: 'official-website',
    title: '範例甲 & 政見',
    retrievedAt: '2026-10-23',
  });
});

test('重抓同一個出處時取代原紀錄，不重複新增；--title 可指定標題', () => {
  const ws = workspace();
  const base = ['--candidate', 'sample-jia', '--url', 'https://example.org/policy', '--type', 'official-website', '--html', ws.html];
  fetchSource(ws, [...base, '--id', 'sample-src-a']);
  fetchSource(ws, [...base, '--id', 'sample-src-b']);

  const { code, output } = fetchSource(ws, [...base, '--id', 'sample-src-a', '--title', '指定標題']);

  assert.equal(code, 0, output);
  assert.deepEqual(readSources(ws, 'sample-jia').map((s) => [s.id, s.title]), [
    ['sample-src-a', '指定標題'],
    ['sample-src-b', '範例甲 & 政見'],
  ]);
});

const FAKE_PDFTOTEXT = fileURLToPath(new URL('./fixtures/fake-pdftotext', import.meta.url));

function pdfWorkspace() {
  const ws = workspace();
  const pdf = join(ws.dir, 'bulletin.pdf');
  writeFileSync(pdf, makePdf());
  const glyphMap = join(ws.dir, 'glyph-map.json');
  writeFileSync(glyphMap, JSON.stringify({ fonts: [{ baseFont: TEST_FONT, codes: { F356: '0', F357: '1' } }] }));
  return { ...ws, pdf, glyphMap };
}

const pdfArgs = (ws) => [
  '--candidate', 'sample-jia', '--id', 'sample-bulletin-jia', '--url', 'https://example.org/bulletin.pdf',
  '--type', 'election-bulletin', '--title', '範例選舉公報', '--pdf', ws.pdf, '--page', '2', '--pdftotext', FAKE_PDFTOTEXT,
];

test('PDF 出處：指定頁以 pdftotext 轉成出處快照，出處紀錄註明轉換方法', () => {
  const ws = pdfWorkspace();

  const { code, output } = fetchSource(ws, pdfArgs(ws));

  assert.equal(code, 0, output);
  assert.equal(readFileSync(join(ws.snapshots, 'sample-bulletin-jia.txt'), 'utf8'), '第 2 頁\n範例里里長拜訪 �� 戶\n');
  const [source] = readSources(ws, 'sample-jia');
  assert.equal(source.snapshotNote, 'PDF 第 2 頁以 pdftotext 轉成文字');
  assert.match(output, /2 個字元無法轉成文字/);
});

test('PDF 出處：指定字型對照時，抽不出的字形由 PDF 字型對照還原，出處紀錄註明還原方法與對照檔', () => {
  const ws = pdfWorkspace();

  const { code, output } = fetchSource(ws, [...pdfArgs(ws), '--glyph-map', ws.glyphMap]);

  assert.equal(code, 0, output);
  assert.equal(readFileSync(join(ws.snapshots, 'sample-bulletin-jia.txt'), 'utf8'), '第 2 頁\n範例里里長拜訪 10 戶\n');
  const [source] = readSources(ws, 'sample-jia');
  assert.match(source.snapshotNote, /^PDF 第 2 頁以 pdftotext 轉成文字；字型 TestSerif-Light 的 2 個字形文字由 PDF 字型對照還原（對照檔 .*glyph-map\.json）$/);
  assert.doesNotMatch(output, /無法轉成文字/);
});

test('PDF 出處：pdftotext 不存在時以非零結束碼退出並說明', () => {
  const ws = pdfWorkspace();
  const args = pdfArgs(ws);
  args[args.indexOf(FAKE_PDFTOTEXT)] = join(ws.dir, 'no-such-pdftotext');

  const { code, output } = fetchSource(ws, args);

  assert.equal(code, 1);
  assert.match(output, /無法執行 .*no-such-pdftotext/);
});

test('來源類型不在清單內時拒絕執行，不寫任何檔案', () => {
  const ws = workspace();

  const { code, output } = fetchSource(ws, [
    '--candidate', 'sample-jia', '--id', 'sample-src-jia', '--url', 'https://example.org/policy',
    '--type', 'news', '--html', ws.html,
  ]);

  assert.equal(code, 1);
  assert.match(output, /--type/);
  assert.throws(() => readSources(ws, 'sample-jia'));
});
