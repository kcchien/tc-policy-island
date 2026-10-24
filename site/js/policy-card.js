// 政見卡片：一個議題區內三位候選人的政見並排。表格檢視與島嶼檢視共用，只讀檢視模型的一列（row）。
// 桌面島嶼檢視停靠在畫布下方、可一鍵放大成全高；800px 以下由 CSS 改為可拖成三段的底部抽屜（sheet.js），
// 三位候選人改為同尺寸的分頁切換。三欄各自捲動，欄頭固定在欄頂；每筆政見預設只顯示摘要與適用行政區，
// 點開才顯示原文引述、出處與核對紀錄。欄內篩選用 filter.js 的 policyMatcher。畫面文字取自 ui-text.js。
// 每筆政見展開後可複製成一段話（policy-text.js 組字、放進剪貼簿）與朗讀（createPolicyReader：有 audioUrl 播預先生成的音檔，
// 沒有時用瀏覽器內建語音；一次一筆，換議題區或關卡片即停止；按鈕帶喇叭圖示 SPEAK_ICON，播放中換成停止方塊）。本模組是唯一引用音檔的畫面模組，只用公開資料集給的 audioUrl。本議題區沒有政見的欄位，下方放市民補件的回報連結（report-link.js）。
// 右下角的「上一題」「下一題」只通知呼叫端（onStep），換哪一區由呼叫端決定。
// 每筆政見的摘要列有「加入對照單」勾選框（pickBox），勾選狀態由呼叫端保管（picks、onPick）。

import { el } from './dom.js';
import { bindSheetDialog } from './sheet.js';
import { policyMatcher } from './filter.js';
import { policySpeech, policyText } from './policy-text.js';
import { sourceReportHref } from './report-link.js';
import { TAICHUNG_DISTRICTS } from './dataset.js';
import {
  candidateCountText, DIALOG_TEXT, FILTER_TEXT, NO_MATCH_TEXT, POLICY_CARD_TEXT as T, SOURCE_TEXT, verificationText,
} from './ui-text.js';

// 桌面島嶼檢視的卡片高度偏好：預設接近全高，使用者按「縮小卡片」改停靠在下方後記住。
// localStorage 在隱私模式或被封鎖時會丟例外，讀寫失敗就用預設、不記住。
const HEIGHT_KEY = 'policy-island:card-height';

function readTallPreference() {
  try {
    return window.localStorage.getItem(HEIGHT_KEY) !== 'docked';
  } catch {
    return true;
  }
}

function writeTallPreference(tall) {
  try {
    window.localStorage.setItem(HEIGHT_KEY, tall ? 'tall' : 'docked');
  } catch {
    // 記不住就下次用預設高度。
  }
}

// 分享用連結不帶檢視，由讀者的裝置決定用哪一種檢視開啟。
export const policyHref = (policyId) => `?policy=${encodeURIComponent(policyId)}`;
export const areaHref = (areaId) => `?area=${encodeURIComponent(areaId)}`;

// 出處、原文存檔、網頁備份三個連結，政見卡片與候選人資料卡共用。
export const sourceLinks = (source) => [
  el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, SOURCE_TEXT.link),
  el('a', { href: source.snapshotUrl, target: '_blank' }, SOURCE_TEXT.snapshot),
  source.archiveUrl && el('a', { href: source.archiveUrl, target: '_blank', rel: 'noopener noreferrer' }, SOURCE_TEXT.archive),
];

