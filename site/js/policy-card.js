// 政見卡片：一個議題區內三位候選人的政見並排。表格檢視與島嶼檢視共用，只讀檢視模型的一列（row）。
// 桌面島嶼檢視停靠在畫布下方、可一鍵展開成全高；800px 以下由 CSS 改為可拖成三段的底部抽屜（sheet.js），
// 三位候選人改為同尺寸的分頁切換。三欄各自捲動，欄頭固定在欄頂；每筆政見預設只顯示摘要與適用行政區，點開才顯示原文與核對紀錄。

import { el } from './dom.js';
import { bindSheetDialog } from './sheet.js';
import { NO_MATCH_TEXT, policyMatcher } from './filter.js';
import { TAICHUNG_DISTRICTS } from './dataset.js';

const STATUS_TEXT = { pending: '未核對', pass: '通過', fail: '不通過' };

// 第一層（逐字比對）的結果與日期，政見卡片與候選人資料卡共用。
export const layer1StatusText = ({ status, checkedAt }) => `${STATUS_TEXT[status]}${checkedAt ? `（${checkedAt}）` : ''}`;

export function verificationText({ layer1, layer2 }) {
  return [
    `第一層 逐字比對：${layer1StatusText(layer1)}`,
    `第二層 檢核表${layer2.checklistVersion ? `（版本 ${layer2.checklistVersion}）` : ''}：${STATUS_TEXT[layer2.status]}` +
      (layer2.checkedAt ? `（${layer2.model}，${layer2.checkedAt}）` : ''),
  ];
}

export const rawPolicyItemsText = ({ total }) => (total === null ? '原始政見條目尚未統計' : `原始政見條目共 ${total} 項`);

export function candidateCountText(areaPolicyCount, rawPolicyItems) {
  return `此議題區 ${areaPolicyCount} 筆政見，${rawPolicyItemsText(rawPolicyItems)}`;
}

// 卡片內篩選時欄頭的第二行，三欄同一句型。
export const columnMatchText = (matchCount) => `符合篩選條件 ${matchCount} 筆`;

export function cardFilterStatusText({ active, matchCount }) {
  if (!active) return '';
  if (matchCount === 0) return '這個議題區沒有符合篩選條件的政見。';
  return `這個議題區符合篩選條件的政見共 ${matchCount} 筆。`;
}

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const policyHref = (policyId) => `?policy=${encodeURIComponent(policyId)}`;
export const areaHref = (areaId) => `?area=${encodeURIComponent(areaId)}`;

const EXPAND_TEXT = { false: '全部展開', true: '全部收合' };
// 桌面島嶼檢視的卡片高度：停靠在下方（上方留給島）或放大成全高。
const HEIGHT_TEXT = { false: '放大卡片', true: '縮小卡片' };

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

// 一筆政見：摘要列（摘要、適用行政區、出處說法不一的提示）可點開，展開後才是原文引述、出處與核對紀錄。
function policyArticle(policy, { focused, open }) {
  const districts = policy.districts.length > 0 ? policy.districts.join('、') : '未指定';
  return el(
    'article',
    { class: `policy${focused ? ' is-focused' : ''}`, id: `card-policy-${policy.id}`, 'aria-current': focused ? 'true' : null },
    el(
      'details',
      { class: 'policy-details', open: open || focused },
      el(
        'summary',
        { class: 'policy-head' },
        el('h4', { class: 'policy-summary' }, policy.summary),
        el(
          'span',
          { class: 'policy-tags' },
          el('span', { class: 'policy-districts' }, `適用行政區：${districts}`),
          policy.conflictNote && el('span', { class: 'policy-flag' }, '出處說法不一'),
        ),
      ),
      el(
        'div',
        { class: 'policy-more' },
        policy.conflictNote && el('p', { class: 'conflict-note' }, el('strong', {}, '出處說法不一：'), policy.conflictNote),
        ...policy.quotes.map(quoteBlock),
        el(
          'dl',
          { class: 'policy-facts' },
          el('dt', {}, '核對紀錄'),
          el('dd', {}, ...verificationText(policy.verification).map((line) => el('span', { class: 'verification-line' }, line))),
        ),
        el('a', { class: 'policy-link', href: policyHref(policy.id) }, '這筆政見的連結'),
      ),
    ),
  );
}

