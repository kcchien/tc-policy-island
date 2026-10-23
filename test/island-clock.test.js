import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnimator } from '../site/js/island-clock.js';

// 記下每次被呼叫時拿到的時間（毫秒取整，避開浮點誤差）與環境。
const recorder = () => {
  const calls = [];
  const fn = (t, dt, env) => calls.push({ t: Math.round(t * 1000), dt: Math.round(dt * 1000), env });
  return { fn, calls };
};

test('動畫時間以實際經過的秒數推進，註冊的動畫每幀拿到時間、間隔與環境', () => {
  const animator = createAnimator();
  const { fn, calls } = recorder();
  animator.add(fn);

  animator.tick(1000, { night: 0 });
  animator.tick(1016, { night: 0 });
  animator.tick(1116, { night: 1 });

  assert.deepEqual(calls.map((c) => [c.t, c.dt]), [[0, 0], [16, 16], [116, 100]]);
  assert.deepEqual(calls[2].env, { night: 1 });
});

test('切到背景分頁等長時間沒有畫格，一幀最多推進 0.25 秒，動畫不會跳一大段', () => {
  const animator = createAnimator();
  const { fn, calls } = recorder();
  animator.add(fn);

  animator.tick(0);
  animator.tick(5000);

  assert.deepEqual(calls.map((c) => [c.t, c.dt]), [[0, 0], [250, 250]]);
});

test('暫停時動畫停在同一畫格；恢復後從停住的地方接著走，不補暫停的時間', () => {
  const animator = createAnimator();
  const { fn, calls } = recorder();
  animator.add(fn);
  animator.tick(0);
  animator.tick(100);

  animator.setPaused(true);
  animator.tick(200);
  animator.tick(9000);
  assert.equal(animator.paused, true);
  assert.equal(animator.running, false);

  animator.setPaused(false);
  animator.tick(9100);
  animator.tick(9150);

  assert.deepEqual(calls.map((c) => [c.t, c.dt]), [[0, 0], [100, 100], [100, 0], [100, 0], [100, 0], [150, 50]]);
});

test('減少動態時所有裝飾動畫停在固定畫格（時間 0）', () => {
  let reduce = true;
  const animator = createAnimator({ reducedMotion: () => reduce });
  const { fn, calls } = recorder();
  animator.add(fn);

  for (const now of [0, 16, 1000, 2000]) animator.tick(now);

  assert.equal(animator.running, false);
  assert.deepEqual(new Set(calls.map((c) => c.t)), new Set([0]));

  // 使用者中途關掉減少動態，動畫從固定畫格開始動。
  reduce = false;
  animator.tick(3000);
  animator.tick(3040);
  assert.deepEqual(calls.slice(-2).map((c) => [c.t, c.dt]), [[0, 0], [40, 40]]);
});

test('註冊會回傳取消函式；沒有任何動畫時迴圈不必持續重畫', () => {
  const animator = createAnimator();
  assert.equal(animator.running, false);

  const a = recorder();
  const b = recorder();
  const removeA = animator.add(a.fn);
  animator.add(b.fn);
  assert.equal(animator.running, true);

  animator.tick(0);
  removeA();
  animator.tick(16);

  assert.equal(a.calls.length, 1);
  assert.equal(b.calls.length, 2);
});
