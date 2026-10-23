import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout, islandPoints, projectedBox } from '../site/js/island-layout.js';
import {
  approachInsets, combineInsets, coverInsets, createCameraFlight, FLIGHT_MS, flightDuration, homeView, isDrag,
} from '../site/js/island-camera.js';
import { makeRaw } from './fixtures/make-raw.js';

const from = { target: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 10, z: 10 } };
const to = { target: { x: 4, y: 0, z: -2 }, position: { x: 4, y: 8, z: 6 } };

test('鏡頭飛行約 1.15 秒，進度依實際經過的時間，不依畫了幾幀', () => {
  assert.equal(FLIGHT_MS, 1150);
  const flight = createCameraFlight();
  let arrived = 0;
  flight.start({ from, to, now: 1000, durationMs: FLIGHT_MS, onArrive: () => (arrived += 1) });

  // 起點與一半：緩動在正中間剛好走到一半，與中間畫了幾幀無關。
  assert.deepEqual(flight.step(1000), from);
  const half = flight.step(1000 + FLIGHT_MS / 2);
  assert.deepEqual(half.target, { x: 2, y: 0, z: -1 });
  assert.deepEqual(half.position, { x: 2, y: 9, z: 8 });
  // 慢裝置一幀就跨過終點：直接落在目的地並通知抵達一次。
  assert.equal(arrived, 0);
  assert.deepEqual(flight.step(1000 + FLIGHT_MS * 3), to);
  assert.equal(arrived, 1);
  assert.equal(flight.active, false);
  assert.equal(flight.step(5000), null);
});

test('緩動起訖都放慢：前四分之一時間走不到四分之一路程', () => {
  const flight = createCameraFlight();
  flight.start({ from, to, now: 0, durationMs: 1000 });

  const quarter = flight.step(250);

  assert.ok(quarter.target.x > 0 && quarter.target.x < 1, `走了 ${quarter.target.x}`);
});

test('使用者拖曳就取消飛行：鏡頭停在原處，抵達後的動作（開卡片）立即執行一次', () => {
  const flight = createCameraFlight();
  let arrived = 0;
  flight.start({ from, to, now: 0, durationMs: FLIGHT_MS, onArrive: () => (arrived += 1) });
  flight.step(300);

  flight.cancel();

  assert.equal(flight.active, false);
  assert.equal(flight.step(600), null);
  assert.equal(arrived, 1);
  flight.cancel();
  assert.equal(arrived, 1);
});

test('飛行途中改飛別處：新的飛行取代前一段，前一段抵達後的動作不再執行', () => {
  const flight = createCameraFlight();
  const arrived = [];
  flight.start({ from, to, now: 0, onArrive: () => arrived.push('a') });
  flight.step(300);
  flight.start({ from: to, to: from, now: 300, onArrive: () => arrived.push('b') });

  assert.deepEqual(flight.step(300 + FLIGHT_MS), from);
  assert.deepEqual(arrived, ['b']);
});

test('減少動態時飛行時間為 0，第一幀就落在目的地', () => {
  assert.equal(flightDuration({ reducedMotion: false }), FLIGHT_MS);
  const flight = createCameraFlight();
  let arrived = 0;
  flight.start({ from, to, now: 0, durationMs: flightDuration({ reducedMotion: true }), onArrive: () => (arrived += 1) });

  assert.deepEqual(flight.step(0), to);
  assert.equal(arrived, 1);
});

test('按下後移動超過 6 像素算拖曳，在範圍內算點選', () => {
  const down = { x: 100, y: 100 };
  assert.equal(isDrag(down, { x: 104, y: 103 }), false);
  assert.equal(isDrag(down, { x: 105, y: 105 }), true);
  assert.equal(isDrag(null, { x: 300, y: 300 }), false);
});

