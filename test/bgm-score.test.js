import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScore, BGM_SEED } from '../site/js/bgm-score.js';

test('同一個種子每次產生完全相同的樂曲，換種子旋律就不同', () => {
  assert.deepEqual(buildScore(BGM_SEED), buildScore(BGM_SEED));
  const lead = (score) => JSON.stringify(score.bars.map((bar) => bar.lead));
  assert.notEqual(lead(buildScore(BGM_SEED)), lead(buildScore(BGM_SEED + 1)));
});

test('循環是 32 小節，每小節 16 個十六分音符，速度在 boom-bap 的 85 到 92 BPM', () => {
  const score = buildScore(BGM_SEED);
  assert.equal(score.bars.length, 32);
  assert.equal(score.stepsPerBar, 16);
  assert.ok(score.bpm >= 85 && score.bpm <= 92, `速度 ${score.bpm}`);
});

test('貝斯、和弦與兩條旋律的每個音都在 G 宮五聲音階（G A B D E）內', () => {
  // 音名對照 MIDI 音高除以 12 的餘數：G=7、A=9、B=11、D=2、E=4。
  const allowed = new Set([7, 9, 11, 2, 4]);
  const outside = [];
  for (const bar of buildScore(BGM_SEED).bars) {
    const pitches = [
      ...bar.bass.map((s) => s.midi),
      ...bar.lead.map((s) => s.midi),
      ...bar.bowed.map((s) => s.midi),
      ...bar.keys.flatMap((k) => k.notes),
    ].filter((midi) => midi !== null);
    for (const midi of pitches) if (!allowed.has(midi % 12)) outside.push(`第 ${bar.index + 1} 小節 ${midi}`);
  }
  assert.deepEqual(outside, []);
});

test('每小節的貝斯與旋律從第 0 格接續排到第 16 格，鼓與和弦都落在小節內', () => {
  for (const bar of buildScore(BGM_SEED).bars) {
    for (const voice of ['bass', 'lead', 'bowed']) {
      let step = 0;
      for (const slot of bar[voice]) {
        assert.equal(slot.step, step, `第 ${bar.index + 1} 小節 ${voice} 不連續`);
        assert.ok(slot.length > 0);
        step += slot.length;
      }
      assert.equal(step, 16, `第 ${bar.index + 1} 小節 ${voice} 共 ${step} 格`);
    }
    for (const hit of bar.drums) assert.ok(hit.step >= 0 && hit.step < 16);
    for (const chord of bar.keys) assert.ok(chord.step >= 0 && chord.step + chord.length <= 16);
  }
});

test('段落有變化：第 1 輪沒有旋律、第 2 輪加旋律、第 4 輪倒數第二小節抽掉大鼓與小鼓', () => {
  const { bars } = buildScore(BGM_SEED);
  const hasMelody = (bar) => [...bar.lead, ...bar.bowed].some((s) => s.midi !== null);
  assert.ok(bars.slice(0, 8).every((bar) => !hasMelody(bar)));
  assert.ok(bars.slice(8, 16).every(hasMelody));
  const voices = (bar) => new Set(bar.drums.map((h) => h.voice));
  assert.ok(!voices(bars[30]).has('kick') && !voices(bars[30]).has('snare'));
  assert.ok(voices(bars[31]).has('snare'), '最後一小節用小鼓過門接回開頭');
  assert.ok(bars.slice(0, 30).every((bar) => voices(bar).has('kick')));
});
