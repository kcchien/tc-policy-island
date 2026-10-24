// 手機底部抽屜的拖曳：把手往上拖變高、往下拖變矮，放開時吸附到三段之一（約一半、全螢幕、關閉）。
// snapSheet 是純函式，Node 可測；bindSheetDrag 與卡片對話框共用的行為 bindSheetDialog 只在瀏覽器使用。

export const SHEET_SNAPS = ['half', 'full'];
// 吸附門檻（占可視高度的比例）。
const FULL_AT = 0.6;
const CLOSE_BELOW = 0.25;
// 位移在這個像素內算點一下。
const TAP_SLOP = 6;

// from 是拖曳前的段落，fraction 是放開時抽屜高度占可視高度的比例，moved 表示有沒有拖動。
export function snapSheet({ from, fraction, moved }) {
  if (!moved) return from === 'full' ? 'half' : 'full';
  if (fraction >= FULL_AT) return 'full';
  if (fraction < CLOSE_BELOW) return 'closed';
  return 'half';
}

// handle 是把手，sheet 是抽屜本體（高度由 CSS 依 data-snap 決定）。
// 拖曳中暫時用行內高度跟著手指，放開後移除，交給 CSS 的段落高度；onSnap(snap) 收到 half、full 或 closed。
export function bindSheetDrag(handle, sheet, { onSnap }) {
  let drag = null;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, startY: event.clientY, startHeight: sheet.getBoundingClientRect().height, moved: false };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dy = drag.startY - event.clientY;
    if (Math.abs(dy) > TAP_SLOP) drag.moved = true;
    if (!drag.moved) return;
    const height = Math.min(window.innerHeight, Math.max(0, drag.startHeight + dy));
    sheet.style.height = `${height}px`;
    sheet.classList.add('is-dragging');
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const fraction = sheet.getBoundingClientRect().height / window.innerHeight;
    const from = sheet.dataset.snap;
    const { moved } = drag;
    drag = null;
    sheet.style.removeProperty('height');
    sheet.classList.remove('is-dragging');
    onSnap(event.type === 'pointercancel' ? from : snapSheet({ from, fraction, moved }));
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// 政見卡片與候選人資料卡共用的對話框行為：把手拖曳與鍵盤切換、關閉鈕、點遮罩關閉；onClose 在對話框關閉後呼叫。
export function bindSheetDialog(dialog, { handle, closeButton, onClose }) {
  const snapTo = (snap) => {
    if (snap === 'closed') dialog.close();
    else dialog.dataset.snap = snap;
  };
  bindSheetDrag(handle, dialog, { onSnap: snapTo });
  // 觸控與滑鼠由 bindSheetDrag 處理；鍵盤操作的 click（detail 為 0）在這裡切換。
  handle.addEventListener('click', (event) => {
    if (event.detail === 0) snapTo(snapSheet({ from: dialog.dataset.snap, fraction: 0, moved: false }));
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => onClose());
}
