// 背景音樂的播放：第一次開啟時才建立 AudioContext，用前瞻排程播放循環。
// 暫停時把 AudioContext 停住，音訊時間跟著停，恢復後從原位置接著播。

import { buildScore } from './bgm-score.js';
import { createCursor, planSteps, stepSeconds } from './bgm-schedule.js';
import { createSynth } from './bgm-synth.js';

// 計時器每 25 毫秒檢查一次，排好接下來 0.12 秒內的音。分頁卡頓時計時器變慢也有餘裕。
const TICK_MS = 25;
const LOOKAHEAD = 0.12;
// 音量滑桿拉到最大時的整體音量，讓背景音樂維持在背景。
const MAX_GAIN = 0.8;

// 主音量與壓縮器，避免音符疊在一起時爆音。
function createOutput(context, volume) {
  const master = context.createGain();
  master.gain.value = volume * MAX_GAIN;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 4;
  master.connect(limiter);
  limiter.connect(context.destination);
  return master;
}

export function createBgmPlayer({ volume, score = buildScore() }) {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let context = null;
  let master = null;
  let synth = null;
  let cursor = null;
  let timer = null;
  let level = volume;

  // 主執行緒被 3D 場景卡住時，已經過時的格子直接跳過，不擠在同一瞬間補播。
  const tick = () => {
    const now = context.currentTime;
    for (const planned of planSteps(score, cursor, now + LOOKAHEAD)) {
      if (planned.time >= now) synth.playStep(score, planned, stepSeconds(score));
    }
  };

  // 最後一次要求的是播放還是暫停；恢復音訊要等一下，等完以最後的要求為準。
  let wanted = false;

  return {
    get volume() {
      return level;
    },
    // play 要在使用者點擊的事件裡同步呼叫：AudioContext 在第一個 await 之前建立。
    async play() {
      wanted = true;
      if (!context) {
        context = new AudioContextClass();
        master = createOutput(context, level);
        synth = createSynth(context, master);
        cursor = createCursor(context.currentTime + 0.1);
      }
      await context.resume();
      if (!wanted || timer !== null) return;
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    async pause() {
      wanted = false;
      clearInterval(timer);
      timer = null;
      await context?.suspend();
    },
    setVolume(value) {
      level = value;
      master?.gain.setTargetAtTime(value * MAX_GAIN, context.currentTime, 0.05);
    },
  };
}

// 用離線音訊環境渲染循環開頭的幾小節，供試聽與檢查（不出聲、不需要使用者操作）。
export async function renderBars(OfflineContextClass, { bars, sampleRate = 44100, score = buildScore() }) {
  const step = stepSeconds(score);
  const seconds = Math.min(bars, score.bars.length) * score.stepsPerBar * step;
  const context = new OfflineContextClass(2, Math.ceil((seconds + 1) * sampleRate), sampleRate);
  const synth = createSynth(context, createOutput(context, 1));
  for (const planned of planSteps(score, createCursor(0), seconds)) synth.playStep(score, planned, step);
  return context.startRendering();
}
