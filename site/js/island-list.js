// 島嶼檢視的索引面板：議題區清單與標記圖例（候選人分頁的候選人資料卡在 candidate-card.js）。桌面在畫面右側，800px 以下由 CSS 改為底部抽屜。
// 清單的編號與標記狀態與島上的名牌、標記同樣來自 island-layout.js，不呈現政見數量。

import { el } from './dom.js';
import { islandLayout, markerLegend } from './island-layout.js';
import { MARKER_TEXT, NO_MATCH_TEXT, NO_POLICY_LABEL } from './ui-text.js';
import { seenMark } from './reading-progress.js';

function markerBadge(marker, offText) {
  const state = marker.lit ? MARKER_TEXT.lit : offText;
  return el(
    'span',
    { class: `marker-badge${marker.lit ? ' is-lit' : ''}`, 'data-candidate': marker.candidateId, 'data-lit': String(marker.lit), title: MARKER_TEXT.state(marker.name, state) },
    el('span', { 'aria-hidden': 'true' }, marker.symbol),
    el('span', { class: 'visually-hidden' }, MARKER_TEXT.spoken(marker.name, state)),
  );
}

export function renderLegend(container, vm) {
  container.replaceChildren(
    ...markerLegend(vm).map((entry) =>
      el('li', { class: 'legend-item' }, el('span', { class: 'marker-badge is-lit', 'aria-hidden': 'true' }, entry.symbol), entry.name),
    ),
    el('li', { class: 'legend-item legend-note' }, MARKER_TEXT.legendNote),
  );
}

// filtered 是篩選後的檢視模型（未篩選時就是 vm）。被篩掉的議題區不列出，其餘議題區保留原編號。
// seen 是讀者看過的議題區識別碼集合（閱讀進度）。
export function renderIslandList(container, vm, filtered, { selectedId, onPick, seen = new Set() }) {
  const shown = new Set(filtered.rows.map((row) => row.issueArea.id));
  const offText = filtered.filter?.active ? NO_MATCH_TEXT : NO_POLICY_LABEL;
  const items = islandLayout(vm, { filtered })
    .tiles.filter((tile) => tile.kind === 'area' && shown.has(tile.id))
    .map((tile) => {
      const button = el(
        'button',
        { type: 'button', class: 'island-item', 'data-area': tile.id, 'aria-current': tile.id === selectedId ? 'true' : null },
        el('span', { class: 'area-number' }, tile.number),
        el('span', { class: 'island-item-name' }, tile.name, seen.has(tile.id) && seenMark()),
        el('span', { class: 'island-item-markers' }, tile.markers.map((m) => markerBadge(m, offText))),
      );
      button.addEventListener('click', () => onPick(tile.id));
      return el('li', {}, button);
    });
  container.replaceChildren(...items);
}
