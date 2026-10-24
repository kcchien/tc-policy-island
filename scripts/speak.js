// 生成政見語音：每條公開政見組成朗讀文字，送語音合成服務生成 mp3，存進 data/audio/ 並維護清單 manifest.json。
// 三位候選人同一組設定與文字樣板，見 scripts/lib/speech.js 與 GLOSSARY「朗讀」。參數與注意事項見 USAGE（--help）。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { loadRawData, readJson } from './lib/raw-data.js';
import { AUDIO_MANIFEST, audioProblems, charCount, sha256, SPEECH_VOICE, speechParts, speechScript } from './lib/speech.js';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '生成政見語音：對每條公開政見（兩層核對都通過）組成朗讀文字，送語音合成服務生成 mp3，寫進音檔目錄與清單。',
  usage: [
    ['node scripts/speak.js [參數]', '生成缺少或文字已變的政見音檔'],
    ['node scripts/speak.js --dry-run', '只列出要生成的政見、字數與估計點數'],
    ['node scripts/speak.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  sections: [
    {
      title: '範圍',
      rows: [
        ['--raw <目錄>', '原始資料目錄（預設 data/raw）'],
        ['--audio <目錄>', '音檔目錄，清單是其中的 manifest.json（預設 data/audio）'],
        ['--candidate <id>', '只生成這位候選人的政見，可重複；不給時生成全部'],
        ['--limit <數量>', '這次最多生成幾條'],
      ],
    },
    {
      title: '動作',
      rows: [
        ['--dry-run', '不呼叫服務、不寫檔，列出要生成的政見與估計點數'],
        ['--prune', '刪除清單沒有引用的音檔，以及已不公開政見的清單項目'],
      ],
    },
    {
      title: '服務',
      rows: [
        ['--endpoint <網址>', '語音合成服務端點（預設 https://connect.voai.ai/TTS/generate-voice）'],
        ['--retry-delays <秒,...>', '429 與 5xx 的重試間隔（預設 5,15,45，共重試三次）'],
        ['--date YYYY-MM-DD', '寫進清單 generatedAt 的日期（預設今天，台灣時間）'],
      ],
    },
  ],
  notes: [
    '會花點數：金鑰讀環境變數 VOAI_API_KEY，有要生成的政見卻沒設金鑰就直接失敗。對正式資料先跑 --dry-run。',
    '音檔檔名是朗讀文字的 sha256，文字沒變且檔案雜湊與清單相符就跳過；文字變了產生新檔，舊檔留到 --prune 才刪。',
    '同時最多 2 個請求；單次文字上限 1000 字，超過時依句子拆段生成後接成一個檔案，清單記 parts。',
    '清單的語音設定與 scripts/lib/speech.js 的 SPEECH_VOICE 不同時直接失敗：刪掉清單與音檔後全部重生成，三人才會是同一聲線。',
    '建置指令只在每條公開政見都有相符音檔時才把音檔放上網站（全有或全無）。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
const JOBS = 2;

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: 'data/raw' },
    audio: { type: 'string', default: 'data/audio' },
    candidate: { type: 'string', multiple: true },
    limit: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    prune: { type: 'boolean', default: false },
    endpoint: { type: 'string', default: 'https://connect.voai.ai/TTS/generate-voice' },
    'retry-delays': { type: 'string', default: '5,15,45' },
    date: { type: 'string', default: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) },
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ServiceError extends Error {
  constructor(status, detail) {
    super(`語音合成服務回應 ${status}：${detail}`);
    this.retryable = status === 429 || status >= 500;
  }
}

// 一段文字一個請求。回應本體就是 mp3，x-used-quota 是本次用掉的點數。
async function requestSpeech(text, key) {
  const response = await fetch(values.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'x-output-format': 'mp3' },
    body: JSON.stringify({
      input: { voai_script_text: text },
      voice: { name: SPEECH_VOICE.name, style: SPEECH_VOICE.style, model: SPEECH_VOICE.model },
      audio_config: { speed: SPEECH_VOICE.speed, pitch_shift: 0, breath_pause: 0 },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new ServiceError(response.status, (await response.text()).slice(0, 200));
  // 沒有點數標頭時記 null（點數不明），不當成 0 點。
  const quota = response.headers.get('x-used-quota');
  return { bytes: Buffer.from(await response.arrayBuffer()), quota: quota === null || quota.trim() === '' ? NaN : Number(quota) };
}

async function requestWithRetry(text, key, delays) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestSpeech(text, key);
    } catch (error) {
      if (!error.retryable || attempt >= delays.length) throw error;
      console.log(`  ${error.message}，${delays[attempt]} 秒後重試`);
      await sleep(delays[attempt] * 1000);
    }
  }
}

