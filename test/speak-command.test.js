import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFfmpeg } from '../scripts/lib/speech.js';
import { startFakeSpeechService } from './fixtures/fake-speech-service.js';

const repoPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const SPEAK_SCRIPT = repoPath('scripts/speak.js');
const SAMPLE_RAW = repoPath('test/fixtures/raw-sample');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// 夾具裡兩條公開政見組好的朗讀文字（樣板見 scripts/lib/speech.js）。
const JIA_TEXT = '摘要。在範例區增設三條公車路線，每 15 分鐘一班。[:1]原文引述。在範例區增設三條範例公車路線，每十五分鐘一班。';
const YI_TEXT = '摘要。每區至少設一所托育中心，收托名額增加一倍。[:1]原文引述。範例托育中心每區至少一所，收托名額增加一倍。';

// 假 ffmpeg 輸出「TRANSCODED-<位元率>:」加上輸入位元組，轉碼流程在沒有 ffmpeg 的環境也能測。
const FAKE_FFMPEG = repoPath('test/fixtures/fake-ffmpeg');
const transcoded = (bytes) => Buffer.concat([Buffer.from('TRANSCODED-48k:'), Buffer.from(bytes)]);
const VOICE = { provider: 'voai', name: '國賢', style: '預設', model: 'Neo', speed: 1, bitrate: '48k' };

// 非同步執行，假伺服器才能在同一個行程裡回應。環境變數不繼承外面的金鑰；ffmpeg 預設用假的。
function speak(args, { key = 'test-key', ffmpeg = FAKE_FFMPEG } = {}) {
  const { VOAI_API_KEY: _, FFMPEG_PATH: __, ...env } = process.env;
  if (key !== null) env.VOAI_API_KEY = key;
  if (ffmpeg !== null) env.FFMPEG_PATH = ffmpeg;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SPEAK_SCRIPT, '--date', '2026-10-24', '--retry-delays', '0,0,0', ...args], { env });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolve({ code, output }));
  });
}

const tempDir = (prefix) => mkdtempSync(join(tmpdir(), prefix));
const readManifest = (audioDir) => JSON.parse(readFileSync(join(audioDir, 'manifest.json'), 'utf8'));

function copySample() {
  const rawDir = tempDir('speak-raw-');
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  return rawDir;
}

test('對每條公開政見送出同一組語音設定，轉碼後存成以文字雜湊命名的 mp3 並寫出含位元率的清單', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url]);

  assert.equal(code, 0, output);
  assert.deepEqual(service.requests.map((r) => r.body.input.voai_script_text).sort(), [JIA_TEXT, YI_TEXT].sort());
  for (const { headers, body } of service.requests) {
    assert.equal(headers['x-api-key'], 'test-key');
    assert.equal(headers['x-output-format'], 'mp3');
    assert.deepEqual(body.voice, { name: '國賢', style: '預設', model: 'Neo' });
    assert.deepEqual(body.audio_config, { speed: 1, pitch_shift: 0, breath_pause: 0 });
  }
  const manifest = readManifest(audioDir);
  assert.deepEqual(manifest.voice, VOICE);
  assert.deepEqual(Object.keys(manifest.items), ['sample-jia-001', 'sample-yi-001']);
  const bytes = transcoded(`FAKE-MP3:${JIA_TEXT}`);
  assert.deepEqual(manifest.items['sample-jia-001'], {
    textSha256: sha256(JIA_TEXT),
    file: `${sha256(JIA_TEXT)}.mp3`,
    fileSha256: sha256(bytes),
    chars: [...JIA_TEXT].length,
    quota: [...JIA_TEXT].length + 1,
    generatedAt: '2026-10-24',
  });
  assert.deepEqual(readFileSync(join(audioDir, `${sha256(JIA_TEXT)}.mp3`)), bytes);
  assert.ok(service.maxActive() <= 2);
});

