import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLayer2Request,
  checkLayer1,
  loadVerificationRules,
  parseLayer2Output,
  recordVerification,
} from '../scripts/lib/verification.js';

const repoPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const RULE_PATHS = {
  checklist: repoPath('data/verification/checklist.json'),
  prompt: repoPath('data/verification/layer2-prompt.md'),
  brandTerms: repoPath('test/fixtures/rules/brand-terms.json'),
};

const SNAPSHOT = '範例甲的範例政見頁\n\n一、在範例區增設 3 條範例公車路線，每15分鐘一班。\n\n二、範例區增設兩座範例公園。';

function layer1(quoteText, snapshot = SNAPSHOT) {
  const policy = { id: 'p-1', quotes: [{ text: quoteText, sourceId: 'src-1' }] };
  return checkLayer1(policy, new Map([['src-1', snapshot]]));
}

test('第一層：全形與半形的數字、英文視為相同', () => {
  assert.equal(layer1('在範例區增設３條範例公車路線，每１５分鐘一班').status, 'pass');
});

test('第一層：空白與換行差異視為相同', () => {
  assert.equal(layer1('範例政見頁 一、在範例區增設3條\n範例公車路線').status, 'pass');
});

test('第一層：標點差異視為相同（全形半形、不同標點、多或少標點）', () => {
  assert.equal(layer1('每15分鐘一班.').status, 'pass');
  assert.equal(layer1('範例公車路線;每15分鐘一班').status, 'pass');
  assert.equal(layer1('範例公車路線每15分鐘一班').status, 'pass');
  assert.equal(layer1('「每15分鐘」一班').status, 'pass');
});

test('第一層：增加、刪除或替換字詞視為不同', () => {
  assert.equal(layer1('在範例區增設3條範例公車新路線').status, 'fail');
  assert.equal(layer1('在範例區增設3條公車路線').status, 'fail');
  assert.equal(layer1('在範例區增設4條範例公車路線').status, 'fail');
  assert.equal(layer1('範例區增設兩座範例綠地').status, 'fail');
});

test('第一層：數字之間的標點不會被移除，「1.5」與「15」視為不同', () => {
  assert.equal(layer1('每1.5分鐘一班').status, 'fail');
  assert.equal(layer1('票價1.5元', '票價15元').status, 'fail');
  assert.equal(layer1('票價1．5元', '票價1.5元').status, 'pass');
});

test('第一層：任一則引述不符就不通過，並指出是哪一則', () => {
  const policy = {
    id: 'p-1',
    quotes: [
      { text: '每15分鐘一班', sourceId: 'src-1' },
      { text: '範例區增設三座範例公園', sourceId: 'src-1' },
    ],
  };

  const result = checkLayer1(policy, new Map([['src-1', SNAPSHOT]]));

  assert.equal(result.status, 'fail');
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /quotes\[1\]/);
});

test('第一層：出處快照缺失時不通過', () => {
  const policy = { id: 'p-1', quotes: [{ text: '每15分鐘一班', sourceId: 'src-missing' }] };

  const result = checkLayer1(policy, new Map([['src-missing', null]]));

  assert.equal(result.status, 'fail');
  assert.match(result.problems[0], /src-missing.*快照/);
  assert.equal(checkLayer1(policy, new Map()).status, 'fail');
});

test('第一層：空白或只有標點的引述不通過', () => {
  assert.equal(layer1('，。 ').status, 'fail');
});

// claude -p --output-format json 的輸出外框，只保留解析會用到的欄位。
function claudeOutput(fields) {
  return JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '',
    modelUsage: { 'claude-opus-5-5': { inputTokens: 1, outputTokens: 1 } },
    ...fields,
  });
}

test('第二層：合法的通過判定解析為 pass，帶理由與模型名稱', () => {
  const output = claudeOutput({ structured_output: { verdict: '通過', reason: '摘要忠於原文，無評價字眼' } });

  assert.deepEqual(parseLayer2Output(output), {
    status: 'pass',
    reason: '摘要忠於原文，無評價字眼',
    model: 'claude-opus-5-5',
  });
});

