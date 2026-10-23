// 核對（見 ADR 0002）。第一層：原文引述須逐字出現在出處快照中。
// 第二層：獨立 AI 依檢核表判定摘要；本模組負責組提示詞、解析輸出與寫成核對紀錄，不呼叫 claude。
import { readFileSync } from 'node:fs';

// 比對用的正規化：全形半形統一、移除空白與換行、移除標點。
// 夾在兩個數字之間的標點保留（小數點、千分位、日期與時間），避免「1.5」與「15」被視為相同。
export function normalizeForMatch(text) {
  return text
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/\p{P}+/gu, (run, offset, all) => {
      const between = /\d/.test(all[offset - 1] ?? '') && /\d/.test(all[offset + run.length] ?? '');
      return between ? run : '';
    });
}

// snapshots：sourceId → 出處快照文字（快照缺失時為 null）。
// 回傳 { status: 'pass' | 'fail', problems: [說明] }。
export function checkLayer1(policy, snapshots) {
  const problems = [];
  policy.quotes.forEach((quote, index) => {
    const snapshot = snapshots.get(quote.sourceId) ?? null;
    const text = normalizeForMatch(quote.text);
    if (snapshot === null) {
      problems.push(`quotes[${index}] 的出處 ${quote.sourceId} 沒有可用的快照`);
    } else if (text === '') {
      problems.push(`quotes[${index}] 正規化後沒有任何文字`);
    } else if (!normalizeForMatch(snapshot).includes(text)) {
      problems.push(`quotes[${index}] 未逐字出現在出處 ${quote.sourceId} 的快照中`);
    }
  });
  return { status: problems.length === 0 ? 'pass' : 'fail', problems };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 提示詞檔第一行是「版本：X」，其後以「## 系統提示」「## 判定提示」分段。
function parsePromptFile(text, path) {
  const version = text.match(/^版本：(\S+)/)?.[1];
  const system = text.match(/^## 系統提示\n([\s\S]*?)(?=^## )/m)?.[1].trim();
  const prompt = text.match(/^## 判定提示\n([\s\S]*)/m)?.[1].trim();
  if (!version || !system || !prompt) throw new Error(`提示詞檔 ${path} 缺少版本、系統提示或判定提示`);
  return { version, system, prompt };
}

// paths：{ checklist, prompt, brandTerms }。檢核表與提示詞是一組，版本須相同。
export function loadVerificationRules(paths) {
  const checklist = readJson(paths.checklist);
  const prompt = parsePromptFile(readFileSync(paths.prompt, 'utf8'), paths.prompt);
  const brandTerms = readJson(paths.brandTerms);
  if (checklist.version !== prompt.version) {
    throw new Error(`檢核表版本 ${checklist.version} 與提示詞版本 ${prompt.version} 不一致`);
  }
  for (const key of ['brand', 'frequent']) {
    if (!Array.isArray(brandTerms[key])) throw new Error(`品牌用語清單 ${paths.brandTerms} 缺少 ${key} 陣列`);
  }
  return {
    checklist,
    prompt,
    brandTerms,
    checklistVersion: `${checklist.version}（品牌用語清單 ${brandTerms.version}）`,
  };
}

const termList = (entries) => entries.map((e) => `- ${e.term}`).join('\n') || '（無）';

// 只代入摘要、原文引述、檢核表與品牌用語清單。候選人、議題區、出處等一律不給。
export function buildLayer2Request(rules, policy) {
  const values = {
    checklistVersion: rules.checklist.version,
    checklist: rules.checklist.items.map((item, i) => `${i + 1}. ${item.title}：${item.rule}`).join('\n'),
    brandTerms: termList(rules.brandTerms.brand),
    frequentTerms: termList(rules.brandTerms.frequent),
    quotes: policy.quotes.map((q) => `- 「${q.text}」`).join('\n'),
    summary: policy.summary,
  };
  return {
    systemPrompt: rules.prompt.system,
    prompt: rules.prompt.prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]),
    checklistVersion: rules.checklistVersion,
  };
}

// 第一層不通過時第二層不送判定，維持未核對。layer2.model 讀不到時用 model（指定的模型）。
export function recordVerification({ layer1, layer2, checklistVersion, model = null, checkedAt }) {
  const sent = layer1.status === 'pass' && layer2 !== null;
  return {
    layer1: { status: layer1.status, checkedAt },
    layer2: sent
      ? { status: layer2.status, reason: layer2.reason, checklistVersion, model: layer2.model ?? model, checkedAt }
      : { status: 'pending', reason: null, checklistVersion: null, model: null, checkedAt: null },
  };
}

// 第二層的固定判定格式：{ verdict: '通過' | '退回', reason: 非空字串 }。
export const LAYER2_VERDICTS = { 通過: 'pass', 退回: 'fail' };

export const LAYER2_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { enum: Object.keys(LAYER2_VERDICTS) },
    reason: { type: 'string' },
  },
  required: ['verdict', 'reason'],
  additionalProperties: false,
};

function malformed(detail) {
  return { status: 'fail', reason: `第二層輸出格式錯誤：${detail}`, model: null };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// 解析 claude -p --output-format json 的輸出。格式不符一律視為不通過，理由寫明哪裡不符。
// model 取自輸出回報的實際模型；讀不到時為 null，由呼叫端補上指定的模型。
export function parseLayer2Output(stdout) {
  const envelope = parseJson(stdout);
  if (envelope === null || typeof envelope !== 'object') return malformed('不是 claude -p 的 JSON 輸出');
  if (envelope.is_error) return malformed(`claude -p 執行失敗（${envelope.subtype ?? '未知'}）：${String(envelope.result ?? '').slice(0, 200)}`);
  const verdict = envelope.structured_output ?? parseJson(envelope.result ?? '');
  if (verdict === null || typeof verdict !== 'object') return malformed('回覆不是 JSON 判定');
  if (!Object.hasOwn(LAYER2_VERDICTS, verdict.verdict)) return malformed(`verdict 應為「通過」或「退回」，實際為 ${JSON.stringify(verdict.verdict)}`);
  if (typeof verdict.reason !== 'string' || verdict.reason.trim() === '') return malformed('reason 應為非空字串');
  const model = Object.keys(envelope.modelUsage ?? {})[0] ?? null;
  return { status: LAYER2_VERDICTS[verdict.verdict], reason: verdict.reason.trim(), model };
}
