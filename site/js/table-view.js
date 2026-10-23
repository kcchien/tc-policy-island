// 表格檢視：議題區 × 候選人。只讀檢視模型（可為 filterViewModel 篩選後的版本），不直接碰公開資料集。
// 800px 以下由 CSS 改為單欄，所以每個元素明確標上 ARIA 表格角色，避免 display 改變後失去表格語意。
// 每格的候選人名稱只在單欄時顯示，對螢幕閱讀器隱藏（欄標題已提供）。

import { el } from './dom.js';
import { NO_MATCH_TEXT } from './filter.js';

function candidateHeader(candidate) {
  const total = candidate.rawPolicyItems.total;
  const meta = [
    candidate.party,
    candidate.ballotNumber === null ? null : `${candidate.ballotNumber} 號`,
    `公開政見 ${candidate.policyCount} 筆`,
    `原始政見條目 ${total === null ? '尚未統計' : `${total} 項`}`,
  ].filter(Boolean);
  return el(
    'th',
    { scope: 'col', role: 'columnheader', class: 'candidate-col' },
    el('span', { class: 'candidate-name' }, candidate.name),
    ...meta.map((text) => el('span', { class: 'candidate-meta' }, text)),
    candidate.dataStatus && el('span', { class: 'data-status' }, candidate.dataStatus),
  );
}

function policyCell(cell, candidate, row, vm, onOpenCard) {
  const label = el(
    'span',
    { class: 'cell-candidate', 'aria-hidden': 'true' },
    candidate.name,
    candidate.dataStatus && el('span', { class: 'data-status' }, candidate.dataStatus),
  );
  if (cell.policies.length === 0) {
    const text = cell.status === 'no-matches' ? NO_MATCH_TEXT : vm.noPolicyText;
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
          button.append(el('span', { class: 'chip-districts' }, `適用行政區：${policy.districts.join('、')}`));
        }
        button.addEventListener('click', () => onOpenCard(row.issueArea.id, policy.id));
        return el('li', {}, button);
      }),
    ),
  );
}

function areaHeader(row, onOpenCard) {
  const button = el('button', { type: 'button', class: 'area-open' }, '看政見卡片');
  button.addEventListener('click', () => onOpenCard(row.issueArea.id, null));
  return el(
    'th',
    { scope: 'row', role: 'rowheader', class: 'area-cell' },
    el('span', { class: 'area-name' }, row.issueArea.name),
    el('span', { class: 'area-departments' }, row.issueArea.departments.join('、')),
    button,
  );
}

export function renderTable(container, vm, { onOpenCard }) {
  if (vm.rows.length === 0) {
    container.replaceChildren(el('p', { class: 'empty-result' }, NO_MATCH_TEXT));
    return;
  }
  const table = el(
    'table',
    { class: 'policy-table', role: 'table', 'aria-describedby': 'candidate-order-note' },
    el('caption', { class: 'visually-hidden' }, '各議題區候選人政見對照表'),
    el('colgroup', {}, el('col', { class: 'area-col' }), vm.candidates.map(() => el('col', { class: 'candidate-col' }))),
    el(
      'thead',
      { role: 'rowgroup' },
      el('tr', { role: 'row' }, el('th', { scope: 'col', role: 'columnheader' }, '議題區'), vm.candidates.map(candidateHeader)),
    ),
    el(
      'tbody',
      { role: 'rowgroup' },
      vm.rows.map((row) =>
        el(
          'tr',
          { role: 'row', id: `area-${row.issueArea.id}`, class: 'area-row' },
          areaHeader(row, onOpenCard),
          row.cells.map((cell, index) => policyCell(cell, vm.candidates[index], row, vm, onOpenCard)),
        ),
      ),
    ),
  );
  container.replaceChildren(table);
}
