// 政見卡片：一個議題區內三位候選人的政見並排。表格檢視與島嶼檢視共用，只讀檢視模型的一列（row）。
// 桌面為置中對話框，800px 以下由 CSS 改為底部抽屜。

import { el } from './dom.js';

const STATUS_TEXT = { pending: '未核對', pass: '通過', fail: '不通過' };

export function verificationText({ layer1, layer2 }) {
  return [
    `第一層 逐字比對：${STATUS_TEXT[layer1.status]}${layer1.checkedAt ? `（${layer1.checkedAt}）` : ''}`,
    `第二層 檢核表${layer2.checklistVersion ? `（版本 ${layer2.checklistVersion}）` : ''}：${STATUS_TEXT[layer2.status]}` +
      (layer2.checkedAt ? `（${layer2.model}，${layer2.checkedAt}）` : ''),
  ];
}

export const rawPolicyItemsText = ({ total }) => (total === null ? '原始政見條目尚未統計' : `原始政見條目共 ${total} 項`);

export function candidateCountText(areaPolicyCount, rawPolicyItems) {
  return `此議題區 ${areaPolicyCount} 筆政見，${rawPolicyItemsText(rawPolicyItems)}`;
}

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const policyHref = (policyId) => `?policy=${encodeURIComponent(policyId)}`;
export const areaHref = (areaId) => `?area=${encodeURIComponent(areaId)}`;

function quoteBlock(quote) {
  const { source } = quote;
  return el(
    'figure',
    { class: 'quote' },
    el('blockquote', { class: 'quote-text', cite: source.url }, quote.text),
    el(
      'figcaption',
      { class: 'quote-source' },
      el('span', { class: 'source-type' }, source.sourceTypeName),
      el('span', {}, `${source.title}（${source.retrievedAt} 擷取）`),
      el(
        'span',
        { class: 'source-links' },
        el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, '出處'),
        el('a', { href: source.snapshotUrl, target: '_blank' }, '出處快照'),
        source.archiveUrl && el('a', { href: source.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, '存檔網址'),
      ),
    ),
  );
}

function policyArticle(policy, focused) {
  const districts = policy.districts.length > 0 ? policy.districts.join('、') : '未指定';
  return el(
    'article',
    { class: `policy${focused ? ' is-focused' : ''}`, id: `card-policy-${policy.id}`, 'aria-current': focused ? 'true' : null },
    el('h4', { class: 'policy-summary' }, policy.summary),
    policy.conflictNote && el('p', { class: 'conflict-note' }, el('strong', {}, '出處說法不一：'), policy.conflictNote),
    ...policy.quotes.map(quoteBlock),
    el(
      'dl',
      { class: 'policy-facts' },
      el('dt', {}, '適用行政區'),
      el('dd', {}, districts),
      el('dt', {}, '核對紀錄'),
      el('dd', {}, ...verificationText(policy.verification).map((line) => el('span', { class: 'verification-line' }, line))),
    ),
    el('a', { class: 'policy-link', href: policyHref(policy.id) }, '這筆政見的連結'),
  );
}

function candidateColumn(candidate, cell, vm, focusPolicyId) {
  return el(
    'section',
    { class: 'card-column', 'aria-label': candidate.name },
    el(
      'header',
      { class: 'card-column-head' },
      el('h3', { class: 'candidate-name' }, candidate.name),
      el('p', { class: 'candidate-meta' }, candidate.party),
      el('p', { class: 'candidate-meta' }, candidateCountText(cell.policies.length, candidate.rawPolicyItems)),
    ),
    // 資料狀態說明放在欄標題下方，三欄標題的高度才一致。
    candidate.dataStatus && el('p', { class: 'data-status' }, candidate.dataStatus),
    cell.policies.length === 0
      ? el('p', { class: 'no-policy' }, vm.noPolicyText)
      : cell.policies.map((policy) => policyArticle(policy, policy.id === focusPolicyId)),
  );
}

// 回傳卡片控制器。onClose 在使用者關閉卡片後呼叫（例如清掉網址參數）。
export function createPolicyCard({ onClose = () => {} } = {}) {
  const title = el('h2', { class: 'card-title', id: 'policy-card-title' });
  const description = el('p', { class: 'card-description' });
  const body = el('div', { class: 'card-columns' });
  const closeButton = el('button', { type: 'button', class: 'card-close' }, '關閉');
  const shareLink = el('a', { class: 'card-share' }, '這個議題區的連結');
  const dialog = el(
    'dialog',
    { class: 'policy-card', 'aria-labelledby': 'policy-card-title' },
    el(
      'div',
      { class: 'card-inner' },
      el('header', { class: 'card-head' }, el('div', {}, title, description, shareLink), closeButton),
      body,
    ),
  );
  closeButton.addEventListener('click', () => dialog.close());
  // 點對話框外的遮罩關閉。
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => onClose());

  return {
    element: dialog,
    open(row, vm, { focusPolicyId = null } = {}) {
      const { issueArea } = row;
      title.textContent = issueArea.name;
      description.textContent = `${issueArea.description}（對應局處：${issueArea.departments.join('、')}）`;
      shareLink.setAttribute('href', areaHref(issueArea.id));
      body.replaceChildren(
        ...vm.candidates.map((candidate) =>
          candidateColumn(candidate, row.cells.find((cell) => cell.candidateId === candidate.id), vm, focusPolicyId),
        ),
      );
      if (!dialog.open) dialog.showModal();
      const focused = focusPolicyId && body.querySelector(`#card-policy-${CSS.escape(focusPolicyId)}`);
      if (focused) focused.scrollIntoView({ block: 'nearest' });
      else body.scrollTop = 0;
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
