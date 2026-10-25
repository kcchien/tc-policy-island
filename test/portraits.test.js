import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { portraitProblems, attachPortraits } from '../scripts/lib/portraits.js';
import { sha256 } from '../scripts/lib/speech.js';
import { makeRaw } from './fixtures/make-raw.js';

// 中性像素夾具，非真實候選人。PNG 的 IHDR 定義 240×320，完整解碼另由瀏覽器驗證。
const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000f0000001400802000000', 'hex');
function fixture() {
  const dataset = buildPublicDataset(makeRaw());
  const manifest = { items: dataset.candidates.map((c) => ({
    candidateId: c.id, candidateName: c.name, sourceId: c.profile.sourceId,
    sourceKind: 'cec-bulletin', sourceLabel: '中選會 2024 年選舉公報',
    originalFile: `${c.id}-original.png`, originalSha256: sha256(bytes),
    position: `${c.name}姓名欄下方`, photographer: null,
    sourceUrl: dataset.sources.find((s) => s.id === c.profile.sourceId).url,
    electionYear: 2024, retrievedAt: '2026-10-24', page: 1, imageObject: '10 0',
    pdfSha256: 'a'.repeat(64), extractedSha256: sha256(bytes),
    extraction: '抽取原始黑白影像，等比例縮放並補留白', identityCheckedAt: '2026-10-24',
    rights: { status: 'cleared', declarationUrl: 'https://web.cec.gov.tw/central/article/21322',
      licenseUrl: 'https://data.gov.tw/license', checkedAt: '2026-10-24', specialExclusion: false,
      evidence: '已核對公報無特別排除', limitations: '僅中立辨識，不暗示官方認可' },
    file: `${c.id}.png`, fileSha256: sha256(bytes), width: 240, height: 320,
  })) };
  return { dataset, manifest, readImage: () => bytes };
}

