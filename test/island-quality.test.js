import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFpsGovernor, initialQuality } from '../site/js/island-quality.js';

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IN_APP_UAS = {
  Facebook: `${IPHONE_UA} [FBAN/FBIOS;FBAV/480.0.0]`,
  Instagram: `${IPHONE_UA} Instagram 350.0.0`,
  LINE: `${IPHONE_UA} Line/14.0.0`,
  Threads: `${IPHONE_UA} Barcelona 360.0.0`,
};

test('桌機預設高畫質：像素比上限 1.75、陰影每幀更新', () => {
  const q = initialQuality({ width: 1440, coarsePointer: false, devicePixelRatio: 2, userAgent: DESKTOP_UA });
  assert.deepEqual(
    [q.level, q.pixelRatio, q.antialias, q.shadows, q.shadowMapSize, q.shadowEvery, q.lowFx],
    ['high', 1.75, true, true, 2048, 1, false],
  );
});

test('手機或 800px 以下預設中畫質', () => {
  const phone = initialQuality({ width: 390, coarsePointer: true, devicePixelRatio: 3, userAgent: IPHONE_UA });
  const narrow = initialQuality({ width: 760, coarsePointer: false, devicePixelRatio: 1, userAgent: DESKTOP_UA });
  assert.deepEqual([phone.level, phone.pixelRatio, phone.shadowMapSize, phone.antialias], ['medium', 1.35, 1024, false]);
  assert.deepEqual([narrow.level, narrow.pixelRatio, narrow.antialias], ['medium', 1, true]);
});

test('社群 App 內建瀏覽器預設低畫質：關抗鋸齒、像素比 1、陰影每 6 幀更新', () => {
  for (const [app, userAgent] of Object.entries(IN_APP_UAS)) {
    const q = initialQuality({ width: 390, coarsePointer: true, devicePixelRatio: 3, userAgent });
    assert.deepEqual([q.level, q.pixelRatio, q.antialias, q.shadowEvery], ['low', 1, false, 6], app);
  }
});

// 以固定幀率送 seconds 秒的畫格，回傳過程中所有降級結果。
function run(governor, { fps, seconds, from = 0 }) {
  const changes = [];
  for (let now = from; now <= from + seconds * 1000; now += 1000 / fps) {
    const next = governor.frame(now);
    if (next) changes.push(next);
  }
  return changes;
}

const high = () => initialQuality({ width: 1440, coarsePointer: false, devicePixelRatio: 2, userAgent: DESKTOP_UA });

test('fps 維持 60 時不降級', () => {
  assert.deepEqual(run(createFpsGovernor(high()), { fps: 60, seconds: 20 }), []);
});

test('前 3 秒不算；之後每 2 秒平均低於 28 fps 就降像素比 0.25、關毛玻璃、陰影改每 6 幀更新', () => {
  const governor = createFpsGovernor(high());

  assert.deepEqual(run(governor, { fps: 15, seconds: 2.9 }), []);
  const [first, ...rest] = run(governor, { fps: 15, seconds: 2.2, from: 3000 });

  assert.equal(rest.length, 0);
  assert.deepEqual([first.pixelRatio, first.lowFx, first.shadowEvery, first.level], [1.5, true, 6, 'high']);
});

test('持續卡頓就繼續降，像素比最低到 1', () => {
  const changes = run(createFpsGovernor(high()), { fps: 15, seconds: 30 });
  assert.deepEqual(changes.map((q) => q.pixelRatio), [1.5, 1.25, 1]);
});

test('剛好 30 fps（省電模式鎖幀）不降級', () => {
  assert.deepEqual(run(createFpsGovernor(high()), { fps: 30, seconds: 20 }), []);
});

test('動畫暫停期間沒有畫格，恢復後不把停住的時間算成卡頓', () => {
  const governor = createFpsGovernor(high());
  run(governor, { fps: 60, seconds: 4 });
  governor.pause();

  assert.deepEqual(run(governor, { fps: 60, seconds: 4, from: 60_000 }), []);
});