// 第二段以後的 mp3 去掉開頭的 ID3v2 標籤再接上，播放器才不會在段落交界讀到標籤。
function stripId3(bytes) {
  if (bytes.length < 10 || bytes.toString('latin1', 0, 3) !== 'ID3') return bytes;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const footer = bytes[5] & 0x10 ? 10 : 0;
  return bytes.subarray(10 + size + footer);
}

function readManifest(path) {
  if (!existsSync(path)) return { voice: { ...SPEECH_VOICE }, items: {} };
  const manifest = readJson(path);
  if (JSON.stringify(manifest.voice) !== JSON.stringify(SPEECH_VOICE)) {
    throw new Error(`清單 ${path} 的語音設定 ${JSON.stringify(manifest.voice)} 與現行設定 ${JSON.stringify(SPEECH_VOICE)} 不同；刪掉清單與音檔後重新生成全部，三人才會是同一聲線`);
  }
  return manifest;
}

// 項目依政見識別碼排序，清單的差異才好讀。
function writeManifest(path, manifest) {
  const items = Object.fromEntries(Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, `${JSON.stringify({ voice: manifest.voice, items }, null, 2)}\n`);
}


// 估計點數：清單已有紀錄時用實際每字點數，否則以一字一點估。
function quotaRate(manifest) {
  const items = Object.values(manifest.items).filter((item) => Number.isFinite(item.quota) && item.chars > 0);
  const chars = items.reduce((sum, item) => sum + item.chars, 0);
  if (chars === 0) return { rate: 1, basis: '以一字一點估' };
  const rate = items.reduce((sum, item) => sum + item.quota, 0) / chars;
  return { rate, basis: `依清單既有 ${items.length} 條紀錄，每字約 ${rate.toFixed(2)} 點` };
}

