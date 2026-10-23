// 背景音樂的排程與播放偏好，純函式（Node 可測）。
// 前瞻排程（lookahead scheduling）：計時器每隔一小段時間呼叫 planSteps，把接下來一段時間內
// 要響的十六分音符交給 Web Audio 在精確的時間點播放。每一格的時間由起點與格數直接算出，
// 不逐格累加，所以播再久也不會漂移。

import { loopSteps } from './bgm-score.js';

export const DEFAULT_VOLUME = 0.4;

export const stepSeconds = (score) => 60 / score.bpm / 4;

// 從音訊時間 anchor 開始播循環的第 0 格。
export function createCursor(anchor) {
  return { anchor, next: 0 };
}

// 排出時間早於 until 的格子，並把游標往前推。回傳每格的循環位置、小節、小節內位置與播放時間。
export function planSteps(score, cursor, until) {
  const step = stepSeconds(score);
  const total = loopSteps(score);
  const planned = [];
  for (;;) {
    const absolute = cursor.next;
    const index = absolute % total;
    const swing = index % 2 === 1 ? score.swing * step : 0;
    const time = cursor.anchor + absolute * step + swing;
    if (time >= until) break;
    planned.push({
      step: index,
      bar: Math.floor(index / score.stepsPerBar),
      stepInBar: index % score.stepsPerBar,
      time,
    });
    cursor.next += 1;
  }
  return planned;
}

// 進站時的音樂狀態：一律先靜音。上次離開時開著音樂、且沒有開啟「減少動態」，
// 才在使用者第一次點擊或按鍵時恢復播放（瀏覽器也不允許沒有操作就出聲）。
export function musicStartup({ stored, reducedMotion }) {
  return { on: false, resumeOnGesture: stored === 'on' && !reducedMotion };
}

export function parseVolume(stored) {
  if (stored === null || stored === undefined || stored === '') return DEFAULT_VOLUME;
  const value = Number(stored);
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}
