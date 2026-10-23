import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendLighting, createDaylight, DEFAULT_TIME_OF_DAY, glowLevel, KEYFRAMES, landShade, timeOfDayAt, TIMES_OF_DAY, TRANSITION_MS,
} from '../site/js/island-daylight.js';

// 台灣時間（UTC+8）的某日某時某分，換成毫秒時間戳。
const taipei = (day, hour, minute = 0) => Date.UTC(2026, 9, day, hour - 8, minute);

test('自動時段依台灣時間：05–08 清晨、08–16 白天、16–19 黃昏、19–05 夜晚，邊界那一分鐘屬於下一段', () => {
  const cases = [
    [0, 0, 'night'], [4, 59, 'night'], [5, 0, 'dawn'], [7, 59, 'dawn'], [8, 0, 'day'], [12, 0, 'day'],
    [15, 59, 'day'], [16, 0, 'dusk'], [18, 59, 'dusk'], [19, 0, 'night'], [23, 59, 'night'],
  ];
  for (const [hour, minute, id] of cases) assert.equal(timeOfDayAt(taipei(23, hour, minute)), id, `${hour}:${minute}`);
});

test('自動時段跨日：UTC 的前一天晚上已是台灣的隔天清晨；不看瀏覽者的時區', () => {
  // UTC 10/23 21:00 是台灣 10/24 05:00；UTC 10/23 10:59 是台灣 10/23 18:59。
  assert.equal(timeOfDayAt(Date.UTC(2026, 9, 23, 21, 0)), 'dawn');
  assert.equal(timeOfDayAt(Date.UTC(2026, 9, 23, 20, 59)), 'night');
  assert.equal(timeOfDayAt(Date.UTC(2026, 9, 23, 10, 59)), 'dusk');
  assert.equal(timeOfDayAt(Date.UTC(2026, 9, 23, 11, 0)), 'night');
  // 跨年與 Date 物件也一樣。
  assert.equal(timeOfDayAt(new Date(Date.UTC(2026, 11, 31, 16, 0))), 'night');
  assert.equal(timeOfDayAt(new Date(Date.UTC(2026, 11, 31, 23, 30))), 'dawn');
});

test('每個關鍵影格都有天空、太陽光暈、半球光、補光、淺水與深水色，霧色等於地平線色', () => {
  for (const [id, k] of Object.entries(KEYFRAMES)) {
    for (const key of ['skyTop', 'skyHorizon', 'sunGlow', 'hemiSky', 'hemiGround', 'fillColor', 'waterShallow', 'waterDeep']) {
      assert.equal(typeof k[key], 'number', `${id}.${key}`);
    }
    assert.equal(k.fog, k.skyHorizon, `${id} 的霧色等於地平線色，遠景融進天空`);
    assert.ok(k.fillIntensity > 0 && k.fillIntensity < k.sunIntensity, `${id} 補光比太陽弱`);
  }
});

test('外圍陸地的色調：白天不改色，黃昏變暗偏暖，夜晚最暗偏冷；補間途中平順變化', () => {
  const [day, dawn, dusk, night] = ['day', 'dawn', 'dusk', 'night'].map((id) => landShade(KEYFRAMES[id]));
  assert.deepEqual(day, [1, 1, 1]);
  const mean = (rgb) => (rgb[0] + rgb[1] + rgb[2]) / 3;
  assert.ok(mean(dawn) < 1 && mean(dusk) < 1);
  assert.ok(mean(night) < 0.6, `夜晚平均 ${mean(night).toFixed(2)}`);
  assert.ok(mean(night) < mean(dusk) && mean(dusk) <= mean(dawn) + 0.05);
  assert.ok(dusk[0] > dusk[2], '黃昏偏暖：紅大於藍');
  assert.ok(night[2] > night[0], '夜晚偏冷：藍大於紅');
  const half = landShade(blendLighting(KEYFRAMES.day, KEYFRAMES.night, 0.5));
  assert.ok(mean(half) < 1 && mean(half) > mean(night));
});

test('光照強度照參考的結構：白天太陽最強，夜晚太陽最弱但半球光最強（冷色但看得清楚）', () => {
  const { dawn, day, dusk, night } = KEYFRAMES;
  assert.ok(day.sunIntensity > dawn.sunIntensity && day.sunIntensity > dusk.sunIntensity && dusk.sunIntensity > night.sunIntensity);
  assert.ok(night.hemiIntensity > day.hemiIntensity);
  assert.equal(day.night, 0);
  assert.equal(night.night, 1);
});

test('四個時段依清晨、白天、黃昏、夜晚排列，預設白天', () => {
  assert.deepEqual(TIMES_OF_DAY.map((t) => t.id), ['dawn', 'day', 'dusk', 'night']);
  assert.deepEqual(TIMES_OF_DAY.map((t) => t.name), ['清晨', '白天', '黃昏', '夜晚']);
  assert.equal(DEFAULT_TIME_OF_DAY, 'day');
  assert.equal(createDaylight().current, 'day');
});

test('補間：色碼逐色版內插，數值與太陽方向線性內插', () => {
  const a = { skyTop: 0x204060, sunIntensity: 1, night: 0, sunDirection: [0, 1, 0] };
  const b = { skyTop: 0x406080, sunIntensity: 3, night: 1, sunDirection: [1, 1, 0] };

  assert.deepEqual(blendLighting(a, b, 0), a);
  assert.deepEqual(blendLighting(a, b, 1), b);
  assert.deepEqual(blendLighting(a, b, 0.5), { skyTop: 0x305070, sunIntensity: 2, night: 0.5, sunDirection: [0.5, 1, 0] });
});

test('切換時段約 1.4 秒補間完成，期間兩端之間平順變化', () => {
  assert.equal(TRANSITION_MS, 1400);
  const daylight = createDaylight();
  daylight.set('night', 1000);

  assert.deepEqual(daylight.at(1000).lighting, KEYFRAMES.day);
  assert.equal(daylight.at(1000).settled, false);
  const mid = daylight.at(1700).lighting.night;
  assert.ok(mid > 0.3 && mid < 0.7, `補間一半時夜間係數 ${mid}`);
  assert.ok(daylight.at(1300).lighting.night < mid);
  assert.deepEqual(daylight.at(2400), { lighting: KEYFRAMES.night, settled: true });
  assert.equal(daylight.current, 'night');
});

test('補間途中改選其他時段，從目前的光線接著補，不跳色', () => {
  const daylight = createDaylight();
  daylight.set('night', 0);
  const before = daylight.at(700).lighting;

  daylight.set('dawn', 700);

  assert.deepEqual(daylight.at(700).lighting, before);
  assert.deepEqual(daylight.at(700 + TRANSITION_MS).lighting, KEYFRAMES.dawn);
});

test('減少動態時直接切到目的時段', () => {
  const daylight = createDaylight();
  daylight.set('dusk', 0, { instant: true });
  assert.deepEqual(daylight.at(0), { lighting: KEYFRAMES.dusk, settled: true });
});

test('不認得的時段不改變光線', () => {
  const daylight = createDaylight();
  assert.equal(daylight.set('noon', 0), false);
  assert.equal(daylight.current, 'day');
  assert.equal(daylight.at(0).settled, true);
});

test('發光材質亮度隨夜間係數增加：白天暗淡、夜晚超過 1（不受色調映射，看起來自己發光）', () => {
  assert.ok(glowLevel(KEYFRAMES.day.night) < 0.5);
  assert.ok(glowLevel(KEYFRAMES.night.night) > 1);
  assert.ok(glowLevel(KEYFRAMES.dusk.night) > glowLevel(KEYFRAMES.day.night));
});
