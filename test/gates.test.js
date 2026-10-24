import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicDataset } from '../site/js/dataset.js';
import { REPO_DOCUMENTS, repoFileSitePath } from '../site/js/repo-documents.js';
import { makeRaw, pendingVerification, profileSnapshot } from './fixtures/make-raw.js';

const GATES_SCRIPT = fileURLToPath(new URL('../scripts/gates.js', import.meta.url));

// 建一個含公開資料集的網站目錄。tamper 可在寫檔前竄改資料集，模擬違規內容混入；
// files 是 { 相對路徑: 內容 }，另外寫入網站目錄的檔案。
function makeSite(tamper = () => {}, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gates-site-'));
  const raw = makeRaw();
  // 候選人廣場所在的裝飾格。
  raw.decorativeTiles = [{ id: 'tile-plaza', axial: [0, 1], localElementId: null }];
  const dataset = buildPublicDataset(raw, { builtAt: '2026-10-24T00:00:00.000Z' });
  tamper(dataset);
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'dataset.json'), JSON.stringify(dataset));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

// 建置時逐字複製到網站目錄的 repo 文件（引用 repo 文件）。必要的那幾份不在就不能上線。
const repoFile = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const REPO_FILES = Object.fromEntries(REPO_DOCUMENTS.filter((doc) => !doc.optional)
  .map((doc) => [repoFileSitePath(doc.path), repoFile(doc.path)]));

// 建置時複製到網站目錄的候選人資料出處快照。
const PROFILE_SNAPSHOTS = Object.fromEntries(['cand-a', 'cand-b', 'cand-c']
  .map((id) => [`data/snapshots/profile-src-${id}.txt`, profileSnapshot(id)]));

