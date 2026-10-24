import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPEAK_ICON } from '../site/js/policy-card.js';

test('朗讀鈕圖示：未播放是喇叭加聲波，播放中換成停止方塊，兩種狀態都有形狀', () => {
  const parts = new Set(SPEAK_ICON.shapes.map((shape) => shape.part));
  assert.deepEqual([...parts].sort(), ['idle', 'playing']);
  assert.ok(SPEAK_ICON.shapes.filter((shape) => shape.part === 'idle').length >= 2, '喇叭與聲波');
  assert.equal(SPEAK_ICON.viewBox, '0 0 24 24');
});

test('朗讀鈕圖示只用內嵌形狀，不引用外部資源、不寫死顏色（顏色跟著按鈕的 CSS 變數）', () => {
  for (const { tag, attrs } of SPEAK_ICON.shapes) {
    assert.ok(['path', 'rect'].includes(tag), tag);
    for (const [key, value] of Object.entries(attrs)) {
      assert.ok(!['fill', 'stroke', 'href', 'style'].includes(key), `${tag} 不得設定 ${key}`);
      assert.doesNotMatch(String(value), /url\(|#|https?:/);
    }
  }
});
