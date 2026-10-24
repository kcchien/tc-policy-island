// 進站流程：選檢視、載入資料、接上篩選與卡片、檢視切換、時段（預設自動依台灣時間，每分鐘檢查；點時段改手動）、
// 頁首的選舉時程（與自動時段同一節奏重算）、隨機一題、下一題與閱讀進度、上手導覽與統計（資料載入後送一次頁面瀏覽，
// 旁聽出處連結的點擊）。
// 島嶼檢視（island-view.js）第一次進入時才動態載入。只在瀏覽器使用。

import { TAICHUNG_DISTRICTS } from './dataset.js';
import { buildViewModel } from './view-model.js';
import { filterViewModel } from './filter.js';
import { chooseView, formatSearch, parseSearch } from './app-state.js';
import { createPolicyCard } from './policy-card.js';
import { renderTable } from './table-view.js';
import { renderIslandList, renderLegend } from './island-list.js';
import { createCandidateDialog, renderProfileCards } from './candidate-card.js';
import { el } from './dom.js';
import { timeOfDayAt } from './island-daylight.js';
import { pickRandomArea } from './random-area.js';
import { markSeen, nextAreaId, parseSeen, SEEN_KEY, serializeSeen } from './reading-progress.js';
import { knownPicks, parsePicks, PICKS_KEY, serializePicks } from './shortlist.js';
import { createShortlistDialog } from './shortlist-dialog.js';
import { autoStartTour, currentTourStep, initialTour, nextTourStep, pickTourArea, reopenTour, skipTour } from './tour.js';
import { createTourView } from './tour-view.js';
import { pageviewHit, sendHit, sourceIdsBySnapshot, trackSourceClicks } from './hits.js';
import {
  FILTER_TEXT, ISLAND_TEXT, LOAD_TEXT, PROFILE_TEXT, RANDOM_AREA_TEXT, READING_TEXT, resultStatusText, SHORTLIST_TEXT, TIME_NAMES,
  TOUR_TEXT,
} from './ui-text.js';
import { setupMusicToggle } from './bgm-control.js';
import { scheduleView, taipeiDate } from './election-schedule.js';
import { renderSchedule, setupScheduleToggle } from './schedule-view.js';

const DATASET_URL = './data/dataset.json';
// 上手導覽看過或跳過的紀錄。沿用舊版文字說明的鍵，看過舊說明的人不再自動出現導覽。
const TOUR_SEEN_KEY = 'policy-island:intro-seen';
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
// 與 main.css 的手機斷點相同：底部膠囊工具列、索引與卡片改為底部抽屜。
const mobileQuery = window.matchMedia('(max-width: 800px)');

