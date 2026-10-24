// 截圖與版面量測。參數見 --help（-h 或不給任何參數也一樣，內容是 scripts/lib/shoot.js 的 USAGE）。
// 以 Chrome DevTools Protocol 驅動本機無頭 Chrome。沒給 --url 時自動以 scripts/preview.js 開本機預覽（網站目錄 --dir，要先建置）。
// shot 存 PNG；measure 印出名牌與浮動元件重疊數、名牌彼此重疊數與水平捲動（JSON），--out 另存檔，--strict 有問題時結束碼 1。
// 過去手寫截圖腳本踩過的坑，這裡是預設行為：
// - 裝置寬度用 Emulation.setDeviceMetricsOverride，不靠 --window-size（無頭視窗有最小寬度，390px 會被撐寬）。
// - 預設減少動態（鏡頭與時段直接到位、動畫停在固定畫格），截圖可重現；--motion full 時每一步後等鏡頭飛行與時段補間跑完。
// - 預設時段白天，不依執行當下的台灣時間；--time auto 保留自動。
// - 等待以「頁面就緒 + 畫格數」計，軟體繪圖一格很慢時也不會截到還沒畫好的畫面；繪圖器是軟體時會提示。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, launchChrome, openPage } from './lib/cdp.js';
import { USAGE, buildScenario, parseShootArgs, summarizeLayout } from './lib/shoot.js';

const PREVIEW_SCRIPT = fileURLToPath(new URL('./preview.js', import.meta.url));
const POLL_MS = 100;

// 頁面就緒：首頁等資料載入完、島嶼檢視等場景建好（載入提示移除）；其他頁面等文件載入完。資料載入失敗回傳 'error'。
const READY_EXPRESSION = `(() => {
  if (document.readyState !== 'complete') return false;
  if (document.querySelector('.status-error')) return 'error';
  if (!document.getElementById('island-stage')) return true;
  const view = document.body.dataset.view;
  if (!view) return false;
  if (view === 'island') return !document.getElementById('island-status');
  return Boolean(document.querySelector('#table-root > :not(.status)'));
})()`;

const RENDERER_EXPRESSION = `(() => {
  const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
})()`;

const framesExpression = (count) => `new Promise((done) => {
  let n = 0;
  const tick = () => (++n >= ${count} ? done(true) : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
})`;

// 收集量測用的矩形。名牌與浮動元件的定義同 main.js 的 stageObstacles 與 island-view.js 的名牌避讓。
const COLLECT_LAYOUT = `(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const box = (node, name) => {
    const r = node.getBoundingClientRect();
    return { name, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const inView = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  const describe = (node) => node.id ? '#' + node.id : node.tagName.toLowerCase() + (node.classList.length ? '.' + [...node.classList].join('.') : '');
  const mobile = matchMedia('(max-width: 800px)').matches;
  const stage = document.getElementById('island-stage');
  const islandShown = stage && document.body.dataset.view === 'island' && !stage.classList.contains('labels-off');
  const labels = islandShown
    ? [...document.querySelectorAll('.island-label:not(.is-hidden)')]
        .filter((node) => visible(node) && visible(node.parentElement))
        .map((node) => box(node, node.textContent.trim()))
        .filter(inView)
    : [];
  const toolbar = document.getElementById('hud-toolbar');
  const obstacleNodes = [
    document.querySelector('.title-card'),
    ...(toolbar ? (mobile ? [toolbar] : toolbar.querySelectorAll('.tool-group')) : []),
    document.getElementById('index-panel'),
    document.getElementById('view-note'),
    ...document.querySelectorAll('dialog[open]'),
  ];
  const obstacles = obstacleNodes.filter((node) => node && !node.hidden && visible(node)).map((node) => box(node, describe(node))).filter(inView);
  const root = document.documentElement;
  const overflowing = [...document.body.querySelectorAll('*')]
    .filter((node) => visible(node) && node.getBoundingClientRect().right > root.clientWidth + 0.5)
    .slice(0, 10)
    .map((node) => ({ node: describe(node), right: Math.round(node.getBoundingClientRect().right) }));
  return { labels, obstacles, scroll: { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, overflowing } };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  await new Promise((r) => server.close(r));
  return port;
}

// 開本機預覽，回傳 { url, stop }。
async function startPreview({ dir, port }) {
  if (!existsSync(join(resolve(dir), 'data', 'dataset.json'))) {
    throw new Error(`${dir} 沒有公開資料集，先跑 node scripts/build.js`);
  }
  const chosen = port || (await freePort());
  const child = spawn(process.execPath, [PREVIEW_SCRIPT, '--port', String(chosen), '--dir', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`本機預覽沒有啟動：${output}`)), 10_000);
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('本機預覽：')) {
        clearTimeout(timer);
        resolvePromise();
      }
    };
    child.stdout.setEncoding('utf8').on('data', onData);
    child.stderr.setEncoding('utf8').on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`本機預覽提早結束（結束碼 ${code}）：${output}`));
    });
  });
  return { url: `http://localhost:${chosen}/`, stop: () => child.kill() };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(`頁面執行失敗：${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  return result.value;
}