// 合規網站文案與配色，取自本站實際使用的寫法。
const COMPLIANT_FILES = {
  'index.html': '<!doctype html><title>台中政見島</title><p>由 AI 依公開資料整理，與任何候選人或政黨無關。</p>',
  'css/main.css': ':root { --laterite: #8e4b32; --rice: #f4efe6; --water: #7d9a98; }\nbody { color: rgb(47, 44, 41); background: var(--rice); }',
  'js/island.js': "const ground = new MeshStandardMaterial({ color: 0x8e4b32 });\nconst sea = '#7d9a98';",
  'js/island-motion.js': repoFile('site/js/island-motion.js'),
  'js/island-body.js': repoFile('site/js/island-body.js'),
  'js/island-plaza.js': repoFile('site/js/island-plaza.js'),
  'js/island-decor.js': repoFile('site/js/island-decor.js'),
  'js/island-heroes.js': repoFile('site/js/island-heroes.js'),
  'js/island-layout.js': repoFile('site/js/island-layout.js'),
  'js/ui-text.js': repoFile('site/js/ui-text.js'),
  ...REPO_FILES,
  ...PROFILE_SNAPSHOTS,
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

const candidateIn = (dataset, id) => dataset.candidates.find((c) => c.id === id);

test('候選人資料缺少欄位或沒有公開時，候選人資料關卡不通過並指出候選人與欄位', () => {
  const site = makeSite((dataset) => {
    candidateIn(dataset, 'cand-a').profile.experience = [];
    delete candidateIn(dataset, 'cand-b').profile.electionYear;
    candidateIn(dataset, 'cand-c').profile = null;
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人 cand-a 的候選人資料缺少經歷/);
  assert.match(output, /候選人 cand-b 的候選人資料缺少選舉年份/);
  assert.match(output, /候選人 cand-c 沒有公開的候選人資料/);
});

test('三位候選人的候選人資料欄位不同時不通過', () => {
  const site = makeSite((dataset) => {
    candidateIn(dataset, 'cand-b').profile.selfIntroduction = '自我介紹';
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /三位候選人的候選人資料欄位不同：cand-b 多了 selfIntroduction/);
});

test('候選人資料的出處不是中選會的選舉公報時不通過', () => {
  const site = makeSite((dataset) => {
    dataset.sources.find((s) => s.id === 'profile-src-cand-a').sourceType = 'official-website';
    dataset.sources.find((s) => s.id === 'profile-src-cand-b').url = 'https://news.example.org/cand-b.pdf';
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人 cand-a：候選人資料的出處 profile-src-cand-a 不是選舉公報（來源類型 official-website）/);
  assert.match(output, /候選人 cand-b：候選人資料的出處 profile-src-cand-b 不是中選會網站（news\.example\.org）/);
});

test('經歷或學歷不在出處快照中時不通過，出處快照不在網站目錄時也不通過', () => {
  const files = { ...COMPLIANT_FILES };
  delete files['data/snapshots/profile-src-cand-b.txt'];
  const site = makeSite((dataset) => {
    candidateIn(dataset, 'cand-a').profile.experience[1] = 'cand-a 測試里里長（連任三屆）';
  }, files);

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /候選人 cand-a：experience\[1\] 未逐字出現在出處 profile-src-cand-a 的快照中/);
  assert.match(output, /候選人 cand-b：出處 profile-src-cand-b 的出處快照 data\/snapshots\/profile-src-cand-b.txt 不在網站目錄/);
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

test('候選人資料的學歷與經歷照原文含品牌用語時不擋，比照原文引述；選舉別與出處快照說明照掃', () => {
  const verbatim = makeSite((dataset) => {
    dataset.candidates[0].profile.education = ['六星大學學士'];
    dataset.candidates[0].profile.experience = ['Taichung Way 推動委員'];
  });
  const written = makeSite((dataset) => {
    dataset.candidates[0].profile.electionName = '六星選舉';
  });

  const verbatimResult = runGates(verbatim);
  const writtenResult = runGates(written);

  assert.doesNotMatch(verbatimResult.output, /品牌用語「/);
  assert.match(writtenResult.output, /profile\.electionName：含品牌用語「六星」/);
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

test('CSS 與 3D 材質使用政黨色或候選人識別色時，禁用色檢查不通過並指出檔案與色碼', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'css/main.css': ':root { --accent: #1f4fbf; --soft: hotpink; }\n.x { color: rgb(120 60 200); border-color: hsl(30 90% 55%); }',
    'js/island.js': "new MeshStandardMaterial({ color: 0x2e8b3d });\nconst foam = '#FFF';",
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /css\/main\.css：色碼 #1f4fbf 落在政黨色「藍」/);
  assert.match(output, /css\/main\.css：色碼 hotpink 落在候選人識別色「粉紅」/);
  assert.match(output, /css\/main\.css：色碼 rgb\(120 60 200\) 落在候選人識別色「紫」/);
  assert.match(output, /css\/main\.css：色碼 hsl\(30 90% 55%\) 落在政黨色「橘」/);
  assert.match(output, /js\/island\.js：色碼 0x2e8b3d 落在政黨色「綠」/);
  assert.match(output, /js\/island\.js：色碼 #FFF 落在政黨色「白」/);
});

test('低飽和的灰青色、透明色與第三方程式碼中的色碼不擋', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'css/main.css': '.x { color: #7d9a98; background: transparent; box-shadow: 0 1px 2px rgb(0 0 255 / 0); }\n/* 註解裡的 #0000ff 不算 */',
    'vendor/three/build/three.module.js': 'const Color = 0x0000ff;',
  });

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});

test('選擇器、錨點、字元參照、url() 與 var() 裡像色碼或顏色名稱的字不算色碼', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'css/main.css': '#add { color: var(--blue-ish); }\na:hover, .navy-link { background: url(img/green.png); }',
    'index.html': '<a href="page.html#bad">&#123;</a><svg><rect fill="url(#fade)"/></svg><!-- #0000ff -->',
    'js/island.js': "class A { #add() {} }\n// 舊色 '#0000ff'",
  });

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});

test('SVG 與 HTML 的 fill、stroke、style 屬性與 <style> 內的色碼也會檢查', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'img/mark.svg': '<svg><rect fill="blue"/><circle stroke="#ff69b4"/></svg>',
    'index.html': '<style>p { color: purple }</style><p style="background: #2e8b3d">x</p>',
  });

  const { output } = runGates(site);

  assert.match(output, /img\/mark\.svg：色碼 blue 落在政黨色「藍」/);
  assert.match(output, /img\/mark\.svg：色碼 #ff69b4 落在候選人識別色「粉紅」/);
  assert.match(output, /index\.html：色碼 purple 落在候選人識別色「紫」/);
  assert.match(output, /index\.html：色碼 #2e8b3d 落在政黨色「綠」/);
});

