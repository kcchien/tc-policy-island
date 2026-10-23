import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVE_BACKOFF_MS, ARCHIVE_INTERVAL_MS, acquireArchiveLock, createArchiver, retryMissingArchives } from '../scripts/lib/archive-queue.js';

const ARCHIVED = (url) => `https://web.archive.org/web/20261024120000/${url}`;
const ok = (url) => ({ archiveUrl: ARCHIVED(url), archiveError: null });
const refused = { archiveUrl: null, archiveError: 'Wayback Machine 回應 HTTP 429' };

// 假時鐘：sleep 只推進時間並記下等了多久。
function fakeClock(start = 1_000_000) {
  let time = start;
  const sleeps = [];
  return {
    now: () => time,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
    sleeps,
  };
}

const lockPath = () => join(mkdtempSync(join(tmpdir(), 'archive-lock-')), 'archive.lock');
const quiet = () => {};

test('退避重試：失敗後依序等 60、120、240、480 秒再試，成功就停', async () => {
  assert.deepEqual(ARCHIVE_BACKOFF_MS, [60_000, 120_000, 240_000, 480_000]);
  const clock = fakeClock();
  const replies = [refused, refused, ok('https://example.org/a')];
  const calls = [];
  const archiver = createArchiver({ lockPath: lockPath(), request: async (url) => (calls.push(url), replies.shift()), ...clock, log: quiet });

  const result = await archiver.archive('https://example.org/a');
  archiver.close();

  assert.deepEqual(result, ok('https://example.org/a'));
  assert.equal(calls.length, 3);
  assert.deepEqual(clock.sleeps, [60_000, 120_000]);
});

test('退避重試：重試用完仍失敗時記錄最後的原因與次數', async () => {
  const clock = fakeClock();
  let calls = 0;
  const archiver = createArchiver({ lockPath: lockPath(), request: async () => (calls++, refused), ...clock, log: quiet });

  const result = await archiver.archive('https://example.org/a');
  archiver.close();

  assert.equal(calls, 5);
  assert.deepEqual(clock.sleeps, [60_000, 120_000, 240_000, 480_000]);
  assert.deepEqual(result, { archiveUrl: null, archiveError: 'Wayback Machine 回應 HTTP 429（重試 4 次仍失敗）' });
});

test('送出間隔：連續兩筆至少隔 20 秒，跨存檔器（跨程序）也一樣', async () => {
  assert.equal(ARCHIVE_INTERVAL_MS, 20_000);
  const path = lockPath();
  const clock = fakeClock();
  const first = createArchiver({ lockPath: path, request: async (url) => ok(url), ...clock, log: quiet });
  await first.archive('https://example.org/a');
  await first.archive('https://example.org/b');
  first.close();
  const second = createArchiver({ lockPath: path, request: async (url) => ok(url), ...clock, log: quiet });
  await second.archive('https://example.org/c');
  second.close();

  assert.deepEqual(clock.sleeps, [20_000, 20_000]);
});

test('鎖檔：同一時間只有一個存檔流程，另一個等到釋放才取得', async () => {
  const path = lockPath();
  const release = await acquireArchiveLock(path, { log: quiet });
  const messages = [];
  let polls = 0;
  const waiting = acquireArchiveLock(path, {
    log: (m) => messages.push(m),
    sleep: async () => {
      polls += 1;
      if (polls === 2) release();
    },
  });

  const releaseSecond = await waiting;

  assert.equal(polls, 2);
  assert.equal(messages.length, 1);
  assert.match(messages[0], new RegExp(`pid ${process.pid}`));
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).pid, process.pid);
  releaseSecond();
  assert.equal(existsSync(path), false);
});

test('鎖檔：持有者已結束的殘留鎖檔直接接手，不等待', async () => {
  const path = lockPath();
  writeFileSync(path, JSON.stringify({ pid: 999_999, startedAt: '2026-10-24T00:00:00.000Z' }));

  const release = await acquireArchiveLock(path, { isAlive: () => false, sleep: async () => assert.fail('不該等待'), log: quiet });

  assert.equal(JSON.parse(readFileSync(path, 'utf8')).pid, process.pid);
  release();
});

