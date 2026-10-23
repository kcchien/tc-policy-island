import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicDataset } from '../site/js/dataset.js';
import { makeRaw, pendingVerification } from './fixtures/make-raw.js';

const GATES_SCRIPT = fileURLToPath(new URL('../scripts/gates.js', import.meta.url));

// 建一個只含公開資料集的網站目錄。tamper 可在寫檔前竄改資料集，模擬違規內容混入。
function makeSite(tamper = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gates-site-'));
  const dataset = buildPublicDataset(makeRaw(), { builtAt: '2026-10-24T00:00:00.000Z' });
  tamper(dataset);
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'dataset.json'), JSON.stringify(dataset));
  return dir;
}

function runGates(siteDir) {
  const result = spawnSync(process.execPath, [GATES_SCRIPT, siteDir], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr };
}

test('合規的網站目錄通過全部關卡，結束碼為 0', () => {
  const { code, output } = runGates(makeSite());

  assert.equal(code, 0, output);
});

test('公開資料混入未核對政見時，關卡以非零結束碼退出並指出政見', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].verification = pendingVerification();
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /p-a1/);
});

test('政見缺少核對紀錄時，關卡以中文說明不通過原因', () => {
  const site = makeSite((dataset) => {
    delete dataset.policies[0].verification;
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /政見 p-a1 缺少核對紀錄/);
  assert.doesNotMatch(output, /Cannot/);
});

test('網站目錄沒有公開資料集時，關卡不通過並提示先建置', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-empty-'));

  const { code, output } = runGates(dir);

  assert.notEqual(code, 0);
  assert.match(output, /讀不到公開資料集/);
});

test('公開資料少了一位候選人時，關卡不通過', () => {
  const site = makeSite((dataset) => {
    dataset.candidates.pop();
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人應有 3 位，實際 2 位/);
});

test('候選人缺少欄位時，關卡不通過並指出候選人與欄位', () => {
  const site = makeSite((dataset) => {
    delete dataset.candidates[1].party;
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人 cand-b：缺少欄位 party/);
});

test('候選人順序不符排序規則時，關卡不通過', () => {
  const site = makeSite((dataset) => {
    dataset.candidates.reverse();
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人順序應為 cand-a、cand-b、cand-c（依姓名筆畫），實際為 cand-c、cand-b、cand-a/);
});
