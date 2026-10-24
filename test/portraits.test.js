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
    sourceUrl: dataset.sources.find((s) => s.id === c.profile.sourceId).url,
    electionYear: 2024, retrievedAt: '2026-10-24', page: 1, imageObject: '10 0',
    pdfSha256: 'a'.repeat(64), extractedSha256: 'b'.repeat(64),
    extraction: '抽取原始黑白影像，等比例縮放並補留白', identityCheckedAt: '2026-10-24',
    rights: { status: 'cleared', declarationUrl: 'https://web.cec.gov.tw/central/article/21322',
      licenseUrl: 'https://data.gov.tw/license', checkedAt: '2026-10-24', specialExclusion: false },
    file: `${c.id}.png`, fileSha256: sha256(bytes), width: 240, height: 320,
  })) };
  return { dataset, manifest, readImage: () => bytes };
}

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
