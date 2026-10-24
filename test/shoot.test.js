import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FLIGHT_MS } from '../site/js/island-camera.js';
import { TRANSITION_MS } from '../site/js/island-daylight.js';
import { DEVICES, SETTLE_MS, USAGE, buildScenario, overlapArea, parseClick, parseDrag, parseShootArgs, summarizeLayout } from '../scripts/lib/shoot.js';
import { CHROME_CANDIDATES, chromeArgs, findChrome } from '../scripts/lib/cdp.js';

const SHOOT_SCRIPT = fileURLToPath(new URL('../scripts/shoot.js', import.meta.url));

test('說明：--help、-h 或不給任何參數時回傳說明，不解析其他參數', () => {
  assert.deepEqual(parseShootArgs([]), { command: 'help' });
  assert.deepEqual(parseShootArgs(['--help']), { command: 'help' });
  assert.deepEqual(parseShootArgs(['measure', '-h']), { command: 'help' });
  assert.deepEqual(parseShootArgs(['--device', 'tablet', '--help']), { command: 'help' });
});

test('說明：指令印出子指令與每個參數並以結束碼 0 結束', () => {
  for (const args of [['--help'], ['-h'], []]) {
    const result = spawnSync(process.execPath, [SHOOT_SCRIPT, ...args], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, USAGE);
  }
  for (const name of ['shot', 'measure', '--device', '--motion', '--time', '--path', '--view', '--area', '--policy', '--candidate',
    '--q', '--district', '--click', '--drag', '--wait', '--out', '--strict', '--url', '--dir', '--port', '--chrome', '--timeout']) {
    assert.ok(USAGE.includes(name), `說明缺少 ${name}`);
  }
});

test('截圖參數：預設桌面、減少動態、白天，子指令省略為 shot 並輸出 shot.png', () => {
  const options = parseShootArgs(['shot']);
  assert.deepEqual(parseShootArgs(['--wait', '0']).command, 'shot');

  assert.equal(options.command, 'shot');
  assert.equal(options.device, 'desktop');
  assert.equal(options.motion, 'reduce');
  assert.equal(options.time, 'day');
  assert.equal(options.out, 'shot.png');
  assert.equal(options.url, null);
  assert.deepEqual(options.actions, []);
});

test('截圖參數：measure 預設不寫檔；網址參數、點擊與等待都會解析', () => {
  const options = parseShootArgs([
    'measure', '--device', 'phone', '--motion', 'full', '--time', 'night', '--area', 'transportation',
    '--candidate', 'sample-jia', '--view', 'island', '--q', '捷運', '--click', '120,300', '--click', '#tool-index', '--wait', '500',
  ]);

  assert.equal(options.command, 'measure');
  assert.equal(options.out, null);
  assert.deepEqual(options.params, { view: 'island', area: 'transportation', policy: null, candidate: 'sample-jia', query: '捷運', district: '' });
  assert.deepEqual(options.actions, [{ type: 'click', x: 120, y: 300 }, { type: 'click', selector: '#tool-index' }]);
  assert.equal(options.waitMs, 500);
});

test('拖曳參數：--drag x1,y1-x2,y2 解析成起訖座標，與 --click 依命令列的順序執行', () => {
  const options = parseShootArgs(['--click', '#tool-index', '--drag', '700,450-400,300', '--click', '10,20', '--drag', '1.5, 2 - 3,4.5']);

  assert.deepEqual(options.actions, [
    { type: 'click', selector: '#tool-index' },
    { type: 'drag', from: { x: 700, y: 450 }, to: { x: 400, y: 300 } },
    { type: 'click', x: 10, y: 20 },
    { type: 'drag', from: { x: 1.5, y: 2 }, to: { x: 3, y: 4.5 } },
  ]);
  assert.deepEqual(parseDrag('0,0-10,0'), { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } });
  for (const bad of ['700,450', '#tool-index', '1,2-3', 'a,b-c,d', '']) {
    assert.throws(() => parseShootArgs(['--drag', bad]), /--drag/);
  }
});

test('場景：拖曳和點擊一樣是一個步驟，之後等動畫到位', () => {
  const options = parseShootArgs(['--device', 'phone', '--drag', '200,400-100,300', '--wait', '100']);

  const { steps } = buildScenario(options, 'http://localhost:8123/');

  assert.deepEqual(steps.map((s) => s.type), ['ready', 'settle', 'time', 'settle', 'drag', 'settle', 'wait']);
  assert.deepEqual(steps[4], { type: 'drag', from: { x: 200, y: 400 }, to: { x: 100, y: 300 } });
});

test('截圖參數：不在清單內的值與格式錯誤一律拒絕並說明', () => {
  assert.throws(() => parseShootArgs(['--device', 'tablet']), /--device/);
  assert.throws(() => parseShootArgs(['--time', 'noon']), /--time/);
  assert.throws(() => parseShootArgs(['--motion', 'none']), /--motion/);
  assert.throws(() => parseShootArgs(['--view', 'map']), /--view/);
  assert.throws(() => parseShootArgs(['--wait', '-1']), /--wait/);
  assert.throws(() => parseShootArgs(['--url', 'localhost:8000']), /--url/);
  assert.throws(() => parseShootArgs(['--path', 'method.html']), /--path/);
  assert.throws(() => parseShootArgs(['print']), /子指令/);
  assert.throws(() => parseShootArgs(['--click', ' ']), /--click/);
});

test('點擊目標：x,y 是座標，其他字串是選擇器', () => {
  assert.deepEqual(parseClick('10, 20.5'), { x: 10, y: 20.5 });
  assert.deepEqual(parseClick('.island-label'), { selector: '.island-label' });
});

