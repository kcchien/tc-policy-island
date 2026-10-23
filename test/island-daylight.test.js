import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blendLighting, createDaylight, DEFAULT_TIME_OF_DAY, glowLevel, KEYFRAMES, TIMES_OF_DAY, TRANSITION_MS,
} from '../site/js/island-daylight.js';

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