// 一欄：欄頭（姓名、政黨、筆數）固定在欄頂，下面是資料狀態與政見。policies 是篩選後的政見。
function candidateColumn(candidate, cell, policies, { vm, matcher, focusPolicyId, expanded, active, index }) {
  let empty = null;
  if (cell.policies.length === 0) empty = vm.noPolicyText;
  else if (policies.length === 0) empty = NO_MATCH_TEXT;
  return el(
    'section',
    {
      class: `card-column${active ? ' is-active' : ''}`,
      id: `card-column-${index}`,
      role: 'tabpanel',
      'aria-labelledby': `card-tab-${index}`,
    },
    el(
      'header',
      { class: 'card-column-head' },
      el('h3', { class: 'candidate-name' }, candidate.name),
      el('p', { class: 'candidate-meta' }, candidate.party),
      el('p', { class: 'candidate-meta' }, candidateCountText(cell.policies.length, candidate.rawPolicyItems)),
      matcher.active && el('p', { class: 'candidate-meta candidate-match' }, columnMatchText(policies.length)),
    ),
    // 資料狀態說明放在欄標題下方，三欄標題的高度才一致。
    candidate.dataStatus && el('p', { class: 'data-status' }, candidate.dataStatus),
    empty
      ? el('p', { class: 'no-policy' }, empty)
      : el('div', { class: 'policy-stack' }, policies.map((policy) => policyArticle(policy, { focused: policy.id === focusPolicyId, open: expanded }))),
  );
}

