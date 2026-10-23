// 截圖工具（scripts/shoot.js）的純函式：參數解析、裝置、場景組合（網址與步驟）、量測結果計算。Node 可測，不碰瀏覽器。
import { parseArgs } from 'node:util';
import { FLIGHT_MS } from '../../site/js/island-camera.js';
import { TIMES_OF_DAY, TRANSITION_MS } from '../../site/js/island-daylight.js';
import { VIEWS, formatSearch } from '../../site/js/app-state.js';

// mobile 與 touch 讓頁面的 (pointer: coarse) 成立，手機版的畫質與操作才和真機一致。
export const DEVICES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, touch: false },
  laptop: { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false, touch: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, touch: true },
};

export const TIMES = ['auto', ...TIMES_OF_DAY.map((t) => t.id)];
export const MOTIONS = ['reduce', 'full'];
export const COMMANDS = ['shot', 'measure'];

// 完整動態時，每一步之後至少等鏡頭飛完與時段補間跑完再截圖，避免截到半途。減少動態時鏡頭與時段直接到位。
export const SETTLE_MS = { reduce: 300, full: Math.max(FLIGHT_MS, TRANSITION_MS) + 400 };
// 等頁面就緒之後再多等的畫格數。軟體繪圖時一格可能要數百毫秒，所以用畫格計，不用固定毫秒。
export const SETTLE_FRAMES = 8;

const OPTIONS = {
  device: { type: 'string', default: 'desktop' },
  motion: { type: 'string', default: 'reduce' },
  time: { type: 'string', default: 'day' },
  path: { type: 'string', default: '/' },
  view: { type: 'string' },
  area: { type: 'string' },
  policy: { type: 'string' },
  candidate: { type: 'string' },
  q: { type: 'string' },
  district: { type: 'string' },
  click: { type: 'string', multiple: true, default: [] },
  wait: { type: 'string', default: '0' },
  out: { type: 'string' },
  url: { type: 'string' },
  dir: { type: 'string', default: 'site' },
  port: { type: 'string', default: '0' },
  chrome: { type: 'string' },
  timeout: { type: 'string', default: '60000' },
  strict: { type: 'boolean', default: false },
};

const nonNegativeInt = (name, text) => {
  if (!/^\d+$/.test(text)) throw new Error(`--${name} 應為非負整數，實際為 ${text}`);
  return Number(text);
};

const oneOf = (name, value, list) => {
  if (!list.includes(value)) throw new Error(`--${name} 應為其中之一：${list.join('、')}，實際為 ${value}`);
  return value;
};

// 點擊目標：「x,y」是畫面座標（CSS 像素），其餘當 CSS 選擇器（點元素中心）。
export function parseClick(text) {
  const match = text.match(/^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*$/);
  if (match) return { x: Number(match[1]), y: Number(match[2]) };
  if (text.trim() === '') throw new Error('--click 不能是空字串');
  return { selector: text };
}

// 命令列參數 → 設定。第一個位置參數是子指令（shot 或 measure，省略為 shot）。
export function parseShootArgs(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  if (positionals.length > 1) throw new Error(`多出的參數：${positionals.slice(1).join(' ')}`);
  const command = oneOf('子指令', positionals[0] ?? 'shot', COMMANDS);
  if (values.url && !/^https?:\/\/\S+$/.test(values.url)) throw new Error(`--url 應為 http(s) 網址，實際為 ${values.url}`);
  if (values.view) oneOf('view', values.view, VIEWS);
  if (!values.path.startsWith('/')) throw new Error(`--path 應以 / 開頭，實際為 ${values.path}`);
  return {
    command,
    device: oneOf('device', values.device, Object.keys(DEVICES)),
    motion: oneOf('motion', values.motion, MOTIONS),
    time: oneOf('time', values.time, TIMES),
    path: values.path,
    params: {
      view: values.view ?? null,
      area: values.area ?? null,
      policy: values.policy ?? null,
      candidate: values.candidate ?? null,
      query: values.q ?? '',
      district: values.district ?? '',
    },
    clicks: values.click.map(parseClick),
    waitMs: nonNegativeInt('wait', values.wait),
    out: values.out ?? (command === 'shot' ? 'shot.png' : null),
    url: values.url ?? null,
    dir: values.dir,
    port: nonNegativeInt('port', values.port),
    chrome: values.chrome ?? null,
    timeoutMs: nonNegativeInt('timeout', values.timeout),
    strict: values.strict,
  };
}

// 設定 → 場景：要開的網址、裝置尺寸、媒體特性與依序執行的步驟。
// 步驟：ready（等頁面就緒）、time（切時段）、click、settle（等動畫到位）、wait（額外毫秒）。
export function buildScenario(options, baseUrl) {
  const url = new URL(options.path, baseUrl);
  url.search = formatSearch(options.params);
  const settle = { type: 'settle', ms: SETTLE_MS[options.motion], frames: SETTLE_FRAMES };
  const steps = [{ type: 'ready' }, settle];
  if (options.time !== 'auto') steps.push({ type: 'time', time: options.time }, settle);
  for (const click of options.clicks) steps.push({ type: 'click', ...click }, settle);
  if (options.waitMs > 0) steps.push({ type: 'wait', ms: options.waitMs });
  return {
    url: url.href,
    metrics: DEVICES[options.device],
    media: [{ name: 'prefers-reduced-motion', value: options.motion === 'reduce' ? 'reduce' : 'no-preference' }],
    steps,
  };
}

// 兩個矩形 { left, top, right, bottom } 的重疊面積；只碰到邊不算。
export function overlapArea(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

// 量測結果：名牌與浮動元件重疊、名牌彼此重疊、水平捲動。輸入是頁面上收集的矩形（見 shoot.js 的 COLLECT_LAYOUT）。
// minArea 濾掉次像素的擦邊（名牌避讓有 8px 遲滯，量測只看真的蓋到的）。
export function summarizeLayout({ labels, obstacles, scroll }, { minArea = 1 } = {}) {
  const labelObstacle = [];
  for (const label of labels) {
    for (const obstacle of obstacles) {
      const area = overlapArea(label, obstacle);
      if (area >= minArea) labelObstacle.push({ label: label.name, obstacle: obstacle.name, area: Math.round(area) });
    }
  }
  const labelLabel = [];
  labels.forEach((a, i) => {
    for (const b of labels.slice(i + 1)) {
      const area = overlapArea(a, b);
      if (area >= minArea) labelLabel.push({ a: a.name, b: b.name, area: Math.round(area) });
    }
  });
  const horizontalScroll = scroll.scrollWidth > scroll.clientWidth;
  return {
    labels: labels.length,
    obstacles: obstacles.map((o) => o.name),
    labelObstacleOverlaps: labelObstacle.length,
    labelLabelOverlaps: labelLabel.length,
    horizontalScroll,
    scrollWidth: scroll.scrollWidth,
    clientWidth: scroll.clientWidth,
    ok: labelObstacle.length === 0 && labelLabel.length === 0 && !horizontalScroll,
    details: { labelObstacle, labelLabel, overflowing: scroll.overflowing },
  };
}