function mixedFixture() {
  const f = fixture();
  for (const [i, item] of f.manifest.items.entries()) {
    if (i === 2) continue;
    delete item.sourceId;
    Object.assign(item, { sourceKind: 'ly-legislator', sourceLabel: '立法院第11屆委員（委員研究室提供）',
      sourceUrl: `https://www.ly.gov.tw/Pages/List.aspx?nodeid=${46764 + i}`,
      imageUrl: `https://www.ly.gov.tw/Images/Legislators/${110009 + i}.jpg`,
      imageAlt: `${item.candidateName}委員照片`, legislature: 11, sourceCredit: '委員研究室提供',
      originalFile: `${item.candidateId}-original.jpg`,
      rights: { ...item.rights, declarationUrl: 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=10772', licenseUrl: null } });
  }
  return f;
}

// 指定照片例外須核對真實姓名；不建立掛真實姓名的示範政見。
function permittedFixture() {
  const f = mixedFixture();
  const candidate = f.dataset.candidates[2];
  candidate.id = 'hung-li-hua'; candidate.name = '洪麗華';
  f.manifest.items[2] = {
    ...f.manifest.items[2], candidateId: candidate.id, candidateName: candidate.name,
    sourceKind: 'ltn-permitted-portrait', sourceId: undefined,
    sourceUrl: 'https://news.ltn.com.tw/news/politics/breakingnews/5599336',
    imageUrl: 'https://img.ltn.com.tw/Upload/news/600/2026/10/08/5599336_3_1.jpg',
    caption: '洪麗華競選形象照。（記者張軒哲翻攝）', sourceCredit: '記者張軒哲翻攝',
    sourceLabel: '自由時報（記者張軒哲翻攝）',
    file: 'hung-li-hua.png', originalFile: 'hung-li-hua-original.jpg',
    originalWidth: 415, originalHeight: 512,
    rights: { status: 'cleared', checkedAt: '2026-10-25',
      evidence: '維護者於2026-10-25確認已取得使用許可',
      limitations: '僅此指定照片作中立辨識，不推論其他素材授權' },
  };
  return f;
}

test('指定照片僅憑維護者明確確認使用許可放行，照片來源與學經歷分開', () => {
  const f = permittedFixture();
  assert.deepEqual(portraitProblems(f.dataset, f.manifest, f.readImage), []);
  attachPortraits(f.dataset, f.manifest);
  assert.equal(f.dataset.candidates[2].portrait.sourceUrl, 'https://news.ltn.com.tw/news/politics/breakingnews/5599336');
  assert.notEqual(f.dataset.candidates[2].profile.sourceId, undefined);
});

for (const [name, change] of [
  ['未確認許可', i => i.rights.status = 'pending'],
  ['沒有確認紀錄', i => i.rights.evidence = '公開上網'],
  ['冒用開放授權', i => i.rights.licenseUrl = 'https://data.gov.tw/license'],
  ['其他新聞頁', i => i.sourceUrl = 'https://news.ltn.com.tw/news/politics/breakingnews/5599337'],
  ['活動照片', i => i.imageUrl = 'https://img.ltn.com.tw/Upload/news/600/2026/10/08/5599336_1_1.jpg'],
  ['姓名不符', i => i.candidateName = '候選人乙'],
  ['漏翻攝署名', i => i.caption = '洪麗華競選形象照。'],
  ['翻攝者冒充原攝影者', i => i.photographer = '張軒哲'],
  ['原圖尺寸不符', i => i.originalWidth = 600],
  ['原圖雜湊不符', i => i.originalSha256 = 'a'.repeat(64)],
  ['成品雜湊不符', i => i.fileSha256 = 'a'.repeat(64)],
]) test(`指定照片遇${name}拒絕整組`, () => {
  const f = permittedFixture(); change(f.manifest.items[2]);
  assert.ok(portraitProblems(f.dataset, f.manifest, f.readImage).length > 0);
});

test('可用官方肖像個別更新，立法院與公報混用，照片出處獨立於學經歷', () => {
  const f = mixedFixture();
  assert.deepEqual(portraitProblems(f.dataset, f.manifest, f.readImage), []);
  attachPortraits(f.dataset, f.manifest);
  assert.deepEqual(f.dataset.candidates[0].portrait, {
    url: 'data/portraits/cand-a.png', sourceKind: 'ly-legislator',
    sourceUrl: 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=46764',
    sourceLabel: '立法院第11屆委員（委員研究室提供）', retrievedAt: '2026-10-24',
  });
});

for (const [name, change] of [
  ['偽官方頁面網域', f => f.manifest.items[0].sourceUrl = 'https://www.ly.gov.tw.example.org/Pages/List.aspx?nodeid=46764'],
  ['非委員頁面', f => f.manifest.items[0].sourceUrl = 'https://www.ly.gov.tw/news'],
  ['外站原圖', f => f.manifest.items[0].imageUrl = 'https://example.org/110009.jpg'],
  ['照片姓名不符', f => f.manifest.items[0].imageAlt = '候選人乙委員照片'],
  ['漏研究室署名', f => f.manifest.items[0].sourceCredit = null],
  ['誤用中選會宣告', f => f.manifest.items[0].rights.declarationUrl = 'https://web.cec.gov.tw/central/article/21322'],
  ['誤標政府開放授權', f => f.manifest.items[0].rights.licenseUrl = 'https://data.gov.tw/license'],
  ['偷指學經歷公報', f => f.manifest.items[0].sourceId = f.dataset.candidates[0].profile.sourceId],
  ['原圖雜湊不符', f => f.manifest.items[0].originalSha256 = 'a'.repeat(64)],
  ['原圖缺檔', f => f.readImage = file => file.endsWith('.jpg') ? null : bytes],
  ['原圖路徑逃逸', f => f.manifest.items[0].originalFile = '../original.jpg'],
  ['不存在日期', f => f.manifest.items[0].retrievedAt = '2026-02-30'],
  ['未知來源', f => f.manifest.items[0].sourceKind = 'news-photo'],
]) test(`官方混合肖像遇${name}仍拒絕整組`, () => {
  const f = mixedFixture(); change(f);
  assert.ok(portraitProblems(f.dataset, f.manifest, f.readImage).length > 0);
});

test('三張肖像、姓名與同批公報出處核對及授權齊全，才全部加入公開候選人', () => {
  const { dataset, manifest, readImage } = fixture();
  assert.deepEqual(portraitProblems(dataset, manifest, readImage), []);
  attachPortraits(dataset, manifest);
  assert.deepEqual(dataset.candidates.map((c) => c.portrait.url), ['data/portraits/cand-a.png', 'data/portraits/cand-b.png', 'data/portraits/cand-c.png']);
});

for (const [name, change] of [
  ['缺一張紀錄', (f) => f.manifest.items.pop()],
  ['同一人重複冒充另一人', (f) => f.manifest.items[1] = structuredClone(f.manifest.items[0])],
  ['候選人姓名不符', (f) => f.manifest.items[0].candidateName = '候選人乙'],
  ['出處屬於別人', (f) => f.manifest.items[0].sourceId = f.manifest.items[1].sourceId],
  ['來源網址不符', (f) => f.manifest.items[0].sourceUrl = 'https://example.org/other'],
  ['來源不是中選會', (f) => { f.dataset.sources.find((s) => s.id === f.manifest.items[0].sourceId).url = f.manifest.items[0].sourceUrl = 'https://cec.gov.tw.example.org/a'; }],
  ['有特別排除', (f) => f.manifest.items[0].rights.specialExclusion = true],
  ['授權未確認', (f) => f.manifest.items[0].rights.status = 'pending'],
  ['不同公報年份', (f) => f.manifest.items[0].electionYear = 2020],
  ['未核對影像位置', (f) => f.manifest.items[0].identityCheckedAt = null],
  ['缺檔', (f) => f.readImage = () => null],
  ['影像損壞', (f) => f.readImage = () => Buffer.from('broken')],
  ['影像雜湊不符', (f) => f.manifest.items[0].fileSha256 = 'c'.repeat(64)],
  ['不同尺寸', (f) => f.manifest.items[0].width = 200],
  ['檔名逃出肖像目錄', (f) => f.manifest.items[0].file = '../else.png'],
]) test(`${name}時不接受肖像批次`, () => {
  const f = fixture(); change(f);
  assert.ok(portraitProblems(f.dataset, f.manifest, f.readImage).length > 0);
});
