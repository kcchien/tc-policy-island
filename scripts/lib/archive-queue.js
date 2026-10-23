// 送網頁存檔服務（Wayback Machine）的排隊：跨程序鎖檔讓同一時間只有一個存檔流程，送出間隔固定，失敗依序退避重試。
// 給 scripts/fetch-source.js 用。網路呼叫（request）、等待（sleep）與時鐘（now）都可注入，供測試使用。
import { closeSync, existsSync, openSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requestArchive } from './source-capture.js';

// Wayback Machine 對連續送存檔會限流：兩次送出至少隔 20 秒，失敗後依序等 60、120、240、480 秒再試。
export const ARCHIVE_INTERVAL_MS = 20 * 1000;
export const ARCHIVE_BACKOFF_MS = [60, 120, 240, 480].map((s) => s * 1000);
// 鎖檔放系統暫存目錄，同一台機器上不同 worktree 的存檔流程也會互相排隊。
export const ARCHIVE_LOCK_PATH = join(tmpdir(), 'tc-policy-island-archive.lock');
const LOCK_POLL_MS = 5 * 1000;

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 程序還在不在。沒有權限送訊號（EPERM）也表示程序存在。
function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// 取得鎖檔，回傳釋放函式。鎖檔記著持有者的 pid；持有者已結束時視為殘留，直接接手。
export async function acquireArchiveLock(lockPath = ARCHIVE_LOCK_PATH, { sleep = realSleep, isAlive = processAlive, pollMs = LOCK_POLL_MS, log = console.log } = {}) {
  let announced = false;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      closeSync(fd);
      return () => {
        try {
          if (JSON.parse(readFileSync(lockPath, 'utf8')).pid === process.pid) unlinkSync(lockPath);
        } catch {
          // 鎖檔已不在或被別人接手，不用處理。
        }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    let holder = null;
    try {
      holder = JSON.parse(readFileSync(lockPath, 'utf8')).pid;
    } catch {
      // 對方剛建立還沒寫入內容，下一輪再看。
    }
    if (Number.isInteger(holder) && !isAlive(holder)) {
      try {
        unlinkSync(lockPath);
      } catch {
        // 別的程序先清掉了。
      }
      continue;
    }
    if (!announced) {
      log(`另一個存檔流程${holder ? `（pid ${holder}）` : ''}進行中，等它結束⋯`);
      announced = true;
    }
    await sleep(pollMs);
  }
}

// 存檔器：第一次送存檔時才取得鎖（不送存檔的流程不排隊），close() 釋放。
// 上次送出的時間記在 <鎖檔>.last，跨程序也維持送出間隔。
export function createArchiver({
  lockPath = ARCHIVE_LOCK_PATH,
  intervalMs = ARCHIVE_INTERVAL_MS,
  backoffMs = ARCHIVE_BACKOFF_MS,
  request = requestArchive,
  sleep = realSleep,
  now = Date.now,
  isAlive = processAlive,
  log = console.log,
} = {}) {
  const lastPath = `${lockPath}.last`;
  let release = null;
  const readLast = () => {
    try {
      return Number(readFileSync(lastPath, 'utf8')) || 0;
    } catch {
      return 0;
    }
  };
  const send = async (url) => {
    const wait = readLast() + intervalMs - now();
    if (wait > 0) await sleep(wait);
    writeFileSync(lastPath, String(now()));
    return request(url);
  };
  return {
    // 回傳 { archiveUrl, archiveError }；退避重試都失敗時 archiveError 是最後一次的原因並註明次數。
    async archive(url) {
      release ??= await acquireArchiveLock(lockPath, { sleep, isAlive, log });
      let result = await send(url);
      for (const [index, delay] of backoffMs.entries()) {
        if (result.archiveUrl) return result;
        log(`存檔失敗（${result.archiveError}），${Math.round(delay / 1000)} 秒後重試（第 ${index + 1}/${backoffMs.length} 次）`);
        await sleep(delay);
        result = await send(url);
      }
      if (result.archiveUrl || backoffMs.length === 0) return result;
      return { archiveUrl: null, archiveError: `${result.archiveError}（重試 ${backoffMs.length} 次仍失敗）` };
    },
    close() {
      release?.();
      release = null;
    },
  };
}

// 補送存檔：<raw>/sources/*.json 中 archiveUrl 為 null 的出處逐一送存檔，每筆送完就寫回該檔。
// candidate 指定時只處理該候選人。回傳 { attempted, archived, failed: [sourceId] }。
export async function retryMissingArchives({ rawDir, candidate = null, archiver, log = console.log }) {
  const dir = join(rawDir, 'sources');
  if (!existsSync(dir)) throw new Error(`找不到出處目錄 ${dir}`);
  const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  const targets = candidate ? files.filter((name) => name === `${candidate}.json`) : files;
  if (candidate && targets.length === 0) throw new Error(`找不到候選人 ${candidate} 的出處檔`);
  const summary = { attempted: 0, archived: 0, failed: [] };
  for (const name of targets) {
    const path = join(dir, name);
    const sources = JSON.parse(readFileSync(path, 'utf8'));
    for (const [index, source] of sources.entries()) {
      if (source.archiveUrl) continue;
      summary.attempted += 1;
      const result = await archiver.archive(source.url);
      sources[index] = { ...source, archiveUrl: result.archiveUrl, archiveError: result.archiveError };
      writeFileSync(path, `${JSON.stringify(sources, null, 2)}\n`);
      if (result.archiveUrl) {
        summary.archived += 1;
        log(`出處 ${source.id}：存檔 ${result.archiveUrl}`);
      } else {
        summary.failed.push(source.id);
        log(`出處 ${source.id}：存檔失敗：${result.archiveError}`);
      }
    }
  }
  return summary;
}
