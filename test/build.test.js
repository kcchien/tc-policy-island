import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, SPEECH_VOICE, speechScript } from '../scripts/lib/speech.js';

const BUILD_SCRIPT = fileURLToPath(new URL('../scripts/build.js', import.meta.url));
const SAMPLE_RAW = fileURLToPath(new URL('./fixtures/raw-sample', import.meta.url));

// 預設指向不存在的音檔目錄，結果不受 repo 裡 data/audio/ 的內容影響。
function build(rawDir, args = []) {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(mkdtempSync(join(tmpdir(), 'build-out-')), 'dataset.json');
  const audio = args.includes('--audio') ? [] : ['--audio', join(tmpdir(), 'build-no-audio')];
  const portraits = args.includes('--portraits') ? [] : ['--portraits', join(tmpdir(), 'build-no-portraits')];
  const result = spawnSync(process.execPath, [BUILD_SCRIPT, '--raw', rawDir, '--out', out, ...audio, ...portraits, ...args], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr, out };
}

test('建置指令從原始資料目錄產出公開資料集，未核對政見不在其中', () => {
  const { code, output, out } = build(SAMPLE_RAW);

  assert.equal(code, 0, output);
  const dataset = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(
    dataset.policies.map((p) => p.id),
    ['sample-jia-001', 'sample-yi-001'],
  );
  assert.deepEqual(
    dataset.candidates.map((c) => c.id),
    ['sample-jia', 'sample-yi', 'sample-bing'],
  );
  assert.match(dataset.meta.builtAt, /^\d{4}-\d{2}-\d{2}T/);
  // 夾具沒有選舉時程檔，建置照常，時程為 null。
  assert.equal(dataset.meta.electionSchedule, null);
});

test('原始資料目錄有選舉時程檔時，建置進公開資料集的 meta.electionSchedule', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const schedule = {
    votingDate: '2026-11-28',
    events: [{
      id: 'voting',
      name: '投票日',
      date: '2026-11-28',
      endDate: null,
      sourceUrl: 'https://web.cec.gov.tw/central/article/61722',
      sourceTitle: '測試公告',
    }],
  };
  writeFileSync(join(rawDir, 'election-schedule.json'), JSON.stringify(schedule));

  const { code, output, out } = build(rawDir);

  assert.equal(code, 0, output);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).meta.electionSchedule, schedule);
});

test('建置指令把公開出處的出處快照複製到公開資料集旁的 snapshots/，讓卡片的快照連結可用', () => {
  const { code, output, out } = build(SAMPLE_RAW);

  assert.equal(code, 0, output);
  const copied = readFileSync(join(dirname(out), 'snapshots', 'sample-src-jia.txt'), 'utf8');
  const original = readFileSync(new URL('./fixtures/snapshots/sample-src-jia.txt', import.meta.url), 'utf8');
  assert.equal(copied, original);
});

test('公開出處的出處快照檔不存在時，建置失敗並指出是哪個出處', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const file = join(rawDir, 'sources', 'sample-yi.json');
  const sources = JSON.parse(readFileSync(file, 'utf8'));
  sources[0].snapshotPath = 'test/fixtures/snapshots/missing.txt';
  writeFileSync(file, JSON.stringify(sources));

  const { code, output } = build(rawDir);

  assert.notEqual(code, 0);
  assert.match(output, /出處 sample-src-yi 的出處快照 test\/fixtures\/snapshots\/missing\.txt 不存在/);
});

test('原始資料結構錯誤時，建置指令以非零結束碼退出並列出錯誤', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const file = join(rawDir, 'policies', 'sample-jia.json');
  const policies = JSON.parse(readFileSync(file, 'utf8'));
  policies[0].issueAreaId = 'no-such-area';
  writeFileSync(file, JSON.stringify(policies));

  const { code, output } = build(rawDir);

  assert.notEqual(code, 0);
  assert.match(output, /政見 sample-jia-001：issueAreaId 指向不存在的議題區 no-such-area/);
});

test('建置指令把整理方法頁引用的 repo 文件逐字複製到公開資料集旁，並寫出實際複製的清單', () => {
  const { code, output, out } = build(SAMPLE_RAW);

  assert.equal(code, 0, output);
  const dir = dirname(out);
  const original = readFileSync(new URL('../docs/rules/classification-rules.md', import.meta.url));
  assert.ok(readFileSync(join(dir, 'repo-files', 'docs', 'rules', 'classification-rules.md')).equals(original));
  const manifest = JSON.parse(readFileSync(join(dir, 'repo-files.json'), 'utf8'));
  assert.ok(manifest.documents.includes('data/verification/checklist.json'));
  assert.ok(manifest.documents.includes('data/extraction/instructions.md'));
});

