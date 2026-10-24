import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policySpeech, policyText } from '../site/js/policy-text.js';
import { internalDetails } from '../scripts/lib/audience-text.js';

// 檢視模型裡的一筆政見：引述的 source 已帶出處欄位。候選人為虛構的「候選人甲」。
const source = (overrides = {}) => ({
  id: 'src-a',
  url: 'https://a.example/future',
  archiveUrl: 'https://web.archive.org/web/20261020000000/https://a.example/future',
  title: '候選人甲官方網站',
  retrievedAt: '2026-10-20',
  sourceTypeName: '候選人官網',
  snapshotUrl: 'data/snapshots/src-a.txt',
  snapshotNote: null,
  ...overrides,
});

const samplePolicy = (overrides = {}) => ({
  id: 'p-1',
  candidateId: 'cand-a',
  summary: '推動捷運藍線動工。',
  quotes: [{ text: '藍線儘快動工', sourceId: 'src-a', source: source() }],
  districts: [],
  conflictNote: null,
  ...overrides,
});

const context = {
  areaName: '交通',
  candidateName: '候選人甲',
  cutoffDate: '2026-10-23',
  url: 'https://example.org/?policy=p-1',
};

test('複製成一段話：議題區與姓名、摘要、原文與出處、資料截止日與本站網址，依固定格式排成多行', () => {
  assert.equal(policyText(samplePolicy(), context), [
    '【交通】候選人甲',
    '摘要：推動捷運藍線動工。',
    '原文：「藍線儘快動工」',
    '出處：候選人甲官方網站（2026-10-20 擷取）https://a.example/future',
    '網頁備份：https://web.archive.org/web/20261020000000/https://a.example/future',
    '資料截止 2026-10-23，整理自台中政見島 https://example.org/?policy=p-1',
  ].join('\n'));
});

test('出處沒有網頁備份時少一行，其餘格式不變；多則引述各自列出原文與出處', () => {
  const policy = samplePolicy({
    quotes: [
      { text: '藍線儘快動工', sourceId: 'src-a', source: source({ archiveUrl: null }) },
      { text: '同步規劃延伸線', sourceId: 'src-b', source: source({ id: 'src-b', title: '政見發表會', url: 'https://b.example/', archiveUrl: null }) },
    ],
  });
  assert.equal(policyText(policy, context), [
    '【交通】候選人甲',
    '摘要：推動捷運藍線動工。',
    '原文：「藍線儘快動工」',
    '出處：候選人甲官方網站（2026-10-20 擷取）https://a.example/future',
    '原文：「同步規劃延伸線」',
    '出處：政見發表會（2026-10-20 擷取）https://b.example/',
    '資料截止 2026-10-23，整理自台中政見島 https://example.org/?policy=p-1',
  ].join('\n'));
});

test('出處說法不一的政見，摘要後照錄說法不一的標註', () => {
  const text = policyText(samplePolicy({ conflictNote: '官網寫 2027 年，發表會說 2028 年。' }), context);
  assert.equal(text.split('\n')[2], '出處說法不一：官網寫 2027 年，發表會說 2028 年。');
});

test('複製文字不含原文存檔位置與其他內部細節', () => {
  const text = policyText(samplePolicy(), context);
  assert.ok(!text.includes('data/snapshots'));
  assert.deepEqual(internalDetails(text.replace(/https?:\/\/\S+/g, '')), []);
});

test('朗讀只唸摘要與每則原文引述，不唸網址', () => {
  const policy = samplePolicy({
    quotes: [
      { text: '藍線儘快動工', sourceId: 'src-a', source: source() },
      { text: '同步規劃延伸線', sourceId: 'src-b', source: source({ id: 'src-b' }) },
    ],
  });
  assert.equal(policySpeech(policy), '推動捷運藍線動工。原文：藍線儘快動工。原文：同步規劃延伸線。');
});
