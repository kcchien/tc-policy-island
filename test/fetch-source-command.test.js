import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
