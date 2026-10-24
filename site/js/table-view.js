// 表格檢視：議題區 × 候選人。只讀檢視模型（可為 filterViewModel 篩選後的版本），不直接碰公開資料集。
// 800px 以下由 CSS 改為單欄，所以每個元素明確標上 ARIA 表格角色，避免 display 改變後失去表格語意。
// 每格的候選人名稱只在單欄時顯示，對螢幕閱讀器隱藏（欄標題已提供）。

import { el } from './dom.js';
import { NO_MATCH_TEXT, rawPolicyItemsText, TABLE_TEXT as T } from './ui-text.js';
import { seenMark } from './reading-progress.js';

function candidateButton(candidate, label, onOpenCandidate) {
  const button = el('button', { type: 'button', class: 'area-open candidate-open' }, label);
  button.addEventListener('click', () => onOpenCandidate(candidate.id));
  return button;
}

function candidateHeader(candidate, onOpenCandidate) {
  const button = candidateButton(candidate, T.openProfile, onOpenCandidate);
  const meta = [
    candidate.party,
    candidate.ballotNumber === null ? null : T.ballotNumber(candidate.ballotNumber),
    T.policyCount(candidate.policyCount),
    rawPolicyItemsText(candidate.rawPolicyItems),
  ].filter(Boolean);
  return el(
    'th',
    { scope: 'col', role: 'columnheader', class: 'candidate-col' },
    el('span', { class: 'candidate-name' }, candidate.name),
    ...meta.map((text) => el('span', { class: 'candidate-meta' }, text)),
    // 按鈕放在資料狀態說明之前，三欄的按鈕才會在同一高度。
    button,
    candidate.dataStatus && el('span', { class: 'data-status' }, candidate.dataStatus),
  );
}

function policyCell(cell, candidate, { noPolicyText, openPolicy }) {
  const label = el(
    'span',
    { class: 'cell-candidate', 'aria-hidden': 'true' },
    candidate.name,
    candidate.dataStatus && el('span', { class: 'data-status' }, candidate.dataStatus),
  );
  if (cell.policies.length === 0) {
    const text = cell.status === 'no-matches' ? NO_MATCH_TEXT : noPolicyText;
    return el('td', { role: 'cell', class: 'policy-cell' }, label, el('p', { class: 'no-policy' }, text));
  }
  return el(
    'td',
    { role: 'cell', class: 'policy-cell' },
    label,
    el(
      'ul',
      { class: 'policy-list' },
      cell.policies.map((policy) => {
        const button = el('button', { type: 'button', class: 'policy-chip' }, el('span', { class: 'chip-summary' }, policy.summary));
        if (policy.districts.length > 0) {
          button.append(el('span', { class: 'chip-districts' }, T.districts(policy.districts)));
        }
        // 兩說並列：與政見卡片同一個標籤，三人同樣式。
        if (policy.conflictNote) button.append(el('span', { class: 'policy-flag' }, T.conflictFlag));
        button.addEventListener('click', () => openPolicy(policy.id));
        return el('li', {}, button);
      }),
    ),
  );
}

function areaHeader(row, onOpenCard, seen) {
  const button = el('button', { type: 'button', class: 'area-open' }, T.openCard);
  button.addEventListener('click', () => onOpenCard(row.issueArea.id, null));
  return el(
    'th',
    { scope: 'row', role: 'rowheader', class: 'area-cell' },
    el('span', { class: 'area-name' }, el('span', { class: 'area-number' }, row.number), row.issueArea.name, seen.has(row.issueArea.id) && seenMark()),
    el('span', { class: 'area-departments' }, row.issueArea.departments.join('、')),
    button,
  );
}

// 800px 以下欄標題隱藏，改由表格上方這排同尺寸按鈕開候選人資料卡；桌面由 CSS 隱藏。
function candidateStrip(candidates, onOpenCandidate) {
  return el(
    'nav',
    { class: 'candidate-strip', 'aria-label': T.openProfile },
    el('span', { class: 'candidate-strip-label' }, T.openProfile),
    el('span', { class: 'candidate-strip-buttons' }, candidates.map((candidate) => candidateButton(candidate, candidate.name, onOpenCandidate))),
  );
}

// onOpenCard(areaId, policyId) 開政見卡片；onOpenCandidate(candidateId) 開候選人資料卡。
// seen 是讀者看過的議題區識別碼集合（閱讀進度），議題區名稱旁打淡勾。
export function renderTable(container, vm, { onOpenCard, onOpenCandidate, seen = new Set() }) {
  const strip = candidateStrip(vm.candidates, onOpenCandidate);
  if (vm.rows.length === 0) {
    container.replaceChildren(strip, el('p', { class: 'empty-result' }, NO_MATCH_TEXT));
    return;
  }
  const table = el(
    'table',
    { class: 'policy-table', role: 'table', 'aria-describedby': 'candidate-order-note' },
    el('caption', { class: 'visually-hidden' }, T.caption),
    el('colgroup', {}, el('col', { class: 'area-col' }), vm.candidates.map(() => el('col', { class: 'candidate-col' }))),
    el(
      'thead',
      { role: 'rowgroup' },
      el('tr', { role: 'row' }, el('th', { scope: 'col', role: 'columnheader' }, T.areaHead), vm.candidates.map((candidate) => candidateHeader(candidate, onOpenCandidate))),
    ),
    el(
      'tbody',
      { role: 'rowgroup' },
      vm.rows.map((row) =>
        el(
          'tr',
          { role: 'row', id: `area-${row.issueArea.id}`, class: 'area-row' },
          areaHeader(row, onOpenCard, seen),
          // 依欄標題的候選人順序取格子，不靠陣列位置對應。
          vm.candidates.map((candidate) =>
            policyCell(row.cells.find((cell) => cell.candidateId === candidate.id), candidate, {
              noPolicyText: vm.noPolicyText,
              openPolicy: (policyId) => onOpenCard(row.issueArea.id, policyId),
            }),
          ),
        ),
      ),
    ),
  );
  container.replaceChildren(strip, table);
}