// 時段按鈕的順序與名稱。實際光照由島嶼檢視的 setTimeOfDay 負責。
// 預設「自動」：依台灣時間選時段（timeOfDayAt），每分鐘檢查一次；點其他時段改為手動。
const TIMES = ['dawn', 'day', 'dusk', 'night'].map((id) => ({ id, name: TIME_NAMES[id] }));
const AUTO_TIME = { id: 'auto', name: TIME_NAMES.auto };
const AUTO_CHECK_MS = 60 * 1000;

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
    // 記不住就下次再顯示導覽。
  }
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
  const conflictOnly = document.getElementById('conflict-only');
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
  // 載入完成的島嶼檢視（上手導覽每幀同步讀名牌位置用）；還沒載入或載入失敗時是 null。
  let loadedIsland = null;
  // timeMode 是 'auto' 或手動選的時段；time 是實際套用的時段。
  const hud = { timeMode: AUTO_TIME.id, time: timeOfDayAt(Date.now()), paused: false, labels: true };

  const updateUrl = () => history.replaceState(null, '', formatSearch(state) || location.pathname);

  const card = createPolicyCard({
    onClose() {
      state.area = null;
      state.policy = null;
      updateUrl();
    },
    onStep: (step) => stepArea(step),
    picks: () => picks,
    onPick: (policyId, checked) => togglePick(policyId, checked),
  });

  // 我的對照單：勾選存在讀者的瀏覽器；網址帶 pick 時以網址為準並寫回，之後從網址拿掉（分享網址由「複製網址」產生）。
  // 頁首按鈕只顯示勾選總數，不依候選人分，沒有勾選時不出現。
  const fromUrl = knownPicks(vm, state.pick);
  let picks = fromUrl.size > 0 ? fromUrl : knownPicks(vm, parsePicks(readStorage(PICKS_KEY)));
  if (fromUrl.size > 0) writeStorage(PICKS_KEY, serializePicks(picks));
  state.pick = [];
  const shortlistButton = el('button', { type: 'button', class: 'shortlist-open', title: SHORTLIST_TEXT.buttonHint });
  const shortlistUrl = () => `${location.origin}${location.pathname}${formatSearch({ pick: [...picks] })}`;
  const shortlist = createShortlistDialog({ onPick: (policyId, checked) => togglePick(policyId, checked) });
  const syncShortlistButton = () => {
    shortlistButton.textContent = SHORTLIST_TEXT.button(picks.size);
    shortlistButton.hidden = picks.size === 0;
  };
  const togglePick = (policyId, checked) => {
    picks = new Set(picks);
    if (checked) picks.add(policyId);
    else picks.delete(policyId);
    writeStorage(PICKS_KEY, serializePicks(picks));
    syncShortlistButton();
    if (shortlist.element.open) shortlist.open(vm, picks, shortlistUrl());
  };
  shortlistButton.addEventListener('click', () => shortlist.open(vm, picks, shortlistUrl()));
  syncShortlistButton();

  // 閱讀進度：看過的議題區只記在讀者的瀏覽器，索引與表格打淡勾；有紀錄時才出現說明與「清除紀錄」。
  // 已不存在的議題區（舊紀錄）略過，否則只剩舊識別碼時會出現說明卻沒有任何淡勾。
  const areaIds = new Set(vm.rows.map((row) => row.issueArea.id));
  let seen = new Set([...parseSeen(readStorage(SEEN_KEY))].filter((id) => areaIds.has(id)));
  const clearSeenButton = el('button', { type: 'button', class: 'reading-clear' }, READING_TEXT.clear);
  const readingProgress = el('p', { class: 'reading-progress' }, el('span', {}, READING_TEXT.note), clearSeenButton);
  const setSeen = (next) => {
    seen = next;
    writeStorage(SEEN_KEY, serializeSeen(seen));
    readingProgress.hidden = seen.size === 0;
    renderLists();
  };
  readingProgress.hidden = seen.size === 0;
  clearSeenButton.addEventListener('click', () => setSeen(new Set()));
  document.body.append(card.element, shortlist.element);

  const candidateDialog = createCandidateDialog({
    onClose() {
      state.candidate = null;
      updateUrl();
    },
  });
  document.body.append(candidateDialog.element);
  // 名牌要避開的浮動元件（見 stageObstacles）開關時，請島嶼檢視重排名牌。鏡頭沒動時不會自己重排。
  const refreshLabels = () => withIsland((controller) => controller.refreshLabels());
  candidateDialog.element.addEventListener('close', refreshLabels);

  // 手機的索引抽屜。桌面的索引面板一直顯示，不受 is-open 影響。
  // 開啟時焦點移到「關閉索引」，Escape 或關閉後焦點回到索引鈕。
  const indexClose = document.getElementById('index-close');
  const setPanelOpen = (open, { returnFocus = false } = {}) => {
    panel.classList.toggle('is-open', open);
    indexToggle.setAttribute('aria-expanded', String(open));
    if (open) indexClose.focus();
    else if (returnFocus) indexToggle.focus();
    refreshLabels();
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

  // 名牌要避開的浮動元件：標題卡、工具列（桌面是各組按鈕，手機是整條膠囊列）、索引面板、說明文字、開著的卡片，
  // 以及上手導覽的說明框。
  const stageObstacles = () => [...panelObstacles(), ...(tourView.element.open ? [tourView.element.getBoundingClientRect()] : [])];
  const panelObstacles = () => {
    const nodes = [
      titleCard,
      ...(mobileQuery.matches ? [toolbar] : toolbar.querySelectorAll('.tool-group')),
      panel,
      document.getElementById('view-note'),
      card.element.open && card.element,
      candidateDialog.element.open && candidateDialog.element,
    ];
    return nodes.filter(Boolean).map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
  };

  // 工具列：時段、暫停、名牌、全景。島嶼檢視還沒載入時先記下狀態，載入後套用。
  const withIsland = (fn) => island?.then((controller) => controller && fn(controller));
  const applyTime = () => {
    const auto = hud.timeMode === AUTO_TIME.id;
    hud.time = auto ? timeOfDayAt(Date.now()) : hud.timeMode;
    const current = TIMES.find((t) => t.id === hud.time);
    for (const button of document.querySelectorAll('[data-time]')) {
      button.setAttribute('aria-pressed', String(button.dataset.time === hud.timeMode));
    }
    document.getElementById('tool-time-cycle-label').textContent = auto ? AUTO_TIME.name : current.name;
    document.getElementById('tool-time-cycle').setAttribute('aria-label', auto ? ISLAND_TEXT.timeCycleAuto(current.name) : ISLAND_TEXT.timeCycle(current.name));
    withIsland((controller) => controller.setTimeOfDay?.(hud.time));
  };
  // 自動模式下跨過時段邊界時切換（島嶼檢視負責補間，減少動態時直接切換）。分頁回到前景時也馬上檢查。
  const checkAutoTime = () => {
    if (hud.timeMode === AUTO_TIME.id && timeOfDayAt(Date.now()) !== hud.time) applyTime();
  };
  // 頁首的選舉時程：與自動時段同一個節奏檢查，台灣日期換日才重畫（天數只在換日時改變）。
  const scheduleRoot = document.getElementById('election-schedule');
  let scheduleDay = null;
  const showSchedule = () => {
    const now = Date.now();
    if (taipeiDate(now) === scheduleDay) return;
    scheduleDay = taipeiDate(now);
    renderSchedule(scheduleRoot, scheduleView(vm.meta.electionSchedule, now));
  };
  setupScheduleToggle(scheduleRoot, { onToggle: refreshLabels });
  const everyMinute = () => {
    checkAutoTime();
    showSchedule();
  };
  setInterval(everyMinute, AUTO_CHECK_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) everyMinute();
  });
  const applyPaused = () => {
    const button = document.getElementById('tool-pause');
    button.setAttribute('aria-pressed', String(hud.paused));
    document.getElementById('tool-pause-label').textContent = hud.paused ? ISLAND_TEXT.play : ISLAND_TEXT.pause;
    withIsland((controller) => controller.setPaused?.(hud.paused));
  };
  const applyLabels = () => {
    document.getElementById('tool-labels').setAttribute('aria-pressed', String(hud.labels));
    stage.classList.toggle('labels-off', !hud.labels);
    refreshLabels();
  };
  for (const button of document.querySelectorAll('[data-time]')) {
    button.addEventListener('click', () => {
      hud.timeMode = button.dataset.time;
      applyTime();
    });
  }
  // 手機的時段循環鈕：自動 → 清晨 → 白天 → 黃昏 → 夜晚 → 自動。
  document.getElementById('tool-time-cycle').addEventListener('click', () => {
    const modes = [AUTO_TIME, ...TIMES];
    const index = modes.findIndex((t) => t.id === hud.timeMode);
    hud.timeMode = modes[(index + 1) % modes.length].id;
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
  });

  const renderIslandPanel = () => {
    renderIslandList(islandList, vm, filtered, { selectedId: selectedArea, onPick: (areaId) => openCard(areaId, null), seen });
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
          obstacles: stageObstacles,
          timeOfDay: hud.time,
        });
        controller.update(filtered);
        // 卡片開關、手機抽屜換段或拖曳時，畫面偏移跟著卡片遮住的範圍走。
        const syncCover = () => controller.setCover(card.element.open ? card.element.getBoundingClientRect() : null);
        new ResizeObserver(syncCover).observe(card.element);
        card.element.addEventListener('close', syncCover);
        // 走到同一格：關閉政見卡片時三位候選人人物同時走回候選人廣場。
        card.element.addEventListener('close', () => controller.returnFigures());
        controller.setTimeOfDay?.(hud.time);
        controller.setPaused?.(hud.paused);
        document.getElementById('island-status').remove();
        loadedIsland = controller;
        return controller;
      })
      .catch((error) => {
        console.error(error);
        disableIsland(ISLAND_TEXT.loadFailed);
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
    refreshLabels();
    return true;
  };

  // unfiltered：卡片內不帶入全站篩選（隨機一題用，三欄照常顯示全部政見）。
  const openCard = (areaId, policyId, { unfiltered = false } = {}) => {
    const row = vm.rows.find((r) => r.issueArea.id === areaId);
    if (!row) return false;
    candidateDialog.close();
    state.candidate = null;
    selectedArea = areaId;
    if (!seen.has(areaId)) setSeen(markSeen(seen, areaId));
    state.area = policyId ? null : areaId;
    state.policy = policyId;
    updateUrl();
    const filter = unfiltered ? {} : { query: state.query, district: state.district, conflictOnly: state.conflict };
    const show = () => card.open(row, vm, { focusPolicyId: policyId, filter });
    if (view === 'island') {
      setPanelOpen(false);
      renderIslandPanel();
      // 走到同一格：卡片還沒開時，等鏡頭到位且三位候選人人物都抵達才開；卡片已開著換題時鏡頭到位就換，
      // 人物在後面走。減少動態時沒有飛行與步行，立即開啟。
      const waitForFigures = !card.element.open;
      ensureIsland().then((controller) => {
        if (!controller || !controller.focusArea(areaId, show, { waitForFigures })) show();
      });
    } else {
      highlightTableRow();
      show();
    }
    return true;
  };

  // 隨機一題：從全部議題區（不看篩選）均勻選一個開政見卡片，不與目前選中的議題區相同；卡片也不帶篩選。
  // 頁首按鈕呼叫；上手導覽在 startApp 內直接呼叫或以回呼傳入（main.js 是入口，沒有 export）。
  // 表格檢視先捲到該列（被篩掉時不捲）；島嶼檢視由 openCard 等載入完成、飛到該區再開。
  const openRandomArea = () => {
    const areaId = pickRandomArea(vm.rows, Math.random, selectedArea);
    if (view === 'table') scrollToTableRow(areaId);
    return openCard(areaId, null, { unfiltered: true });
  };

  // 下一題與上一題：依全部議題區的編號（不看篩選），與隨機一題同樣不帶篩選開卡。
  const stepArea = (step) => {
    const areaId = nextAreaId(vm.rows, selectedArea, step);
    if (view === 'table') scrollToTableRow(areaId);
    return openCard(areaId, null, { unfiltered: true });
  };

  // 上手導覽（tour.js 的狀態機、tour-view.js 的覆蓋層）：第一步框一個議題區的名牌、第二步框同一格的三個標記，
  // 第三步呼叫隨機一題並框住開好的政見卡片。框哪一格只依畫面位置（pickTourArea），不讀政見。
  const webgl = document.body.dataset.webgl === 'yes';
  let tour = initialTour({ seen: readStorage(TOUR_SEEN_KEY) === '1' });
  // 網址指定要開卡片時，第一次進島嶼檢視不自動出現導覽（島嶼檢視的卡片要等鏡頭飛到才開，所以另外記）。
  let deepLink = Boolean(state.policy || state.area || state.candidate || fromUrl.size > 0);
  let tourArea = null;
  const tourTarget = (step) => {
    if (step === 'random') {
      if (!card.element.open) return null;
      const { left, top, right, bottom } = card.element.getBoundingClientRect();
      return { left, top, right, bottom };
    }
    if (!loadedIsland) return null;
    const { innerWidth: width, innerHeight: height } = window;
    const inset = stageInsets();
    const visible = { left: inset.left, top: inset.top, right: width - inset.right, bottom: height - inset.bottom };
    const rectsOf = (id) => ({ id, ...loadedIsland.areaScreenRects(id) });
    // 上一幀框的那一格，標記仍在可見範圍內就不換。名牌可能被說明框擋住而避讓隱藏，不看名牌，
    // 否則說明框一移動就會換格、來回跳。
    let rects = tourArea && rectsOf(tourArea);
    const markersVisible = (r) => r && r.left >= visible.left && r.top >= visible.top && r.right <= visible.right && r.bottom <= visible.bottom;
    if (!markersVisible(rects?.markers)) {
      tourArea = pickTourArea(vm.rows.map((row) => rectsOf(row.issueArea.id)), { visible, obstacles: panelObstacles() });
      if (!tourArea) return null;
      rects = rectsOf(tourArea);
    }
    return step === 'area' ? rects.label ?? rects.markers : rects.markers;
  };
  const setTour = (next) => {
    if (next === tour) return;
    const previous = currentTourStep(tour);
    if (next.seen && !tour.seen) writeStorage(TOUR_SEEN_KEY, '1');
    tour = next;
    const step = currentTourStep(tour);
    if (!step) {
      tourView.hide();
    } else {
      if (previous === null) {
        // 從第一步開始：收起卡片與抽屜，讓島露出來。
        tourArea = null;
        card.close();
        candidateDialog.close();
        setPanelOpen(false);
      }
      tourView.show(step);
      if (step === 'random' && previous !== 'random') openRandomArea();
    }
    refreshLabels();
  };
  const tourView = createTourView({
    targetOf: tourTarget,
    onNext: () => setTour(nextTourStep(tour)),
    onSkip: () => setTour(skipTour(tour)),
    onMove: refreshLabels,
  });
  document.body.append(tourView.element);
  // 第三步的政見卡片在鏡頭飛到後才開，開在導覽之上；開好後把導覽移回最上層。
  new MutationObserver(() => {
    if (card.element.open && currentTourStep(tour) === 'random') tourView.raise();
  }).observe(card.element, { attributes: true, attributeFilter: ['open'] });
  const autoStart = () => {
    const cardOpen = deepLink || card.element.open || candidateDialog.element.open;
    setTour(autoStartTour(tour, { view, webgl, cardOpen }));
    deepLink = false;
  };
  const tourButton = document.getElementById('tour-open');
  tourButton.textContent = TOUR_TEXT.open;
  tourButton.title = TOUR_TEXT.openHint;
  tourButton.addEventListener('click', () => setTour(reopenTour(tour, { view, webgl })));
  tourButton.hidden = !webgl;

  function setView(next) {
    view = next;
    document.body.dataset.view = next;
    for (const button of document.querySelectorAll('.view-button')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === next));
    }
    // 搜尋與篩選：島嶼檢視放在索引面板，表格檢視放在表格上方。
    document.getElementById(next === 'island' ? 'panel-controls-slot' : 'table-controls-slot').append(controls);
    // 閱讀進度的說明與清除鈕：島嶼檢視放在議題區清單下方，表格檢視放在表格上方。
    if (next === 'island') islandList.after(readingProgress);
    else tableRoot.before(readingProgress);
    if (next === 'island') {
      setPanelOpen(false);
      renderIslandPanel();
      ensureIsland().then((controller) => {
        if (!controller) return;
        controller.resize();
        // 人物只在政見卡片開著時走到該格（走到同一格）。
        if (selectedArea) controller.focusArea(selectedArea, undefined, { figures: card.element.open });
        // 載入期間切回表格檢視時不出導覽。
        if (view === 'island') autoStart();
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

  // 表格與索引清單（看過紀錄改變時也重畫，淡勾才跟著更新）。
  function renderLists() {
    renderTable(tableRoot, filtered, { onOpenCard: openCard, onOpenCandidate: openCandidateCard, seen });
    highlightTableRow();
    renderIslandPanel();
  }

  const render = () => {
    filtered = filterViewModel(vm, { query: state.query, district: state.district, conflictOnly: state.conflict });
    renderLists();
    withIsland((controller) => controller.update(filtered));
    status.textContent = resultStatusText(filtered);
  };

  search.value = state.query;
  setupDistricts(district, state.district);
  conflictOnly.checked = state.conflict;
  document.getElementById('conflict-only-label').textContent = FILTER_TEXT.conflictOnly;
  document.getElementById('conflict-hint').textContent = FILTER_TEXT.conflictHint;
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => {
    state.query = search.value;
    state.district = district.value;
    state.conflict = conflictOnly.checked;
    updateUrl();
    render();
  });
  form.addEventListener('reset', () => {
    state.query = '';
    state.district = '';
    state.conflict = false;
    updateUrl();
    render();
  });

  const randomButton = document.getElementById('random-area');
  document.getElementById('random-area-label').textContent = RANDOM_AREA_TEXT.button;
  randomButton.title = RANDOM_AREA_TEXT.hint;
  randomButton.addEventListener('click', openRandomArea);
  randomButton.hidden = false;
  randomButton.after(shortlistButton);

  document.getElementById('candidate-order-note').textContent = vm.candidateOrderNote;
  document.getElementById('panel-order-note').textContent = vm.candidateOrderNote;
  renderLegend(document.getElementById('island-legend'), vm);
  document.getElementById('panel-profile-note').textContent = PROFILE_TEXT.note;
  renderProfileCards(document.getElementById('candidate-profiles'), vm, { idPrefix: 'panel-profile' });
  setupTabs();
  showSchedule();
  applyTime();
  applyPaused();
  applyLabels();
  updateUrl();
  render();
  setView(view);
  sendHit(navigator, pageviewHit(view));
  trackSourceClicks(document, { bySnapshot: sourceIdsBySnapshot(vm), view: () => view });

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
  } else if (!state.candidate && fromUrl.size > 0) {
    // 別人分享的對照單網址：沒有指定其他卡片時直接打開對照單。
    shortlist.open(vm, picks, shortlistUrl());
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
  if (!webgl) disableIsland(ISLAND_TEXT.noWebgl);
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const vm = buildViewModel(await response.json());
    for (const node of document.querySelectorAll('[data-cutoff-date]')) node.textContent = vm.meta.dataCutoffDate;
    startApp(vm, state, view);
  } catch (error) {
    // 錯誤細節只寫進主控台，畫面用白話。
    console.error(error);
    const message = LOAD_TEXT.datasetFailed;
    document.getElementById('table-root').replaceChildren(el('p', { class: 'status status-error' }, message));
    document.getElementById('island-status').textContent = message;
  }
}

start();
