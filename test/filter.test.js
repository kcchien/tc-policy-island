import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { filterViewModel, policyMatcher } from '../site/js/filter.js';
import { makeRaw, policy } from './fixtures/make-raw.js';

// area-a：甲「增設公車路線」（大里區）、乙「捷運延伸」（原文提到太平）
// area-b：甲「托育中心」（大里區、霧峰區）
function sampleViewModel() {
  const raw = makeRaw();
  const [a1, b1] = raw.policies;
  a1.summary = '增設三條公車路線';
  a1.quotes[0].text = '我們會增設三條公車路線';
  a1.districts = ['大里區'];
  b1.summary = '延伸捷運路線';
  b1.quotes[0].text = '捷運延伸到太平';
  const a2 = policy('p-a2', 'cand-a', undefined, 'area-b');
  a2.summary = '每區設一所托育中心';
  a2.quotes[0].text = '托育中心每區一所';
  a2.districts = ['大里區', '霧峰區'];
  raw.policies.push(a2);
  return buildViewModel(buildPublicDataset(raw));
}

const shape = (vm) =>
  vm.rows.map((row) => [row.issueArea.id, row.cells.map((cell) => [cell.status, cell.policies.map((p) => p.id)])]);

test('沒有任何篩選條件時，檢視模型原樣保留', () => {
  const vm = sampleViewModel();

  const filtered = filterViewModel(vm, { query: '  ', district: '' });

  assert.deepEqual(shape(filtered), shape(vm));
  assert.equal(filtered.filter.active, false);
});

test('關鍵字比對摘要：只留有符合政見的議題區，同區其他候選人的格子標為沒有符合的政見', () => {
  const filtered = filterViewModel(sampleViewModel(), { query: '公車' });

  assert.deepEqual(shape(filtered), [
    ['area-a', [['has-policies', ['p-a1']], ['no-matches', []], ['no-matches', []]]],
  ]);
  assert.equal(filtered.filter.active, true);
  assert.equal(filtered.filter.matchCount, 1);
});

test('關鍵字也比對原文引述', () => {
  const filtered = filterViewModel(sampleViewModel(), { query: '太平' });

  assert.deepEqual(shape(filtered), [
    ['area-a', [['no-matches', []], ['has-policies', ['p-b1']], ['no-matches', []]]],
  ]);
});

test('關鍵字輸入不含「區」的行政區名稱，也比對到適用行政區', () => {
  const filtered = filterViewModel(sampleViewModel(), { query: '霧峰' });

  assert.deepEqual(shape(filtered), [
    ['area-b', [['has-policies', ['p-a2']], ['no-matches', []], ['no-matches', []]]],
  ]);
});

test('關鍵字以空白分開時，每個詞都要符合', () => {
  const filtered = filterViewModel(sampleViewModel(), { query: '路線 捷運' });

  assert.deepEqual(filtered.rows.flatMap((row) => row.cells.flatMap((c) => c.policies.map((p) => p.id))), ['p-b1']);
});

test('英文字母不分大小寫、全形與半形視為相同', () => {
  const raw = makeRaw();
  raw.policies[0].summary = '推動 MRT 藍線';
  const vm = buildViewModel(buildPublicDataset(raw));

  assert.equal(filterViewModel(vm, { query: 'mrt' }).filter.matchCount, 1);
  assert.equal(filterViewModel(vm, { query: 'ＭＲＴ' }).filter.matchCount, 1);
});

test('行政區篩選只留適用行政區包含該區的政見', () => {
  const filtered = filterViewModel(sampleViewModel(), { district: '大里區' });

  assert.deepEqual(shape(filtered), [
    ['area-a', [['has-policies', ['p-a1']], ['no-matches', []], ['no-matches', []]]],
    ['area-b', [['has-policies', ['p-a2']], ['no-matches', []], ['no-matches', []]]],
  ]);
  assert.equal(filtered.filter.matchCount, 2);
});

test('搜尋與行政區篩選同時使用時，兩個條件都要符合', () => {
  const filtered = filterViewModel(sampleViewModel(), { query: '托育', district: '大里區' });

  assert.deepEqual(shape(filtered), [
    ['area-b', [['has-policies', ['p-a2']], ['no-matches', []], ['no-matches', []]]],
  ]);
  assert.equal(filterViewModel(sampleViewModel(), { query: '公車', district: '霧峰區' }).rows.length, 0);
});

test('篩選不改動候選人欄位：欄位數、順序與政見數維持不變', () => {
  const vm = sampleViewModel();

  const filtered = filterViewModel(vm, { query: '公車' });

  assert.deepEqual(filtered.candidates, vm.candidates);
  assert.deepEqual(filtered.rows[0].cells.map((c) => c.candidateId), ['cand-a', 'cand-b', 'cand-c']);
});

test('未知的行政區名稱不當成篩選條件', () => {
  const vm = sampleViewModel();

  const filtered = filterViewModel(vm, { district: '不存在區' });

  assert.equal(filtered.filter.active, false);
  assert.deepEqual(shape(filtered), shape(vm));
});

test('只看兩說並列：只留有出處說法不一標註的政見，其他條件照樣並用', () => {
  const raw = makeRaw();
  raw.policies[1].conflictNote = '官網寫延伸到太平，臉書寫延伸到大里';
  const a2 = policy('p-a2', 'cand-a', undefined, 'area-b');
  a2.conflictNote = '兩個來源的所數不同';
  a2.summary = '每區設一所托育中心';
  raw.policies.push(a2);
  const vm = buildViewModel(buildPublicDataset(raw));

  const filtered = filterViewModel(vm, { conflictOnly: true });

  assert.deepEqual(shape(filtered), [
    ['area-a', [['no-matches', []], ['has-policies', ['p-b1']], ['no-matches', []]]],
    ['area-b', [['has-policies', ['p-a2']], ['no-matches', []], ['no-matches', []]]],
  ]);
  assert.deepEqual(filtered.filter, { active: true, query: '', district: null, conflictOnly: true, matchCount: 2 });
  assert.deepEqual(filterViewModel(vm, { conflictOnly: true, query: '托育' }).rows.map((row) => row.issueArea.id), ['area-b']);
});

test('沒有開啟只看兩說並列時，篩選結果記為 false', () => {
  assert.equal(filterViewModel(sampleViewModel(), {}).filter.conflictOnly, false);
  assert.equal(filterViewModel(sampleViewModel(), { query: '公車' }).filter.conflictOnly, false);
});

test('政見卡片的欄內篩選與全站篩選用同一套比對：關鍵字比對摘要、原文與行政區，行政區須完全相符', () => {
  const vm = sampleViewModel();
  const policies = vm.rows.flatMap((row) => row.cells.flatMap((cell) => cell.policies));
  const ids = (filter) => {
    const matcher = policyMatcher(filter);
    return { active: matcher.active, ids: policies.filter(matcher.matches).map((p) => p.id) };
  };
  assert.deepEqual(ids({ query: '太平' }), { active: true, ids: ['p-b1'] });
  assert.deepEqual(ids({ query: '托育 霧峰' }), { active: true, ids: ['p-a2'] });
  assert.deepEqual(ids({ district: '大里區' }), { active: true, ids: ['p-a1', 'p-a2'] });
  assert.deepEqual(ids({ query: '  ', district: '不存在區' }).active, false);
});