test('數字代號不因小數點或頓號前後的數字而誤擋，英文用語不擋較長的單字', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].summary = '每公升 0.168 元，路線 168.5 公里，第 12、345 號';
  }, { ...COMPLIANT_FILES, 'index.html': '<p lang="en">Taichung Weather</p>' });

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});

test('程式碼註解裡的陣營高頻詞不擋，字串裡的文案照擋', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island.js': "// 鏡頭飛行先加速再減速\nconst label = '查詢更安心';",
  });

  const { output } = runGates(site);

  assert.doesNotMatch(output, /加速/);
  assert.match(output, /js\/island\.js：含陣營高頻詞「安心」/);
});

// 引用 repo 文件：規則文件與清單照原文公開，品牌用語掃描不掃，改由關卡驗證與 repo 檔案逐字相同。

test('引用 repo 文件照原文含品牌用語時，品牌用語掃描不擋', () => {
  const site = makeSite(() => {}, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.match(repoFile('docs/rules/brand-terms.md'), /臺中味/);
  assert.equal(code, 0, output);
});

test('引用 repo 文件與 repo 檔案不一致時不通過，夾帶的文字也照樣被品牌用語掃描擋下', () => {
  const path = repoFileSitePath('docs/rules/classification-rules.md');
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, [path]: `${REPO_FILES[path]}\n本站推薦六星市政。\n` });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /data\/repo-files\/docs\/rules\/classification-rules\.md：與 repo 檔案 docs\/rules\/classification-rules\.md 不一致/);
  assert.match(output, /data\/repo-files\/docs\/rules\/classification-rules\.md：含品牌用語「六星」/);
});

test('引用 repo 文件目錄裡出現清單以外的檔案時不通過', () => {
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'data/repo-files/docs/notes.md': '整理者的話' });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /data\/repo-files\/docs\/notes\.md：不在引用 repo 文件清單中/);
});

test('缺少必要的引用 repo 文件時不通過，選用的核對報告缺少不擋', () => {
  const missing = repoFileSitePath('data/verification/checklist.json');
  const { [missing]: _, ...files } = COMPLIANT_FILES;

  const { code, output } = runGates(makeSite(() => {}, files));

  assert.notEqual(code, 0);
  assert.match(output, /缺少引用 repo 文件 data\/verification\/checklist\.json/);
  assert.doesNotMatch(output, /report/);
});

test('頁面上引用 repo 文件的容器標註清單以外的檔案時不通過，容器內寫在頁面的文字照常掃描', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'method.html': '<section data-repo-file="docs/research/candidates-2026.md"><p>研究筆記</p></section>'
      + '<section data-repo-file="docs/rules/brand-terms.md"><p>六星</p></section>',
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /method\.html：引用 repo 文件的容器標註 docs\/research\/candidates-2026\.md，不在引用 repo 文件清單中/);
  assert.match(output, /method\.html：含品牌用語「六星」/);
});

// 受眾文案：整理者撰寫、給市民看的文字不得外漏內部實作細節。