// 刪除清單項目中已不公開的政見，以及清單沒有引用的音檔。回傳要刪的項目與檔案，dryRun 時不動手。
function prune(manifest, audioDir, publicIds, dryRun) {
  const items = Object.keys(manifest.items).filter((id) => !publicIds.has(id));
  if (!dryRun) for (const id of items) delete manifest.items[id];
  const referenced = new Set(Object.values(manifest.items).map((item) => item.file));
  const files = existsSync(audioDir)
    ? readdirSync(audioDir).filter((name) => name.endsWith('.mp3') && !referenced.has(name))
    : [];
  if (!dryRun) for (const name of files) rmSync(join(audioDir, name));
  return { items, files };
}

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw new Error(`--date 應為 YYYY-MM-DD，實際為 ${values.date}`);
  const delays = values['retry-delays'].split(',').map((d) => (d.trim() === '' ? NaN : Number(d)));
  if (delays.some((d) => !Number.isFinite(d) || d < 0)) throw new Error(`--retry-delays 應為逗號分隔的秒數，實際為 ${values['retry-delays']}`);
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1)) throw new Error(`--limit 應為正整數，實際為 ${values.limit}`);

  const dataset = buildPublicDataset(loadRawData(resolve(values.raw)));
  const candidateIds = new Set(dataset.candidates.map((c) => c.id));
  for (const id of values.candidate ?? []) {
    if (!candidateIds.has(id)) throw new Error(`--candidate ${id} 不是原始資料中的候選人`);
  }
  const audioDir = resolve(values.audio);
  const manifestPath = join(audioDir, AUDIO_MANIFEST);
  const manifest = readManifest(manifestPath);

  // 清單項目與現在的文字相符、音檔存在且雜湊相符（與建置的判準相同），才不必重生成。
  const fileSha256Of = (file) => (existsSync(join(audioDir, file)) ? sha256(readFileSync(join(audioDir, file))) : null);
  const scoped = dataset.policies
    .filter((p) => !values.candidate || values.candidate.includes(p.candidateId))
    .map((policy) => ({ policy, text: speechScript(policy) }));
  const stale = scoped.filter(({ policy }) => audioProblems([policy], manifest, fileSha256Of).length > 0);
  const targets = stale.slice(0, limit);
  const totalChars = targets.reduce((sum, { text }) => sum + charCount(text), 0);

  if (values['dry-run']) {
    for (const { policy, text } of targets) {
      const parts = speechParts(text).length;
      console.log(`${policy.id}：${charCount(text)} 字${parts > 1 ? `（拆成 ${parts} 段）` : ''}`);
    }
    const { rate, basis } = quotaRate(manifest);
    console.log(`要生成 ${targets.length} 條，共 ${totalChars} 字，估計 ${Math.ceil(totalChars * rate)} 點（${basis}）；已是最新 ${scoped.length - stale.length} 條`);
    if (values.prune) {
      const pruned = prune(manifest, audioDir, new Set(dataset.policies.map((p) => p.id)), true);
      console.log(`--prune 會刪除清單項目 ${pruned.items.length} 條、音檔 ${pruned.files.length} 個`);
    }
    return;
  }

  const key = process.env.VOAI_API_KEY;
  if (targets.length > 0 && !key) {
    throw new Error(`要生成 ${targets.length} 條政見語音，但沒有設定環境變數 VOAI_API_KEY（語音合成服務的金鑰）。只想看要生成哪些，加 --dry-run`);
  }
  mkdirSync(audioDir, { recursive: true });

  const generateOne = async ({ policy, text }) => {
    const parts = speechParts(text);
    const chunks = [];
    let quota = 0;
    for (const part of parts) {
      const result = await requestWithRetry(part, key, delays);
      chunks.push(chunks.length === 0 ? result.bytes : stripId3(result.bytes));
      quota += result.quota;
    }
    const bytes = Buffer.concat(chunks);
    const textSha256 = sha256(text);
    const file = `${textSha256}.mp3`;
    writeFileSync(join(audioDir, file), bytes);
    manifest.items[policy.id] = {
      textSha256,
      file,
      fileSha256: sha256(bytes),
      chars: charCount(text),
      quota: Number.isFinite(quota) ? quota : null,
      generatedAt: values.date,
      ...(parts.length > 1 ? { parts: parts.length } : {}),
    };
    // 每條寫回一次，中途中止時已生成的不會遺失。
    writeManifest(manifestPath, manifest);
    console.log(`${policy.id}：${charCount(text)} 字，${Number.isFinite(quota) ? `${quota} 點` : '點數不明'}${parts.length > 1 ? `，${parts.length} 段` : ''}`);
  };

  // JOBS 個工作者輪流從佇列取政見；任一條失敗時其他工作者不再取新的。
  const queue = [...targets];
  let aborted = false;
  const worker = async () => {
    while (!aborted && queue.length > 0) {
      try {
        await generateOne(queue.shift());
      } catch (error) {
        aborted = true;
        throw error;
      }
    }
  };
  const results = await Promise.allSettled(Array.from({ length: JOBS }, worker));
  const failure = results.find((r) => r.status === 'rejected');
  if (failure) throw failure.reason;

  if (values.prune) {
    const pruned = prune(manifest, audioDir, new Set(dataset.policies.map((p) => p.id)), false);
    console.log(`已刪除清單項目 ${pruned.items.length} 條、音檔 ${pruned.files.length} 個`);
  }
  writeManifest(manifestPath, manifest);
  const quota = targets.reduce((sum, { policy }) => sum + (manifest.items[policy.id].quota ?? 0), 0);
  console.log(`語音生成完成：${targets.length} 條、${totalChars} 字、${quota} 點；已是最新 ${scoped.length - stale.length} 條`);
}

try {
  await main();
} catch (error) {
  if (error instanceof DatasetValidationError) console.error(error.message);
  else console.error(`語音生成失敗：${error.message}`);
  process.exitCode = 1;
}
