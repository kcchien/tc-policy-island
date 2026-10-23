// 島嶼檢視的畫質：依裝置選初始畫質，執行中量 fps 自動降級。只做計算，瀏覽器與 Node 共用。

// 三段畫質。pixelRatio 是像素比上限；shadowEvery 是每幾幀更新一次陰影。
export const QUALITY_LEVELS = {
  high: { pixelRatio: 1.75, antialias: true, shadows: true, shadowMapSize: 2048, shadowEvery: 1 },
  medium: { pixelRatio: 1.35, antialias: true, shadows: true, shadowMapSize: 1024, shadowEvery: 1 },
  low: { pixelRatio: 1, antialias: false, shadows: true, shadowMapSize: 768, shadowEvery: 6 },
};

// 社群 App 內建瀏覽器：Facebook、Instagram、LINE、Threads（UA 代號 Barcelona）。
const IN_APP_BROWSER = /\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bInstagram\b|\bLine\/|\bBarcelona\b/i;

// 社群 App 內建瀏覽器預設低；800px 以下或觸控裝置預設中；其餘高。
// lowFx（關掉毛玻璃）一開始都是 false，執行中卡頓才由 createFpsGovernor 打開。
export function initialQuality({ width, coarsePointer, devicePixelRatio, userAgent = '' }) {
  const level = IN_APP_BROWSER.test(userAgent) ? 'low' : width <= 800 || coarsePointer ? 'medium' : 'high';
  const preset = QUALITY_LEVELS[level];
  return {
    level,
    ...preset,
    pixelRatio: Math.min(devicePixelRatio, preset.pixelRatio),
    // 中畫質的高像素密度螢幕（像素比 2 以上）鋸齒本來就不明顯，省下抗鋸齒。
    antialias: preset.antialias && (level === 'high' || devicePixelRatio < 2),
    lowFx: false,
  };
}

// 執行中自動降級：開始後前 warmupMs 不算（載入與編譯著色器），之後每 windowMs 算一次平均 fps，
// 低於 minFps 就把像素比降 step（最低 1）、關毛玻璃、陰影改每 6 幀更新。
// minFps 是 28 而不是 30，省電模式鎖 30 fps 的手機不會被誤降。
export function createFpsGovernor(quality, { warmupMs = 3000, windowMs = 2000, minFps = 28, step = 0.25 } = {}) {
  let current = quality;
  const floor = Math.min(1, quality.pixelRatio);
  let firstFrame = null;
  let windowStart = null;
  let frames = 0;

  return {
    // 每畫一幀呼叫一次。要降級時回傳新的畫質，否則回傳 null。
    frame(now) {
      firstFrame ??= now;
      if (now - firstFrame < warmupMs) return null;
      if (windowStart === null) {
        windowStart = now;
        frames = 0;
        return null;
      }
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed < windowMs) return null;
      const fps = (frames * 1000) / elapsed;
      windowStart = now;
      frames = 0;
      if (fps >= minFps) return null;
      const pixelRatio = Math.max(floor, current.pixelRatio - step);
      if (pixelRatio === current.pixelRatio && current.lowFx) return null;
      current = { ...current, pixelRatio, lowFx: true, shadowEvery: 6 };
      return current;
    },
    // 動畫停下（暫停、減少動態、畫面靜止不重畫）時呼叫，下一幀重新開始計算區間。
    pause() {
      windowStart = null;
    },
  };
}