test('存檔器：沒送存檔就不取鎖', () => {
  const path = lockPath();
  createArchiver({ lockPath: path }).close();
  assert.equal(existsSync(path), false);
});

function rawWorkspace() {
  const raw = mkdtempSync(join(tmpdir(), 'retry-archive-'));
  mkdirSync(join(raw, 'sources'));
  const source = (id, url, archiveUrl) => ({ id, candidateId: 'x', url, archiveUrl, archiveError: archiveUrl ? null : '未送存檔（--no-archive）' });
  writeFileSync(join(raw, 'sources', 'sample-jia.json'), `${JSON.stringify([
    source('src-a', 'https://example.org/a', ARCHIVED('https://example.org/a')),
    source('src-b', 'https://example.org/b', null),
  ], null, 2)}\n`);
  writeFileSync(join(raw, 'sources', 'sample-yi.json'), `${JSON.stringify([source('src-c', 'https://example.org/c', null)], null, 2)}\n`);
  return raw;
}

const readSources = (raw, name) => JSON.parse(readFileSync(join(raw, 'sources', `${name}.json`), 'utf8'));

test('補送存檔：只送缺存檔網址的出處，結果寫回原檔，已存檔的不動', async () => {
  const raw = rawWorkspace();
  const sent = [];
  const archiver = { archive: async (url) => (sent.push(url), url.endsWith('/c') ? { archiveUrl: null, archiveError: 'x（重試 4 次仍失敗）' } : ok(url)) };

  const summary = await retryMissingArchives({ rawDir: raw, archiver, log: quiet });

  assert.deepEqual(sent, ['https://example.org/b', 'https://example.org/c']);
  assert.deepEqual(summary, { attempted: 2, archived: 1, failed: ['src-c'] });
  assert.deepEqual(readSources(raw, 'sample-jia').map((s) => [s.id, s.archiveUrl, s.archiveError]), [
    ['src-a', ARCHIVED('https://example.org/a'), null],
    ['src-b', ARCHIVED('https://example.org/b'), null],
  ]);
  assert.deepEqual(readSources(raw, 'sample-yi')[0].archiveError, 'x（重試 4 次仍失敗）');
});

test('補送存檔：指定候選人時只處理該候選人；候選人沒有出處檔時說明', async () => {
  const raw = rawWorkspace();
  const sent = [];
  const archiver = { archive: async (url) => (sent.push(url), ok(url)) };

  await retryMissingArchives({ rawDir: raw, candidate: 'sample-yi', archiver, log: quiet });

  assert.deepEqual(sent, ['https://example.org/c']);
  await assert.rejects(retryMissingArchives({ rawDir: raw, candidate: 'sample-bing', archiver, log: quiet }), /sample-bing/);
});

const FETCH_SCRIPT = fileURLToPath(new URL('../scripts/fetch-source.js', import.meta.url));
const runFetch = (args) => {
  const result = spawnSync(process.execPath, [FETCH_SCRIPT, ...args], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr };
};

test('抓取指令 --retry-archive：沒有缺存檔網址時不送任何存檔', () => {
  const raw = mkdtempSync(join(tmpdir(), 'retry-archive-'));
  mkdirSync(join(raw, 'sources'));
  writeFileSync(join(raw, 'sources', 'sample-jia.json'), JSON.stringify([{ id: 'src-a', url: 'https://example.org/a', archiveUrl: ARCHIVED('https://example.org/a'), archiveError: null }]));

  const { code, output } = runFetch(['--retry-archive', '--raw', raw]);

  assert.equal(code, 0, output);
  assert.match(output, /沒有缺存檔網址的出處/);
});

test('抓取指令 --retry-archive：不能和擷取參數一起用', () => {
  const { code, output } = runFetch(['--retry-archive', '--url', 'https://example.org/a', '--no-archive']);

  assert.equal(code, 1);
  assert.match(output, /--retry-archive 不能和 --url、--no-archive 一起用/);
});
