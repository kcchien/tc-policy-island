import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset, DatasetValidationError } from '../site/js/dataset.js';
import { makeRaw, policy, localElement, passedVerification, pendingVerification } from './fixtures/make-raw.js';

test('未通過兩層核對的政見不會出現在公開資料集', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-pending', 'cand-a', pendingVerification()));
  const layer2Rejected = passedVerification();
  layer2Rejected.layer2.status = 'fail';
  raw.policies.push(policy('p-rejected', 'cand-b', layer2Rejected));
  const layer1Failed = passedVerification();
  layer1Failed.layer1.status = 'fail';
  raw.policies.push(policy('p-mismatch', 'cand-c', layer1Failed));

  const dataset = buildPublicDataset(raw);

  assert.deepEqual(
    dataset.policies.map((p) => p.id),
    ['p-a1', 'p-b1'],
  );
});

test('抽籤前候選人依姓名筆畫由少到多排列，並標示排序規則為筆畫', () => {
  const dataset = buildPublicDataset(makeRaw());

  assert.deepEqual(
    dataset.candidates.map((c) => c.id),
    ['cand-a', 'cand-b', 'cand-c'],
  );
  assert.equal(dataset.meta.candidateOrder, 'name-strokes');
});

test('抽籤後候選人依號次排列，即使與筆畫順序不同', () => {
  const raw = makeRaw();
  const ballot = { 'cand-a': 3, 'cand-b': 1, 'cand-c': 2 };
  for (const c of raw.candidates) c.ballotNumber = ballot[c.id];

  const dataset = buildPublicDataset(raw);

  assert.deepEqual(
    dataset.candidates.map((c) => c.id),
    ['cand-b', 'cand-c', 'cand-a'],
  );
  assert.equal(dataset.meta.candidateOrder, 'ballot-number');
});

// 驗證失敗時丟出 DatasetValidationError，errors 列出每一處問題，訊息要指出哪一筆、哪個欄位。
function validationErrors(raw) {
  try {
    buildPublicDataset(raw);
  } catch (error) {
    assert.ok(error instanceof DatasetValidationError, `預期 DatasetValidationError，實際為 ${error}`);
    return error.errors;
  }
  assert.fail('預期驗證失敗，但建置成功');
}

test('政見缺少必要欄位時，錯誤訊息指出政見識別碼與欄位名稱', () => {
  const raw = makeRaw();
  delete raw.policies[0].summary;

  assert.deepEqual(validationErrors(raw), ['政見 p-a1：缺少欄位 summary']);
});

test('欄位型別錯誤時，錯誤訊息說明應有的型別與實際值', () => {
  const raw = makeRaw();
  raw.sources[0].sourceType = 'news';
  raw.candidates[0].nameStrokes = '七';

  assert.deepEqual(validationErrors(raw), [
    '候選人 cand-b：欄位 nameStrokes 應為正整數，實際為 "七"',
    '出處 src-cand-a：欄位 sourceType 應為其中之一：official-website、official-facebook、policy-presentation、election-bulletin，實際為 "news"',
  ]);
});

test('出處類型不接受物件內建屬性名', () => {
  const raw = makeRaw();
  raw.sources[0].sourceType = 'constructor';

  assert.equal(validationErrors(raw).length, 1);
});

test('沒有候選人時只報缺少候選人，不因排序規則判斷而出錯', () => {
  const raw = makeRaw();
  raw.candidates = [];
  raw.sources = [];
  raw.policies = [];

  assert.deepEqual(validationErrors(raw), ['候選人：至少要有一位候選人']);
});

test('只被未核對政見引用的出處不會出現在公開資料集', () => {
  const raw = makeRaw();
  raw.sources.push({ ...raw.sources[0], id: 'src-pending-only', url: 'https://example.org/pending' });
  raw.sources.push({ ...raw.sources[0], id: 'src-raw-items', url: 'https://example.org/raw-items' });
  raw.candidates.find((c) => c.id === 'cand-a').rawPolicyItems = { total: 5, sourceIds: ['src-raw-items'] };
  const pending = policy('p-pending', 'cand-a', pendingVerification());
  pending.quotes = [{ text: '未核對的原文', sourceId: 'src-pending-only' }];
  raw.policies.push(pending);

  const dataset = buildPublicDataset(raw);

  assert.deepEqual(
    dataset.sources.map((s) => s.id).sort(),
    ['src-cand-a', 'src-cand-b', 'src-raw-items'],
  );
});

test('政見指向不存在的候選人、議題區或出處時列出每一處', () => {
  const raw = makeRaw();
  raw.policies[0].candidateId = 'cand-x';
  raw.policies[0].issueAreaId = 'area-x';
  raw.policies[1].quotes.push({ text: '另一段原文', sourceId: 'src-x' });

  assert.deepEqual(validationErrors(raw), [
    '政見 p-a1：candidateId 指向不存在的候選人 cand-x',
    '政見 p-a1：issueAreaId 指向不存在的議題區 area-x',
    '政見 p-a1 的 quotes[0]：出處 src-cand-a 屬於候選人 cand-a，不是 cand-x',
    '政見 p-b1 的 quotes[1]：sourceId 指向不存在的出處 src-x',
  ]);
});

