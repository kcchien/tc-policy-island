// 以 Chrome DevTools Protocol 驅動本機 Chrome：啟動無頭 Chrome、連線、開分頁。只用 Node 內建模組（WebSocket 是 Node 24 的全域物件）。
// 給 scripts/shoot.js 用，不給網站用。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 依平台找得到的第一個 Chrome。可用 --chrome 或環境變數 CHROME_PATH 指定。
export const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
};

export function findChrome({ explicit = process.env.CHROME_PATH, platform = process.platform, exists = existsSync } = {}) {
  if (explicit) {
    if (!exists(explicit)) throw new Error(`找不到 Chrome：${explicit}`);
    return explicit;
  }
  const found = (CHROME_CANDIDATES[platform] ?? []).find((path) => exists(path));
  if (!found) throw new Error('找不到 Chrome，用 --chrome 或環境變數 CHROME_PATH 指定執行檔');
  return found;
}

// 無頭 Chrome 的啟動參數。
// - 視窗大小不靠 --window-size（無頭模式有最小寬度，390px 會被撐寬），改由 Emulation.setDeviceMetricsOverride 設定。
// - 背景分頁節流會讓 requestAnimationFrame 停住、鏡頭動畫卡在半途，一律關掉。
// - WebGL 在無頭模式可能退回軟體繪圖：--enable-unsafe-swiftshader 讓它至少畫得出來（慢，等待改以畫格計算）。
export function chromeArgs({ userDataDir }) {
  return [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank',
  ];
}

// 啟動無頭 Chrome，回傳 { browser, close }。browser 是瀏覽器層級的 CDP 連線。
export async function launchChrome({ chrome, timeoutMs = 30_000 } = {}) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'tpi-chrome-'));
  const child = spawn(chrome, chromeArgs({ userDataDir }), { stdio: ['ignore', 'ignore', 'pipe'] });
  const cleanup = () => rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  let stderr = '';
  try {
    const endpoint = await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error(`Chrome 在 ${timeoutMs}ms 內沒有開出除錯埠：${stderr.slice(-400)}`)), timeoutMs);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`無法執行 Chrome（${chrome}）：${error.message}`));
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Chrome 提早結束（結束碼 ${code}）：${stderr.slice(-400)}`));
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolvePromise(match[1]);
        }
      });
    });
    const browser = await connect(endpoint);
    const close = async () => {
      await browser.send('Browser.close').catch(() => {});
      browser.close();
      if (child.exitCode === null) {
        await new Promise((r) => {
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            r();
          }, 5000);
          child.once('exit', () => {
            clearTimeout(timer);
            r();
          });
        });
      }
      cleanup();
    };
    return { browser, close };
  } catch (error) {
    child.kill('SIGKILL');
    cleanup();
    throw error;
  }
}

// 一條 CDP 連線。send(method, params, sessionId) 回傳結果；on(event, fn) 收事件（fn 收到 params 與 sessionId）。
export async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', () => reject(new Error(`無法連線 ${endpoint}`)), { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}：${message.error.message}`));
      else entry.resolve(message.result);
      return;
    }
    for (const fn of listeners.get(message.method) ?? []) fn(message.params, message.sessionId);
  });
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) entry.reject(new Error(`${entry.method}：連線已關閉`));
    pending.clear();
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((resolvePromise, reject) => pending.set(id, { method, resolve: resolvePromise, reject }));
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method).add(fn);
      return () => listeners.get(method).delete(fn);
    },
    close() {
      socket.close();
    },
  };
}

// 開一個新分頁並附加（flatten 模式），回傳 send(method, params) 綁好 sessionId 的分頁物件。
export async function openPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  return {
    targetId,
    send: (method, params) => browser.send(method, params, sessionId),
    on: (method, fn) => browser.on(method, (params, from) => from === sessionId && fn(params)),
  };
}
