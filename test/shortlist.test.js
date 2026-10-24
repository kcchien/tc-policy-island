import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { formatSearch, parseSearch } from '../site/js/app-state.js';
import { knownPicks, parsePicks, PICKS_KEY, serializePicks, shortlistRows } from '../site/js/shortlist.js';
import { makeRaw, policy } from './fixtures/make-raw.js';

// 三個議題區：area-a 有候選人甲、乙各一筆，area-b 只有候選人甲一筆，area-c 沒有政見。
function sampleViewModel() {
  const raw = makeRaw();
  raw.issueAreas.push({ ...raw.issueAreas[1], id: 'area-c', name: '議題區三', axial: [2, 0] });
  raw.policies.push(policy('p-a2', 'cand-a', undefined, 'area-b'));
  return buildViewModel(buildPublicDataset(raw));
}

test('勾選紀錄序列化後解析回相同的集合', () => {
  assert.deepEqual([...parsePicks(serializePicks(new Set(['p-b1', 'p-a1'])))].sort(), ['p-a1', 'p-b1']);
  assert.equal(PICKS_KEY, 'policy-island:picks');
});

test('勾選紀錄是壞資料時回空集合，陣列裡不是文字的項目略過', () => {
  for (const bad of [null, '', '{', '"p-a1"', '{"a":1}']) {
    assert.deepEqual([...parsePicks(bad)], [], String(bad));
  }
  assert.deepEqual([...parsePicks('["p-a1", 3, null]')], ['p-a1']);
});

test('對照單只列出有勾選政見的議題區，三欄都在，沒有政見的欄位照常保留', () => {
  const vm = sampleViewModel();
  const rows = shortlistRows(vm, new Set(['p-a2']));
  assert.deepEqual(rows.map((row) => row.issueArea.id), ['area-b']);
  const [row] = rows;
  // 三欄依排序規則，與檢視模型的候選人順序相同。
  assert.deepEqual(row.cells.map((cell) => cell.candidateId), vm.candidates.map((c) => c.id));
  const byCandidate = Object.fromEntries(row.cells.map((cell) => [cell.candidateId, cell]));
  assert.equal(byCandidate['cand-a'].policies.length, 1);
  assert.equal(byCandidate['cand-b'].policies.length, 0);
  assert.equal(byCandidate['cand-b'].status, 'no-policies');
  assert.equal(byCandidate['cand-c'].policies.length, 0);
});

test('對照單整列帶出該議題區的全部政見，只標出被勾的那幾條，議題區依編號排列', () => {
  const vm = sampleViewModel();
  const rows = shortlistRows(vm, new Set(['p-a2', 'p-b1']));
  assert.deepEqual(rows.map((row) => row.issueArea.id), ['area-a', 'area-b']);
  const areaA = Object.fromEntries(rows[0].cells.map((cell) => [cell.candidateId, cell]));
  // 只勾了候選人乙的政見，候選人甲的政見照樣列出，只是沒有標記。
  assert.deepEqual(areaA['cand-a'].policies.map((p) => [p.id, p.picked]), [['p-a1', false]]);
  assert.deepEqual(areaA['cand-b'].policies.map((p) => [p.id, p.picked]), [['p-b1', true]]);
  assert.equal(rows[0].number, '01');
});

test('沒有勾選時對照單是空的', () => {
  assert.deepEqual(shortlistRows(sampleViewModel(), new Set()), []);
});

test('網址參數 pick 以逗號分隔政見識別碼，往返後相同；空的時候不出現在網址上', () => {
  const state = parseSearch('?pick=p-a1%2Cp-b1');
  assert.deepEqual(state.pick, ['p-a1', 'p-b1']);
  assert.equal(formatSearch({ pick: ['p-a1', 'p-b1'] }), '?pick=p-a1%2Cp-b1');
  assert.equal(formatSearch({ pick: [] }), '');
  assert.deepEqual(parseSearch('').pick, []);
});

test('網址參數 pick 的壞值忽略：空項、重複與資料集裡沒有的政見識別碼都不算', () => {
  const vm = sampleViewModel();
  const { pick } = parseSearch('?pick=,p-a1,,p-a1, p-b1 ,nope,%3Cscript%3E');
  assert.deepEqual([...knownPicks(vm, pick)], ['p-a1', 'p-b1']);
});
