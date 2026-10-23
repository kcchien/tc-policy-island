import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScore, BGM_SEED } from '../site/js/bgm-score.js';
import { createCursor, planSteps, musicStartup, parseVolume, DEFAULT_VOLUME } from '../site/js/bgm-schedule.js';

const score = buildScore(BGM_SEED);
// 88 BPM 的十六分音符：60 / 88 / 4 秒。
const STEP = 60 / 88 / 4;

test('前瞻排程只排到期限之前的十六分音符，下次從沒排過的那一格接著排', () => {
  const cursor = createCursor(10);
  const first = planSteps(score, cursor, 10 + STEP * 2.5);
  assert.deepEqual(first.map((s) => s.step), [0, 1, 2]);
  const second = planSteps(score, cursor, 10 + STEP * 4.5);
  assert.deepEqual(second.map((s) => s.step), [3, 4]);
});

test('排程時間由起點與格數直接算出，排了一千個循環也不會漂移，奇數格往後推做搖擺', () => {
  const cursor = createCursor(0);
  const loops = 1000;
  const loopSeconds = 512 * STEP;
  // 每次只往前看 0.1 秒，模擬計時器一直呼叫。
  let last;
  for (let until = 0.1; until < loops * loopSeconds + 0.05; until += 0.1) {
    const planned = planSteps(score, cursor, until);
    if (planned.length) last = planned.at(-1);
  }
  const startOfLoop = planSteps(score, cursor, loops * loopSeconds + STEP / 2);
  assert.equal(last.step, 511, '上一個循環的最後一格');
  assert.deepEqual(startOfLoop.map((s) => s.step), [0], '循環接縫回到第 0 格');
  assert.ok(Math.abs(startOfLoop[0].time - loops * loopSeconds) < 1e-6, `第 ${loops} 輪開頭在 ${startOfLoop[0].time}`);
  assert.ok(Math.abs(last.time - (loops * loopSeconds - STEP + STEP * score.swing)) < 1e-6);
});

test('預設靜音；記住開啟且沒有減少動態時，等使用者第一次操作才恢復播放', () => {
  assert.deepEqual(musicStartup({ stored: null, reducedMotion: false }), { on: false, resumeOnGesture: false });
  assert.deepEqual(musicStartup({ stored: 'off', reducedMotion: false }), { on: false, resumeOnGesture: false });
  assert.deepEqual(musicStartup({ stored: 'on', reducedMotion: false }), { on: false, resumeOnGesture: true });
  assert.deepEqual(musicStartup({ stored: 'on', reducedMotion: true }), { on: false, resumeOnGesture: false });
});

test('記住的音量讀不到或不合理時用預設音量，超出範圍就夾在 0 到 1', () => {
  assert.equal(parseVolume(null), DEFAULT_VOLUME);
  assert.equal(parseVolume('abc'), DEFAULT_VOLUME);
  assert.equal(parseVolume('0.3'), 0.3);
  assert.equal(parseVolume('7'), 1);
  assert.equal(parseVolume('-1'), 0);
  assert.ok(DEFAULT_VOLUME > 0 && DEFAULT_VOLUME <= 0.6, '預設音量適中');
});