test('文字沒變就跳過；文字變了只重生成那一條，舊檔留到 --prune 才刪', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const rawDir = copySample();
  const audioDir = tempDir('speak-audio-');
  const args = ['--raw', rawDir, '--audio', audioDir, '--endpoint', service.url];
  assert.equal((await speak(args)).code, 0);
  const before = readManifest(audioDir);

  const again = await speak(args);
  assert.equal(again.code, 0, again.output);
  assert.equal(service.requests.length, 2);
  assert.deepEqual(readManifest(audioDir), before);

  const file = join(rawDir, 'policies', 'sample-yi.json');
  const policies = JSON.parse(readFileSync(file, 'utf8'));
  policies[0].summary = '每區至少設兩所托育中心。';
  writeFileSync(file, JSON.stringify(policies));
  const changed = await speak(args);
  assert.equal(changed.code, 0, changed.output);
  assert.equal(service.requests.length, 3);
  const after = readManifest(audioDir);
  assert.deepEqual(after.items['sample-jia-001'], before.items['sample-jia-001']);
  assert.notEqual(after.items['sample-yi-001'].file, before.items['sample-yi-001'].file);
  assert.ok(existsSync(join(audioDir, before.items['sample-yi-001'].file)), '沒給 --prune 時舊檔要留著');

  const pruned = await speak([...args, '--prune']);
  assert.equal(pruned.code, 0, pruned.output);
  assert.equal(service.requests.length, 3);
  assert.deepEqual(readdirSync(audioDir).sort(), ['manifest.json', after.items['sample-jia-001'].file, after.items['sample-yi-001'].file].sort());
});

test('音檔被刪掉或內容與清單不符時重生成', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  const args = ['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url];
  assert.equal((await speak(args)).code, 0);
  writeFileSync(join(audioDir, `${sha256(JIA_TEXT)}.mp3`), 'broken');

  const { code, output } = await speak(args);

  assert.equal(code, 0, output);
  assert.equal(service.requests.length, 3);
  assert.equal(service.requests[2].body.input.voai_script_text, JIA_TEXT);
});

test('文字超過 1000 字時依句子拆段送出，接成一個音檔並在清單記 parts', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const rawDir = copySample();
  const file = join(rawDir, 'policies', 'sample-jia.json');
  const policies = JSON.parse(readFileSync(file, 'utf8'));
  policies[0].summary = '範例區增設公車路線。'.repeat(120);
  writeFileSync(file, JSON.stringify(policies));
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', rawDir, '--audio', audioDir, '--endpoint', service.url, '--candidate', 'sample-jia']);

  assert.equal(code, 0, output);
  const texts = service.requests.map((r) => r.body.input.voai_script_text);
  assert.equal(texts.length, 2);
  for (const text of texts) assert.ok([...text].length <= 1000);
  const item = readManifest(audioDir).items['sample-jia-001'];
  assert.equal(item.parts, 2);
  assert.equal(item.chars, [...texts.join('')].length);
  assert.equal(item.textSha256, sha256(texts.join('')));
  assert.deepEqual(readFileSync(join(audioDir, item.file)), transcoded(texts.map((text) => `FAKE-MP3:${text}`).join('')));
});

test('清單的語音設定與現行設定不同時直接失敗，不呼叫服務', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify({ voice: { provider: 'voai', name: '別的聲音', style: '預設', model: 'Neo', speed: 1 }, items: {} }));

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url]);

  assert.notEqual(code, 0);
  assert.match(output, /語音設定/);
  assert.equal(service.requests.length, 0);
});

