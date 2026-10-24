// 我的對照單的對話框（手機為底部抽屜）：只列出勾選政見所在的議題區，每區三欄依排序規則並排，沒有政見的欄位照常顯示，
// 每條政見附出處連結，被勾的政見標「已勾選」。可列印（main.css 的列印樣式只印這個對話框）與複製帶 pick 參數的網址。
// 列哪些議題區由 shortlist.js 的 shortlistRows 決定；勾選狀態由呼叫端保管。只在瀏覽器使用，畫面文字取自 ui-text.js。

import { el } from './dom.js';
import { bindSheetDialog } from './sheet.js';
import { pickBox } from './policy-card.js';
import { shortlistRows } from './shortlist.js';
import { DIALOG_TEXT, SHORTLIST_TEXT as T } from './ui-text.js';

// 一條政見：勾選框、摘要、每個出處的連結（同一出處只列一次）。
function shortlistPolicy(policy) {
  const sources = [...new Map(policy.quotes.map(({ source }) => [source.url, source])).values()];
  return el(
    'li',
    { class: `shortlist-policy${policy.picked ? ' is-picked' : ''}` },
    el('p', { class: 'shortlist-summary' }, policy.summary),
    el(
      'p',
      { class: 'shortlist-meta' },
      pickBox(policy.id, policy.picked),
      policy.picked && el('span', { class: 'shortlist-picked' }, T.picked),
      sources.map((source, index) =>
        el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, T.sourceLink(index, sources.length))),
    ),
  );
}

function shortlistArea(row, vm) {
  return el(
    'section',
    { class: 'shortlist-area', 'aria-label': row.issueArea.name },
    el('h3', { class: 'shortlist-area-title' }, el('span', { class: 'area-number' }, row.number), row.issueArea.name),
    el(
      'div',
      { class: 'shortlist-columns' },
      vm.candidates.map((candidate) => {
        const cell = row.cells.find((c) => c.candidateId === candidate.id);
        return el(
          'div',
          { class: 'shortlist-column' },
          el('h4', { class: 'candidate-name' }, candidate.name),
          cell.policies.length === 0
            ? el('p', { class: 'no-policy' }, vm.noPolicyText)
            : el('ul', { class: 'shortlist-policies' }, cell.policies.map(shortlistPolicy)),
        );
      }),
    ),
  );
}

// onPick(policyId, checked) 在對照單裡取消或重新勾選時呼叫；呼叫端更新勾選後再呼叫 open 重畫。
export function createShortlistDialog({ onClose = () => {}, onPick = () => {} } = {}) {
  const note = el('p', { class: 'card-description' }, T.note);
  const body = el('div', { class: 'shortlist-body' });
  const footer = el('p', { class: 'shortlist-footer' });
  const status = el('span', { class: 'policy-action-status', role: 'status' });
  const printButton = el('button', { type: 'button', class: 'shortlist-action' }, T.print);
  const copyButton = el('button', { type: 'button', class: 'shortlist-action' }, T.copyLink);
  const closeButton = el('button', { type: 'button', class: 'card-close shortlist-close' }, DIALOG_TEXT.close);
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': DIALOG_TEXT.handle });
  const actions = el('div', { class: 'card-actions shortlist-actions' }, status, printButton, copyButton, closeButton);
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog shortlist-dialog', 'aria-labelledby': 'shortlist-title', 'data-snap': 'half' },
    el(
      'div',
      { class: 'card-inner' },
      handle,
      el('header', { class: 'card-head' }, el('div', {}, el('h2', { class: 'card-title', id: 'shortlist-title' }, T.title), note), actions),
      el('div', { class: 'card-body' }, body, footer),
    ),
  );
  bindSheetDialog(dialog, { handle, closeButton, onClose });

  let link = '';
  printButton.addEventListener('click', () => window.print());
  // 複製網址：剪貼簿不能用時在提示列放出網址並選取，讓讀者自己複製。
  copyButton.addEventListener('click', async () => {
    actions.querySelector('.shortlist-link')?.remove();
    try {
      await navigator.clipboard.writeText(link);
      status.textContent = T.copied;
      setTimeout(() => {
        if (status.textContent === T.copied) status.textContent = '';
      }, 2000);
    } catch {
      status.textContent = T.copyFailed;
      const fallback = el('input', { class: 'shortlist-link', readonly: true, value: link });
      actions.prepend(fallback);
      fallback.select();
    }
  });
  body.addEventListener('change', (event) => {
    const box = event.target.closest('[data-pick]');
    if (box) onPick(box.dataset.pick, box.checked);
  });

  return {
    element: dialog,
    // picks 是勾選的政見識別碼集合；url 是帶 pick 參數的分享網址。
    open(vm, picks, url) {
      link = url;
      const rows = shortlistRows(vm, picks);
      body.replaceChildren(...(rows.length > 0 ? rows.map((row) => shortlistArea(row, vm)) : [el('p', { class: 'no-policy' }, T.empty)]));
      footer.textContent = T.footer(vm.meta.dataCutoffDate, url);
      printButton.disabled = rows.length === 0;
      copyButton.disabled = rows.length === 0;
      if (!dialog.open) {
        dialog.dataset.snap = 'full';
        dialog.showModal();
      }
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
