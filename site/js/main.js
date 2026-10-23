import { TAICHUNG_DISTRICTS } from './dataset.js';
import { buildViewModel } from './view-model.js';
import { filterViewModel } from './filter.js';
import { chooseView, formatSearch, parseSearch } from './app-state.js';
import { createPolicyCard } from './policy-card.js';
import { renderTable } from './table-view.js';
import { renderIslandList, renderLegend } from './island-list.js';
import { createCandidateDialog, PROFILE_NOTE, renderProfileCards } from './candidate-card.js';
import { el } from './dom.js';
import { setupMusicToggle } from './bgm-control.js';

const DATASET_URL = './data/dataset.json';
const INTRO_SEEN_KEY = 'policy-island:intro-seen';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
// 與 main.css 的手機斷點相同：底部膠囊工具列、索引與卡片改為底部抽屜。
const mobileQuery = window.matchMedia('(max-width: 800px)');

// 時段按鈕的順序與名稱。實際光照由島嶼檢視的 setTimeOfDay 負責，預設白天。
const TIMES = [
  { id: 'dawn', name: '清晨' },
  { id: 'day', name: '白天' },
  { id: 'dusk', name: '黃昏' },
  { id: 'night', name: '夜晚' },
];

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// localStorage 在隱私模式或被封鎖時會丟例外，讀寫失敗就當作沒看過、不記住。
function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 記不住就下次再顯示說明。
  }
}

function setupIntro() {
  const intro = document.getElementById('intro');
  if (readStorage(INTRO_SEEN_KEY) === '1') return;
  intro.hidden = false;
  document.getElementById('intro-dismiss').addEventListener('click', () => {
    writeStorage(INTRO_SEEN_KEY, '1');
    intro.hidden = true;
  });
}

function showViewNote(text) {
  const note = document.getElementById('view-note');
  note.textContent = text;
  note.hidden = false;
}

// 島嶼檢視無法使用時停用切換按鈕，只留表格檢視。
function disableIsland(reason) {
  document.querySelector('.view-button[data-view="island"]').disabled = true;
  document.body.dataset.island = 'unavailable';
  showViewNote(reason);
}

function setupDistricts(select, selected) {
  select.append(...TAICHUNG_DISTRICTS.map((name) => el('option', { value: name }, name)));
  select.value = TAICHUNG_DISTRICTS.includes(selected) ? selected : '';
}

function resultStatusText(filtered) {
  if (!filtered.filter.active) return '';
  const { matchCount } = filtered.filter;
  if (matchCount === 0) return '沒有符合篩選條件的政見。';
  return `符合篩選條件的政見共 ${matchCount} 筆，分布在 ${filtered.rows.length} 個議題區。`;
}

// 索引面板的分頁：議題區、候選人。
function setupTabs() {
  const tabs = [...document.querySelectorAll('.index-tab')];
  const select = (tab) => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
}

