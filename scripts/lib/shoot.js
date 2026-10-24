// 截圖工具（scripts/shoot.js）的純函式：參數解析、裝置、場景組合（網址與步驟）、量測結果計算。Node 可測，不碰瀏覽器。
import { parseArgs } from 'node:util';
import { FLIGHT_MS } from '../../site/js/island-camera.js';
import { TIMES_OF_DAY, TRANSITION_MS } from '../../site/js/island-daylight.js';
import { VIEWS, formatSearch } from '../../site/js/app-state.js';
import { formatUsage } from './usage.js';

// mobile 與 touch 讓頁面的 (pointer: coarse) 成立，手機版的畫質與操作才和真機一致。
export const DEVICES = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, touch: false },
  laptop: { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false, touch: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, touch: true },
};

export const TIMES = ['auto', ...TIMES_OF_DAY.map((t) => t.id)];
export const MOTIONS = ['reduce', 'full'];
// 媒體類型：print 時套用頁面的列印樣式（例如我的對照單的列印版面）。
export const MEDIA_TYPES = ['screen', 'print'];
export const COMMANDS = ['shot', 'measure'];

// 完整動態時，每一步之後至少等鏡頭飛完與時段補間跑完再截圖，避免截到半途。減少動態時鏡頭與時段直接到位。
export const SETTLE_MS = { reduce: 300, full: Math.max(FLIGHT_MS, TRANSITION_MS) + 400 };
// 等頁面就緒之後再多等的畫格數。軟體繪圖時一格可能要數百毫秒，所以用畫格計，不用固定毫秒。
export const SETTLE_FRAMES = 8;