// 依夾具的公開政見做一份齊全的政見語音清單與音檔（音檔內容是假的位元組）。
function makeAudio(rawDir, { skip = [] } = {}) {
  const audioDir = mkdtempSync(join(tmpdir(), 'build-audio-'));
  const items = {};
  const policies = ['sample-jia', 'sample-yi'].flatMap((id) => JSON.parse(readFileSync(join(rawDir, 'policies', `${id}.json`), 'utf8')));
  for (const policy of policies.filter((p) => p.verification.layer2.status === 'pass' && !skip.includes(p.id))) {
    const text = speechScript(policy);
    const bytes = Buffer.from(`FAKE-MP3:${policy.id}`);
    const file = `${sha256(text)}.mp3`;
    writeFileSync(join(audioDir, file), bytes);
    items[policy.id] = { textSha256: sha256(text), file, fileSha256: sha256(bytes), chars: [...text].length, quota: 1, generatedAt: '2026-10-24' };
  }
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify({ voice: SPEECH_VOICE, items }));
  return audioDir;
}

const audioFiles = (out) => (existsSync(join(dirname(out), 'audio')) ? readdirSync(join(dirname(out), 'audio')).sort() : []);

test('政見語音清單齊全時，每條公開政見帶 audioUrl，音檔與清單複製到公開資料集旁的 audio/', () => {
  const audioDir = makeAudio(SAMPLE_RAW);
  const manifest = JSON.parse(readFileSync(join(audioDir, 'manifest.json'), 'utf8'));

  const { code, output, out } = build(SAMPLE_RAW, ['--audio', audioDir]);

  assert.equal(code, 0, output);
  const dataset = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(
    dataset.policies.map((p) => [p.id, p.audioUrl]),
    dataset.policies.map((p) => [p.id, `data/audio/${manifest.items[p.id].file}`]),
  );
  assert.deepEqual(audioFiles(out), [...Object.values(manifest.items).map((item) => item.file), 'manifest.json'].sort());
  assert.ok(readFileSync(join(dirname(out), 'audio', manifest.items['sample-jia-001'].file)).equals(Buffer.from('FAKE-MP3:sample-jia-001')));
  assert.match(output, /政見語音 2 條/);
});

test('缺一條政見語音時，全部政見都不帶 audioUrl、不複製任何音檔，輸出列出缺少的政見', () => {
  const { code, output, out } = build(SAMPLE_RAW, ['--audio', makeAudio(SAMPLE_RAW, { skip: ['sample-yi-001'] })]);

  assert.equal(code, 0, output);
  const dataset = JSON.parse(readFileSync(out, 'utf8'));
  assert.ok(dataset.policies.every((p) => !('audioUrl' in p)));
  assert.deepEqual(audioFiles(out), []);
  assert.match(output, /sample-yi-001：清單沒有這條/);
  assert.doesNotMatch(output, /sample-jia-001/);
});

test('文字已變或音檔雜湊不符時視為缺少，同樣全部不帶；上一次建置留下的音檔也一併清掉', () => {
  const rawDir = mkdtempSync(join(tmpdir(), 'build-raw-'));
  cpSync(SAMPLE_RAW, rawDir, { recursive: true });
  const audioDir = makeAudio(rawDir);
  const out = join(mkdtempSync(join(tmpdir(), 'build-out-')), 'dataset.json');
  assert.equal(build(rawDir, ['--audio', audioDir, '--out', out]).code, 0);
  assert.equal(audioFiles(out).length, 3);

  const file = join(rawDir, 'policies', 'sample-yi.json');
  const policies = JSON.parse(readFileSync(file, 'utf8'));
  policies[0].summary = '每區至少設兩所托育中心。';
  writeFileSync(file, JSON.stringify(policies));
  const manifest = JSON.parse(readFileSync(join(audioDir, 'manifest.json'), 'utf8'));
  writeFileSync(join(audioDir, manifest.items['sample-jia-001'].file), 'broken');

  const { code, output } = build(rawDir, ['--audio', audioDir, '--out', out]);

  assert.equal(code, 0, output);
  assert.ok(JSON.parse(readFileSync(out, 'utf8')).policies.every((p) => !('audioUrl' in p)));
  assert.deepEqual(audioFiles(out), []);
  assert.match(output, /sample-yi-001：文字已變/);
  assert.match(output, /sample-jia-001：音檔與清單的雜湊不符/);
});