// 回傳卡片控制器。onClose 在使用者關閉卡片後呼叫（例如清掉網址參數）。
export function createPolicyCard({ onClose = () => {} } = {}) {
  const number = el('span', { class: 'card-number' });
  const title = el('h2', { class: 'card-title', id: 'policy-card-title' });
  const description = el('p', { class: 'card-description' });
  const tabs = el('div', { class: 'card-tabs', role: 'tablist', 'aria-label': '候選人' });
  const body = el('div', { class: 'card-columns' });
  // 開卡片時焦點放在關閉鈕，Tab 往後是篩選與各欄政見。
  const closeButton = el('button', { type: 'button', class: 'card-close', autofocus: true }, '關閉');
  const heightButton = el('button', { type: 'button', class: 'card-height', 'aria-pressed': 'false' }, HEIGHT_TEXT.false);
  const expandButton = el('button', { type: 'button', class: 'card-expand', 'aria-pressed': 'false' }, EXPAND_TEXT.false);
  const shareLink = el('a', { class: 'card-share' }, '這個議題區的連結');
  const search = el('input', { id: 'card-search', type: 'search', autocomplete: 'off', placeholder: '在這個議題區找關鍵字' });
  const district = el(
    'select',
    { id: 'card-district' },
    el('option', { value: '' }, '全部行政區'),
    TAICHUNG_DISTRICTS.map((name) => el('option', { value: name }, name)),
  );
  const filterStatus = el('p', { class: 'card-filter-status', role: 'status' });
  const filters = el(
    'form',
    { class: 'card-filters', role: 'search', 'aria-label': '在這個議題區篩選政見' },
    // 欄位名稱只給輔助科技讀，畫面上用提示文字與預設選項說明，省下卡片高度。
    el('div', { class: 'card-field card-field-search' }, el('label', { for: 'card-search', class: 'visually-hidden' }, '在這個議題區找政見的關鍵字'), search),
    el('div', { class: 'card-field' }, el('label', { for: 'card-district', class: 'visually-hidden' }, '適用行政區'), district),
    expandButton,
  );
  // 手機抽屜的把手：拖曳在一半、全螢幕、關閉三段之間吸附，點一下在一半與全螢幕之間切換。桌面由 CSS 隱藏。
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': '切換卡片高度' });
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog policy-card', 'aria-labelledby': 'policy-card-title', 'data-snap': 'half', 'data-height': 'docked' },
    el(
      'div',
      { class: 'card-inner' },
      handle,
      el(
        'header',
        { class: 'card-head' },
        el(
          'div',
          { class: 'card-heading' },
          number,
          el('div', { class: 'card-heading-text' }, el('p', { class: 'card-eyebrow' }, '議題區'), title),
          description,
        ),
        el('div', { class: 'card-actions' }, shareLink, heightButton, closeButton),
      ),
      filters,
      filterStatus,
      tabs,
      body,
    ),
  );
  bindSheetDialog(dialog, { handle, closeButton, onClose });

  // 目前顯示的議題區與狀態。expanded 是「全部展開」，active 是手機分頁目前的候選人（依排序規則的位置）。
  let current = null;
  let expanded = false;
  let active = 0;

  const selectTab = (index, { focus = false } = {}) => {
    active = index;
    [...tabs.children].forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      if (i === index && focus) tab.focus();
    });
    [...body.children].forEach((column, i) => column.classList.toggle('is-active', i === index));
  };

  const render = ({ focusPolicyId = null } = {}) => {
    const { row, vm } = current;
    const matcher = policyMatcher({ query: search.value, district: district.value });
    const columns = vm.candidates.map((candidate) => {
      const cell = row.cells.find((c) => c.candidateId === candidate.id);
      return { candidate, cell, policies: cell.policies.filter(matcher.matches) };
    });
    // 分頁：三位候選人同尺寸、依排序規則排列，只放姓名。
    tabs.replaceChildren(
      ...columns.map(({ candidate }, index) => {
        const tab = el(
          'button',
          { type: 'button', class: 'card-tab', role: 'tab', id: `card-tab-${index}`, 'aria-controls': `card-column-${index}` },
          candidate.name,
        );
        tab.addEventListener('click', () => selectTab(index));
        tab.addEventListener('keydown', (event) => {
          const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
          if (step) selectTab((index + step + columns.length) % columns.length, { focus: true });
        });
        return tab;
      }),
    );
    body.replaceChildren(
      ...columns.map(({ candidate, cell, policies }, index) =>
        candidateColumn(candidate, cell, policies, { vm, matcher, focusPolicyId, expanded, active: index === active, index })),
    );
    selectTab(active);
    filterStatus.textContent = cardFilterStatusText({
      active: matcher.active,
      matchCount: columns.reduce((sum, column) => sum + column.policies.length, 0),
    });
  };

  const setExpanded = (next) => {
    expanded = next;
    expandButton.setAttribute('aria-pressed', String(next));
    expandButton.textContent = EXPAND_TEXT[next];
    for (const details of body.querySelectorAll('.policy-details')) details.open = next;
  };
  expandButton.addEventListener('click', () => setExpanded(!expanded));

  const setTall = (tall) => {
    dialog.dataset.height = tall ? 'tall' : 'docked';
    heightButton.setAttribute('aria-pressed', String(tall));
    heightButton.textContent = HEIGHT_TEXT[tall];
  };
  heightButton.addEventListener('click', () => setTall(dialog.dataset.height !== 'tall'));

  filters.addEventListener('submit', (event) => event.preventDefault());
  filters.addEventListener('input', () => {
    if (current) render();
  });

  return {
    element: dialog,
    // filter 是全站的篩選條件 { query, district }，開卡片時帶進欄內篩選；指定政見時清空，那筆政見才一定看得到。
    open(row, vm, { focusPolicyId = null, filter = {} } = {}) {
      const { issueArea } = row;
      const sameArea = current?.row.issueArea.id === issueArea.id && dialog.open;
      current = { row, vm };
      number.textContent = row.number;
      title.textContent = issueArea.name;
      description.textContent = `${issueArea.description}（對應局處：${issueArea.departments.join('、')}）`;
      shareLink.setAttribute('href', areaHref(issueArea.id));
      if (!sameArea) {
        search.value = focusPolicyId ? '' : filter.query ?? '';
        district.value = !focusPolicyId && TAICHUNG_DISTRICTS.includes(filter.district) ? filter.district : '';
        setExpanded(false);
        active = 0;
      }
      // 指定政見時分頁切到那位候選人。
      const focusIndex = focusPolicyId
        ? vm.candidates.findIndex((c) => row.cells.find((cell) => cell.candidateId === c.id).policies.some((p) => p.id === focusPolicyId))
        : -1;
      if (focusIndex >= 0) active = focusIndex;
      render({ focusPolicyId });
      if (!dialog.open) {
        dialog.dataset.snap = 'half';
        setTall(false);
        dialog.showModal();
      }
      const focused = focusPolicyId && body.querySelector(`#card-policy-${CSS.escape(focusPolicyId)}`);
      if (focused) focused.scrollIntoView({ block: 'nearest' });
      else for (const column of body.children) column.scrollTop = 0;
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