test('第二層：合法的退回判定解析為 fail，保留退回理由', () => {
  const output = claudeOutput({ structured_output: { verdict: '退回', reason: '摘要多出原文沒有的「每年」' } });

  assert.deepEqual(parseLayer2Output(output), {
    status: 'fail',
    reason: '摘要多出原文沒有的「每年」',
    model: 'claude-opus-5-5',
  });
});

test('第二層：沒有結構化輸出時，從回覆文字解析固定格式的判定', () => {
  const output = claudeOutput({ result: '{"verdict":"通過","reason":"符合檢核表"}' });

  assert.equal(parseLayer2Output(output).status, 'pass');
});

test('第二層：格式錯誤的輸出視為不通過，並記錄原因', () => {
  const cases = [
    'not json at all',
    '',
    claudeOutput({ result: '我認為通過。' }),
    claudeOutput({ structured_output: { verdict: '大致通過', reason: '還行' } }),
    claudeOutput({ structured_output: { verdict: '通過', reason: '' } }),
    claudeOutput({ structured_output: { verdict: '通過' } }),
    claudeOutput({ is_error: true, subtype: 'error_during_execution', result: 'API Error' }),
  ];
  for (const output of cases) {
    const parsed = parseLayer2Output(output);
    assert.equal(parsed.status, 'fail', output);
    assert.match(parsed.reason, /^第二層輸出格式錯誤：/, output);
  }
});

const POLICY = {
  id: 'sample-jia-001',
  candidateId: 'sample-jia',
  issueAreaId: 'sample-transport',
  summary: '在範例區增設三條公車路線，每 15 分鐘一班。',
  quotes: [{ text: '在範例區增設三條範例公車路線，每十五分鐘一班。', sourceId: 'sample-src-jia' }],
  districts: ['大里區'],
  conflictNote: null,
};