test('沒有政見語音清單時照常建置，政見不帶 audioUrl', () => {
  const { code, output, out } = build(SAMPLE_RAW, ['--audio', join(mkdtempSync(join(tmpdir(), 'build-audio-')), 'missing')]);

  assert.equal(code, 0, output);
  assert.ok(JSON.parse(readFileSync(out, 'utf8')).policies.every((p) => !('audioUrl' in p)));
  assert.match(output, /沒有政見語音清單/);
});

// 肖像夾具沿用虛構候選人資料，影像以中性像素代替真實肖像。
function makePortraits(rawDir) {
  const portraitDir = mkdtempSync(join(tmpdir(), 'build-portraits-'));
  const candidates = JSON.parse(readFileSync(join(rawDir, 'candidates.json')));
  const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000f0000001400802000000', 'hex');
  const items = candidates.map(c => {
    const source = JSON.parse(readFileSync(join(rawDir, 'sources', `${c.id}.json`))).find(s => s.id === c.profile.sourceId);
    const file = `${c.id}.png`;
    writeFileSync(join(portraitDir,file),bytes);
    return {candidateId:c.id,candidateName:c.name,sourceId:source.id,sourceUrl:source.url,electionYear:2024,
      retrievedAt:'2026-10-24',page:1,imageObject:'10 0',pdfSha256:'a'.repeat(64),extractedSha256:'b'.repeat(64),
      extraction:'抽取原始影像',identityCheckedAt:'2026-10-24',
      rights:{status:'cleared',specialExclusion:false,declarationUrl:'https://web.cec.gov.tw/central/article/21322',licenseUrl:'https://data.gov.tw/license',checkedAt:'2026-10-24'},
      file,fileSha256:sha256(bytes),width:240,height:320};
  });
  writeFileSync(join(portraitDir,'manifest.json'),JSON.stringify({items}));
  return portraitDir;
}

test('肖像建置全有全無，缺檔、未清權與來源不符不會洩漏照片，且清除上次產物', () => {
  const rawDir=mkdtempSync(join(tmpdir(),'build-portrait-raw-'));
  cpSync(SAMPLE_RAW,rawDir,{recursive:true});
  for (const c of JSON.parse(readFileSync(join(rawDir,'candidates.json')))) {
    const path=join(rawDir,'sources',`${c.id}.json`),sources=JSON.parse(readFileSync(path));
    sources.find(s=>s.id===c.profile.sourceId).url=`https://bulletin.cec.gov.tw/test-fixture/${c.id}.pdf`;
    writeFileSync(path,JSON.stringify(sources));
  }
  const portraits = makePortraits(rawDir);
  const out=join(mkdtempSync(join(tmpdir(),'build-portrait-out-')),'dataset.json');
  let result=build(rawDir,['--out',out,'--portraits',portraits]);
  assert.equal(result.code,0,result.output);
  assert.ok(JSON.parse(readFileSync(out)).candidates.every(c=>c.portrait));
  assert.equal(readdirSync(join(dirname(out),'portraits')).length,4);
  for (const mutate of [
    m => m.items[0].rights.status='pending',
    m => m.items[0].sourceId=m.items[1].sourceId,
    m => m.items.pop(),
  ]) {
    const dir=makePortraits(rawDir);
    const path=join(dir,'manifest.json'),manifest=JSON.parse(readFileSync(path)); mutate(manifest);writeFileSync(path,JSON.stringify(manifest));
    result=build(rawDir,['--out',out,'--portraits',dir]);
    assert.equal(result.code,0,result.output);
    assert.ok(JSON.parse(readFileSync(out)).candidates.every(c=>!c.portrait));
    assert.equal(existsSync(join(dirname(out),'portraits')),false);
  }
  // 缺檔以同樣不發布處理。
  const manifest=JSON.parse(readFileSync(join(portraits,'manifest.json')));
  writeFileSync(join(portraits,manifest.items[0].file),'broken');
  result=build(rawDir,['--out',out,'--portraits',portraits]);
  assert.ok(JSON.parse(readFileSync(out)).candidates.every(c=>!c.portrait));
  assert.equal(existsSync(join(dirname(out),'portraits')),false);
});
