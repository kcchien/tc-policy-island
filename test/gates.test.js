import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicDataset } from '../site/js/dataset.js';
import { makeRaw, pendingVerification } from './fixtures/make-raw.js';

const GATES_SCRIPT = fileURLToPath(new URL('../scripts/gates.js', import.meta.url));

// 建一個含公開資料集的網站目錄。tamper 可在寫檔前竄改資料集，模擬違規內容混入；
// files 是 { 相對路徑: 內容 }，另外寫入網站目錄的檔案。
function makeSite(tamper = () => {}, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gates-site-'));
  const dataset = buildPublicDataset(makeRaw(), { builtAt: '2026-10-24T00:00:00.000Z' });
  tamper(dataset);
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'dataset.json'), JSON.stringify(dataset));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

// 合規網站文案與配色，取自本站實際使用的寫法。
const COMPLIANT_FILES = {
  'index.html': '<!doctype html><title>台中政見島</title><p>由 AI 依公開資料整理，與任何候選人或政黨無關。</p>',
  'css/main.css': ':root { --laterite: #8e4b32; --rice: #f4efe6; --water: #7d9a98; }\nbody { color: rgb(47, 44, 41); background: var(--rice); }',
  'js/island.js': "const ground = new MeshStandardMaterial({ color: 0x8e4b32 });\nconst sea = '#7d9a98';",
};

function runGates(siteDir) {
  const result = spawnSync(process.execPath, [GATES_SCRIPT, siteDir], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr };
}

test('合規的網站目錄通過全部關卡，結束碼為 0', () => {
  const { code, output } = runGates(makeSite(() => {}, COMPLIANT_FILES));

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

// 品牌用語掃描與禁用色檢查讀正式清單 data/rules/。以下用清單中確定收錄的詞與色相測試。

test('摘要含品牌用語時，品牌用語掃描不通過並指出政見與詞', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].summary = '推動六星市政，擴大兒童福利';
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /policies\[p-a1\]\.summary：含品牌用語「六星」/);
});

test('原文引述、出處標題與網址含品牌用語時不擋，摘要用陣營高頻詞也不擋', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].quotes[0].text = '六星市政168，市長換欣、台中創新';
    dataset.sources[0].title = '臺中味 Taichung Way｜臺中未來';
    dataset.sources[0].url = 'https://taichungway.tw/future';
    dataset.policies[0].summary = '擴大敬老卡適用範圍';
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});

test('網站文案含陣營高頻詞時不通過', () => {
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'index.html': '<p>打造更幸福的查詢體驗</p>' });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /index\.html：含陣營高頻詞「幸福」/);
});

test('品牌用語不分台臺、全半形、大小寫與空白都會被擋下', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'index.html': '<p>台中味導覽</p>',
    'js/copy.js': "export const tagline = 'TAICHUNG  way';",
    'css/main.css': '/* １６８ */',
  });

  const { output } = runGates(site);

  assert.match(output, /index\.html：含品牌用語「臺中味」/);
  assert.match(output, /js\/copy\.js：含品牌用語「Taichung Way」/);
  assert.match(output, /css\/main\.css：含品牌用語「168」/);
});

test('數字代號只擋獨立出現的數字，金額與距離中的數字不擋', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].summary = '每月補助 1,680 元，路線長 16.8 公里，第 2168 號計畫';
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});

test('議題區名稱、元素名稱與檔名含品牌用語時不通過', () => {
  const site = makeSite((dataset) => {
    dataset.issueAreas[0].name = '星光計畫區';
    dataset.localElements = [{ id: 'el-a', name: '親子味小吃', category: '小吃', place: '中區', reason: '測試' }];
  }, { ...COMPLIANT_FILES, 'taichung-way.html': '<p>測試</p>' });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /issueAreas\[area-a\]\.name：含品牌用語「星光計畫」/);
  assert.match(output, /localElements\[el-a\]\.name：含品牌用語「親子味」/);
  assert.match(output, /檔名 taichung-way\.html：含品牌用語「Taichung Way」/);
});