test('頁面文案含檔案路徑、副檔名或工具名時，受眾文案關卡不通過並指出檔案與類別', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'method.html': '<p>核對報告放在 <code>data/verification/report.md</code>。</p><p>公報以 pdftotext 轉成文字。</p>',
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /method\.html：含檔案路徑「data\/verification\/report\.md」/);
  assert.match(output, /method\.html：含工具名「pdftotext」/);
});

test('畫面文案模組含模型代號、字型名或程式欄位名時，受眾文案關卡不通過', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/ui-text.js': "export const A = '第二層（claude-opus-5-5）';\nexport const B = `字型 NotoSerifCJKtc-Light 還原，見 archiveUrl ${x}`;",
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /js\/ui-text\.js：含模型代號「claude-opus-5-5」/);
  assert.match(output, /js\/ui-text\.js：含字型名「NotoSerifCJKtc-Light」/);
  assert.match(output, /js\/ui-text\.js：含程式欄位名「archiveUrl」/);
});

test('畫面文案模組的行尾註解含引號時，下一行的字串照樣被掃到；註解本身不掃', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/ui-text.js': "export const A = '關閉'; // it's ok, see data/x.json\nexport const B = '見 data/verification/report.md';\n/* 'pdftotext' */",
  });

  const { output } = runGates(site);

  assert.match(output, /js\/ui-text\.js：含檔案路徑「data\/verification\/report\.md」/);
  assert.doesNotMatch(output, /data\/x\.json|pdftotext/);
});

test('按鈕的 value 與社群分享用的 meta 說明也算畫面文字', () => {
  const html = '<meta property="og:description" content="見 snapshotPath"><input type="submit" value="送出 archiveUrl">';
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'index.html': html });

  const { output } = runGates(site);

  assert.match(output, /index\.html：含程式欄位名「snapshotPath」/);
  assert.match(output, /index\.html：含程式欄位名「archiveUrl」/);
});

test('一般用語不誤擋：TCP/IP、12 位數字、Node 與版本號以外的英文', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].summary = '推動 TCP/IP 教育，設置 Node 創客中心，補助 202610230001 號計畫';
  }, COMPLIANT_FILES);

  const { output } = runGates(site);

  assert.match(output, /✓ 受眾文案不外漏內部細節/, output);
});

test('網站上的排序規則說明與來源類型名稱含內部細節時，受眾文案關卡不通過', () => {
  const dataset = repoFile('site/js/dataset.js').replace("'official-website': '官網'", "'official-website': '官網（sourceType）'");
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'js/dataset.js': dataset });

  const { output } = runGates(site);

  assert.match(output, /js\/dataset\.js：含程式欄位名「sourceType」/);
});

test('網站目錄缺少畫面文案模組時，受眾文案關卡不通過', () => {
  const files = { ...COMPLIANT_FILES };
  delete files['js/ui-text.js'];

  const { code, output } = runGates(makeSite(() => {}, files));

  assert.notEqual(code, 0);
  assert.match(output, /找不到畫面文案模組 js\/ui-text\.js/);
});

test('aria-label、title、placeholder 與 meta description 也算畫面文字；註解、程式與連結網址不算', () => {
  const html = '<!doctype html><meta name="description" content="資料在 data/dataset.json">'
    + '<button aria-label="切換 snapshotNote">鈕</button>'
    + '<!-- 註解提到 pdftotext 不擋 --><script>const s = "wrangler";</script>'
    + '<a href="./data/repo-files/docs/x.md">在 GitHub 查看</a>';
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'index.html': html });

  const { output } = runGates(site);

  assert.match(output, /index\.html：含檔案路徑「data\/dataset\.json」/);
  assert.match(output, /index\.html：含程式欄位名「snapshotNote」/);
  assert.doesNotMatch(output, /pdftotext|wrangler|docs\/x\.md/);
});

test('整理者撰寫的資料欄位含程式欄位名時不通過；iBike 這類服務名稱不擋', () => {
  const site = makeSite((dataset) => {
    dataset.issueAreas[0].description = '依 issueAreaId 分類';
    dataset.policies[0].summary = '增設 iBike 租賃站';
  }, COMPLIANT_FILES);

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /issueAreas\[area-a\]\.description：含程式欄位名「issueAreaId」/);
  assert.doesNotMatch(output, /iBike/);
});