// 轉碼前的舊清單：voice 沒有 bitrate，音檔是服務原樣回傳的位元組。
function writeOldManifest(audioDir, voice = { provider: 'voai', name: '國賢', style: '預設', model: 'Neo', speed: 1 }) {
  const items = {};
  for (const [id, text] of [['sample-jia-001', JIA_TEXT], ['sample-yi-001', YI_TEXT]]) {
    const bytes = Buffer.from(`FAKE-MP3:${text}`);
    items[id] = { textSha256: sha256(text), file: `${sha256(text)}.mp3`, fileSha256: sha256(bytes), chars: [...text].length, quota: 7, generatedAt: '2026-10-20' };
    writeFileSync(join(audioDir, items[id].file), bytes);
  }
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify({ voice, items }));
  return items;
}

test('--reencode 把舊清單（沒有位元率）的既有音檔轉成現行設定，更新雜湊並補上位元率，不需要金鑰、不呼叫服務', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  const old = writeOldManifest(audioDir);

  const { code, output } = await speak(['--audio', audioDir, '--endpoint', service.url, '--reencode'], { key: null });

  assert.equal(code, 0, output);
  assert.equal(service.requests.length, 0);
  const manifest = readManifest(audioDir);
  assert.deepEqual(manifest.voice, VOICE);
  for (const [id, text] of [['sample-jia-001', JIA_TEXT], ['sample-yi-001', YI_TEXT]]) {
    const bytes = transcoded(`FAKE-MP3:${text}`);
    assert.deepEqual(readFileSync(join(audioDir, old[id].file)), bytes);
    assert.deepEqual(manifest.items[id], { ...old[id], fileSha256: sha256(bytes) });
  }
  assert.match(output, /轉碼 2 條/);

  // 轉完再跑生成，音檔都已是最新，不呼叫服務。
  const again = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url]);
  assert.equal(again.code, 0, again.output);
  assert.equal(service.requests.length, 0);
});

test('--reencode 跳過不存在或雜湊與清單不符的音檔並列出，留給下次生成', async () => {
  const audioDir = tempDir('speak-audio-');
  const old = writeOldManifest(audioDir);
  rmSync(join(audioDir, old['sample-yi-001'].file));

  const { code, output } = await speak(['--audio', audioDir, '--reencode'], { key: null });

  assert.equal(code, 0, output);
  const manifest = readManifest(audioDir);
  assert.deepEqual(manifest.voice, VOICE);
  assert.deepEqual(manifest.items['sample-yi-001'], old['sample-yi-001']);
  assert.notEqual(manifest.items['sample-jia-001'].fileSha256, old['sample-jia-001'].fileSha256);
  assert.match(output, /轉碼 1 條/);
  assert.match(output, /sample-yi-001.*不存在/);
});

test('--reencode 遇到清單已是現行設定時不重轉；聲線等其他設定不同時直接失敗', async () => {
  const current = tempDir('speak-audio-');
  writeOldManifest(current, VOICE);
  const before = readFileSync(join(current, 'manifest.json'), 'utf8');
  const same = await speak(['--audio', current, '--reencode'], { key: null });
  assert.equal(same.code, 0, same.output);
  assert.equal(readFileSync(join(current, 'manifest.json'), 'utf8'), before);
  assert.match(same.output, /已是現行設定/);

  const other = tempDir('speak-audio-');
  const old = writeOldManifest(other, { provider: 'voai', name: '別的聲音', style: '預設', model: 'Neo', speed: 1 });
  const failed = await speak(['--audio', other, '--reencode'], { key: null });
  assert.notEqual(failed.code, 0);
  assert.match(failed.output, /語音設定/);
  assert.deepEqual(readManifest(other).items, old);
});

test('清單只差位元率時，一般生成直接失敗並提示 --reencode，不呼叫服務', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  writeOldManifest(audioDir);

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url]);

  assert.notEqual(code, 0);
  assert.match(output, /--reencode/);
  assert.equal(service.requests.length, 0);
});

test('--reencode 找不到 ffmpeg 時直接失敗，不動清單與音檔', async () => {
  const audioDir = tempDir('speak-audio-');
  const old = writeOldManifest(audioDir);

  const { code, output } = await speak(['--audio', audioDir, '--reencode'], { key: null, ffmpeg: join(audioDir, 'no-ffmpeg') });

  assert.notEqual(code, 0);
  assert.match(output, /找不到 ffmpeg/);
  assert.deepEqual(readManifest(audioDir).items, old);
});

