// 候選人資料卡：中選會公開的姓名、政黨、出生年、學歷、經歷，逐字呈現，不加整理者撰寫的介紹或評語（ADR 0001）。
// 索引面板的「候選人」分頁與對話框（表格欄頭「看候選人資料」、網址 candidate 參數）共用同一張卡片。
// 三張卡片永遠一起排列，由 CSS 讓三張同尺寸；開啟某位候選人只是捲到並標示那一張，不單獨放大。
// profileCardContent 是純函式，Node 可測；其餘只在瀏覽器使用。

import { el } from './dom.js';
import { markerLegend } from './island-layout.js';
import { layer1StatusText } from './policy-card.js';
import { bindSheetDialog } from './sheet.js';

export const NO_PROFILE_TEXT = '尚未收錄候選人資料';
// 索引分頁與對話框共用的說明文字。
export const PROFILE_NOTE = '中選會公開資料，逐字呈現。';

// candidate 是檢視模型的候選人（附 profileSource）。學歷與經歷一項一行，照資料集原樣，不斷句、不合併。
export function profileCardContent(candidate) {
  const { profile, profileSource: source } = candidate;
  const base = { candidateId: candidate.id, name: candidate.name, party: candidate.party };
  if (!profile) return { ...base, fields: [], emptyText: NO_PROFILE_TEXT, source: null };
  return {
    ...base,
    fields: [
      { label: '出生年', values: [String(profile.birthYear)] },
      { label: '學歷', values: profile.education },
      { label: '經歷', values: profile.experience },
    ],
    emptyText: null,
    source: {
      origin: `中選會${source.sourceTypeName}，${profile.electionYear} 年${profile.electionName}`,
      title: source.title,
      retrievedAt: source.retrievedAt,
      url: source.url,
      archiveUrl: source.archiveUrl,
      snapshotUrl: source.snapshotUrl,
      snapshotNote: source.snapshotNote,
      verification: `逐字比對：${layer1StatusText(profile.verification.layer1)}`,
    },
  };
}

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const candidateHref = (candidateId) => `?candidate=${encodeURIComponent(candidateId)}`;

function sourceBlock(source) {
  return el(
    'footer',
    { class: 'profile-source' },
    el('p', {}, el('strong', {}, '資料來源：'), source.origin),
    el('p', {}, `${source.title}（${source.retrievedAt} 擷取）`),
    el(
      'p',
      { class: 'source-links' },
      el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, '出處'),
      el('a', { href: source.snapshotUrl, target: '_blank' }, '出處快照'),
      source.archiveUrl && el('a', { href: source.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, '存檔網址'),
    ),
    source.snapshotNote && el('p', { class: 'snapshot-note' }, el('strong', {}, '出處快照說明：'), source.snapshotNote),
    el('p', {}, source.verification),
  );
}

// idPrefix 區分同一頁上的兩組卡片（索引分頁與對話框），讓 id 不重複。symbol 是島上標記的形狀。
function profileCard(content, { idPrefix, focused, symbol }) {
  const titleId = `${idPrefix}-${content.candidateId}-name`;
  return el(
    'article',
    {
      class: `profile-card${focused ? ' is-focused' : ''}`,
      id: `${idPrefix}-${content.candidateId}`,
      'data-candidate': content.candidateId,
      'aria-labelledby': titleId,
      'aria-current': focused ? 'true' : null,
    },
    el(
      'header',
      { class: 'profile-head' },
      el('span', { class: 'marker-badge is-lit', title: '島上標記', 'aria-hidden': 'true' }, symbol),
      el('h3', { class: 'candidate-name', id: titleId }, content.name),
      el('p', { class: 'candidate-meta' }, content.party),
    ),
    content.emptyText
      ? el('p', { class: 'no-policy' }, content.emptyText)
      : el(
        'dl',
        { class: 'profile-fields' },
        content.fields.flatMap((field) => [
          el('dt', {}, field.label),
          el('dd', {}, field.values.length === 1 ? field.values[0] : el('ul', { class: 'profile-list' }, field.values.map((v) => el('li', {}, v)))),
        ]),
      ),
    content.source && sourceBlock(content.source),
    el('a', { class: 'policy-link', href: candidateHref(content.candidateId) }, '這張候選人資料卡的連結'),
  );
}

// 依檢視模型的候選人順序（排序規則）放三張卡片。
export function renderProfileCards(container, vm, { idPrefix, focusId = null }) {
  const symbols = new Map(markerLegend(vm).map((entry) => [entry.candidateId, entry.symbol]));
  container.replaceChildren(
    ...vm.candidates.map((candidate) =>
      profileCard(profileCardContent(candidate), { idPrefix, focused: candidate.id === focusId, symbol: symbols.get(candidate.id) })),
  );
}

// 回傳對話框控制器：open(vm, candidateId) 開啟並捲到該候選人的卡片，不回傳值。桌面為置中對話框，800px 以下為底部抽屜。
export function createCandidateDialog({ onClose = () => {} } = {}) {
  const note = el('p', { class: 'card-description' });
  // 捲動放在外層，內層格線的高度才不受限，三張卡片能撐成同一高度。
  const body = el('div', { class: 'profile-cards' });
  const scroller = el('div', { class: 'card-body' }, body);
  const closeButton = el('button', { type: 'button', class: 'card-close' }, '關閉');
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': '切換卡片高度' });
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog candidate-dialog', 'aria-labelledby': 'candidate-dialog-title', 'data-snap': 'half' },
    el(
      'div',
      { class: 'card-inner' },
      handle,
      el('header', { class: 'card-head' }, el('div', {}, el('h2', { class: 'card-title', id: 'candidate-dialog-title' }, '候選人資料'), note), closeButton),
      scroller,
    ),
  );
  bindSheetDialog(dialog, { handle, closeButton, onClose });

  return {
    element: dialog,
    // candidateId 須是 vm.candidates 中的候選人，由呼叫端先確認。
    open(vm, candidateId) {
      note.textContent = `${PROFILE_NOTE}${vm.candidateOrderNote}。`;
      renderProfileCards(body, vm, { idPrefix: 'dialog-profile', focusId: candidateId });
      if (!dialog.open) {
        dialog.dataset.snap = 'half';
        dialog.showModal();
      }
      body.querySelector('.profile-card.is-focused').scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