test('第二層提示詞：含檢核表全部項目、品牌用語、摘要與原文引述，標示檢核表版本', () => {
  const rules = loadVerificationRules(RULE_PATHS);

  const request = buildLayer2Request(rules, POLICY);

  for (const item of rules.checklist.items) assert.ok(request.prompt.includes(item.rule), item.id);
  assert.ok(request.prompt.includes('範例口號'));
  assert.ok(request.prompt.includes('七星市政'));
  assert.ok(request.prompt.includes('超級'));
  assert.ok(request.prompt.includes(POLICY.summary));
  assert.ok(request.prompt.includes(POLICY.quotes[0].text));
  assert.doesNotMatch(request.prompt, /\{\{/);
  assert.ok(request.systemPrompt.length > 0);
  assert.equal(request.checklistVersion, '1（品牌用語清單 fixture-1）');
});

test('第二層提示詞：不含候選人、議題區、出處與抽取資訊', () => {
  const request = buildLayer2Request(loadVerificationRules(RULE_PATHS), POLICY);

  for (const leaked of ['sample-jia', 'sample-transport', 'sample-src-jia', '大里區']) {
    assert.ok(!request.prompt.includes(leaked), leaked);
    assert.ok(!request.systemPrompt.includes(leaked), leaked);
  }
});

test('第二層提示詞：品牌用語清單只代入詞本身，不含候選人姓名與政黨名稱（盲測）', () => {
  // 正式清單每筆的 candidate 與 note 會寫到真實候選人，這裡故意放進去，確認不會漏給核對 AI。
  const leaked = ['江啟臣', '何欣純', '洪麗華', '中國國民黨', '民主進步黨', '司法正義黨'];
  const brandTerms = join(mkdtempSync(join(tmpdir(), 'rules-')), 'brand-terms.json');
  writeFileSync(brandTerms, JSON.stringify({
    version: 'leak-test',
    brand: [
      { term: '範例口號', candidate: '江啟臣', note: '中國國民黨提名的江啟臣使用' },
      { term: '七星市政', candidate: '何欣純', note: '民主進步黨提名的何欣純使用' },
    ],
    frequent: [{ term: '超級', candidate: '洪麗華', note: '司法正義黨洪麗華' }],
  }));

  const request = buildLayer2Request(loadVerificationRules({ ...RULE_PATHS, brandTerms }), POLICY);

  assert.ok(request.prompt.includes('範例口號'));
  for (const name of leaked) {
    assert.ok(!request.prompt.includes(name), name);
    assert.ok(!request.systemPrompt.includes(name), name);
  }
});

test('第二層提示詞：本身含候選人姓名或政黨名稱的品牌用語不代入提示詞', () => {
  const brandTerms = join(mkdtempSync(join(tmpdir(), 'rules-')), 'brand-terms.json');
  writeFileSync(brandTerms, JSON.stringify({
    version: 'leak-test',
    brand: [
      { term: '範例口號', candidate: 'sample-jia', note: '' },
      { term: '台中的市長範例甲', candidate: 'sample-jia', note: '' },
    ],
    frequent: [{ term: '範例乙黨加油', candidate: 'sample-yi', note: '' }],
  }));
  const rules = loadVerificationRules({ ...RULE_PATHS, brandTerms });

  const policy = {
    ...POLICY,
    summary: '範例甲黨主張在範例區增設三條公車路線。',
    quotes: [{ text: '我範例甲承諾，在範例區增設三條範例公車路線。', sourceId: 'sample-src-jia' }],
  };

  const request = buildLayer2Request(rules, policy, { hiddenNames: ['範例甲', '範例甲黨', '範例乙', '範例乙黨'] });

  assert.ok(request.prompt.includes('範例口號'));
  assert.ok(!request.prompt.includes('範例甲'));
  assert.ok(!request.prompt.includes('範例乙'));
  assert.ok(request.prompt.includes('○○主張在範例區增設三條公車路線。'));
  assert.ok(request.prompt.includes('我○○承諾，在範例區增設三條範例公車路線。'));
});

test('檢核表與提示詞的版本不一致時拒絕載入', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rules-'));
  const prompt = join(dir, 'layer2-prompt.md');
  writeFileSync(prompt, readFileSync(RULE_PATHS.prompt, 'utf8').replace('版本：1', '版本：2'));

  assert.throws(() => loadVerificationRules({ ...RULE_PATHS, prompt }), /版本/);
});

test('紀錄寫入：第一層通過、第二層通過時寫入兩層結果、理由、檢核表版本、模型與日期', () => {
  const verification = recordVerification({
    layer1: { status: 'pass' },
    layer2: { status: 'pass', reason: '摘要忠於原文', model: 'claude-opus-5-5' },
    checklistVersion: '1（品牌用語清單 fixture-1）',
    checkedAt: '2026-10-23',
  });

  assert.deepEqual(verification, {
    layer1: { status: 'pass', checkedAt: '2026-10-23' },
    layer2: {
      status: 'pass',
      reason: '摘要忠於原文',
      checklistVersion: '1（品牌用語清單 fixture-1）',
      model: 'claude-opus-5-5',
      checkedAt: '2026-10-23',
    },
  });
});

test('紀錄寫入：第一層不通過時第二層維持未核對', () => {
  const verification = recordVerification({
    layer1: { status: 'fail' },
    layer2: null,
    checklistVersion: '1',
    checkedAt: '2026-10-23',
  });

  assert.deepEqual(verification, {
    layer1: { status: 'fail', checkedAt: '2026-10-23' },
    layer2: { status: 'pending', reason: null, checklistVersion: null, model: null, checkedAt: null },
  });
});

test('紀錄寫入：格式錯誤的輸出寫成退回並保留原因', () => {
  const verification = recordVerification({
    layer1: { status: 'pass' },
    layer2: parseLayer2Output('oops'),
    checklistVersion: '1',
    model: 'claude-opus-5-5',
    checkedAt: '2026-10-23',
  });

  assert.equal(verification.layer2.status, 'fail');
  assert.match(verification.layer2.reason, /^第二層輸出格式錯誤：/);
  assert.equal(verification.layer2.model, 'claude-opus-5-5');
});
