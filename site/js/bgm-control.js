// 工具列的背景音樂開關與音量滑桿。預設靜音、不自動播放；第一次開啟時才載入播放器並建立 AudioContext。
// 分頁隱藏時暫停，回來後若原本開著就接著播。開關與音量記在 localStorage（讀寫失敗就不記）。

import { musicStartup, parseVolume } from './bgm-schedule.js';

const MUSIC_KEY = 'policy-island:music';
const VOLUME_KEY = 'policy-island:music-volume';

// 開關用 aria-pressed 表示開或關，名稱固定。
export const MUSIC_TEXT = {
  button: '背景音樂',
  volume: '音樂音量',
};

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 記不住就下次預設靜音。
  }
}

export function setupMusicToggle({ button, volumeInput, reducedMotion }) {
  let player = null;
  let on = false;
  const volume = parseVolume(readStorage(VOLUME_KEY));
  volumeInput.value = String(volume);
  volumeInput.setAttribute('aria-label', MUSIC_TEXT.volume);
  button.setAttribute('aria-label', MUSIC_TEXT.button);

  const render = () => {
    button.setAttribute('aria-pressed', String(on));
    button.closest('.music-group')?.classList.toggle('is-on', on);
  };

  const ensurePlayer = async () => {
    if (!player) {
      const { createBgmPlayer } = await import('./bgm-player.js');
      player ??= createBgmPlayer({ volume: Number(volumeInput.value) });
    }
    return player;
  };

  const setOn = async (next, { remember = true } = {}) => {
    on = next;
    render();
    if (remember) writeStorage(MUSIC_KEY, on ? 'on' : 'off');
    if (on && !document.hidden) await (await ensurePlayer()).play();
    else await player?.pause();
  };

  button.addEventListener('click', () => setOn(!on));
  volumeInput.addEventListener('input', () => {
    const value = parseVolume(volumeInput.value);
    writeStorage(VOLUME_KEY, String(value));
    player?.setVolume(value);
  });
  document.addEventListener('visibilitychange', () => {
    if (!player) return;
    if (document.hidden) player.pause();
    else if (on) player.play();
  });

  // 上次開著音樂離開：等使用者第一次點擊或按鍵才恢復（不在進站時自動出聲）。
  const startup = musicStartup({ stored: readStorage(MUSIC_KEY), reducedMotion: reducedMotion() });
  if (startup.resumeOnGesture) {
    const resume = (event) => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      // 這次操作本身就是按音樂開關時，交給開關處理。
      if (button.contains(event.target)) return;
      if (!on) setOn(true, { remember: false });
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }
  render();
  return {
    get on() {
      return on;
    },
    get playing() {
      return Boolean(player?.playing);
    },
  };
}
