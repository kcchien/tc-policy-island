// 核對政見：node scripts/verify.js [--raw data/raw] [--candidate <id>]... [--skip-passed] [--jobs 1]
//   [--model claude-opus-5-5] [--claude claude] [--brand-terms data/rules/brand-terms.json] [--date YYYY-MM-DD]
// 對每筆政見先跑第一層（逐字比對出處快照），通過才送第二層（claude -p 全新 session 依檢核表判定），
// 結果寫回 <raw>/policies/<candidateId>.json 的 verification。見 ADR 0002。
// --jobs 是第二層同時執行的 session 數，每筆仍各開一個全新 session。
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isVerified, validateRawData } from '../site/js/dataset.js';
import { loadRawData, readJson } from './lib/raw-data.js';
import {
  buildLayer2Request,
  checkLayer1,
  LAYER2_OUTPUT_SCHEMA,
  loadVerificationRules,
  parseLayer2Output,
  recordVerification,
} from './lib/verification.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYER2_TIMEOUT_MS = 5 * 60 * 1000;

const { values } = parseArgs({
  options: {
    raw: { type: 'string', default: 'data/raw' },
    candidate: { type: 'string', multiple: true },
    'skip-passed': { type: 'boolean', default: false },
    jobs: { type: 'string', default: '1' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    claude: { type: 'string', default: 'claude' },
    'brand-terms': { type: 'string', default: 'data/rules/brand-terms.json' },
    date: { type: 'string', default: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) },
  },
});

const STATUS_TEXT = {
  layer1: { pass: '通過', fail: '不通過', pending: '未核對' },
  layer2: { pass: '通過', fail: '退回', pending: '未核對' },
};

// 快照路徑相對 repo 根目錄。檔案不存在或雜湊與出處紀錄不符時視為沒有可用的快照。
function readSnapshots(sources) {
  const snapshots = new Map();
  const notes = [];
  for (const source of sources) {
    const path = resolve(REPO_ROOT, source.snapshotPath);
    if (!existsSync(path)) {
      snapshots.set(source.id, null);
      notes.push(`出處 ${source.id}：快照 ${source.snapshotPath} 不存在`);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    const sha256 = createHash('sha256').update(text).digest('hex');
    if (sha256 !== source.snapshotSha256) {
      snapshots.set(source.id, null);
      notes.push(`出處 ${source.id}：快照雜湊 ${sha256} 與出處紀錄 ${source.snapshotSha256} 不符`);
      continue;
    }
    snapshots.set(source.id, text);
  }
  return { snapshots, notes };
}

// 非同步版的 spawnSync：回傳 { stdout, error }，執行檔不存在或逾時時 error 有值。
function spawnAsync(command, args, { cwd, input, timeout }) {
  return new Promise((settle) => {
    // 不用 spawn 的 timeout 選項：執行檔不存在時它的計時器不會清掉，流程會卡到逾時。
    // stderr 不讀，接成管線而沒人讀時，子程序寫滿緩衝區就會卡住。
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'ignore'] });
    let stdout = '';
    let error = null;
    const timer = setTimeout(() => {
      error = new Error(`逾時 ${timeout / 1000} 秒`);
      child.kill();
    }, timeout);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stdin.on('error', () => {});
    child.on('error', (e) => { error ??= e; });
    child.on('close', () => {
      clearTimeout(timer);
      settle({ stdout, error });
    });
    child.stdin.end(input);
  });
}

