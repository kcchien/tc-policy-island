// 表格檢視（陽春版）：只讀檢視模型，不直接碰公開資料集。設計與互動由表格檢視的票負責。

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function candidateHeader(candidate) {
  const total = candidate.rawPolicyItems.total;
  const meta = [
    candidate.party,
    candidate.ballotNumber === null ? null : `${candidate.ballotNumber} 號`,
    `公開政見 ${candidate.policyCount} 筆`,
    `原始政見條目 ${total === null ? '尚未統計' : `${total} 項`}`,
    candidate.dataStatus,
  ].filter(Boolean);
  return el(
    'th',
    { scope: 'col' },
    el('span', { class: 'candidate-name' }, candidate.name),
    ...meta.map((text) => el('span', { class: 'candidate-meta' }, text)),
  );
}

function policyCell(cell, noPolicyText) {
  if (cell.status === 'no-policies') return el('td', {}, el('span', { class: 'no-policy' }, noPolicyText));
  return el('td', {}, el('ul', { class: 'policy-list' }, ...cell.policies.map((p) => el('li', {}, p.summary))));
}

export function renderTable(container, vm) {
  const table = el(
    'table',
    { class: 'policy-table' },
    el('caption', { class: 'order-note' }, vm.candidateOrderNote),
    el(
      'colgroup',
      {},
      el('col', { class: 'area-col' }),
      ...vm.candidates.map(() => el('col', {})),
    ),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '議題區'), ...vm.candidates.map(candidateHeader))),
    el(
      'tbody',
      {},
      ...vm.rows.map((row) =>
        el(
          'tr',
          { id: `area-${row.issueArea.id}` },
          el('th', { scope: 'row' }, row.issueArea.name),
          ...row.cells.map((cell) => policyCell(cell, vm.noPolicyText)),
        ),
      ),
    ),
  );
  container.replaceChildren(el('div', { class: 'table-scroll' }, table));
}
