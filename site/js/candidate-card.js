// 候選人資料卡：中選會公開的姓名、政黨、出生年、學歷、經歷，逐字呈現，不加整理者撰寫的介紹或評語（ADR 0001）。
// 索引面板的「候選人」分頁與對話框（表格欄頭「看候選人資料」、網址 candidate 參數）共用同一張卡片。
// 三張卡片永遠一起排列，由 CSS 讓三張同尺寸；開啟某位候選人只是捲到並標示那一張，不單獨放大。
// profileCardContent 是純函式，Node 可測；其餘只在瀏覽器使用。畫面文字取自 ui-text.js。

import { el } from './dom.js';
import { markerLegend } from './island-layout.js';
import { sourceLinks } from './policy-card.js';
import { bindSheetDialog } from './sheet.js';
import { DIALOG_TEXT, PROFILE_TEXT as T, profileVerificationText, snapshotNoteText, SOURCE_TEXT } from './ui-text.js';

// candidate 是檢視模型的候選人（附 profileSource）。學歷與經歷一項一行，照資料集原樣，不斷句、不合併。
// snapshotNote 是給讀者的白話說明，無需說明時為 null；抓取指令寫的轉換紀錄只留在公開資料集。
export function profileCardContent(candidate) {
  const { profile, profileSource: source } = candidate;
  const base = { candidateId: candidate.id, name: candidate.name, party: candidate.party };
  if (!profile) return { ...base, fields: [], emptyText: T.empty, source: null };
  return {
    ...base,
    fields: [
      { label: T.fields.birthYear, values: [String(profile.birthYear)] },
      { label: T.fields.education, values: profile.education },
      { label: T.fields.experience, values: profile.experience },
    ],
    emptyText: null,
    source: {
      origin: T.origin(source.sourceTypeName, profile.electionYear, profile.electionName),
      title: source.title,
      retrievedAt: source.retrievedAt,
      url: source.url,
      archiveUrl: source.archiveUrl,
      snapshotUrl: source.snapshotUrl,
      snapshotNote: snapshotNoteText(source.snapshotNote),
      verification: profileVerificationText(profile.verification),
    },
  };
}

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const candidateHref = (candidateId) => `?candidate=${encodeURIComponent(candidateId)}`;

function sourceBlock(source) {
  return el(
    'footer',
    { class: 'profile-source' },
    el('p', {}, el('strong', {}, T.sourceLabel), source.origin),
    el('p', {}, SOURCE_TEXT.titleWithDate(source.title, source.retrievedAt)),
    el('p', { class: 'source-links' }, sourceLinks(source)),
    source.snapshotNote && el('p', { class: 'snapshot-note' }, el('strong', {}, T.snapshotNoteLabel), source.snapshotNote),
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
      el('span', { class: 'marker-badge is-lit', title: T.markerTitle, 'aria-hidden': 'true' }, symbol),
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
    el('a', { class: 'policy-link', href: candidateHref(content.candidateId) }, T.cardLink),
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
  const closeButton = el('button', { type: 'button', class: 'card-close' }, DIALOG_TEXT.close);
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': DIALOG_TEXT.handle });
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog candidate-dialog', 'aria-labelledby': 'candidate-dialog-title', 'data-snap': 'half' },
    el(
      'div',
      { class: 'card-inner' },
      handle,
      el('header', { class: 'card-head' }, el('div', {}, el('h2', { class: 'card-title', id: 'candidate-dialog-title' }, T.title), note), closeButton),
      scroller,
    ),
  );
  bindSheetDialog(dialog, { handle, closeButton, onClose });

  return {
    element: dialog,
    // candidateId 須是 vm.candidates 中的候選人，由呼叫端先確認。
    open(vm, candidateId) {
      note.textContent = `${T.note}${vm.candidateOrderNote}。`;
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
