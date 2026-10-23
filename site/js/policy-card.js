// 政見卡片：一個議題區內三位候選人的政見並排。表格檢視與島嶼檢視共用，只讀檢視模型的一列（row）。
// 桌面為置中對話框，800px 以下由 CSS 改為可拖成三段的底部抽屜（sheet.js）。畫面文字取自 ui-text.js。

import { el } from './dom.js';
import { bindSheetDialog } from './sheet.js';
import { candidateCountText, DIALOG_TEXT, POLICY_CARD_TEXT as T, SOURCE_TEXT, verificationText } from './ui-text.js';

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const policyHref = (policyId) => `?policy=${encodeURIComponent(policyId)}`;
export const areaHref = (areaId) => `?area=${encodeURIComponent(areaId)}`;

// 出處、原文存檔、網頁備份三個連結，政見卡片與候選人資料卡共用。
export const sourceLinks = (source) => [
  el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, SOURCE_TEXT.link),
  el('a', { href: source.snapshotUrl, target: '_blank' }, SOURCE_TEXT.snapshot),
  source.archiveUrl && el('a', { href: source.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, SOURCE_TEXT.archive),
];

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
      el('span', {}, SOURCE_TEXT.titleWithDate(source.title, source.retrievedAt)),
      el('span', { class: 'source-links' }, sourceLinks(source)),
    ),
  );
}

function policyArticle(policy, focused) {
  const districts = policy.districts.length > 0 ? policy.districts.join('、') : T.noDistricts;
  return el(
    'article',
    { class: `policy${focused ? ' is-focused' : ''}`, id: `card-policy-${policy.id}`, 'aria-current': focused ? 'true' : null },
    el('h4', { class: 'policy-summary' }, policy.summary),
    policy.conflictNote && el('p', { class: 'conflict-note' }, el('strong', {}, T.conflict), policy.conflictNote),
    ...policy.quotes.map(quoteBlock),
    el(
      'dl',
      { class: 'policy-facts' },
      el('dt', {}, T.districts),
      el('dd', {}, districts),
      el('dt', {}, T.verification),
      el('dd', {}, el('span', { class: 'verification-line' }, verificationText(policy.verification))),
    ),
    el('a', { class: 'policy-link', href: policyHref(policy.id) }, T.policyLink),
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
  const closeButton = el('button', { type: 'button', class: 'card-close' }, DIALOG_TEXT.close);
  const shareLink = el('a', { class: 'card-share' }, T.areaLink);
  // 手機抽屜的把手：拖曳在一半、全螢幕、關閉三段之間吸附，點一下在一半與全螢幕之間切換。桌面由 CSS 隱藏。
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': DIALOG_TEXT.handle });
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog policy-card', 'aria-labelledby': 'policy-card-title', 'data-snap': 'half' },
    el(
      'div',
      { class: 'card-inner' },
      handle,
      el('header', { class: 'card-head' }, el('div', {}, title, description, shareLink), closeButton),
      body,
    ),
  );
  bindSheetDialog(dialog, { handle, closeButton, onClose });

  return {
    element: dialog,
    open(row, vm, { focusPolicyId = null } = {}) {
      const { issueArea } = row;
      title.textContent = issueArea.name;
      description.textContent = T.areaDescription(issueArea.description, issueArea.departments);
      shareLink.setAttribute('href', areaHref(issueArea.id));
      body.replaceChildren(
        ...vm.candidates.map((candidate) =>
          candidateColumn(candidate, row.cells.find((cell) => cell.candidateId === candidate.id), vm, focusPolicyId),
        ),
      );
      if (!dialog.open) {
        dialog.dataset.snap = 'half';
        dialog.showModal();
      }
      const focused = focusPolicyId && body.querySelector(`#card-policy-${CSS.escape(focusPolicyId)}`);
      if (focused) focused.scrollIntoView({ block: 'nearest' });
      else body.scrollTop = 0;
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