test('--dry-run 列出要生成的政見、字數與估計點數，不需要金鑰、不呼叫服務、不寫檔', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url, '--dry-run'], { key: null });

  assert.equal(code, 0, output);
  assert.equal(service.requests.length, 0);
  assert.deepEqual(readdirSync(audioDir), []);
  assert.match(output, new RegExp(`sample-jia-001.*${[...JIA_TEXT].length} 字`));
  assert.match(output, /sample-yi-001/);
  assert.match(output, new RegExp(`要生成 2 條.*${[...JIA_TEXT].length + [...YI_TEXT].length} 字.*估計.*點`));
});

test('--candidate 只生成那位候選人，--limit 限制這次生成的條數', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  const base = ['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url];

  assert.equal((await speak([...base, '--candidate', 'sample-yi'])).code, 0);
  assert.deepEqual(Object.keys(readManifest(audioDir).items), ['sample-yi-001']);

  const other = tempDir('speak-audio-');
  assert.equal((await speak(['--raw', SAMPLE_RAW, '--audio', other, '--endpoint', service.url, '--limit', '1'])).code, 0);
  assert.equal(Object.keys(readManifest(other).items).length, 1);
});

test('服務沒回點數標頭時清單的 quota 記 null，不當成 0 點', async (t) => {
  const service = await startFakeSpeechService({ quotaHeader: false });
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url, '--candidate', 'sample-jia']);

  assert.equal(code, 0, output);
  assert.equal(readManifest(audioDir).items['sample-jia-001'].quota, null);
  assert.match(output, /點數不明/);
});

test('--retry-delays 不是逗號分隔的秒數時直接失敗', async () => {
  for (const value of ['', '5,,45', '-1']) {
    const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', tempDir('speak-audio-'), '--dry-run', '--retry-delays', value]);
    assert.notEqual(code, 0, value);
    assert.match(output, /--retry-delays/);
  }
});

test('沒有設 VOAI_API_KEY 時直接失敗並說明，不呼叫服務', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url], { key: null });

  assert.notEqual(code, 0);
  assert.match(output, /VOAI_API_KEY/);
  assert.equal(service.requests.length, 0);
  assert.deepEqual(readdirSync(audioDir), []);
});

test('找不到 ffmpeg 時直接失敗並說明怎麼安裝或指定，不呼叫服務', async (t) => {
  const service = await startFakeSpeechService();
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url], { ffmpeg: join(audioDir, 'no-ffmpeg') });

  assert.notEqual(code, 0);
  assert.match(output, /找不到 ffmpeg.*FFMPEG_PATH/);
  assert.equal(service.requests.length, 0);
  assert.deepEqual(readdirSync(audioDir), []);
});

test('429 與 5xx 重試，其他錯誤不重試；重試用完仍失敗時以非零結束碼退出', async (t) => {
  const retried = await startFakeSpeechService({ statuses: [429, 503] });
  t.after(retried.close);
  const audioDir = tempDir('speak-audio-');
  const ok = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', retried.url, '--candidate', 'sample-jia']);
  assert.equal(ok.code, 0, ok.output);
  assert.equal(retried.requests.length, 3);

  const rejected = await startFakeSpeechService({ statuses: [400] });
  t.after(rejected.close);
  const bad = await speak(['--raw', SAMPLE_RAW, '--audio', tempDir('speak-audio-'), '--endpoint', rejected.url, '--candidate', 'sample-jia']);
  assert.notEqual(bad.code, 0);
  assert.match(bad.output, /400/);
  assert.equal(rejected.requests.length, 1);

  const down = await startFakeSpeechService({ statuses: [500, 500, 500, 500] });
  t.after(down.close);
  const failed = await speak(['--raw', SAMPLE_RAW, '--audio', tempDir('speak-audio-'), '--endpoint', down.url, '--candidate', 'sample-jia']);
  assert.notEqual(failed.code, 0);
  assert.equal(down.requests.length, 4);
});

