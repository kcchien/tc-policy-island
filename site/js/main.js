import { TAICHUNG_DISTRICTS } from './dataset.js';
import { buildViewModel } from './view-model.js';
import { filterViewModel } from './filter.js';
import { chooseView, formatSearch, parseSearch } from './app-state.js';
import { createPolicyCard } from './policy-card.js';
import { renderTable } from './table-view.js';
import { el } from './dom.js';

const DATASET_URL = './data/dataset.json';
// 島嶼檢視完成後由島嶼檢視的票改為 true。
const ISLAND_AVAILABLE = false;
const INTRO_SEEN_KEY = 'policy-island:intro-seen';

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

function setupViewSwitch(view, webgl) {
  document.body.dataset.view = view;
  document.body.dataset.webgl = webgl ? 'yes' : 'no';
  for (const button of document.querySelectorAll('.view-button')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  const note = document.getElementById('view-note');
  note.textContent = webgl ? '島嶼檢視準備中，目前提供表格檢視。' : '此裝置不支援 3D 顯示，已改用表格檢視。';
  note.hidden = false;
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

function startApp(vm, state) {
  const tableRoot = document.getElementById('table-root');
  const form = document.getElementById('filters');
  const search = document.getElementById('search');
  const district = document.getElementById('district');
  const status = document.getElementById('result-status');

  const updateUrl = () => history.replaceState(null, '', formatSearch(state) || location.pathname);

  const card = createPolicyCard({
    onClose() {
      state.area = null;
      state.policy = null;
      updateUrl();
    },
  });
  document.body.append(card.element);

  const openCard = (areaId, policyId) => {
    const row = vm.rows.find((r) => r.issueArea.id === areaId);
    if (!row) return false;
    state.area = policyId ? null : areaId;
    state.policy = policyId;
    updateUrl();
    card.open(row, vm, { focusPolicyId: policyId });
    return true;
  };

  const render = () => {
    const filtered = filterViewModel(vm, { query: state.query, district: state.district });
    renderTable(tableRoot, filtered, { onOpenCard: openCard });
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
    // reset 事件在欄位清空前觸發，等清空後再重畫。
    setTimeout(render);
  });

  document.getElementById('candidate-order-note').textContent = vm.candidateOrderNote;
  render();

  // 網址指向政見時開到該政見所在議題區的卡片；指向議題區時捲到該列並開卡片。
  const policyRow = state.policy && vm.rows.find((r) => r.cells.some((c) => c.policies.some((p) => p.id === state.policy)));
  if (policyRow) {
    openCard(policyRow.issueArea.id, state.policy);
  } else if (state.area && vm.rows.some((r) => r.issueArea.id === state.area)) {
    document.getElementById(`area-${state.area}`)?.scrollIntoView({ block: 'start' });
    openCard(state.area, null);
  }
}

async function start() {
  const state = parseSearch(location.search);
  const webgl = supportsWebGL();
  setupViewSwitch(chooseView({ requested: state.view, webgl, islandAvailable: ISLAND_AVAILABLE }), webgl);
  setupIntro();
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const vm = buildViewModel(await response.json());
    document.getElementById('data-cutoff-date').textContent = vm.meta.dataCutoffDate;
    startApp(vm, state);
  } catch (error) {
    const message = el('p', { class: 'status status-error' }, `政見資料載入失敗（${error.message}），請稍後重新整理。`);
    document.getElementById('table-root').replaceChildren(message);
  }
}

start();
