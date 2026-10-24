import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeSpeechService } from './fixtures/fake-speech-service.js';

const repoPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const SPEAK_SCRIPT = repoPath('scripts/speak.js');
const SAMPLE_RAW = repoPath('test/fixtures/raw-sample');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// 夾具裡兩條公開政見組好的朗讀文字（樣板見 scripts/lib/speech.js）。
const JIA_TEXT = '摘要。在範例區增設三條公車路線，每 15 分鐘一班。[:1]原文引述。在範例區增設三條範例公車路線，每十五分鐘一班。';
const YI_TEXT = '摘要。每區至少設一所托育中心，收托名額增加一倍。[:1]原文引述。範例托育中心每區至少一所，收托名額增加一倍。';

// 非同步執行，假伺服器才能在同一個行程裡回應。環境變數不繼承外面的金鑰。
function speak(args, { key = 'test-key' } = {}) {
  const { VOAI_API_KEY: _, ...env } = process.env;
  if (key !== null) env.VOAI_API_KEY = key;
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

test('對每條公開政見送出同一組語音設定，存成以文字雜湊命名的 mp3 並寫出清單', async (t) => {
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
  assert.deepEqual(manifest.voice, { provider: 'voai', name: '國賢', style: '預設', model: 'Neo', speed: 1 });
  assert.deepEqual(Object.keys(manifest.items), ['sample-jia-001', 'sample-yi-001']);
  const bytes = Buffer.from(`FAKE-MP3:${JIA_TEXT}`);
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
  assert.equal(readFileSync(join(audioDir, item.file), 'utf8'), texts.map((text) => `FAKE-MP3:${text}`).join(''));
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