test('卡片遮住的範圍：停靠在下方的卡片算下緣被遮住，保留面積最大的那一側', () => {
  const viewport = { width: 1440, height: 900 };
  // 桌面：卡片停靠在下方、索引面板左側。
  assert.deepEqual(coverInsets({ left: 16, top: 486, right: 1068, bottom: 884 }, viewport), { top: 0, right: 0, bottom: 414, left: 0 });
  // 右側直立的卡片算右緣被遮住。
  assert.deepEqual(coverInsets({ left: 1000, top: 80, right: 1424, bottom: 884 }, viewport), { top: 0, right: 440, bottom: 0, left: 0 });
  // 關閉的卡片沒有大小，不遮住任何邊。
  assert.deepEqual(coverInsets({ left: 0, top: 0, right: 0, bottom: 0 }, viewport), { top: 0, right: 0, bottom: 0, left: 0 });
});

test('手機抽屜三段各自對應偏移：一半遮住下半、全螢幕留最小可見區、關閉不偏移', () => {
  const viewport = { width: 390, height: 844 };
  const base = { top: 60, right: 0, bottom: 80, left: 0 };
  const sheet = (top) => combineInsets(base, coverInsets({ left: 0, top, right: 390, bottom: 844 }, viewport), viewport);

  assert.deepEqual(sheet(422), { top: 60, right: 0, bottom: 422, left: 0 });
  const full = sheet(0);
  assert.ok(844 - full.top - full.bottom >= 844 * 0.2 - 1e-9, JSON.stringify(full));
  assert.deepEqual(combineInsets(base, coverInsets({ left: 0, top: 0, right: 0, bottom: 0 }, viewport), viewport), base);
});

test('偏移以指數平滑跟上卡片，減少動態時直接到位', () => {
  const current = { top: 0, right: 0, bottom: 0, left: 0 };
  const target = { top: 0, right: 0, bottom: 400, left: 0 };

  const step = approachInsets(current, target, 1 / 6);
  // 1 - e^(-1) ≈ 0.632
  assert.ok(Math.abs(step.bottom - 400 * (1 - Math.exp(-1))) < 1e-9, String(step.bottom));
  assert.deepEqual(approachInsets(current, target, 1 / 60, { reducedMotion: true }), target);
  // 差不到半像素就直接到位，迴圈才會停下來。
  assert.deepEqual(approachInsets({ ...target, bottom: 399.8 }, target, 1 / 60), target);
});

const taichungLike = () => {
  // 東西長、南北窄的島，跟正式資料的形狀相近。
  const raw = makeRaw();
  raw.decorativeTiles = [-5, -4, -3, -2, -1, 1, 2, 3, 4].map((q, i) => ({ id: `tile-${i}`, axial: [q, q % 2 ? -1 : 1], localElementId: null }));
  return islandPoints(islandLayout(buildViewModel(buildPublicDataset(raw))), { surface: 0.44, top: 1.5 });
};

test('直式畫面的預設視角用較低俯角並轉一點方位角，島比正南方構圖大；橫式畫面維持正南方', () => {
  const points = taichungLike();
  const portraitAspect = 390 / 600;

  const portrait = homeView(points, { fov: 32, aspect: portraitAspect, fill: 0.8 });
  const landscape = homeView(points, { fov: 32, aspect: 1.5, fill: 0.8 });
  const southOnly = homeView(points, { fov: 32, aspect: portraitAspect, fill: 0.8, azimuths: [0] });

  assert.equal(landscape.azimuth, 0);
  assert.notEqual(portrait.azimuth, 0);
  assert.ok(Math.abs(portrait.azimuth) <= 1);
  assert.ok(portrait.polar > landscape.polar - 1e-9, '直式俯角不比橫式高');
  assert.ok(portrait.distance < southOnly.distance * 0.95, `${portrait.distance} vs ${southOnly.distance}`);
  // 轉了方位角，島仍置中、最長邊占 80%。
  const box = projectedBox(points, { fov: 32, aspect: portraitAspect, ...portrait });
  assert.ok(Math.abs((box.minX + box.maxX) / 2) < 0.01 && Math.abs((box.minY + box.maxY) / 2) < 0.01, JSON.stringify(box));
  assert.ok(Math.abs(Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2 - 0.8) < 0.01);
});