test('裝置：手機 390x844、三倍像素並模擬觸控，桌面與筆電不模擬觸控', () => {
  assert.deepEqual(DEVICES.phone, { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, touch: true });
  assert.equal(DEVICES.desktop.width, 1440);
  assert.equal(DEVICES.laptop.width, 1024);
  assert.equal(DEVICES.desktop.touch, false);
});

test('場景：網址帶上檢視參數，步驟依序為就緒、時段、點擊、額外等待，每步之後都等動畫到位', () => {
  const options = parseShootArgs(['--device', 'phone', '--time', 'dusk', '--area', 'transportation', '--click', '#tool-index', '--wait', '200']);

  const scenario = buildScenario(options, 'http://localhost:8123/');

  assert.equal(scenario.url, 'http://localhost:8123/?area=transportation');
  assert.equal(scenario.metrics, DEVICES.phone);
  assert.deepEqual(scenario.media, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.deepEqual(scenario.steps.map((s) => s.type), ['ready', 'settle', 'time', 'settle', 'click', 'settle', 'wait']);
  assert.equal(scenario.steps[2].time, 'dusk');
  assert.equal(scenario.steps[4].selector, '#tool-index');
});

test('媒體類型：預設 screen 不切換；--media print 在點擊與等待之後才切到列印樣式；其他值擋下', () => {
  assert.equal(parseShootArgs(['shot']).media, 'screen');
  assert.ok(!buildScenario(parseShootArgs(['shot']), 'http://localhost:8123/').steps.some((s) => s.type === 'media'));
  const options = parseShootArgs(['--media', 'print', '--click', '.shortlist-open', '--wait', '100']);
  assert.equal(options.media, 'print');
  const { steps } = buildScenario(options, 'http://localhost:8123/');
  assert.deepEqual(steps.map((s) => s.type), ['ready', 'settle', 'time', 'settle', 'click', 'settle', 'wait', 'media', 'settle']);
  assert.equal(steps[7].media, 'print');
  assert.throws(() => parseShootArgs(['--media', 'paper']), /--media/);
});

test('場景：完整動態時等到鏡頭飛行與時段補間都跑完；--time auto 不切時段；--path 換頁面', () => {
  const options = parseShootArgs(['--motion', 'full', '--time', 'auto', '--path', '/method.html']);

  const scenario = buildScenario(options, 'http://localhost:8123/');

  assert.equal(scenario.url, 'http://localhost:8123/method.html');
  assert.deepEqual(scenario.media, [{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  assert.deepEqual(scenario.steps.map((s) => s.type), ['ready', 'settle']);
  assert.ok(scenario.steps[1].ms > FLIGHT_MS && scenario.steps[1].ms > TRANSITION_MS);
  assert.ok(SETTLE_MS.reduce < SETTLE_MS.full);
});

const rect = (name, left, top, width, height) => ({ name, left, top, right: left + width, bottom: top + height, width, height });

test('重疊面積：只碰到邊不算重疊', () => {
  assert.equal(overlapArea(rect('a', 0, 0, 10, 10), rect('b', 5, 5, 10, 10)), 25);
  assert.equal(overlapArea(rect('a', 0, 0, 10, 10), rect('b', 10, 0, 10, 10)), 0);
});

test('量測：算出名牌與浮動元件、名牌彼此的重疊數與水平捲動', () => {
  const layout = {
    labels: [rect('01 交通', 100, 100, 60, 20), rect('02 治安', 150, 110, 60, 20), rect('03 產業', 500, 500, 60, 20)],
    obstacles: [rect('header.title-card', 0, 0, 200, 105), rect('#index-panel', 1000, 0, 400, 900)],
    scroll: { scrollWidth: 1440, clientWidth: 1440, overflowing: [] },
  };

  const report = summarizeLayout(layout);

  assert.equal(report.labels, 3);
  assert.equal(report.labelObstacleOverlaps, 1);
  assert.deepEqual(report.details.labelObstacle, [{ label: '01 交通', obstacle: 'header.title-card', area: 300 }]);
  assert.equal(report.labelLabelOverlaps, 1);
  assert.equal(report.horizontalScroll, false);
  assert.equal(report.ok, false);
});

test('量測：沒有重疊也沒有水平捲動才算通過；只擦到次像素的不算', () => {
  const clean = summarizeLayout({
    labels: [rect('01 交通', 100, 200, 60, 20)],
    obstacles: [rect('header.title-card', 0, 0, 200, 200.01)],
    scroll: { scrollWidth: 390, clientWidth: 390, overflowing: [] },
  });
  assert.equal(clean.ok, true);

  const scrolling = summarizeLayout({ labels: [], obstacles: [], scroll: { scrollWidth: 420, clientWidth: 390, overflowing: [{ node: 'table', right: 420 }] } });
  assert.equal(scrolling.horizontalScroll, true);
  assert.equal(scrolling.ok, false);
});

test('Chrome：無頭啟動不用 --window-size，關掉背景節流；找執行檔依平台清單或指定路徑', () => {
  const args = chromeArgs({ userDataDir: '/tmp/x' });
  assert.ok(args.includes('--headless=new'));
  assert.ok(args.includes('--disable-background-timer-throttling'));
  assert.ok(!args.some((a) => a.startsWith('--window-size')));

  const linux = CHROME_CANDIDATES.linux;
  assert.equal(findChrome({ explicit: '', platform: 'linux', exists: (p) => p === linux[1] }), linux[1]);
  assert.equal(findChrome({ explicit: '/opt/chrome', exists: () => true }), '/opt/chrome');
  assert.throws(() => findChrome({ explicit: '/opt/chrome', exists: () => false }), /找不到 Chrome/);
  assert.throws(() => findChrome({ explicit: '', platform: 'linux', exists: () => false }), /CHROME_PATH/);
});