test('號次只填了部分候選人時拒絕建置，避免排序規則混用', () => {
  const raw = makeRaw();
  raw.candidates[0].ballotNumber = 1;

  assert.deepEqual(validationErrors(raw), [
    '候選人：號次只有部分填寫，須全部填寫（抽籤後）或全部為 null（抽籤前）',
  ]);
});

test('適用行政區只接受台中市 29 區正式名稱', () => {
  const raw = makeRaw();
  raw.policies[0].districts = ['大里區', '大里'];

  assert.deepEqual(validationErrors(raw), ['政見 p-a1：districts 含非台中市行政區正式名稱「大里」']);
});

test('第二層核對已有結果卻缺少檢核表版本或模型時拒絕建置', () => {
  const raw = makeRaw();
  raw.policies[0].verification.layer2.checklistVersion = null;
  raw.policies[0].verification.layer2.model = null;

  assert.deepEqual(validationErrors(raw), [
    '政見 p-a1：第二層核對已有結果，verification.layer2.checklistVersion 不得為 null',
    '政見 p-a1：第二層核對已有結果，verification.layer2.model 不得為 null',
  ]);
});

test('驗證失敗的錯誤物件 message 含錯誤數量與每一行訊息', () => {
  const raw = makeRaw();
  delete raw.policies[0].summary;

  assert.throws(() => buildPublicDataset(raw), {
    name: 'DatasetValidationError',
    message: '原始資料有 1 處錯誤：\n政見 p-a1：缺少欄位 summary',
  });
});

test('議題區指向元素清單中的元素，公開資料集附上完整元素清單', () => {
  const raw = makeRaw();
  raw.localElements = [localElement('el-a'), localElement('el-b')];
  raw.issueAreas[0].localElementId = 'el-a';

  const dataset = buildPublicDataset(raw);

  assert.deepEqual(dataset.localElements.map((e) => e.id), ['el-a', 'el-b']);
  assert.equal(dataset.issueAreas[0].localElementId, 'el-a');
});

test('議題區指向不存在的元素、兩區共用同一元素、元素缺理由時列出每一處', () => {
  const raw = makeRaw();
  const noReason = localElement('el-b');
  delete noReason.reason;
  raw.localElements = [localElement('el-a'), noReason, { ...localElement('el-c'), category: '地標' }];
  raw.issueAreas[0].localElementId = 'el-a';
  raw.issueAreas[1].localElementId = 'el-a';
  raw.issueAreas.push({ ...raw.issueAreas[1], id: 'area-c', axial: [2, 0], localElementId: 'el-x' });

  assert.deepEqual(validationErrors(raw), [
    '元素 el-b：缺少欄位 reason',
    '元素 el-c：欄位 category 應為其中之一：自然景觀、小吃、老建築，實際為 "地標"',
    '議題區 area-b：在地感元素 el-a 已放在議題區 area-a，每個在地感元素只放一格',
    '議題區 area-c：localElementId 指向不存在的元素 el-x',
  ]);
});

test('裝飾格不屬於任何議題區，座標不得與議題區重疊，元素不得與議題區共用', () => {
  const raw = makeRaw();
  raw.localElements = [localElement('el-a'), localElement('el-b')];
  raw.issueAreas[0].localElementId = 'el-a';
  raw.decorativeTiles = [
    { id: 'tile-1', axial: [5, 5], localElementId: 'el-b' },
    { id: 'tile-2', axial: [1, 0], localElementId: null },
    { id: 'tile-3', axial: [6, 6], localElementId: 'el-a' },
  ];

  assert.deepEqual(validationErrors(raw), [
    '裝飾格 tile-2：軸向座標 [1,0] 與 area-b 重複',
    '裝飾格 tile-3：在地感元素 el-a 已放在議題區 area-a，每個在地感元素只放一格',
  ]);
});

test('合法的裝飾格隨公開資料集公開', () => {
  const raw = makeRaw();
  raw.localElements = [localElement('el-b')];
  raw.decorativeTiles = [{ id: 'tile-1', axial: [5, 5], localElementId: 'el-b' }];

  assert.deepEqual(buildPublicDataset(raw).decorativeTiles, raw.decorativeTiles);
});

test('公開資料集保留出處說法不一標註、適用行政區與建置時間', () => {
  const raw = makeRaw();
  raw.policies[0].districts = ['大里區', '霧峰區'];
  raw.policies[0].conflictNote = '官網寫 10 處，臉書寫 12 處';

  const dataset = buildPublicDataset(raw, { builtAt: '2026-10-24T08:00:00.000Z' });

  const published = dataset.policies.find((p) => p.id === 'p-a1');
  assert.deepEqual(published.districts, ['大里區', '霧峰區']);
  assert.equal(published.conflictNote, '官網寫 10 處，臉書寫 12 處');
  assert.equal(dataset.meta.builtAt, '2026-10-24T08:00:00.000Z');
  assert.equal(dataset.meta.dataCutoffDate, '2026-10-23');
});