// 真 ffmpeg 轉碼：服務回 1 秒靜音的 128 kbps 單聲道 32 kHz mp3，用 ffprobe 量轉出來的檔。
// 這台機器沒有 ffmpeg 或 ffprobe 時跳過（上面用假 ffmpeg 的測試照跑）。
const SILENCE_128K = readFileSync(repoPath('test/fixtures/silence-128k.mp3'));
const realFfmpeg = (() => {
  try {
    const ffmpeg = findFfmpeg();
    const ffprobe = join(dirname(ffmpeg), 'ffprobe');
    return existsSync(ffprobe) ? { ffmpeg, ffprobe } : null;
  } catch {
    return null;
  }
})();
const skipReason = realFfmpeg ? false : '這台機器沒有 ffmpeg 與 ffprobe（可用環境變數 FFMPEG_PATH 指定），跳過真轉碼測試';

function probe(path) {
  const json = execFileSync(realFfmpeg.ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_name,bit_rate,channels,sample_rate', '-of', 'json', path], { encoding: 'utf8' });
  const [stream] = JSON.parse(json).streams;
  return { codec: stream.codec_name, bitRate: Number(stream.bit_rate), channels: stream.channels, sampleRate: Number(stream.sample_rate) };
}

test('真 ffmpeg：新生成的音檔轉成 48 kbps 單聲道 mp3，取樣率不變', { skip: skipReason }, async (t) => {
  const service = await startFakeSpeechService({ audio: SILENCE_128K });
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');

  const { code, output } = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url, '--candidate', 'sample-jia'], { ffmpeg: realFfmpeg?.ffmpeg });

  assert.equal(code, 0, output);
  const item = readManifest(audioDir).items['sample-jia-001'];
  const file = join(audioDir, item.file);
  assert.deepEqual(probe(file), { codec: 'mp3', bitRate: 48000, channels: 1, sampleRate: 32000 });
  assert.equal(item.fileSha256, sha256(readFileSync(file)));
  assert.ok(readFileSync(file).length < SILENCE_128K.length / 2);
});

test('真 ffmpeg：--reencode 把舊清單的 128 kbps 音檔轉成 48 kbps，轉完生成指令視為最新', { skip: skipReason }, async (t) => {
  const service = await startFakeSpeechService({ audio: SILENCE_128K });
  t.after(service.close);
  const audioDir = tempDir('speak-audio-');
  const old = writeOldManifest(audioDir);
  for (const item of Object.values(old)) {
    writeFileSync(join(audioDir, item.file), SILENCE_128K);
    item.fileSha256 = sha256(SILENCE_128K);
  }
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify({ voice: { provider: 'voai', name: '國賢', style: '預設', model: 'Neo', speed: 1 }, items: old }));

  const { code, output } = await speak(['--audio', audioDir, '--reencode'], { key: null, ffmpeg: realFfmpeg?.ffmpeg });

  assert.equal(code, 0, output);
  const manifest = readManifest(audioDir);
  assert.deepEqual(manifest.voice, VOICE);
  for (const item of Object.values(manifest.items)) {
    const file = join(audioDir, item.file);
    assert.deepEqual(probe(file), { codec: 'mp3', bitRate: 48000, channels: 1, sampleRate: 32000 });
    assert.equal(item.fileSha256, sha256(readFileSync(file)));
  }
  const again = await speak(['--raw', SAMPLE_RAW, '--audio', audioDir, '--endpoint', service.url], { ffmpeg: realFfmpeg?.ffmpeg });
  assert.equal(again.code, 0, again.output);
  assert.equal(service.requests.length, 0);
});
