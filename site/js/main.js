import { TAICHUNG_DISTRICTS } from './dataset.js';
import { buildViewModel } from './view-model.js';
import { filterViewModel } from './filter.js';
import { chooseView, formatSearch, parseSearch } from './app-state.js';
import { createPolicyCard } from './policy-card.js';
import { renderTable } from './table-view.js';
import { renderIslandList, renderLegend } from './island-list.js';
import { el } from './dom.js';

const DATASET_URL = './data/dataset.json';
const INTRO_SEEN_KEY = 'policy-island:intro-seen';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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

function startApp(vm, state, initialView) {
  const tableRoot = document.getElementById('table-root');
  const form = document.getElementById('filters');
  const search = document.getElementById('search');
  const district = document.getElementById('district');
  const status = document.getElementById('result-status');
  const stage = document.getElementById('island-stage');
  const panel = document.getElementById('island-panel');
  const panelToggle = document.getElementById('island-panel-toggle');
  const islandList = document.getElementById('island-list');

  let view = initialView;
  let filtered = vm;
  // 目前選中的議題區。關閉卡片後仍保留，切換檢視時沿用。
  let selectedArea = null;
  let island = null;

  const updateUrl = () => history.replaceState(null, '', formatSearch(state) || location.pathname);

  const card = createPolicyCard({
    onClose() {
      state.area = null;
      state.policy = null;
      updateUrl();
    },
  });
  document.body.append(card.element);

  const setPanelOpen = (open) => {
    panel.classList.toggle('is-open', open);
    panelToggle.setAttribute('aria-expanded', String(open));
  };
  panelToggle.addEventListener('click', () => setPanelOpen(!panel.classList.contains('is-open')));
  document.getElementById('island-reset').addEventListener('click', () => {
    island?.then((controller) => controller?.showAll());
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
        });
        controller.update(filtered);
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

  const openCard = (areaId, policyId) => {
    const row = vm.rows.find((r) => r.issueArea.id === areaId);
    if (!row) return false;
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
    if (next === 'island') {
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
    renderTable(tableRoot, filtered, { onOpenCard: openCard });
    highlightTableRow();
    renderIslandPanel();
    island?.then((controller) => controller?.update(filtered));
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
  renderLegend(document.getElementById('island-legend'), vm);
  updateUrl();
  render();
  setView(view);

  // 網址指向政見時開到該政見所在議題區的卡片；指向議題區時開該區卡片（表格檢視先捲到該列）。
  const policyRow = state.policy && vm.rows.find((r) => r.cells.some((c) => c.policies.some((p) => p.id === state.policy)));
  if (policyRow) {
    openCard(policyRow.issueArea.id, state.policy);
  } else if (state.area && vm.rows.some((r) => r.issueArea.id === state.area)) {
    if (view === 'table') scrollToTableRow(state.area);
    openCard(state.area, null);
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
    document.getElementById('data-cutoff-date').textContent = vm.meta.dataCutoffDate;
    startApp(vm, state, view);
  } catch (error) {
    const message = `政見資料載入失敗（${error.message}），請稍後重新整理。`;
    document.getElementById('table-root').replaceChildren(el('p', { class: 'status status-error' }, message));
    document.getElementById('island-status').textContent = message;
  }
}

start();
