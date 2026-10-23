// 工具列的背景音樂開關與音量滑桿。預設靜音，只有按下開關才播放，進站時一律不出聲
// （不論上次是否開著、有沒有開啟「減少動態」）。第一次開啟時才建立 AudioContext，
// 而且在點擊當下同步建立，瀏覽器才會認定是使用者的操作。
// 分頁隱藏時暫停，回來後若原本開著就接著播。音量記在 localStorage（讀寫失敗就不記）。

import { createBgmPlayer } from './bgm-player.js';
import { MUSIC_TEXT } from './ui-text.js';

const VOLUME_KEY = 'policy-island:music-volume';
export const DEFAULT_VOLUME = 0.4;

export function parseVolume(stored) {
  if (stored === null || stored === undefined || stored === '') return DEFAULT_VOLUME;
  const value = Number(stored);
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

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
    // 記不住就下次用預設音量。
  }
}

export function setupMusicToggle({ button, volumeInput }) {
  let on = false;
  const player = createBgmPlayer({ volume: parseVolume(readStorage(VOLUME_KEY)) });
  volumeInput.value = String(player.volume);
  volumeInput.setAttribute('aria-label', MUSIC_TEXT.volume);
  button.setAttribute('aria-label', MUSIC_TEXT.button);

  const render = () => {
    button.setAttribute('aria-pressed', String(on));
    button.closest('.music-group')?.classList.toggle('is-on', on);
  };

  button.addEventListener('click', () => {
    on = !on;
    render();
    if (on) player.play();
    else player.pause();
  });
  volumeInput.addEventListener('input', () => {
    const value = parseVolume(volumeInput.value);
    writeStorage(VOLUME_KEY, String(value));
    player.setVolume(value);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.pause();
    else if (on) player.play();
  });
  render();
}
