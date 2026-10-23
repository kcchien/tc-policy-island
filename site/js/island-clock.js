// 島嶼檢視的動畫迴圈時間：統一推進裝飾動畫的時間，處理暫停與減少動態。只做計算，瀏覽器與 Node 共用。
// 後續的動畫（風車、小人、車輛、雲等）一律用 add 註冊，不自己讀 performance.now()，
// 暫停按鈕與 prefers-reduced-motion 才能讓所有裝飾動畫一起停在固定畫格。

// 一幀最多推進的秒數。切到背景分頁回來時動畫不會跳一大段，慢裝置也不會快轉。
const MAX_STEP = 0.25;

// reducedMotion 是讀取目前「減少動態」設定的函式，使用者中途改設定也會生效。
export function createAnimator({ reducedMotion = () => false } = {}) {
  const animations = new Set();
  let paused = false;
  // 動畫時間（秒）。減少動態從一開始就開著時一直是 0，所有動畫停在同一個固定畫格。
  let t = 0;
  let last = null;

  const frozen = () => paused || reducedMotion();

  return {
    // 註冊動畫 fn(t, dt, env)：t 是動畫時間（秒），dt 是這一幀推進的秒數（停住時為 0），
    // env 是場景環境（例如 { night } 夜間係數）。回傳取消註冊的函式。
    add(fn) {
      animations.add(fn);
      return () => animations.delete(fn);
    },
    get paused() {
      return paused;
    },
    setPaused(value) {
      paused = Boolean(value);
    },
    // 有動畫在走，迴圈需要每幀重畫。
    get running() {
      return animations.size > 0 && !frozen();
    },
    // 每畫一幀呼叫一次，now 是毫秒（requestAnimationFrame 的時間戳）。停住時仍呼叫動畫，dt 為 0。
    tick(now, env = {}) {
      let dt = 0;
      if (frozen()) {
        last = null;
      } else {
        dt = last === null ? 0 : Math.min(MAX_STEP, Math.max(0, (now - last) / 1000));
        last = now;
        t += dt;
      }
      for (const fn of animations) fn(t, dt, env);
      return { t, dt };
    },
  };
}
