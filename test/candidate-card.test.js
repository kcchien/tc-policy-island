import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { profileCardContent } from '../site/js/candidate-card.js';
import { GLYPH_RESTORED_TEXT } from '../site/js/ui-text.js';
import { loadRawData } from '../scripts/lib/raw-data.js';
import { makeRaw, profileVerification } from './fixtures/make-raw.js';

const RAW_DIR = fileURLToPath(new URL('../data/raw', import.meta.url));
const viewModelOf = (raw) => buildViewModel(buildPublicDataset(raw));

test('候選人資料卡逐字列出姓名、政黨、出生年、學歷、經歷與資料來源，不加其他文字', () => {
  const vm = viewModelOf(makeRaw());

  const card = profileCardContent(vm.candidates.find((c) => c.id === 'cand-a'));

  assert.deepEqual(card, {
    candidateId: 'cand-a',
    name: '候選人甲',
    party: '候選人甲所屬政黨',
    fields: [
      { label: '出生年', values: ['1970'] },
      { label: '學歷', values: ['cand-a 測試大學學士'] },
      { label: '經歷', values: ['cand-a 測試協會理事長', 'cand-a 測試里里長'] },
    ],
    emptyText: null,
    source: {
      origin: '中選會選舉公報，2024 年第11屆立法委員選舉（測試選舉區）',
      title: '測試選舉公報',
      retrievedAt: '2026-10-23',
      url: 'https://bulletin.cec.gov.tw/test-fixture/cand-a.pdf',
      archiveUrl: null,
      snapshotUrl: './data/snapshots/profile-src-cand-a.txt',
      // 一般的 PDF 轉文字不需要說明；轉換紀錄只留在公開資料集。
      snapshotNote: null,
      verification: '已通過核對：學歷與經歷逐字比對原文（2026-10-24）',
    },
  });
});

test('沒有公開的候選人資料時，卡片只寫尚未收錄，欄位與來源留空', () => {
  const raw = makeRaw();
  raw.candidates.find((c) => c.id === 'cand-b').profile.verification = profileVerification('pending');
  const vm = viewModelOf(raw);

  const card = profileCardContent(vm.candidates.find((c) => c.id === 'cand-b'));

  assert.equal(card.emptyText, '尚未收錄候選人資料');
  assert.deepEqual(card.fields, []);
  assert.equal(card.source, null);
});

test('正式資料的三張卡片與公開資料集逐字一致：每一項學歷與經歷照原樣一項一行，不斷句、不合併', () => {
  const dataset = buildPublicDataset(loadRawData(RAW_DIR));
  const vm = buildViewModel(dataset);

  for (const candidate of dataset.candidates) {
    const card = profileCardContent(vm.candidates.find((c) => c.id === candidate.id));
    const value = (label) => card.fields.find((f) => f.label === label).values;
    const source = dataset.sources.find((s) => s.id === candidate.profile.sourceId);

    assert.equal(card.name, candidate.name);
    assert.equal(card.party, candidate.party);
    assert.deepEqual(card.fields.map((f) => f.label), ['出生年', '學歷', '經歷']);
    assert.deepEqual(value('出生年'), [String(candidate.profile.birthYear)]);
    assert.deepEqual(value('學歷'), candidate.profile.education);
    assert.deepEqual(value('經歷'), candidate.profile.experience);
    assert.equal(card.source.url, source.url);
    assert.equal(card.source.archiveUrl, source.archiveUrl);
    assert.equal(card.source.retrievedAt, source.retrievedAt);
    // 有字形還原的公報，卡片用白話說明，不出現轉換工具、字型與對照檔。
    assert.equal(card.source.snapshotNote, source.snapshotNote.includes('字型對照還原') ? GLYPH_RESTORED_TEXT : null);
    assert.ok(card.source.origin.includes(`${candidate.profile.electionYear} 年${candidate.profile.electionName}`));
  }
});
