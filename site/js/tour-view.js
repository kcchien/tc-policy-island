// 上手導覽的覆蓋層，只在瀏覽器使用：框線加一個說明框（步數、標題、說明、跳過與下一步）。步驟由 tour.js 的狀態機決定。
// 覆蓋層是 showModal 的對話框，才能疊在政見卡片之上；對話框本身就是說明框，框線是固定定位的子元素，
// 以大範圍陰影壓暗框外。開著時每幀向 targetOf(step) 要框線範圍（視窗座標，null 表示不框），
// 鏡頭飛行、拖曳與視窗縮放時框線與說明框跟著走；說明框移動後呼叫 onMove（名牌重新避讓）。

import { el } from './dom.js';
import { placeTourBubble, TOUR_STEPS } from './tour.js';
import { TOUR_TEXT } from './ui-text.js';

// 框線比目標外擴的像素。
const FRAME_PADDING = 6;

export function createTourView({ targetOf, onNext, onSkip, onMove }) {
  const frame = el('div', { class: 'tour-frame', 'aria-hidden': 'true' });
  const count = el('p', { class: 'tour-count' });
  const title = el('h2', { class: 'tour-title', id: 'tour-title' });
  const body = el('p', { class: 'tour-body', id: 'tour-body' });
  const skip = el('button', { type: 'button', class: 'tour-skip' }, TOUR_TEXT.skip);
  const next = el('button', { type: 'button', class: 'tour-next' });
  const bubble = el('div', { class: 'tour-bubble' }, count, title, body, el('div', { class: 'tour-actions' }, skip, next));
  const dialog = el('dialog', { class: 'tour', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-body' }, frame, bubble);
  skip.addEventListener('click', () => onSkip());
  next.addEventListener('click', () => onNext());
  // Escape 等同跳過。
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    onSkip();
  });

  let step = null;
  let side = null;
  let placed = '';
  let frameId = null;

  const layout = () => {
    frameId = requestAnimationFrame(layout);
    const target = targetOf(step);
    const padded = target && {
      left: target.left - FRAME_PADDING,
      top: target.top - FRAME_PADDING,
      right: target.right + FRAME_PADDING,
      bottom: target.bottom + FRAME_PADDING,
    };
    const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
    frame.classList.toggle('is-empty', !padded);
    const box = padded ?? { left: viewport.width / 2, top: viewport.height / 2, right: viewport.width / 2, bottom: viewport.height / 2 };
    Object.assign(frame.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
    });
    const size = { width: dialog.offsetWidth, height: dialog.offsetHeight };
    const position = placeTourBubble({ target: padded, bubble: size, viewport, previous: side });
    side = position.side;
    const key = `${Math.round(position.left)},${Math.round(position.top)},${size.width},${size.height}`;
    if (key === placed) return;
    placed = key;
    dialog.style.left = `${position.left}px`;
    dialog.style.top = `${position.top}px`;
    onMove?.();
  };

  return {
    element: dialog,
    // 顯示某一步；已開著時只換內容。
    show(nextStep) {
      const index = TOUR_STEPS.indexOf(nextStep);
      step = nextStep;
      side = null;
      count.textContent = TOUR_TEXT.count(index + 1, TOUR_STEPS.length);
      title.textContent = TOUR_TEXT.steps[nextStep].title;
      body.textContent = TOUR_TEXT.steps[nextStep].body;
      // 最後一步只留「開始逛」，跳過與完成的效果相同。
      const last = index === TOUR_STEPS.length - 1;
      next.textContent = last ? TOUR_TEXT.done : TOUR_TEXT.next;
      skip.hidden = last;
      if (!dialog.open) dialog.showModal();
      next.focus();
      if (frameId === null) layout();
    },
    hide() {
      step = null;
      placed = '';
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      if (dialog.open) dialog.close();
    },
    // 其他對話框（政見卡片）開在導覽之後時，重新開一次讓導覽回到最上層。
    raise() {
      if (!dialog.open) return;
      dialog.close();
      dialog.showModal();
      next.focus();
    },
  };
}
