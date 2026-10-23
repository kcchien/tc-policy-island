import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapSheet } from '../site/js/sheet.js';

test('手機卡片放開時依高度吸附：超過六成全螢幕、低於四分之一關閉、其餘約一半', () => {
  assert.equal(snapSheet({ from: 'half', fraction: 0.8, moved: true }), 'full');
  assert.equal(snapSheet({ from: 'half', fraction: 0.6, moved: true }), 'full');
  assert.equal(snapSheet({ from: 'full', fraction: 0.45, moved: true }), 'half');
  assert.equal(snapSheet({ from: 'half', fraction: 0.3, moved: true }), 'half');
  assert.equal(snapSheet({ from: 'half', fraction: 0.2, moved: true }), 'closed');
  assert.equal(snapSheet({ from: 'full', fraction: 0.1, moved: true }), 'closed');
});

test('只點把手不拖曳時在一半與全螢幕之間切換', () => {
  assert.equal(snapSheet({ from: 'half', fraction: 0.5, moved: false }), 'full');
  assert.equal(snapSheet({ from: 'full', fraction: 1, moved: false }), 'half');
});
