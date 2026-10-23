// 島嶼檢視的索引面板：議題區清單、標記圖例與候選人分頁。桌面在畫面右側，800px 以下由 CSS 改為底部抽屜。
// 清單的編號與標記狀態與島上的名牌、標記同樣來自 island-layout.js，不呈現政見數量。

import { el } from './dom.js';
import { NO_MATCH_TEXT } from './filter.js';
import { NO_POLICY_LABEL } from './view-model.js';
import { islandLayout, markerLegend } from './island-layout.js';

function markerBadge(marker, offText) {
  const state = marker.lit ? '有政見' : offText;
  return el(
    'span',
    { class: `marker-badge${marker.lit ? ' is-lit' : ''}`, 'data-candidate': marker.candidateId, 'data-lit': String(marker.lit), title: `${marker.name}：${state}` },
    el('span', { 'aria-hidden': 'true' }, marker.symbol),
    el('span', { class: 'visually-hidden' }, `${marker.name}${state}`),
  );
}

export function renderLegend(container, vm) {
  container.replaceChildren(
    ...markerLegend(vm).map((entry) =>
      el('li', { class: 'legend-item' }, el('span', { class: 'marker-badge is-lit', 'aria-hidden': 'true' }, entry.symbol), entry.name),
    ),
    el('li', { class: 'legend-item legend-note' }, '亮起表示有政見，灰色表示沒有；標記不表示政見多寡。'),
  );
}

// 候選人分頁：三人同尺寸，依排序列出形狀、姓名與政黨。候選人資料卡加入後由資料卡取代。
export function renderCandidateIndex(container, vm) {
  container.replaceChildren(
    ...markerLegend(vm).map((entry) => {
      const candidate = vm.candidates.find((c) => c.id === entry.candidateId);
      return el(
        'li',
        { class: 'candidate-index-item', 'data-candidate': candidate.id },
        el('span', { class: 'marker-badge is-lit', 'aria-hidden': 'true' }, entry.symbol),
        el('span', { class: 'candidate-name' }, candidate.name),
        el('span', { class: 'candidate-meta' }, candidate.party),
      );
    }),
  );
}

// filtered 是篩選後的檢視模型（未篩選時就是 vm）。被篩掉的議題區不列出，其餘議題區保留原編號。
export function renderIslandList(container, vm, filtered, { selectedId, onPick }) {
  const shown = new Set(filtered.rows.map((row) => row.issueArea.id));
  const offText = filtered.filter?.active ? NO_MATCH_TEXT : NO_POLICY_LABEL;
  const items = islandLayout(vm, { filtered })
    .tiles.filter((tile) => tile.kind === 'area' && shown.has(tile.id))
    .map((tile) => {
      const button = el(
        'button',
        { type: 'button', class: 'island-item', 'data-area': tile.id, 'aria-current': tile.id === selectedId ? 'true' : null },
        el('span', { class: 'area-number' }, tile.number),
        el('span', { class: 'island-item-name' }, tile.name),
        el('span', { class: 'island-item-markers' }, tile.markers.map((m) => markerBadge(m, offText))),
      );
      button.addEventListener('click', () => onPick(tile.id));
      return el('li', {}, button);
    });
  container.replaceChildren(...items);
}
