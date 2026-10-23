import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseView, formatSearch, parseSearch } from '../site/js/app-state.js';

test('網址參數讀出檢視、議題區、政見、關鍵字與行政區', () => {
  assert.deepEqual(parseSearch('?view=table&area=transport&policy=p-1&q=%E6%8D%B7%E9%81%8B&district=%E5%A4%A7%E9%87%8C%E5%8D%80'), {
    view: 'table',
    area: 'transport',
    policy: 'p-1',
    query: '捷運',
    district: '大里區',
  });
});

test('沒有參數或檢視名稱不合法時，各欄為空', () => {
  const empty = { view: null, area: null, policy: null, query: '', district: '' };
  assert.deepEqual(parseSearch(''), empty);
  assert.deepEqual(parseSearch('?view=map'), empty);
});

test('狀態寫回網址時省略空欄，讀回後與原狀態相同', () => {
  const state = { view: 'table', area: 'transport', policy: null, query: '托育 中心', district: '' };

  const search = formatSearch(state);

  assert.equal(search, '?view=table&area=transport&q=%E6%89%98%E8%82%B2+%E4%B8%AD%E5%BF%83');
  assert.deepEqual(parseSearch(search), state);
  assert.equal(formatSearch({ view: null, area: null, policy: null, query: '', district: '' }), '');
});

test('不支援 WebGL 時一律進入表格檢視，即使網址指定島嶼檢視', () => {
  assert.equal(chooseView({ requested: 'island', webgl: false, islandAvailable: true }), 'table');
  assert.equal(chooseView({ requested: null, webgl: false, islandAvailable: true }), 'table');
});

test('島嶼檢視尚未提供時進入表格檢視', () => {
  assert.equal(chooseView({ requested: 'island', webgl: true, islandAvailable: false }), 'table');
});

test('支援 WebGL 且島嶼檢視可用時，預設島嶼檢視，網址可指定表格檢視', () => {
  assert.equal(chooseView({ requested: null, webgl: true, islandAvailable: true }), 'island');
  assert.equal(chooseView({ requested: 'table', webgl: true, islandAvailable: true }), 'table');
});
