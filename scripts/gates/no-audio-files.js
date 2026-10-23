import { THIRD_PARTY } from './site.js';

// 背景音樂在瀏覽器即時合成，網站不放也不載入任何音檔（避免混入既有歌曲）。
const AUDIO_EXTENSIONS = 'mp3|wav|ogg|oga|opus|m4a|aac|flac|weba|mid|midi';
const AUDIO_FILE = new RegExp(`\\.(${AUDIO_EXTENSIONS})$`, 'i');
// 程式與頁面裡引用音檔的寫法：字串或 url() 裡以音檔副檔名結尾的路徑、<audio> 元素、new Audio()。
// 只看引號或 url() 包住的路徑，程式裡叫做 midi 的欄位（slot.midi）不算。
const AUDIO_REFERENCE = new RegExp(
  `(["'\`])[^"'\`\\s]*\\.(${AUDIO_EXTENSIONS})([?#][^"'\`\\s]*)?\\1`
    + `|url\\(\\s*["']?[^)"'\\s]*\\.(${AUDIO_EXTENSIONS})\\b|<audio\\b|new\\s+Audio\\s*\\(`,
  'i',
);
const SCANNED = /\.(html|js|mjs|css|json)$/;

export default {
  id: 'no-audio-files',
  name: '不載入音檔：背景音樂只用瀏覽器即時合成',
  check(site) {
    const failures = [];
    for (const path of site.files()) {
      if (AUDIO_FILE.test(path)) {
        failures.push(`${path}：網站目錄不得放音檔`);
        continue;
      }
      if (!SCANNED.test(path) || THIRD_PARTY.test(path) || path.startsWith('data/')) continue;
      const match = site.readText(path).match(AUDIO_REFERENCE);
      if (match) failures.push(`${path}：引用音檔「${match[0]}」`);
    }
    return failures;
  },
};
