import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { HIT_URL, pageviewHit, sendHit, sourceHitFromLinks, sourceIdsBySnapshot, trackingAllowed } from '../site/js/hits.js';
import { makeRaw } from './fixtures/make-raw.js';

// 假的 navigator：記下每次送出。
function fakeNavigator(extra = {}) {
  const sent = [];
  return {
    sent,
    nav: { sendBeacon: (url, body) => sent.push({ url, body: JSON.parse(body) }) && true, ...extra },
  };
}

test('瀏覽器開啟「不要追蹤」或全域隱私控制時不送出，其餘照送', () => {
  assert.equal(trackingAllowed({}), true);
  assert.equal(trackingAllowed({ doNotTrack: '0' }), true);
  assert.equal(trackingAllowed({ doNotTrack: 'unspecified', globalPrivacyControl: false }), true);
  assert.equal(trackingAllowed({ doNotTrack: '1' }), false);
  assert.equal(trackingAllowed({ globalPrivacyControl: true }), false);
});

test('頁面瀏覽送到統計端點，只帶種類與檢視', () => {
  const { sent, nav } = fakeNavigator();

  assert.equal(sendHit(nav, pageviewHit('method')), true);
  assert.deepEqual(sent, [{ url: HIT_URL, body: { kind: 'pageview', id: null, view: 'method' } }]);
});

test('不要追蹤時完全不呼叫送出', () => {
  for (const extra of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
    const { sent, nav } = fakeNavigator(extra);
    assert.equal(sendHit(nav, pageviewHit('island')), false);
    assert.deepEqual(sent, []);
  }
});

test('送出失敗或瀏覽器不支援時安靜放棄，不丟錯誤', () => {
  assert.equal(sendHit({ sendBeacon: () => { throw new TypeError('blocked'); } }, pageviewHit('table')), false);
  assert.equal(sendHit({}, pageviewHit('table')), false);
});

test('出處點擊：從同一組連結裡的原文存檔找出出處識別碼，三個連結都算同一個出處', () => {
  const vm = buildViewModel(buildPublicDataset(makeRaw()));
  const bySnapshot = sourceIdsBySnapshot(vm);
  const source = vm.rows[0].cells.find((c) => c.candidateId === 'cand-a').policies[0].quotes[0].source;
  const links = [source.url, source.snapshotUrl];

  assert.deepEqual(sourceHitFromLinks(links, bySnapshot, 'island'), { kind: 'source', id: 'src-cand-a', view: 'island' });
  // 候選人資料卡的出處也在對照裡。
  const profileSource = vm.candidates.find((c) => c.id === 'cand-b').profileSource;
  assert.deepEqual(sourceHitFromLinks([profileSource.url, profileSource.snapshotUrl, 'https://web.archive.org/x'], bySnapshot, 'table'),
    { kind: 'source', id: 'profile-src-cand-b', view: 'table' });
});

test('找不到原文存檔對應的出處時不送', () => {
  const bySnapshot = sourceIdsBySnapshot(buildViewModel(buildPublicDataset(makeRaw())));

  assert.equal(sourceHitFromLinks(['https://example.org/cand-a', './data/snapshots/unknown.txt'], bySnapshot, 'island'), null);
});