// 朗讀的播放器（Node 可測，依賴由呼叫端注入）：政見帶 audioUrl 時播放預先生成的音檔（播放時才建立、不預先載入），
// 沒有時退回瀏覽器內建語音（speech 為 null 表示沒有語音功能）。一次只播一條，再按同一條停止，開始另一條先停掉前一條。
// 音檔只來自公開資料集給的 audioUrl，不在程式裡寫任何音檔路徑。onChange(policyId) 在播放狀態改變時呼叫（停止時為 null）。
export function createPolicyReader({ createAudio, speech, createUtterance, onChange = () => {} }) {
  // playing 是目前這一次播放；結束事件只結束發出它的那一次，同一條政見重播時舊事件不影響新的一次。
  let playing = null;
  const finish = (session) => {
    if (playing !== session) return;
    playing = null;
    onChange(null);
  };
  const stop = () => {
    if (!playing) return;
    const { halt } = playing;
    playing = null;
    halt();
    onChange(null);
  };
  const start = (policy) => {
    stop();
    const session = { id: policy.id };
    const done = () => finish(session);
    playing = session;
    if (policy.audioUrl) {
      const audio = createAudio(policy.audioUrl);
      audio.preload = 'none';
      audio.addEventListener('ended', done);
      audio.addEventListener('error', done);
      session.halt = () => audio.pause();
      // 瀏覽器擋下播放（例如沒有使用者手勢）時回到未播放。
      audio.play().catch(done);
    } else {
      const utterance = createUtterance(policySpeech(policy));
      utterance.addEventListener('end', done);
      utterance.addEventListener('error', done);
      session.halt = () => speech.cancel();
      speech.speak(utterance);
    }
    onChange(policy.id);
  };
  return {
    get playingId() {
      return playing?.id ?? null;
    },
    // 有音檔或有瀏覽器語音才放朗讀鈕。音檔全有或全無（上線關卡檢查），所以三欄的按鈕同時出現或同時不出現。
    canRead: (policy) => Boolean(policy.audioUrl) || Boolean(speech),
    toggle(policy) {
      if (playing?.id === policy.id) stop();
      else start(policy);
    },
    stop,
  };
}

// 朗讀鈕的喇叭圖示（內嵌、只有線條、顏色跟著按鈕文字色）：未播放是喇叭加聲波（idle），播放中換成停止方塊（playing），
// 由 main.css 依按鈕的按下狀態切換。形狀放成資料，Node 可測。
export const SPEAK_ICON = {
  viewBox: '0 0 24 24',
  shapes: [
    { part: 'idle', tag: 'path', attrs: { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4Z' } },
    { part: 'idle', tag: 'path', attrs: { d: 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11' } },
    { part: 'playing', tag: 'rect', attrs: { x: '6.5', y: '6.5', width: '11', height: '11', rx: '2' } },
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const speakIcon = () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'policy-action-icon');
  svg.setAttribute('viewBox', SPEAK_ICON.viewBox);
  svg.setAttribute('aria-hidden', 'true');
  for (const { part, tag, attrs } of SPEAK_ICON.shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    shape.setAttribute('class', `icon-${part}`);
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
    svg.append(shape);
  }
  return svg;
};

// 我的對照單的勾選框，政見卡片與對照單共用；變更由外層以事件委派（data-pick）處理。
// 放在政見的摘要列裡：點勾選框只切換勾選，不會展開或收合政見。
export const pickBox = (policyId, checked) => el(
  'label',
  { class: 'policy-pick' },
  el('input', { type: 'checkbox', 'data-pick': policyId, checked }),
  el('span', {}, T.pick),
);

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

// 一筆政見：摘要列（摘要、適用行政區、出處說法不一的提示）可點開，展開後才是原文引述、出處與核對紀錄。
function policyArticle(policy, { focused, open, canRead, picked }) {
  const districts = policy.districts.length > 0 ? policy.districts.join('、') : T.noDistricts;
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
          el('span', { class: 'policy-districts' }, T.districtsLine(districts)),
          policy.conflictNote && el('span', { class: 'policy-flag' }, T.conflictFlag),
          pickBox(policy.id, picked),
        ),
      ),
      el(
        'div',
        { class: 'policy-more' },
        policy.conflictNote && el('p', { class: 'conflict-note' }, el('strong', {}, T.conflict), policy.conflictNote),
        ...policy.quotes.map((quote) => quoteBlock(quote)),
        el(
          'dl',
          { class: 'policy-facts' },
          el('dt', {}, T.verification),
          el('dd', {}, el('span', { class: 'verification-line' }, verificationText(policy.verification))),
        ),
        // 連結、複製、朗讀同一列；按鈕的動作由卡片控制器以事件委派處理，沒有語音功能時不放朗讀鈕。
        el(
          'div',
          { class: 'policy-actions' },
          el('a', { class: 'policy-link', href: policyHref(policy.id) }, T.policyLink),
          el('button', { type: 'button', class: 'policy-action', 'data-action': 'copy', 'data-policy': policy.id, title: T.copyHint }, T.copy),
          canRead(policy) && el(
            'button',
            { type: 'button', class: 'policy-action', 'data-action': 'speak', 'data-policy': policy.id, 'aria-pressed': 'false', title: T.speakHint },
            speakIcon(),
            T.speak,
          ),
          el('span', { class: 'policy-action-status', role: 'status' }),
        ),
      ),
    ),
  );
}