// 每筆政見一個全新的 claude -p session：不帶工具、設定、MCP、指令與對話紀錄，
// 工作目錄是空的暫存目錄，讀不到本 repo 與其他候選人的資料。
async function runLayer2(request) {
  const cwd = mkdtempSync(join(tmpdir(), 'tc-verify-'));
  try {
    const result = await spawnAsync(
      values.claude,
      [
        '-p',
        '--output-format', 'json',
        '--model', values.model,
        '--system-prompt', request.systemPrompt,
        '--json-schema', JSON.stringify(LAYER2_OUTPUT_SCHEMA),
        '--tools', '',
        '--setting-sources', '',
        '--strict-mcp-config',
        '--disable-slash-commands',
        '--no-session-persistence',
      ],
      { cwd, input: request.prompt, timeout: LAYER2_TIMEOUT_MS },
    );
    // 執行檔不存在或逾時是環境問題，不寫成退回，直接中止。
    if (result.error) throw new Error(`無法執行 ${values.claude}：${result.error.message}`);
    return parseLayer2Output(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// 政見識別碼 → 所在的 policies/*.json，寫回時只重寫該檔。
function policyFiles(rawDir) {
  const dir = join(rawDir, 'policies');
  const fileOf = new Map();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    for (const p of readJson(join(dir, name))) fileOf.set(p.id, join(dir, name));
  }
  return fileOf;
}

function writePolicy(path, policy) {
  const records = readJson(path).map((p) => (p.id === policy.id ? policy : p));
  writeFileSync(path, `${JSON.stringify(records, null, 2)}\n`);
}

// 兩層都以現行檢核表版本通過才算已通過；檢核表升版後舊的通過要重跑。
const passedWithCurrentChecklist = (policy, checklistVersion) =>
  isVerified(policy) && policy.verification.layer2.checklistVersion === checklistVersion;

async function main() {
  const rawDir = resolve(values.raw);
  const jobs = Number(values.jobs);
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs 應為正整數，實際為 ${values.jobs}`);
  const raw = loadRawData(rawDir);
  const errors = validateRawData(raw);
  if (errors.length > 0) throw new Error(`原始資料有 ${errors.length} 處錯誤，先修正再核對：\n${errors.join('\n')}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw new Error(`--date 應為 YYYY-MM-DD，實際為 ${values.date}`);

  const candidateIds = new Set(raw.candidates.map((c) => c.id));
  for (const id of values.candidate ?? []) {
    if (!candidateIds.has(id)) throw new Error(`--candidate ${id} 不是原始資料中的候選人`);
  }
  const brandTerms = resolve(values['brand-terms']);
  if (!existsSync(brandTerms)) throw new Error(`品牌用語清單 ${values['brand-terms']} 不存在，用 --brand-terms 指定路徑`);
  const rules = loadVerificationRules({
    checklist: join(REPO_ROOT, 'data/verification/checklist.json'),
    prompt: join(REPO_ROOT, 'data/verification/layer2-prompt.md'),
    brandTerms,
  });
  const { snapshots, notes } = readSnapshots(raw.sources);
  for (const note of notes) console.log(note);

  const targets = raw.policies
    .filter((p) => !values.candidate || values.candidate.includes(p.candidateId))
    .filter((p) => !values['skip-passed'] || !passedWithCurrentChecklist(p, rules.checklistVersion));
  // 遮蔽全部候選人（不只本筆政見的候選人）的姓名與政黨，核對 AI 無從得知是誰的政見。
  const hiddenNames = raw.candidates.flatMap((c) => [c.name, c.party]);
  const fileOf = policyFiles(rawDir);
  const tally = { pass: 0, fail: 0 };
  const verifyOne = async (policy) => {
    const layer1 = checkLayer1(policy, snapshots);
    const layer2 = layer1.status === 'pass' ? await runLayer2(buildLayer2Request(rules, policy, { hiddenNames })) : null;
    policy.verification = recordVerification({
      layer1,
      layer2,
      checklistVersion: rules.checklistVersion,
      model: values.model,
      checkedAt: values.date,
    });
    // 每筆寫回一次，中途中止時已完成的結果不會遺失。
    writePolicy(fileOf.get(policy.id), policy);

    const passed = isVerified(policy);
    tally[passed ? 'pass' : 'fail'] += 1;
    const { layer2: record } = policy.verification;
    const detail = layer1.status === 'pass' ? `；${record.reason}` : `；${layer1.problems.join('；')}`;
    console.log(`${policy.id}：第一層${STATUS_TEXT.layer1[layer1.status]}、第二層${STATUS_TEXT.layer2[record.status]}${detail}`);
  };
  // jobs 個工作者輪流從佇列取政見。寫回是同步的，同一流程內不會互相覆蓋。
  // 任一筆中止（例如執行檔不存在）時其他工作者不再取新的政見。
  const queue = [...targets];
  let aborted = false;
  const worker = async () => {
    while (!aborted && queue.length > 0) {
      try {
        await verifyOne(queue.shift());
      } catch (error) {
        aborted = true;
        throw error;
      }
    }
  };
  const results = await Promise.allSettled(Array.from({ length: jobs }, worker));
  const failure = results.find((r) => r.status === 'rejected');
  if (failure) throw failure.reason;
  console.log(`核對完成：${targets.length} 筆，兩層皆通過 ${tally.pass} 筆、未通過 ${tally.fail} 筆（檢核表版本 ${rules.checklistVersion}）`);
}

try {
  await main();
} catch (error) {
  console.error(`核對失敗：${error.message}`);
  process.exitCode = 1;
}
