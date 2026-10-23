import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { makeRaw, policy, pendingVerification } from './fixtures/make-raw.js';

const viewModelOf = (raw) => buildViewModel(buildPublicDataset(raw));

test('矩陣每一列是一個議題區，每一格依候選人排序列出該候選人在該區的政見', () => {
  const raw = makeRaw();
  raw.policies.push(policy('p-a2', 'cand-a', undefined, 'area-b'));

  const vm = viewModelOf(raw);

  const shape = vm.rows.map((row) => ({
    area: row.issueArea.id,
    cells: row.cells.map((cell) => [cell.candidateId, cell.status, cell.policies.map((p) => p.id)]),
  }));
  assert.deepEqual(shape, [
    {
      area: 'area-a',
      cells: [
        ['cand-a', 'has-policies', ['p-a1']],
        ['cand-b', 'has-policies', ['p-b1']],
        ['cand-c', 'no-policies', []],
      ],
    },
    {
      area: 'area-b',
      cells: [
        ['cand-a', 'has-policies', ['p-a2']],
        ['cand-b', 'no-policies', []],
        ['cand-c', 'no-policies', []],
      ],
    },
  ]);
});

test('候選人欄位附原始政見條目總數與其出處、公開政見數與資料狀態說明', () => {
  const raw = makeRaw();
  const candA = raw.candidates.find((c) => c.id === 'cand-a');
  candA.rawPolicyItems = { total: 117, sourceIds: ['src-cand-a'] };
  const candC = raw.candidates.find((c) => c.id === 'cand-c');
  candC.rawPolicyItems = { total: 0, sourceIds: [] };
  candC.dataStatus = '尚無一手來源';
  raw.policies.push(policy('p-a2', 'cand-a', undefined, 'area-b'));

  const vm = viewModelOf(raw);

  assert.deepEqual(
    vm.candidates.map((c) => ({
      id: c.id,
      rawTotal: c.rawPolicyItems.total,
      rawSources: c.rawPolicyItems.sourceIds,
      policyCount: c.policyCount,
      dataStatus: c.dataStatus,
    })),
    [
      { id: 'cand-a', rawTotal: 117, rawSources: ['src-cand-a'], policyCount: 2, dataStatus: null },
      { id: 'cand-b', rawTotal: null, rawSources: [], policyCount: 1, dataStatus: null },
      { id: 'cand-c', rawTotal: 0, rawSources: [], policyCount: 0, dataStatus: '尚無一手來源' },
    ],
  );
});

test('「未提出相關政見」的說明文字帶資料截止日', () => {
  const vm = viewModelOf(makeRaw());

  assert.equal(vm.noPolicyText, '未提出相關政見（截至 2026-10-23）');
  assert.equal(vm.meta.dataCutoffDate, '2026-10-23');
});

test('檢視模型附上目前採用的候選人排序規則說明', () => {
  const byStrokes = viewModelOf(makeRaw());
  const raw = makeRaw();
  raw.candidates.forEach((c, index) => { c.ballotNumber = index + 1; });
  const byBallot = viewModelOf(raw);

  assert.equal(byStrokes.candidateOrderNote, '候選人排列依姓名筆畫由少到多（號次抽籤前）');
  assert.equal(byBallot.candidateOrderNote, '候選人排列依選委會抽籤號次');
});

test('沒有任何公開政見時，每一格都是「未提出相關政見」', () => {
  const raw = makeRaw();
  raw.policies = [policy('p-pending', 'cand-a', pendingVerification())];

  const vm = viewModelOf(raw);

  const statuses = vm.rows.flatMap((row) => row.cells.map((cell) => cell.status));
  assert.deepEqual(statuses, Array(6).fill('no-policies'));
});

test('每則原文引述附上出處（來源類型中文名、網址、出處快照位置），供政見卡片使用', () => {
  const raw = makeRaw();
  const source = raw.sources.find((s) => s.id === 'src-cand-a');
  source.archiveUrl = 'https://web.archive.org/web/2026/https://example.org/cand-a';
  source.archiveError = null;

  const vm = viewModelOf(raw);

  const [quote] = vm.rows[0].cells[0].policies[0].quotes;
  assert.deepEqual(quote.source, {
    id: 'src-cand-a',
    title: '測試出處',
    url: 'https://example.org/cand-a',
    archiveUrl: 'https://web.archive.org/web/2026/https://example.org/cand-a',
    snapshotUrl: './data/snapshots/src-cand-a.txt',
    sourceType: 'official-website',
    sourceTypeName: '官網',
    retrievedAt: '2026-10-23',
  });
});