async function waitUntilReady(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ready = await evaluate(page, READY_EXPRESSION).catch(() => false);
    if (ready === 'error') throw new Error('頁面顯示資料載入失敗');
    if (ready === true) return;
    if (Date.now() > deadline) throw new Error(`頁面在 ${timeoutMs}ms 內沒有就緒`);
    await sleep(POLL_MS);
  }
}

async function click(page, step, { touch }) {
  let { x, y } = step;
  if (step.selector) {
    const point = await evaluate(page, `(() => {
      const node = document.querySelector(${JSON.stringify(step.selector)});
      if (!node) return null;
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error(`找不到要點擊的元素：${step.selector}`);
    ({ x, y } = point);
  }
  if (touch) {
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function runStep(page, step, { options, scenario }) {
  switch (step.type) {
    case 'ready':
      return waitUntilReady(page, options.timeoutMs);
    case 'time': {
      // 手機版的時段按鈕藏起來了，用程式點一樣有效。整理方法頁這類沒有島嶼的頁面直接略過。
      const found = await evaluate(page, `(() => {
        if (!document.getElementById('island-stage')) return 'no-island';
        const button = document.querySelector('[data-time="${step.time}"]');
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (found === false) console.warn(`注意：頁面沒有時段按鈕，--time ${step.time} 沒有作用`);
      return;
    }
    case 'click':
      return click(page, step, { touch: scenario.metrics.touch });
    case 'settle':
      await sleep(step.ms);
      return evaluate(page, framesExpression(step.frames));
    case 'wait':
      return sleep(step.ms);
    default:
      throw new Error(`未知的步驟 ${step.type}`);
  }
}

async function run(options) {
  const preview = options.url ? null : await startPreview(options);
  const chrome = await launchChrome({ chrome: findChrome({ explicit: options.chrome ?? process.env.CHROME_PATH }) });
  try {
    const scenario = buildScenario(options, options.url ?? preview.url);
    const page = await openPage(chrome.browser);
    const pageErrors = [];
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => pageErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text));
    page.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type === 'error') pageErrors.push(args.map((a) => a.value ?? a.description).join(' '));
    });
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    const { width, height, deviceScaleFactor, mobile, touch } = scenario.metrics;
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile, screenWidth: width, screenHeight: height });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
    await page.send('Emulation.setEmulatedMedia', { features: scenario.media });

    const renderer = await evaluate(page, RENDERER_EXPRESSION);
    if (!renderer) console.warn('注意：這個 Chrome 沒有 WebGL，首頁會改用表格檢視');
    else if (/swiftshader|llvmpipe|software/i.test(renderer)) console.warn(`注意：WebGL 是軟體繪圖（${renderer}），每格較慢，等待以畫格計`);

    await page.send('Page.navigate', { url: scenario.url });
    for (const step of scenario.steps) await runStep(page, step, { options, scenario });

    for (const message of pageErrors) console.warn(`頁面錯誤：${message}`);
    const label = `${options.device} ${width}x${height}@${deviceScaleFactor}x ${scenario.url}`;
    if (options.command === 'shot') {
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
      const out = resolve(options.out);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(data, 'base64'));
      console.log(`截圖 ${out}（${label}）`);
      return 0;
    }
    const report = { device: options.device, url: scenario.url, ...summarizeLayout(await evaluate(page, COLLECT_LAYOUT)) };
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (options.out) {
      const out = resolve(options.out);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, json);
    }
    process.stdout.write(json);
    return options.strict && !report.ok ? 1 : 0;
  } finally {
    await chrome.close();
    preview?.stop();
  }
}

try {
  const options = parseShootArgs(process.argv.slice(2));
  if (options.command === 'help') process.stdout.write(USAGE);
  else process.exitCode = await run(options);
} catch (error) {
  console.error(`截圖失敗：${error.message}`);
  process.exitCode = 1;
}