// 一欄：欄頭（姓名、政黨、筆數）固定在欄頂，下面是資料狀態與政見。policies 是篩選後的政見。
// openIds 是重畫前已展開的政見，篩選時保留；tabbed 表示手機分頁模式（欄位才是分頁面板）。
function candidateColumn(candidate, cell, policies, {
  vm, areaName, matcher, focusPolicyId, expanded, openIds, active, index, tabbed, canRead, picks,
}) {
  let empty = null;
  if (cell.policies.length === 0) empty = vm.noPolicyText;
  else if (policies.length === 0) empty = NO_MATCH_TEXT;
  return el(
    'section',
    {
      class: `card-column${active ? ' is-active' : ''}`,
      id: `card-column-${index}`,
      role: tabbed ? 'tabpanel' : null,
      'aria-labelledby': tabbed ? `card-tab-${index}` : null,
      'aria-label': tabbed ? null : candidate.name,
    },
    el(
      'header',
      { class: 'card-column-head' },
      el('h3', { class: 'candidate-name' }, candidate.name),
      el('p', { class: 'candidate-meta' }, candidate.party),
      el('p', { class: 'candidate-meta' }, candidateCountText(cell.policies.length, candidate.rawPolicyItems)),
      matcher.active && el('p', { class: 'candidate-meta candidate-match' }, T.columnMatch(policies.length)),
    ),
    // 資料狀態說明放在欄標題下方，三欄標題的高度才一致。
    candidate.dataStatus && el('p', { class: 'data-status' }, candidate.dataStatus),
    empty && el('p', { class: 'no-policy' }, empty),
    // 市民補件：這一欄在本議題區完全沒有政見時（不是篩選後才沒有），三欄同一句、同一位置。
    cell.policies.length === 0 && el(
      'a',
      {
        class: 'source-report',
        href: sourceReportHref({ areaName, candidateName: candidate.name }),
        target: '_blank',
        rel: 'noopener noreferrer',
        title: T.reportHint,
      },
      T.report,
    ),
    !empty && el('div', { class: 'policy-stack' }, policies.map((policy) =>
      policyArticle(policy, { focused: policy.id === focusPolicyId, open: expanded || openIds.has(policy.id), canRead, picked: picks.has(policy.id) }))),
  );
}

