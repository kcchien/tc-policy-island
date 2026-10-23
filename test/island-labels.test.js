import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeLabels } from '../site/js/island-labels.js';

// 名牌以中心點與兩種尺寸描述：完整（編號加名稱）與只留編號。
const label = (id, x, y, extra = {}) => ({ id, x, y, full: { width: 80, height: 20 }, number: { width: 24, height: 20 }, ...extra });

test('沒有重疊的名牌完整顯示', () => {
  const modes = placeLabels([label('a', 100, 100), label('b', 300, 100)]);
  assert.deepEqual(Object.fromEntries(modes), { a: 'full', b: 'full' });
});

test('與先放好的名牌重疊時先縮成只留編號，編號仍重疊就隱藏', () => {
  // b 與 a 相距 60px：完整寬 80 會重疊，只留編號（寬 24）不會。
  assert.equal(placeLabels([label('a', 100, 100), label('b', 160, 100)]).get('b'), 'number');
  // c 與 a 幾乎同位置：連編號都會重疊。
  assert.equal(placeLabels([label('a', 100, 100), label('c', 105, 100)]).get('c'), 'hidden');
});

test('8px 遲滯：重疊不到 8px 時維持上一次的顯示方式，不在兩種之間來回閃', () => {
  // a 與 b 相距 75px，完整名牌重疊 5px。
  const pair = [label('a', 100, 100), label('b', 175, 100)];
  assert.equal(placeLabels(pair, { previous: new Map([['b', 'full']]) }).get('b'), 'full');
  assert.equal(placeLabels(pair, { previous: new Map([['b', 'number']]) }).get('b'), 'number');
  // 重疊 10px 超過遲滯範圍，完整名牌也要縮。
  const closer = [label('a', 100, 100), label('b', 170, 100)];
  assert.equal(placeLabels(closer, { previous: new Map([['b', 'full']]) }).get('b'), 'number');
  // 完全分開後才從編號恢復完整。
  const apart = [label('a', 100, 100), label('b', 180, 100)];
  assert.equal(placeLabels(apart, { previous: new Map([['b', 'number']]) }).get('b'), 'full');
});

test('隱藏的名牌也要離開 8px 遲滯範圍才重新出現', () => {
  const panel = { left: 0, top: 0, right: 130, bottom: 200 };
  // 只留編號時左緣 126，伸進面板 4px：上次顯示中就留著，上次隱藏就繼續隱藏。
  const near = [label('a', 138, 100, { full: null })];
  assert.equal(placeLabels(near, { obstacles: [panel], previous: new Map([['a', 'number']]) }).get('a'), 'number');
  assert.equal(placeLabels(near, { obstacles: [panel], previous: new Map([['a', 'hidden']]) }).get('a'), 'hidden');
});

test('選中的名牌最先放，其他名牌讓它', () => {
  const modes = placeLabels([label('a', 100, 100), label('b', 105, 100)], { selectedId: 'b' });
  assert.deepEqual(Object.fromEntries(modes), { a: 'hidden', b: 'full' });
});

test('同組的名牌（三位候選人人物）一起縮、一起隱藏，三人呈現相同', () => {
  const panel = { left: 0, top: 0, right: 130, bottom: 200 };
  const figures = ['x', 'y', 'z'].map((id, i) => label(id, 150 + i * 200, 100, { group: 'figures' }));
  // 只有 x 伸進面板，三人都只留編號。
  assert.deepEqual(Object.fromEntries(placeLabels(figures, { obstacles: [panel] })), { x: 'number', y: 'number', z: 'number' });
  // 同組只留編號後空出的位置，後面的名牌可以用。
  const after = placeLabels([...figures, label('w', 215, 100)], { obstacles: [panel] });
  assert.equal(after.get('w'), 'full');
});

test('與介面面板重疊時同樣先縮成編號再隱藏', () => {
  const panel = { left: 0, top: 0, right: 130, bottom: 200 };
  // 完整名牌左右各 40px，伸進面板；只留編號時左緣在 138，不碰面板。
  assert.equal(placeLabels([label('a', 150, 100)], { obstacles: [panel] }).get('a'), 'number');
  assert.equal(placeLabels([label('a', 120, 100)], { obstacles: [panel] }).get('a'), 'hidden');
});