const OPTIONS = {
  device: { type: 'string', default: 'desktop' },
  motion: { type: 'string', default: 'reduce' },
  media: { type: 'string', default: 'screen' },
  time: { type: 'string', default: 'day' },
  path: { type: 'string', default: '/' },
  view: { type: 'string' },
  area: { type: 'string' },
  policy: { type: 'string' },
  candidate: { type: 'string' },
  q: { type: 'string' },
  district: { type: 'string' },
  click: { type: 'string', multiple: true, default: [] },
  drag: { type: 'string', multiple: true, default: [] },
  wait: { type: 'string', default: '0' },
  'no-settle': { type: 'boolean', default: false },
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

// 拖曳：「x1,y1-x2,y2」是起點與終點的畫面座標（CSS 像素），只收座標。
export function parseDrag(text) {
  const number = '\\s*(\\d+(?:\\.\\d+)?)\\s*';
  const match = text.match(new RegExp(`^${number},${number}-${number},${number}$`));
  if (!match) throw new Error(`--drag 應為 x1,y1-x2,y2，實際為 ${text}`);
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  return { from: { x: x1, y: y1 }, to: { x: x2, y: y2 } };
}

// 操作（--click、--drag）依命令列上的順序排成一串。
function actionsOf(tokens) {
  return tokens
    .filter((token) => token.kind === 'option' && (token.name === 'click' || token.name === 'drag'))
    .map((token) => (token.name === 'click'
      ? { type: 'click', ...parseClick(token.value) }
      : { type: 'drag', ...parseDrag(token.value) }));
}

export const USAGE = formatUsage({
  summary: '截圖與版面量測：以本機無頭 Chrome 開網站，截圖或量測版面。',
  usage: [
    ['node scripts/shoot.js shot [參數]', '截圖存成 PNG（子指令省略時為 shot，但至少要給一個參數）'],
    ['node scripts/shoot.js measure [參數]', '印出名牌重疊與水平捲動的量測結果（JSON）'],
    ['node scripts/shoot.js --help', '顯示這段說明（-h 或不給任何參數也一樣）'],
  ],
  usageColumn: 39,
  optionColumn: 32,
  sections: [
    {
      title: '畫面',
      rows: [
        ['--device desktop|laptop|phone', '裝置：desktop 1440x900、laptop 1024x768、phone 390x844 三倍像素加觸控（預設 desktop）'],
        ['--motion reduce|full', '減少動態（鏡頭與時段直接到位）或完整動態（每步後等動畫跑完）（預設 reduce）'],
        ['--time auto|dawn|day|dusk|night', '時段；auto 依台灣時間（預設 day）'],
        ['--media screen|print', '媒體類型；print 套用頁面的列印樣式（預設 screen）'],
      ],
    },
    {
      title: '網址',
      rows: [
        ['--path /', '頁面路徑，例如 /method.html'],
        ['--view island|table', '檢視'],
        ['--area <id>  --policy <id>  --candidate <id>  --q <關鍵字>  --district <行政區>'],
      ],
    },
    {
      title: '操作',
      rows: [
        ['--click <x,y 或 CSS 選擇器>', '點擊畫面座標或元素中心，可重複，依序執行'],
        ['--drag <x1,y1-x2,y2>', '從起點拖到終點（滑鼠左鍵；手機用一指觸控），可重複，與 --click 依命令列順序執行'],
        ['--wait <毫秒>', '最後再多等的時間（預設 0）'],
        ['--no-settle', '最後一個操作之後不等動畫到位，--wait 從操作完成起算（截動畫途中的畫面）'],
      ],
    },
    {
      title: '輸出',
      rows: [
        ['--out <路徑>', 'shot 的 PNG（預設 shot.png）；measure 另存 JSON（預設不存）'],
        ['--strict', 'measure 有重疊或水平捲動時結束碼 1'],
      ],
    },
    {
      title: '環境',
      rows: [
        ['--url <網址>', '指定網站網址；不給時自動開本機預覽（要先建置）'],
        ['--dir site  --port 0', '本機預覽的網站目錄與埠（0 為自動挑選）'],
        ['--chrome <執行檔>', 'Chrome 路徑，也可用環境變數 CHROME_PATH'],
        ['--timeout 60000', '等頁面就緒的上限（毫秒）'],
      ],
    },
  ],
  notes: [
    '以 Chrome DevTools Protocol（CDP）驅動；裝置寬度用模擬，390px 不會被撐寬。手機版驗證用這支，不用無頭 Chrome 的 --window-size（它有最小寬度）。',
    '預設減少動態、白天，同樣的參數截圖可重現。',
    'measure 量測名牌與浮動元件的重疊數、名牌彼此的重疊數與水平捲動。',
  ],
});

// 命令列參數 → 設定。第一個位置參數是子指令（shot 或 measure，省略為 shot）。
// 沒有任何參數、或有 --help／-h 時回傳 { command: 'help' }。
export function parseShootArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return { command: 'help' };
  const { values, positionals, tokens } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, tokens: true });
  if (positionals.length > 1) throw new Error(`多出的參數：${positionals.slice(1).join(' ')}`);
  const command = oneOf('子指令', positionals[0] ?? 'shot', COMMANDS);
  if (values.url && !/^https?:\/\/\S+$/.test(values.url)) throw new Error(`--url 應為 http(s) 網址，實際為 ${values.url}`);
  if (values.view) oneOf('view', values.view, VIEWS);
  if (!values.path.startsWith('/')) throw new Error(`--path 應以 / 開頭，實際為 ${values.path}`);
  return {
    command,
    device: oneOf('device', values.device, Object.keys(DEVICES)),
    motion: oneOf('motion', values.motion, MOTIONS),
    media: oneOf('media', values.media, MEDIA_TYPES),
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
    actions: actionsOf(tokens),
    settleLast: !values['no-settle'],
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
// 步驟：ready（等頁面就緒）、time（切時段）、click、drag、settle（等動畫到位）、wait（額外毫秒）。
export function buildScenario(options, baseUrl) {
  const url = new URL(options.path, baseUrl);
  url.search = formatSearch(options.params);
  const settle = { type: 'settle', ms: SETTLE_MS[options.motion], frames: SETTLE_FRAMES };
  const steps = [{ type: 'ready' }, settle];
  if (options.time !== 'auto') steps.push({ type: 'time', time: options.time }, settle);
  options.actions.forEach((action, i) => {
    steps.push(action);
    if (options.settleLast || i < options.actions.length - 1) steps.push(settle);
  });
  if (options.waitMs > 0) steps.push({ type: 'wait', ms: options.waitMs });
  // 列印樣式在點擊與等待之後才套用（列印樣式常把按鈕藏起來，先套用就點不到）。
  if (options.media !== 'screen') steps.push({ type: 'media', media: options.media }, settle);
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