// 回傳卡片控制器。onClose 在使用者關閉卡片後呼叫（例如清掉網址參數）。
// onStep(step) 在按「上一題」（-1）或「下一題」（1）時呼叫，由呼叫端決定開哪個議題區（reading-progress.js 的 nextAreaId）。
// picks() 回傳目前勾選進對照單的政見識別碼集合；勾選框改變時呼叫 onPick(policyId, checked)。
export function createPolicyCard({ onClose = () => {}, onStep = () => {}, picks = () => new Set(), onPick = () => {} } = {}) {
  const number = el('span', { class: 'card-number' });
  const title = el('h2', { class: 'card-title', id: 'policy-card-title' });
  const description = el('p', { class: 'card-description' });
  const tabs = el('div', { class: 'card-tabs', role: 'tablist', 'aria-label': T.tabsLabel });
  const body = el('div', { class: 'card-columns' });
  // 開卡片時焦點放在關閉鈕，Tab 往後是篩選與各欄政見。
  const closeButton = el('button', { type: 'button', class: 'card-close', autofocus: true }, DIALOG_TEXT.close);
  // 這兩顆按鈕的文字說明按下後的動作（放大／縮小、展開／收合），不另標按下狀態。
  const heightButton = el('button', { type: 'button', class: 'card-height' }, T.enlarge);
  const expandButton = el('button', { type: 'button', class: 'card-expand' }, T.expandAll);
  const shareLink = el('a', { class: 'card-share' }, T.areaLink);
  const search = el('input', { id: 'card-search', type: 'search', autocomplete: 'off', placeholder: T.searchPlaceholder });
  const district = el(
    'select',
    { id: 'card-district' },
    el('option', { value: '' }, T.allDistricts),
    TAICHUNG_DISTRICTS.map((name) => el('option', { value: name }, name)),
  );
  // 只看出處說法不一：與全站篩選同一個條件，開卡片時帶入，讀者可在卡片內取消。
  const conflict = el('input', { id: 'card-conflict', type: 'checkbox' });
  const filterStatus = el('p', { class: 'card-filter-status', role: 'status' });
  const filters = el(
    'form',
    { class: 'card-filters', role: 'search', 'aria-label': T.filtersLabel },
    // 欄位名稱只給輔助科技讀，畫面上用提示文字與預設選項說明，省下卡片高度。
    el('div', { class: 'card-field card-field-search' }, el('label', { for: 'card-search', class: 'visually-hidden' }, T.searchLabel), search),
    el('div', { class: 'card-field' }, el('label', { for: 'card-district', class: 'visually-hidden' }, T.districts), district),
    el('label', { class: 'card-conflict', for: 'card-conflict' }, conflict, el('span', {}, FILTER_TEXT.conflictOnly)),
    expandButton,
  );
  // 手機抽屜的把手：拖曳在一半、全螢幕、關閉三段之間吸附，點一下在一半與全螢幕之間切換。桌面由 CSS 隱藏。
  const handle = el('button', { type: 'button', class: 'card-handle', 'aria-label': DIALOG_TEXT.handle });
  // 下一題：卡片右下角，依議題區編號換區，頭尾相接。
  const previousButton = el('button', { type: 'button', class: 'card-step' }, T.previous);
  const nextButton = el('button', { type: 'button', class: 'card-step' }, T.next);
  previousButton.addEventListener('click', () => onStep(-1));
  nextButton.addEventListener('click', () => onStep(1));
  const steps = el('nav', { class: 'card-steps', 'aria-label': T.stepsLabel }, previousButton, nextButton);
  const dialog = el(
    'dialog',
    { class: 'sheet-dialog policy-card', 'aria-labelledby': 'policy-card-title', 'data-snap': 'half', 'data-height': 'tall' },
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
          el('div', { class: 'card-heading-text' }, el('p', { class: 'card-eyebrow' }, T.eyebrow), title),
          description,
        ),
        el('div', { class: 'card-actions' }, shareLink, heightButton, closeButton),
      ),
      filters,
      filterStatus,
      tabs,
      body,
      steps,
    ),
  );
  bindSheetDialog(dialog, {
    handle,
    closeButton,
    onClose: () => {
      reader.stop();
      onClose();
    },
  });

  // 目前顯示的議題區與狀態。expanded 是「全部展開」，active 是手機分頁目前的候選人（依排序規則的位置）。
  let current = null;
  let expanded = false;
  let active = 0;

  // 朗讀：有音檔播音檔，沒有時用瀏覽器內建語音（三人同一個 zh-TW 聲音、預設語速）。
  // 按鈕名稱固定為「朗讀」，播放中以按下狀態表示（同背景音樂開關的做法）。
  const speech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;
  const syncSpeakButtons = () => {
    for (const button of body.querySelectorAll('[data-action="speak"]')) {
      button.setAttribute('aria-pressed', String(button.dataset.policy === reader.playingId));
    }
  };
  const reader = createPolicyReader({
    createAudio: (url) => new Audio(url),
    speech,
    createUtterance: (text) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      const voice = speech.getVoices().find((v) => v.lang.replace('_', '-') === 'zh-TW');
      if (voice) utterance.voice = voice;
      return utterance;
    },
    onChange: syncSpeakButtons,
  });

  // 複製成一段話：成功顯示兩秒的提示；剪貼簿不能用時在同一列放出文字並選取，讓讀者自己複製。
  const copyPolicy = async (policy, button) => {
    const { row, vm } = current;
    const candidate = vm.candidates.find((c) => c.id === policy.candidateId);
    const text = policyText(policy, {
      areaName: row.issueArea.name,
      candidateName: candidate.name,
      cutoffDate: vm.meta.dataCutoffDate,
      url: new URL(policyHref(policy.id), window.location.href).href,
    });
    const actions = button.closest('.policy-actions');
    const status = actions.querySelector('.policy-action-status');
    actions.querySelector('.policy-copy-text')?.remove();
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = T.copied;
      setTimeout(() => {
        if (status.textContent === T.copied) status.textContent = '';
      }, 2000);
    } catch {
      status.textContent = T.copyFailed;
      const fallback = el('textarea', { class: 'policy-copy-text', readonly: true, rows: 6 }, text);
      actions.append(fallback);
      fallback.select();
    }
  };

  body.addEventListener('change', (event) => {
    const box = event.target.closest('[data-pick]');
    if (box) onPick(box.dataset.pick, box.checked);
  });

  body.addEventListener('click', (event) => {
    const button = event.target.closest('.policy-action');
    if (!button || !current) return;
    const policy = current.row.cells.flatMap((cell) => cell.policies).find((p) => p.id === button.dataset.policy);
    if (!policy) return;
    if (button.dataset.action === 'copy') copyPolicy(policy, button);
    else reader.toggle(policy);
  });
  // 與 main.css 的手機斷點相同：800px 以下三欄改為分頁。在函式內讀，Node 載入本模組時不碰 window。
  const tabbedQuery = window.matchMedia('(max-width: 800px)');
  tabbedQuery.addEventListener('change', () => {
    if (current && dialog.open) render();
  });

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
    const matcher = policyMatcher({ query: search.value, district: district.value, conflictOnly: conflict.checked });
    // 重畫前讀者自己點開的政見，重畫後照樣展開。
    const openIds = new Set([...body.querySelectorAll('.policy-details[open]')].map((d) => d.closest('.policy').id.slice('card-policy-'.length)));
    const tabbed = tabbedQuery.matches;
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
        candidateColumn(candidate, cell, policies, {
          vm, areaName: row.issueArea.name, matcher, focusPolicyId, expanded, openIds, active: index === active, index, tabbed, canRead: reader.canRead, picks: picks(),
        })),
    );
    syncSpeakButtons();
    selectTab(active);
    filterStatus.textContent = T.filterStatus({
      active: matcher.active,
      matchCount: columns.reduce((sum, column) => sum + column.policies.length, 0),
    });
  };

  const setExpanded = (next) => {
    expanded = next;
    expandButton.textContent = next ? T.collapseAll : T.expandAll;
    for (const details of body.querySelectorAll('.policy-details')) details.open = next;
  };
  expandButton.addEventListener('click', () => setExpanded(!expanded));

  // 桌面島嶼檢視的卡片高度：接近全高（預設），或縮小停靠在下方、上方露出島。
  const setTall = (tall) => {
    dialog.dataset.height = tall ? 'tall' : 'docked';
    heightButton.textContent = tall ? T.shrink : T.enlarge;
  };
  heightButton.addEventListener('click', () => {
    const tall = dialog.dataset.height !== 'tall';
    writeTallPreference(tall);
    setTall(tall);
  });

  filters.addEventListener('submit', (event) => event.preventDefault());
  filters.addEventListener('input', () => {
    if (current) render();
  });

  return {
    element: dialog,
    // filter 是全站的篩選條件 { query, district, conflictOnly }，開卡片時帶進欄內篩選；指定政見時清空，那筆政見才一定看得到。
    open(row, vm, { focusPolicyId = null, filter = {} } = {}) {
      const { issueArea } = row;
      const sameArea = current?.row.issueArea.id === issueArea.id && dialog.open;
      current = { row, vm };
      number.textContent = row.number;
      title.textContent = issueArea.name;
      description.textContent = T.areaDescription(issueArea.description, issueArea.departments);
      shareLink.setAttribute('href', areaHref(issueArea.id));
      if (!sameArea) {
        reader.stop();
        search.value = filter.query ?? '';
        district.value = TAICHUNG_DISTRICTS.includes(filter.district) ? filter.district : '';
        conflict.checked = Boolean(filter.conflictOnly);
        // 換議題區時清掉上一區的展開狀態。
        body.replaceChildren();
        setExpanded(false);
        active = 0;
      }
      if (focusPolicyId) {
        search.value = '';
        district.value = '';
        conflict.checked = false;
      }
      // 指定政見時分頁切到那位候選人。
      const focusIndex = focusPolicyId
        ? vm.candidates.findIndex((c) => row.cells.find((cell) => cell.candidateId === c.id).policies.some((p) => p.id === focusPolicyId))
        : -1;
      if (focusIndex >= 0) active = focusIndex;
      render({ focusPolicyId });
      if (!dialog.open) {
        dialog.dataset.snap = 'half';
        setTall(readTallPreference());
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