test('原文引述、候選人資料原文、出處標題與逐字公開的 repo 文件含內部細節時，受眾文案關卡不擋', () => {
  const site = makeSite((dataset) => {
    dataset.policies[0].quotes[0].text = '詳見 www.example.tw/policy/index.html';
    dataset.candidates[0].profile.experience = ['node 協會理事長'];
    dataset.sources[0].title = 'policy_2026.pdf';
    dataset.sources[0].snapshotNote = 'PDF 第 1 頁以 pdftotext 轉成文字';
  }, COMPLIANT_FILES);

  const { output } = runGates(site);

  // 合規網站目錄已含逐字公開的 repo 文件（內有路徑、指令與欄位名），一併驗證不擋。
  // 改過的經歷不在出處快照中，候選人資料關卡會擋，這裡只看受眾文案關卡。
  assert.match(output, /✓ 受眾文案不外漏內部細節/, output);
});

// 人物配置的替身：包住正式的 plazaLayout，再由 change 竄改結果，模擬違規的配置。
const plazaModule = (change) => `${repoFile('site/js/island-plaza.js').replace('export function plazaLayout(', 'function realPlazaLayout(')}
export function plazaLayout(layout) {
  const plaza = realPlazaLayout(layout);
  (${change})(plaza);
  return plaza;
}
`;

const FIGURE_CHANGES = [
  ['尺寸', (plaza) => { plaza.figures[1].scale = 1.1; }],
  ['幾何', (plaza) => { plaza.figures[1].parts[5].radius += 0.01; }],
  ['材質', (plaza) => { plaza.figures[1].color = 'markerLit'; }],
  ['動畫參數', (plaza) => { plaza.figures[1].idle.sway *= 2; }],
  ['動畫相位', (plaza) => { plaza.figures[1].idle.phase = 0.5; }],
  ['底座', (plaza) => { plaza.figures[1].pad.size *= 1.2; }],
  ['點選範圍', (plaza) => { plaza.figures[1].hitRadius = 0.3; }],
  ['行走時長', (plaza) => { plaza.figures[1].walk.durationSeconds = 1.2; }],
  ['步伐', (plaza) => { plaza.figures[1].walk.legSwing *= 1.5; }],
];
for (const [what, change] of FIGURE_CHANGES) {
  test(`某位候選人人物的${what}與其他人不同時，人物一致關卡不通過並指出候選人`, () => {
    const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'js/island-plaza.js': plazaModule(change) });

    const { code, output } = runGates(site);

    assert.notEqual(code, 0);
    assert.match(output, /✗ 人物一致：/);
    assert.match(output, /cand-b/);
  });
}

test('網站上的人物配置模組改寫「外觀相同」的定義時，人物一致關卡照樣擋下不同的人物', () => {
  const tampered = plazaModule((plaza) => { plaza.figures[1].scale = 1.1; })
    .replace('export function figureLook(', 'export function figureLook() { return {}; }\nfunction originalFigureLook(');
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'js/island-plaza.js': tampered });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /cand-b/);
});

test('人物順序不依排序規則或沒有等距並排時，人物一致關卡不通過', () => {
  const swapped = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-plaza.js': plazaModule((plaza) => {
      const [a, b] = plaza.figures;
      [a.position, b.position] = [b.position, a.position];
      plaza.figures.splice(0, 2, b, a);
    }),
  });
  const uneven = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-plaza.js': plazaModule((plaza) => { plaza.figures[2].position.x += 0.2; }),
  });

  const first = runGates(swapped);
  const second = runGates(uneven);

  assert.notEqual(first.code, 0);
  assert.match(first.output, /人物順序應為 cand-a、cand-b、cand-c/);
  assert.notEqual(second.code, 0);
  assert.match(second.output, /等距/);
});

