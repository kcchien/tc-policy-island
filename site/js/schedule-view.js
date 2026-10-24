// 頁首的選舉時程列：把 election-schedule.js 的 scheduleView 結果畫進 index.html 的 #election-schedule。
// 桌面的表格檢視一行列出全部日期；島嶼檢視與手機只顯示天數，按下展開日期清單（CSS 依版面切換）。
// 每個日期連到中選會或選舉委員會的公告。只讀選舉時程，不讀候選人與政見。只在瀏覽器使用。

import { el } from './dom.js';
import { SCHEDULE_TEXT } from './ui-text.js';

function headline(view) {
  if (view.phase === 'before') return SCHEDULE_TEXT.countdown(view.daysLeft);
  return view.phase === 'voting-day' ? SCHEDULE_TEXT.votingDay : SCHEDULE_TEXT.ended;
}

function eventItem(event) {
  const state = SCHEDULE_TEXT.states[event.state];
  return el(
    'li',
    { class: 'schedule-event', 'data-state': event.state },
    el('span', { class: 'schedule-name' }, event.name),
    el(
      'a',
      { class: 'schedule-date', href: event.sourceUrl, title: event.sourceTitle, target: '_blank', rel: 'noopener' },
      SCHEDULE_TEXT.eventDate(event),
      el('span', { class: 'visually-hidden' }, SCHEDULE_TEXT.announcement),
    ),
    state ? el('span', { class: 'schedule-state' }, state) : null,
  );
}

// view 為 null（沒有時程資料）時整列隱藏。
export function renderSchedule(root, view) {
  root.hidden = view === null;
  if (view === null) return;
  root.dataset.phase = view.phase;
  for (const node of root.querySelectorAll('[data-schedule-headline]')) node.textContent = headline(view);
  root.querySelector('.schedule-list').replaceChildren(...view.events.map(eventItem));
  root.querySelector('.schedule-note').textContent = SCHEDULE_TEXT.note;
}

// 展開鈕：只在島嶼檢視與手機出現。onToggle 在展開或收合後呼叫（島嶼檢視重排名牌）。
export function setupScheduleToggle(root, { onToggle = () => {} } = {}) {
  const toggle = root.querySelector('.schedule-toggle');
  toggle.title = SCHEDULE_TEXT.label;
  toggle.addEventListener('click', () => {
    toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true'));
    onToggle();
  });
}
