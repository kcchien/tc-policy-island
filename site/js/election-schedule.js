// 選舉時程：公開資料集的 meta.electionSchedule 與「現在」→ 距投票日天數、投票日前後的狀態、依日期排序的事件清單。
// 日期依台灣時間（UTC+8，沒有日光節約時間，與 island-daylight.js 的自動時段同一做法），不看瀏覽者的時區。
// 只讀選舉時程，不讀候選人與政見（ADR 0001）。瀏覽器與 Node 共用，不得引用 node: 模組。

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// now（毫秒時間戳或 Date）在台灣是哪一天，回傳 YYYY-MM-DD。
export const taipeiDate = (now) => new Date(Number(now) + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);

const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

// 事件當天到結束日（沒有結束日就是當天）都算進行中，之後已過，之前未到。
function eventState(event, today) {
  if (today < event.date) return 'upcoming';
  if (today > (event.endDate ?? event.date)) return 'past';
  return 'ongoing';
}

// phase：before 投票日前、voting-day 投票日當天、after 投票日之後（daysLeft 為 null，畫面不再顯示天數）。
// 時程為 null（沒有資料）時回傳 null。
export function scheduleView(schedule, now) {
  if (!schedule) return null;
  const today = taipeiDate(now);
  const diff = dayNumber(schedule.votingDate) - dayNumber(today);
  const phase = diff > 0 ? 'before' : diff === 0 ? 'voting-day' : 'after';
  const events = schedule.events
    .map((event) => ({ ...event, state: eventState(event, today) }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date));
  return { votingDate: schedule.votingDate, phase, daysLeft: phase === 'after' ? null : diff, events };
}