// 走到同一格的替身：把網站模組裡的 export function name( 包一層，由 wrap 竄改原本的結果。
const walkModule = (name, wrap) => `${repoFile('site/js/island-plaza.js').replace(`export function ${name}(`, `function real_${name}(`)}
export function ${name}(...args) {
  return (${wrap})(real_${name}(...args), ...args);
}
`;

test('走到同一格合規時，人物一致關卡通過', () => {
  const { output } = runGates(makeSite(() => {}, COMPLIANT_FILES));

  assert.match(output, /✓ 人物一致：/, output);
});

const WALK_CHANGES = [
  ['目的地與標記的相對位置不同', 'figureDestinations', (destinations) => {
    if (destinations[1]) destinations[1].position.z += 0.3;
    return destinations;
  }],
  ['只有有政見的人有目的地', 'figureDestinations', (destinations) => destinations.filter((d) => d.candidateId !== 'cand-b')],
  // 夾具的廣場在 [0, 1]，格心 x 約 1.2225，cand-b 站在中間，從廣場出發的那一趟被竄改。
  ['抵達時間不同（有人先到）', 'walkPlan', (plan, from) => (Math.abs(from.x - 1.2225) < 0.01 ? { ...plan, arriveSeconds: plan.arriveSeconds * 0.8 } : plan)],
  ['出發時間不同', 'walkPlan', (plan, from) => (Math.abs(from.x - 1.2225) < 0.01 ? { ...plan, departSeconds: 0.2 } : plan)],
  ['路徑不同（繞路）', 'walkPose', (pose, plan) => (Math.abs(plan.from.x - 1.2225) < 0.01 && !pose.arrived ? { ...pose, z: pose.z + 0.3 } : pose)],
];
for (const [what, name, wrap] of WALK_CHANGES) {
  test(`走到同一格${what}時，人物一致關卡不通過並指出候選人`, () => {
    const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'js/island-plaza.js': walkModule(name, wrap) });

    const { code, output } = runGates(site);

    assert.notEqual(code, 0, output);
    assert.match(output, /✗ 人物一致：/);
    assert.match(output, /cand-b/);
  });
}

test('目的地依政見資料而變時，人物一致關卡不通過', () => {
  // 有政見的格子目的地往南移：換一份政見資料後目的地不同。
  const tampered = walkModule('figureDestinations', (destinations, layout, areaId) => {
    const tile = layout.tiles.find((t) => t.id === areaId);
    return destinations.map((d, i) => (tile.markers[i].lit ? { ...d, position: { ...d.position, z: d.position.z + 0.01 } } : d));
  });
  const site = makeSite(() => {}, { ...COMPLIANT_FILES, 'js/island-plaza.js': tampered });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0, output);
  assert.match(output, /政見/);
});

test('沒有候選人廣場或網站目錄缺少人物配置模組時，人物一致關卡不通過', () => {
  const { 'js/island-plaza.js': _, ...files } = COMPLIANT_FILES;
  const noPlaza = makeSite((dataset) => { dataset.decorativeTiles = []; }, COMPLIANT_FILES);

  const missing = runGates(makeSite(() => {}, files));
  const empty = runGates(noPlaza);

  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /js\/island-plaza\.js/);
  assert.notEqual(empty.code, 0);
  assert.match(empty.output, /候選人廣場/);
});

// 動態配置的替身：包住正式的 motionPlan，再由 change 竄改結果，模擬違規的配置。
const motionModule = (change) => `${repoFile('site/js/island-motion.js').replace('export function motionPlan(', 'function realMotionPlan(')}
export function motionPlan(layout, options) {
  const plan = realMotionPlan(layout, options);
  (${change})(plan, layout);
  return plan;
}
`;