function startApp(vm, state, initialView) {
  const tableRoot = document.getElementById('table-root');
  const form = document.getElementById('filters');
  const search = document.getElementById('search');
  const district = document.getElementById('district');
  const status = document.getElementById('result-status');
  const stage = document.getElementById('island-stage');
  const panel = document.getElementById('index-panel');
  const indexToggle = document.getElementById('tool-index');
  const toolbar = document.getElementById('hud-toolbar');
  const titleCard = document.querySelector('.title-card');
  const controls = document.getElementById('controls');
  const islandList = document.getElementById('island-list');

  let view = initialView;
  let filtered = vm;
  // 目前選中的議題區。關閉卡片後仍保留，切換檢視時沿用。
  let selectedArea = null;
  let island = null;
  const hud = { time: 'day', paused: false, labels: true };

  const updateUrl = () => history.replaceState(null, '', formatSearch(state) || location.pathname);

  const card = createPolicyCard({
    onClose() {
      state.area = null;
      state.policy = null;
      updateUrl();
    },
  });
  document.body.append(card.element);

  const candidateDialog = createCandidateDialog({
    onClose() {
      state.candidate = null;
      updateUrl();
    },
  });
  document.body.append(candidateDialog.element);

  // 手機的索引抽屜。桌面的索引面板一直顯示，不受 is-open 影響。
  // 開啟時焦點移到「關閉索引」，Escape 或關閉後焦點回到索引鈕。
  const indexClose = document.getElementById('index-close');
  const setPanelOpen = (open, { returnFocus = false } = {}) => {
    panel.classList.toggle('is-open', open);
    indexToggle.setAttribute('aria-expanded', String(open));
    if (open) indexClose.focus();
    else if (returnFocus) indexToggle.focus();
  };
  indexToggle.addEventListener('click', () => setPanelOpen(!panel.classList.contains('is-open')));
  indexClose.addEventListener('click', () => setPanelOpen(false, { returnFocus: true }));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) setPanelOpen(false, { returnFocus: true });
  });

  // 畫布四邊被浮動元件遮住的寬度：桌面是上方工具列與右側索引面板，手機是標題卡與底部膠囊列。
  const stageInsets = () => {
    const { innerWidth: width, innerHeight: height } = window;
    const bar = toolbar.getBoundingClientRect();
    if (mobileQuery.matches) {
      return { top: titleCard.getBoundingClientRect().bottom, right: 0, bottom: Math.max(0, height - bar.top), left: 0 };
    }
    return { top: bar.bottom, right: Math.max(0, width - panel.getBoundingClientRect().left), bottom: 0, left: 0 };
  };

  // 工具列：時段、暫停、名牌、全景。島嶼檢視還沒載入時先記下狀態，載入後套用。
  const withIsland = (fn) => island?.then((controller) => controller && fn(controller));
  const applyTime = () => {
    const current = TIMES.find((t) => t.id === hud.time);
    for (const button of document.querySelectorAll('[data-time]')) {
      button.setAttribute('aria-pressed', String(button.dataset.time === hud.time));
    }
    document.getElementById('tool-time-cycle-label').textContent = current.name;
    document.getElementById('tool-time-cycle').setAttribute('aria-label', `切換時段，目前${current.name}`);
    withIsland((controller) => controller.setTimeOfDay?.(hud.time));
  };
  const applyPaused = () => {
    const button = document.getElementById('tool-pause');
    button.setAttribute('aria-pressed', String(hud.paused));
    document.getElementById('tool-pause-label').textContent = hud.paused ? '播放' : '暫停';
    withIsland((controller) => controller.setPaused?.(hud.paused));
  };
  const applyLabels = () => {
    document.getElementById('tool-labels').setAttribute('aria-pressed', String(hud.labels));
    stage.classList.toggle('labels-off', !hud.labels);
  };
  for (const button of document.querySelectorAll('[data-time]')) {
    button.addEventListener('click', () => {
      hud.time = button.dataset.time;
      applyTime();
    });
  }
  document.getElementById('tool-time-cycle').addEventListener('click', () => {
    const index = TIMES.findIndex((t) => t.id === hud.time);
    hud.time = TIMES[(index + 1) % TIMES.length].id;
    applyTime();
  });
  document.getElementById('tool-pause').addEventListener('click', () => {
    hud.paused = !hud.paused;
    applyPaused();
  });
  document.getElementById('tool-labels').addEventListener('click', () => {
    hud.labels = !hud.labels;
    applyLabels();
  });
  document.getElementById('tool-overview').addEventListener('click', () => withIsland((controller) => controller.showAll()));
  setupMusicToggle({
    button: document.getElementById('tool-music'),
    volumeInput: document.getElementById('tool-music-volume'),
    reducedMotion: () => reducedMotionQuery.matches,
  });

  const renderIslandPanel = () => {
    renderIslandList(islandList, vm, filtered, { selectedId: selectedArea, onPick: (areaId) => openCard(areaId, null) });
  };

  // 第一次進入島嶼檢視時才載入 three.js。載入或建立場景失敗就改用表格檢視。
  const ensureIsland = () => {
    island ??= import('./island-view.js')
      .then(({ createIslandView }) => {
        const controller = createIslandView(stage, {
          vm,
          reducedMotion: () => reducedMotionQuery.matches,
          onSelectArea: (areaId) => openCard(areaId, null),
          onSelectCandidate: openCandidateCard,
          insets: stageInsets,
        });
        controller.update(filtered);
        // 卡片開關、手機抽屜換段或拖曳時，畫面偏移跟著卡片遮住的範圍走。
        const syncCover = () => controller.setCover(card.element.open ? card.element.getBoundingClientRect() : null);
        new ResizeObserver(syncCover).observe(card.element);
        card.element.addEventListener('close', syncCover);
        controller.setTimeOfDay?.(hud.time);
        controller.setPaused?.(hud.paused);
        document.getElementById('island-status').remove();
        return controller;
      })
      .catch((error) => {
        console.error(error);
        disableIsland('島嶼檢視載入失敗，已改用表格檢視。');
        setView('table');
        return null;
      });
    return island;
  };

  const scrollToTableRow = (areaId) => document.getElementById(`area-${areaId}`)?.scrollIntoView({ block: 'start' });

  const highlightTableRow = () => {
    for (const row of tableRoot.querySelectorAll('.area-row')) {
      row.classList.toggle('is-selected', row.id === `area-${selectedArea}`);
    }
  };

  // 開啟某位候選人的候選人資料卡（三張並排，捲到並標示這一張）。表格欄頭、網址 candidate 參數使用，
  // 也以 onSelectCandidate 交給島嶼檢視（#22 接上：點候選人人物時呼叫）。候選人不存在時回傳 false。
  const openCandidateCard = (candidateId) => {
    if (!vm.candidates.some((c) => c.id === candidateId)) return false;
    card.close();
    setPanelOpen(false);
    state.area = null;
    state.policy = null;
    state.candidate = candidateId;
    updateUrl();
    candidateDialog.open(vm, candidateId);
    return true;
  };

  const openCard = (areaId, policyId) => {
    const row = vm.rows.find((r) => r.issueArea.id === areaId);
    if (!row) return false;
    candidateDialog.close();
    state.candidate = null;
    selectedArea = areaId;
    state.area = policyId ? null : areaId;
    state.policy = policyId;
    updateUrl();
    const show = () => card.open(row, vm, { focusPolicyId: policyId });
    if (view === 'island') {
      setPanelOpen(false);
      renderIslandPanel();
      // 鏡頭飛到該區後才開卡片；減少動態時沒有飛行，立即開啟。
      ensureIsland().then((controller) => {
        if (!controller || !controller.focusArea(areaId, show)) show();
      });
    } else {
      highlightTableRow();
      show();
    }
    return true;
  };

  function setView(next) {
    view = next;
    document.body.dataset.view = next;
    for (const button of document.querySelectorAll('.view-button')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === next));
    }
    // 搜尋與篩選：島嶼檢視放在索引面板，表格檢視放在表格上方。
    document.getElementById(next === 'island' ? 'panel-controls-slot' : 'table-controls-slot').append(controls);
    if (next === 'island') {
      setPanelOpen(false);
      renderIslandPanel();
      ensureIsland().then((controller) => {
        if (!controller) return;
        controller.resize();
        if (selectedArea) controller.focusArea(selectedArea);
      });
    } else {
      highlightTableRow();
      if (selectedArea) scrollToTableRow(selectedArea);
    }
  }

  for (const button of document.querySelectorAll('.view-button')) {
    button.addEventListener('click', () => {
      if (button.disabled || button.dataset.view === view) return;
      state.view = button.dataset.view;
      updateUrl();
      setView(button.dataset.view);
    });
  }

  const render = () => {
    filtered = filterViewModel(vm, { query: state.query, district: state.district });
    renderTable(tableRoot, filtered, { onOpenCard: openCard, onOpenCandidate: openCandidateCard });
    highlightTableRow();
    renderIslandPanel();
    withIsland((controller) => controller.update(filtered));
    status.textContent = resultStatusText(filtered);
  };

  search.value = state.query;
  setupDistricts(district, state.district);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => {
    state.query = search.value;
    state.district = district.value;
    updateUrl();
    render();
  });
  form.addEventListener('reset', () => {
    state.query = '';
    state.district = '';
    updateUrl();
    render();
  });

  document.getElementById('candidate-order-note').textContent = vm.candidateOrderNote;
  document.getElementById('panel-order-note').textContent = vm.candidateOrderNote;
  renderLegend(document.getElementById('island-legend'), vm);
  document.getElementById('panel-profile-note').textContent = PROFILE_NOTE;
  renderProfileCards(document.getElementById('candidate-profiles'), vm, { idPrefix: 'panel-profile' });
  setupTabs();
  applyTime();
  applyPaused();
  applyLabels();
  updateUrl();
  render();
  setView(view);

  // 網址指向政見時開到該政見所在議題區的卡片；指向議題區時開該區卡片（表格檢視先捲到該列）；
  // 都沒有時，指向候選人就開該候選人的候選人資料卡。識別碼不存在就從網址移除。
  const policyRow = state.policy && vm.rows.find((r) => r.cells.some((c) => c.policies.some((p) => p.id === state.policy)));
  if (policyRow) {
    openCard(policyRow.issueArea.id, state.policy);
  } else if (state.area && vm.rows.some((r) => r.issueArea.id === state.area)) {
    if (view === 'table') scrollToTableRow(state.area);
    openCard(state.area, null);
  } else if (state.candidate && !openCandidateCard(state.candidate)) {
    state.candidate = null;
    updateUrl();
  }
}

async function start() {
  const state = parseSearch(location.search);
  const webgl = supportsWebGL();
  const view = chooseView({ requested: state.view, webgl });
  // 網址指定的檢視無法使用時，不把它留在網址上。
  if (state.view !== view) state.view = null;
  document.body.dataset.view = view;
  document.body.dataset.webgl = webgl ? 'yes' : 'no';
  if (!webgl) disableIsland('此裝置無法顯示島嶼檢視，已改用表格檢視。');
  setupIntro();
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const vm = buildViewModel(await response.json());
    for (const node of document.querySelectorAll('[data-cutoff-date]')) node.textContent = vm.meta.dataCutoffDate;
    startApp(vm, state, view);
  } catch (error) {
    const message = `政見資料載入失敗（${error.message}），請稍後重新整理。`;
    document.getElementById('table-root').replaceChildren(el('p', { class: 'status status-error' }, message));
    document.getElementById('island-status').textContent = message;
  }
}

start();
