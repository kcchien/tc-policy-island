import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleView } from '../site/js/election-schedule.js';

const event = (id, date, extra = {}) => ({
  id,
  name: `事件${id}`,
  date,
  endDate: null,
  sourceUrl: `https://web.cec.gov.tw/central/article/${id}`,
  sourceTitle: `公告${id}`,
  ...extra,
});

const schedule = {
  votingDate: '2026-11-28',
  events: [
    event('voting', '2026-11-28'),
    event('presentations', '2026-11-13', { endDate: '2026-11-27' }),
    event('draw', '2026-10-27'),
    event('list', '2026-11-12'),
  ],
};

// 台灣時間某日某時的時間戳（UTC+8）。
const taipei = (date, time = '12:00') => Date.parse(`${date}T${time}:00+08:00`);

test('投票日前：距投票日天數以台灣日期計算', () => {
  assert.equal(scheduleView(schedule, taipei('2026-10-24')).daysLeft, 35);
  assert.equal(scheduleView(schedule, taipei('2026-11-27', '23:59')).daysLeft, 1);
  assert.equal(scheduleView(schedule, taipei('2026-10-24')).phase, 'before');
});

test('投票日當天與之後：天數為 0 或不顯示，狀態改變', () => {
  const day = scheduleView(schedule, taipei('2026-11-28', '00:00'));
  assert.equal(day.phase, 'voting-day');
  assert.equal(day.daysLeft, 0);
  const after = scheduleView(schedule, taipei('2026-11-29', '00:00'));
  assert.equal(after.phase, 'after');
  assert.equal(after.daysLeft, null);
});

test('時區：UTC 前一天 16:00 已是台灣的隔天', () => {
  // 2026-11-27T16:00Z 是台灣 11/28 00:00，投票日當天。
  assert.equal(scheduleView(schedule, Date.parse('2026-11-27T16:00:00Z')).phase, 'voting-day');
  assert.equal(scheduleView(schedule, Date.parse('2026-11-27T15:59:00Z')).phase, 'before');
});

test('事件依日期排序，標示已過、進行中、未到', () => {
  const view = scheduleView(schedule, taipei('2026-11-20'));
  assert.deepEqual(view.events.map((e) => [e.id, e.state]), [
    ['draw', 'past'],
    ['list', 'past'],
    ['presentations', 'ongoing'],
    ['voting', 'upcoming'],
  ]);
});

test('事件當天算進行中，結束日隔天才算已過', () => {
  const states = (date) => Object.fromEntries(scheduleView(schedule, taipei(date)).events.map((e) => [e.id, e.state]));
  assert.equal(states('2026-10-27').draw, 'ongoing');
  assert.equal(states('2026-10-28').draw, 'past');
  assert.equal(states('2026-11-27').presentations, 'ongoing');
  assert.equal(states('2026-11-28').presentations, 'past');
  assert.equal(states('2026-11-12').presentations, 'upcoming');
});

test('沒有時程資料時回傳 null', () => {
  assert.equal(scheduleView(null, taipei('2026-10-24')), null);
});

test('不改動輸入的時程', () => {
  const copy = structuredClone(schedule);
  scheduleView(schedule, taipei('2026-11-20'));
  assert.deepEqual(schedule, copy);
});