test('某個議題區格子的市民比其他格多時，動態數量固定關卡不通過並指出格子', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-motion.js': motionModule((plan) => {
      plan.tiles[1].citizens.push({ ...plan.tiles[1].citizens[0], phase: 0.9 });
    }),
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /✗ 動態數量固定：/);
  assert.match(output, /area-b/);
});

test('動態配置隨政見資料改變時，動態數量固定關卡不通過', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-motion.js': motionModule((plan, layout) => {
      // 依標記亮暗調整車速：有亮起的標記越多車越快。
      const lit = layout.tiles.flatMap((t) => t.markers).filter((m) => m.lit).length;
      for (const v of plan.vehicles) v.speed += lit;
    }),
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /換一份政見資料/);
});

test('網站目錄缺少動態配置模組時，動態數量固定關卡不通過', () => {
  const { 'js/island-motion.js': _, ...files } = COMPLIANT_FILES;

  const { code, output } = runGates(makeSite(() => {}, files));

  assert.notEqual(code, 0);
  assert.match(output, /js\/island-motion\.js/);
});

// 裝飾配置的替身：包住正式的 decorPlan，再由 change 竄改結果，模擬違規的配置。
const decorModule = (change) => `${repoFile('site/js/island-decor.js').replace('export function decorPlan(', 'function realDecorPlan(')}
export function decorPlan(layout) {
  const plan = realDecorPlan(layout);
  (${change})(plan, layout);
  return plan;
}
`;

test('某個議題區格子比其他格多一件裝飾時，裝飾數量固定關卡不通過並指出格子', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-decor.js': decorModule((plan) => {
      const tile = plan.tiles.find((t) => t.id === 'area-b');
      tile.items.push({ ...tile.items.find((i) => i.kind === 'bench'), x: 0.1 });
    }),
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /✗ 裝飾數量固定：/);
  assert.match(output, /area-b/);
});

test('某格的主題場景放大倍率不同、或不是依議題區識別碼選的場景時，裝飾數量固定關卡不通過', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-decor.js': decorModule((plan) => {
      const [first, second] = plan.tiles.filter((t) => t.kind === 'area');
      first.hero.transform.scale *= 1.3;
      second.hero.sceneId = 'education';
    }),
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /area-a/);
  assert.match(output, /area-b.*education/);
});

test('裝飾配置隨政見資料改變時，裝飾數量固定關卡不通過', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/island-decor.js': decorModule((plan, layout) => {
      // 有政見的格子多種一棵樹：每格都多，數量仍相同，但隨政見改變。
      const lit = layout.tiles.flatMap((t) => t.markers).filter((m) => m.lit).length;
      for (const tile of plan.tiles) for (let i = 0; i < lit; i++) tile.items.push({ ...tile.items[0], kind: 'tree' });
    }),
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /換一份政見資料/);
});

test('網站目錄缺少裝飾配置模組時，裝飾數量固定關卡不通過', () => {
  const { 'js/island-decor.js': _, ...files } = COMPLIANT_FILES;

  const { code, output } = runGates(makeSite(() => {}, files));

  assert.notEqual(code, 0);
  assert.match(output, /js\/island-decor\.js/);
});

test('網站目錄放了音檔或程式引用音檔時，不載入音檔關卡不通過並指出檔案', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'audio/loop.mp3': 'ID3',
    'js/music.js': "const track = new Audio('./audio/theme.ogg');",
  });

  const { code, output } = runGates(site);

  assert.notEqual(code, 0);
  assert.match(output, /audio\/loop\.mp3/);
  assert.match(output, /js\/music\.js/);
});

test('即時合成的背景音樂程式、叫做 midi 的欄位與文案提到「音檔」兩字不擋', () => {
  const site = makeSite(() => {}, {
    ...COMPLIANT_FILES,
    'js/bgm-synth.js': "const osc = context.createOscillator(); // 不使用音檔\nconst noise = context.createBuffer(1, 4410, 44100);\nif (slot.midi !== null) play(slot.midi);",
  });

  const { code, output } = runGates(site);

  assert.equal(code, 0, output);
});
