import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoStartTour,
  currentTourStep,
  initialTour,
  nextTourStep,
  pickTourArea,
  placeTourBubble,
  reopenTour,
  skipTour,
} from '../site/js/tour.js';

const ISLAND = { view: 'island', webgl: true, cardOpen: false };

test('第一次進入島嶼檢視時自動出現上手導覽，從議題區格子開始', () => {
  const state = autoStartTour(initialTour({ seen: false }), ISLAND);
  assert.equal(currentTourStep(state), 'area');
});

test('下一步依序走過議題區格子、三個標記、隨機一題，最後一步之後結束並記為看過', () => {
  let state = autoStartTour(initialTour({ seen: false }), ISLAND);
  state = nextTourStep(state);
  assert.equal(currentTourStep(state), 'markers');
  state = nextTourStep(state);
  assert.equal(currentTourStep(state), 'random');
  assert.equal(state.seen, false);
  state = nextTourStep(state);
  assert.equal(currentTourStep(state), null);
  assert.equal(state.seen, true);
});

test('跳過：任何一步都能跳過，結束並記為看過', () => {
  for (const presses of [0, 1, 2]) {
    let state = autoStartTour(initialTour({ seen: false }), ISLAND);
    for (let i = 0; i < presses; i += 1) state = nextTourStep(state);
    state = skipTour(state);
    assert.equal(currentTourStep(state), null);
    assert.equal(state.seen, true);
  }
});

test('看過就不再自動出現', () => {
  assert.equal(currentTourStep(autoStartTour(initialTour({ seen: true }), ISLAND)), null);
});

test('表格檢視、沒有 WebGL 或讀者正在看卡片時不自動出現，之後進島嶼檢視、卡片關著時才出現', () => {
  const fresh = initialTour({ seen: false });
  assert.equal(currentTourStep(autoStartTour(fresh, { ...ISLAND, view: 'table' })), null);
  assert.equal(currentTourStep(autoStartTour(fresh, { ...ISLAND, webgl: false })), null);
  const linked = autoStartTour(fresh, { ...ISLAND, cardOpen: true });
  assert.equal(currentTourStep(linked), null);
  assert.equal(linked.seen, false);
  assert.equal(currentTourStep(autoStartTour(linked, ISLAND)), 'area');
});

test('導覽進行中再次自動檢查不會跳回第一步', () => {
  const state = nextTourStep(autoStartTour(initialTour({ seen: false }), ISLAND));
  assert.equal(currentTourStep(autoStartTour(state, ISLAND)), 'markers');
});

test('頁首重開：看過也從第一步開始；表格檢視或沒有 WebGL 時不開', () => {
  const seen = skipTour(autoStartTour(initialTour({ seen: false }), ISLAND));
  assert.equal(currentTourStep(reopenTour(seen, ISLAND)), 'area');
  assert.equal(currentTourStep(reopenTour(seen, { ...ISLAND, view: 'table' })), null);
  assert.equal(currentTourStep(reopenTour(seen, { ...ISLAND, webgl: false })), null);
  const done = nextTourStep(nextTourStep(nextTourStep(reopenTour(seen, ISLAND))));
  assert.equal(done.seen, true);
});

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });

test('框哪一格：名牌與標記都完整在可見範圍、不被浮動元件擋住的議題區中，選最靠近可見範圍中央的', () => {
  const visible = rect(0, 100, 400, 600); // 中央 (200, 400)
  const candidates = [
    { id: 'far', label: rect(20, 120, 60, 20), markers: rect(20, 150, 40, 20) },
    { id: 'near', label: rect(170, 380, 60, 20), markers: rect(180, 410, 40, 20) },
    { id: 'blocked', label: rect(190, 390, 60, 20), markers: rect(190, 420, 40, 20) },
    { id: 'off-screen', label: rect(200, 650, 60, 20), markers: rect(200, 690, 40, 20) },
    { id: 'no-label', label: null, markers: rect(200, 400, 40, 20) },
  ];
  const obstacles = [rect(240, 380, 100, 100)];
  assert.equal(pickTourArea(candidates, { visible, obstacles }), 'near');
  assert.equal(pickTourArea(candidates.slice(2), { visible, obstacles }), null);
});

test('說明框放在框線下方；下方放不下改放上方，水平置中於框線並留邊距', () => {
  const viewport = { width: 390, height: 844 };
  const bubble = { width: 300, height: 200 };
  const below = placeTourBubble({ target: rect(20, 100, 40, 20), bubble, viewport });
  assert.deepEqual(below, { left: 16, top: 132, side: 'below' });
  const above = placeTourBubble({ target: rect(300, 700, 60, 40), bubble, viewport });
  assert.deepEqual(above, { left: 74, top: 488, side: 'above' });
});

test('上次放的那一側仍放得下就不換邊，框線移動時不來回跳', () => {
  const viewport = { width: 390, height: 844 };
  const bubble = { width: 300, height: 200 };
  const target = rect(100, 400, 40, 20);
  assert.equal(placeTourBubble({ target, bubble, viewport }).side, 'below');
  assert.equal(placeTourBubble({ target, bubble, viewport, previous: 'above' }).side, 'above');
});

test('上下都放不下時放在空間較大的一側並貼齊視窗邊距；沒有框線時置中', () => {
  const viewport = { width: 390, height: 844 };
  const bubble = { width: 300, height: 200 };
  const tall = placeTourBubble({ target: rect(0, 100, 390, 600), bubble, viewport });
  assert.deepEqual(tall, { left: 45, top: 628, side: 'below' });
  assert.deepEqual(placeTourBubble({ target: null, bubble, viewport }), { left: 45, top: 322, side: 'center' });
});
