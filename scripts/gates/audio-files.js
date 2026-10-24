// 上線關卡「音檔只來自政見語音清單」：背景音樂在瀏覽器即時合成，網站上的音檔只有政見語音（朗讀，GLOSSARY）。
// 政見音檔只能放在 data/audio/、每個都登記在同目錄的政見語音清單且雜湊相符；公開資料集的 audioUrl 全有或全無，
// 三位候選人的覆蓋率相同。程式不得寫死音檔路徑，播放音檔只限政見卡片模組，只能播公開資料集給的 audioUrl。

import { AUDIO_DIR, AUDIO_MANIFEST, audioProblems, audioUrlOf, sha256 } from '../lib/speech.js';
import { THIRD_PARTY } from './site.js';

const AUDIO_EXTENSIONS = 'mp3|wav|ogg|oga|opus|m4a|aac|flac|weba|mid|midi';
const AUDIO_FILE = new RegExp(`\\.(${AUDIO_EXTENSIONS})$`, 'i');
// 寫死的音檔路徑：字串或 url() 裡以音檔副檔名結尾的路徑。只看引號或 url() 包住的路徑，程式裡叫做 midi 的欄位（slot.midi）不算。
const AUDIO_PATH = new RegExp(
  `(["'\`])[^"'\`\\s]*\\.(${AUDIO_EXTENSIONS})([?#][^"'\`\\s]*)?\\1`
    + `|url\\(\\s*["']?[^)"'\\s]*\\.(${AUDIO_EXTENSIONS})\\b`,
  'i',
);
// 播放音檔的寫法：<audio> 元素、new Audio()、createElement('audio')。
const AUDIO_PLAYER = /<audio\b|new\s+Audio\s*\(|createElement\(\s*["'`]audio["'`]/i;
const SCANNED = /\.(html|js|mjs|css|json)$/;
// 網站目錄裡唯一可以播放音檔的模組。
const PLAYER_MODULE = 'js/policy-card.js';

const AUDIO_SITE_DIR = `data/${AUDIO_DIR}/`;
const MANIFEST_PATH = `${AUDIO_SITE_DIR}${AUDIO_MANIFEST}`;

function readManifest(site, files) {
  if (!files.includes(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(site.readText(MANIFEST_PATH));
  } catch (error) {
    throw new Error(`政見語音清單 ${MANIFEST_PATH} 不是合法 JSON：${error.message}`);
  }
}

function checkCode(site, files) {
  const failures = [];
  for (const path of files) {
    if (!SCANNED.test(path) || THIRD_PARTY.test(path) || path.startsWith('data/')) continue;
    const text = site.readText(path);
    const literal = text.match(AUDIO_PATH);
    if (literal) failures.push(`${path}：引用音檔「${literal[0]}」，音檔位置只能來自公開資料集的 audioUrl`);
    if (path !== PLAYER_MODULE && AUDIO_PLAYER.test(text)) failures.push(`${path}：只有政見卡片模組可以播放音檔`);
  }
  return failures;
}

// 網站目錄的音檔：只能在 data/audio/，每個都登記在清單且雜湊相符。
function checkFiles(site, files, manifest) {
  const byFile = new Map(Object.values(manifest?.items ?? {}).map((item) => [item.file, item]));
  return files.filter((path) => AUDIO_FILE.test(path)).flatMap((path) => {
    if (!path.startsWith(AUDIO_SITE_DIR) || path.slice(AUDIO_SITE_DIR.length).includes('/')) {
      return [`${path}：網站上的音檔只能是放在 ${AUDIO_SITE_DIR} 的政見音檔，背景音樂只用瀏覽器即時合成`];
    }
    const item = byFile.get(path.slice(AUDIO_SITE_DIR.length));
    if (!item) return [`${path}：不在政見語音清單裡`];
    if (sha256(site.readBytes(path)) !== item.fileSha256) return [`${path}：音檔與政見語音清單的雜湊不符`];
    return [];
  });
}

// 公開資料集的 audioUrl：全有或全無，三人覆蓋率相同，每個都指向清單登記的音檔且文字與音檔都相符。
function checkDataset(site, files, manifest) {
  const { candidates, policies } = site.dataset();
  const voiced = policies.filter((p) => p.audioUrl !== undefined && p.audioUrl !== null);
  const audioFiles = files.filter((path) => AUDIO_FILE.test(path));
  if (voiced.length === 0) {
    return audioFiles.length > 0 ? [`網站目錄有 ${audioFiles.length} 個音檔，但公開資料集沒有任何政見帶 audioUrl；政見音檔全有或全無`] : [];
  }
  const failures = policies.filter((p) => !voiced.includes(p))
    .map((p) => `政見 ${p.id}：沒有 audioUrl，但其他 ${voiced.length} 條有；政見音檔要全部政見都有或全部沒有`);

  const coverage = candidates
    .map((c) => ({ id: c.id, policies: policies.filter((p) => p.candidateId === c.id) }))
    .filter(({ policies: own }) => own.length > 0)
    .map(({ id, policies: own }) => ({ id, percent: Math.round((own.filter((p) => voiced.includes(p)).length / own.length) * 100) }));
  if (new Set(coverage.map((c) => c.percent)).size > 1) {
    failures.push(`三位候選人的音檔覆蓋率不同：${coverage.map((c) => `${c.id} ${c.percent}%`).join('、')}`);
  }

  if (manifest === null) return [...failures, `有政見帶 audioUrl，但網站目錄沒有政見語音清單 ${MANIFEST_PATH}`];
  const fileSha256Of = (file) => (files.includes(`${AUDIO_SITE_DIR}${file}`) ? sha256(site.readBytes(`${AUDIO_SITE_DIR}${file}`)) : null);
  failures.push(...audioProblems(voiced, manifest, fileSha256Of));
  for (const p of voiced) {
    const item = manifest.items?.[p.id];
    if (item && p.audioUrl !== audioUrlOf(item)) failures.push(`政見 ${p.id}：audioUrl ${p.audioUrl} 不是清單登記的 ${audioUrlOf(item)}`);
  }
  return failures;
}

export default {
  id: 'audio-files',
  name: '音檔只來自政見語音清單：背景音樂仍只即時合成，政見音檔全有或全無',
  check(site) {
    const files = site.files();
    const manifest = readManifest(site, files);
    return [...checkCode(site, files), ...checkFiles(site, files, manifest), ...checkDataset(site, files, manifest)];
  },
};
