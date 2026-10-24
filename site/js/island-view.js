// 島嶼檢視：把島嶼配置畫成 3D 場景。只讀檢視模型（經 island-layout.js），不直接碰公開資料集。
// 由 main.js 以動態 import 載入，不支援 WebGL 的裝置不會下載 three.js。
// 控制介面含 setTimeOfDay、setPaused、addAnimation、stats、setCover（政見卡片遮住的範圍，main.js 依卡片大小呼叫）。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { cameraLimits, islandLayout, islandPoints, orbitCenter, viewOffset } from './island-layout.js';
import {
  approachInsets, combineInsets, coverInsets, createCameraFlight, flightDuration, homeView, isDrag, sameInsets,
} from './island-camera.js';
import { createSelection, SELECTED_LIFT } from './island-selection.js';
import { createFpsGovernor, initialQuality } from './island-quality.js';
import { createDaylight } from './island-daylight.js';
import { createAnimator } from './island-clock.js';
import { createEnvironment } from './island-environment.js';
import { instancify } from './island-kit.js';
import { createOutskirts } from './island-outskirts.js';
import { outskirtsWaterRadius } from './island-terrain.js';
import { createMotion } from './island-motion-view.js';
import {
  batchMarkerFaces, figureModel, localElementModel, markerSign, setMarkerLit, TILE_SURFACE,
} from './island-models.js';
import { TILE_SLOTS } from './island-body.js';
import { createIslandBody } from './island-body-view.js';
import { figurePose, plazaLayout } from './island-plaza.js';
import { placeLabels } from './island-labels.js';
import { LOD_DISTANCE } from './island-decor.js';
import { createDecor } from './island-decor-view.js';
import { el } from './dom.js';
import { ISLAND_TEXT } from './ui-text.js';

const FOV = 32;
// 窄畫面的名牌改成直書（見 LABEL_NARROW）。預設視角的俯角與方位角由 island-camera.js 的 homeView 依長寬比決定。
const NARROW_WIDTH = 600;
// 飛到議題區時鏡頭與格子的距離。
const FOCUS_DISTANCE = 14;
// 議題區名牌的錨點（相對格心）。寬畫面的橫書名牌浮在元素北側上方；
// 窄畫面的直書名牌往上長，錨點放在格心正北，名牌落在南北兩列格子的標記之間，不蓋住標記。
const LABEL_WIDE = new THREE.Vector3(0, TILE_SURFACE + 1.35, -0.45);
const LABEL_NARROW = new THREE.Vector3(0, TILE_SURFACE + 0.9, -0.2);
// 構圖時算進的高度：格子頂面加上元素模型的最高高度（island-models.js 的元素區）。
const MODEL_TOP = TILE_SURFACE + 1.1;

// onSelectArea(areaId) 在使用者點選議題區格子時呼叫；onSelectCandidate(candidateId) 在點選候選人人物時呼叫。
// reducedMotion 是讀取目前「減少動態」設定的函式，讓使用者中途改設定也會生效。
// insets() 回傳畫布四邊被浮動元件遮住的像素寬度 { top, right, bottom, left }。
// obstacles() 回傳浮動元件與卡片的視窗矩形（getBoundingClientRect），名牌會避開。
// timeOfDay 是一開始的時段（不補間，直接是這個時段），省略時是白天。
export function createIslandView(stage, {
  vm, reducedMotion, onSelectArea, onSelectCandidate,
  insets = () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  obstacles = () => [],
  timeOfDay,
}) {
  const quality = initialQuality({
    width: window.innerWidth,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    devicePixelRatio: window.devicePixelRatio || 1,
    userAgent: navigator.userAgent,
  });

  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'low-power' });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = quality.level === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  // 陰影由迴圈決定何時更新（低畫質或卡頓時每幾幀一次）。
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.classList.add('island-canvas');
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.classList.add('island-labels');
  labelRenderer.domElement.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement, labelRenderer.domElement);

  const scene = new THREE.Scene();
  const layout = islandLayout(vm);
  const plaza = plazaLayout(layout);
  const { bounds } = layout;
  const outline = islandPoints(layout, { surface: TILE_SURFACE, top: MODEL_TOP });
  const center = new THREE.Vector3(bounds.center.x, 0, bounds.center.z);

  // 晝夜、天空、光照與發光材質。
  const daylight = createDaylight({ initial: timeOfDay });
  const environment = createEnvironment(scene, { center, radius: bounds.radius, quality, waterRadius: outskirtsWaterRadius(bounds) });
  // 裝飾動畫的時間；後續的動畫用 animator.add 註冊（見 island-clock.js）。
  const animator = createAnimator({ reducedMotion });
  const governor = createFpsGovernor(quality);
  let shadowEvery = quality.shadowEvery;
  let frame = 0;
  let lastNight = 0;

  // 每格一個群組：島體（island-body-view.js）、靜態裝飾（主題場景、路燈、大樹、家具與植栽，island-decor-view.js）、
  // 在地感元素、三個標記、議題區名牌。
  const tiles = new Map();
  const groups = new Map();
  const pickable = [];
  const labelAnchors = [];
  // 參與避讓的名牌：{ id, node, group?, compact, pinned? }。compact 表示可以縮成只留編號；
  // pinned 的名牌（人物名牌與廣場名牌）先放，議題區名牌讓它們。
  const labelEntries = [];
  for (const tileInfo of layout.tiles) {
    const g = new THREE.Group();
    g.position.set(tileInfo.position.x, 0, tileInfo.position.z);
    groups.set(tileInfo.id, g);
    // 候選人廣場是鋪面的裝飾格，在地感元素放在北半，南半站候選人人物。
    const isPlaza = tileInfo.id === plaza.tile?.id;
    const slot = isPlaza ? TILE_SLOTS.element.plaza : tileInfo.elementSlot;
    const model = tileInfo.localElement && localElementModel(tileInfo.localElement, slot);
    if (model) {
      model.position.y = TILE_SURFACE;
      g.add(model);
    }
    const markers = tileInfo.markers.map((info) => {
      const marker = markerSign(info);
      marker.position.set(info.offset.x, TILE_SURFACE, info.offset.z);
      setMarkerLit(marker, info.lit);
      g.add(marker);
      return marker;
    });
    if (tileInfo.kind === 'area') {
      // 外層是 CSS2DRenderer 定位的錨點；名牌本身的對齊方式由 CSS 決定（手機改直書）。
      // 名牌的編號與索引面板相同（檢視模型的議題區編號）。
      const name = el(
        'span',
        { class: 'island-label' },
        el('b', { class: 'island-label-number' }, tileInfo.number),
        el('span', { class: 'island-label-name' }, tileInfo.name),
      );
      const label = new CSS2DObject(el('span', { class: 'island-label-anchor' }, name));
      labelAnchors.push(label);
      labelEntries.push({ id: tileInfo.id, node: name, compact: true });
      g.add(label);
      g.userData.areaId = tileInfo.id;
      pickable.push(g);
      tiles.set(tileInfo.id, { group: g, markers, label: name });
    }
    scene.add(g);
  }
  const markerFaces = batchMarkerFaces(scene, [...tiles.values()].flatMap((tile) => tile.markers));
  // 候選人人物：三人同一款，依排序規則並排在廣場。人物不移動，只有待機動畫。
  // 頭上名牌只有形狀；姓名寫在廣場南端的廣場名牌，三人並列（姓名放頭上會互疊）。
  const plate = (info) => [el('b', { class: 'island-label-number' }, info.symbol), el('span', { class: 'island-label-name' }, info.name)];
  const figures = plaza.figures.map((info) => {
    const { model, body, hit } = figureModel(info);
    model.position.set(info.position.x, TILE_SURFACE, info.position.z);
    hit.userData.candidateId = info.candidateId;
    const node = el('span', { class: 'island-label island-figure-label' }, el('b', { class: 'island-label-number' }, info.symbol));
    const label = new CSS2DObject(el('span', { class: 'island-label-anchor' }, node));
    label.position.y = info.labelHeight;
    // 三人的頭上名牌同一組：一起顯示或一起隱藏。
    labelEntries.push({ id: `figure:${info.candidateId}`, node, group: 'figures', compact: false, pinned: true });
    model.add(label);
    scene.add(model);
    return { info, body, hit };
  });
  if (plaza.tile) {
    // 名牌層不接收指標事件，廣場名牌上的姓名另外開放點選，手機上比點人物容易。
    // 名牌層對輔助科技隱藏，候選人資料由索引的「候選人」分頁提供，所以姓名按鈕不進 Tab 順序。
    const entries = plaza.figures.map((info) => {
      const button = el('button', { type: 'button', class: 'island-plaza-entry', tabindex: '-1' }, ...plate(info));
      button.addEventListener('click', () => onSelectCandidate?.(info.candidateId));
      return button;
    });
    const node = el('span', { class: 'island-label island-plaza-sign' }, el('span', { class: 'island-plaza-title' }, ISLAND_TEXT.plaza), ...entries);
    const sign = new CSS2DObject(el('span', { class: 'island-label-anchor' }, node));
    sign.position.set(plaza.sign.x, TILE_SURFACE, plaza.sign.z);
    labelEntries.push({ id: 'plaza-sign', node, compact: false, pinned: true });
    scene.add(sign);
  }
  const figureHits = figures.map((f) => f.hit);
  animator.add((t) => {
    for (const { info, body } of figures) {
      const { stretch, tilt } = figurePose(info.idle, t);
      body.scale.y = info.scale * stretch;
      body.rotation.z = tilt;
    }
  });
  // 島體：頂面、側壁、圖案帶、步道環、路緣、淺水與泡沫環、拱橋（island-body-view.js），每格相同、不讀政見。
  const islandBody = createIslandBody(scene, layout, { groupOf: (id) => groups.get(id), waterMaterial: environment.waterMaterial, plazaId: plaza.tile?.id });
  // 靜態裝飾：主題場景只依議題區識別碼，其餘每個議題區格子數量相同，不讀政見（island-decor.js）。
  const decor = createDecor(scene, layout, { groupOf: (id) => groups.get(id), surface: TILE_SURFACE });
  // 每格的循環道具、市民、環線車輛（island-motion-view.js），配置不讀政見。
  const motion = createMotion(scene, layout, { level: quality.level, groupOf: (id) => tiles.get(id)?.group, glowMaterial: environment.glowMaterial });
  animator.add(motion.update);
  // 靜態零件依材質合併成幾個網格（發光件另成 InstancedMesh），繪製呼叫數只看材質種類，不看零件數。
  const kit = instancify(scene, { glowMaterial: environment.glowMaterial });
  pickable.push(...kit.meshes);
  // 鏡頭拉遠時隱藏的小物件（長椅、盆栽、踏石等），合批後是幾個獨立的網格。
  const smallDecor = kit.meshes.filter((mesh) => mesh.userData.lod === 'small');
  // 外圍地形與環境（不可點選）；雲、霧、鳥隨動畫時間移動。
  const outskirts = createOutskirts(scene, { layout, quality, environment });
  animator.add(outskirts.update);
  const selection = createSelection(scene, { hexSize: layout.hexSize, addAnimation: (fn) => animator.add(fn) });

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion();
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  let renderPending = false;
  const flight = createCameraFlight();
  // 畫面偏移：base 是工具列與索引面板（resize 時讀），cover 是政見卡片遮住的範圍（setCover），
  // shown 是目前畫面用的卡片偏移，每幀平滑跟上 cover。
  let baseInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  let cover = { ...baseInsets };
  let shown = { ...baseInsets };
  let stageSize = { width: 0, height: 0 };
  let lastFrame = null;
  // 最近一次飛往的議題區格心；還沒飛過時是 null，旋轉中心就是預設視角的中心。
  let focus = null;
  // 使用者縮遠時把旋轉中心移回預設視角的中心（orbitCenter），鏡頭與中心一起平移，視角不變。
  const recenter = () => {
    if (!home) return;
    const distance = camera.position.distanceTo(controls.target);
    const near = Math.min(FOCUS_DISTANCE, home.distance);
    const c = orbitCenter(focus ?? home.target, home.target, distance, { near, far: Math.max(home.distance, near + 1) });
    const delta = new THREE.Vector3(c.x - controls.target.x, 0, c.z - controls.target.z);
    if (delta.lengthSq() < 1e-8) return;
    controls.target.add(delta);
    camera.position.add(delta);
  };
  const render = () => {
    renderPending = false;
    const now = performance.now();
    const dt = lastFrame === null ? 0 : Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    const pose = flight.step(now);
    if (pose) {
      controls.target.copy(pose.target);
      camera.position.copy(pose.position);
    } else {
      recenter();
    }
    const shifting = !sameInsets(shown, cover);
    if (shifting) {
      shown = approachInsets(shown, cover, dt, { reducedMotion: reducedMotion() });
      applyOffset();
    }
    const moving = controls.update();
    const { lighting, settled } = daylight.at(now);
    lastNight = lighting.night;
    environment.apply(lighting, renderer);
    decor.setNight(lighting.night);
    const cameraDistance = camera.position.distanceTo(controls.target);
    const showSmall = cameraDistance < LOD_DISTANCE;
    for (const mesh of smallDecor) mesh.visible = showSmall;
    animator.tick(now, { night: lighting.night, fog: lighting.fog, skyHorizon: lighting.skyHorizon, lighting, cameraDistance });
    // 有裝飾動畫在走時每幀重畫，陰影每 shadowEvery 幀更新；畫面靜止時只在有變化才重畫，每次都更新陰影。
    const animating = animator.running;
    frame += 1;
    renderer.shadowMap.needsUpdate = !animating || frame % shadowEvery === 0;
    // 標記牌面跟著格子抬高與亮暗：先更新世界矩陣再寫進合批。
    scene.updateMatrixWorld();
    markerFaces.sync();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    layoutLabels();
    // 連續重畫（拖曳、鏡頭飛行、時段補間、裝飾動畫）時才量 fps；停下來就重新起算，閒置時間不算卡頓。
    const continuous = moving || flight.active || shifting || !settled || animating;
    if (continuous) {
      const next = governor.frame(now);
      if (next) applyQuality(next);
      requestRender();
    } else {
      governor.pause();
      lastFrame = null;
    }
  };
  // 名牌避讓（island-labels.js）：鏡頭、畫面偏移、選取或介面變動後，重新決定每個名牌完整顯示、只留編號或隱藏。
  // 名牌以中心定位，縮成編號時中心不變，所以直接讀目前的位置；兩種尺寸量一次記著，畫布尺寸改變時重量。
  let labelModes = new Map();
  let labelKey = '';
  let labelsDirty = true;
  // 名牌的字級或內容可能變了（斷點、網頁字型載入）：尺寸重量並重排。
  const remeasureLabels = () => {
    for (const entry of labelEntries) entry.sizes = null;
    labelsDirty = true;
  };
  const setMode = (node, mode) => {
    node.classList.toggle('is-compact', mode === 'number');
    node.classList.toggle('is-hidden', mode === 'hidden');
  };
  const measureLabel = (entry) => {
    const mode = labelModes.get(entry.id) ?? 'full';
    setMode(entry.node, 'full');
    const full = { width: entry.node.offsetWidth, height: entry.node.offsetHeight };
    let number = null;
    if (entry.compact) {
      setMode(entry.node, 'number');
      number = { width: entry.node.offsetWidth, height: entry.node.offsetHeight };
    }
    setMode(entry.node, mode);
    return { full, number };
  };
  function layoutLabels() {
    // 名牌關閉時不排；重新打開時鏡頭可能已經動過，要重排。
    if (stage.classList.contains('labels-off')) {
      labelsDirty = true;
      return;
    }
    const key = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements, stageSize.width, stageSize.height].join();
    if (!labelsDirty && key === labelKey) return;
    labelsDirty = false;
    labelKey = key;
    const items = [];
    for (const entry of labelEntries) {
      const rect = entry.node.getBoundingClientRect();
      // 在鏡頭後方或視野外的名牌（CSS2DRenderer 設成不顯示）不參與。
      if (rect.width === 0 && rect.height === 0) continue;
      if (!entry.sizes || entry.sizes.full.width === 0) entry.sizes = measureLabel(entry);
      items.push({
        id: entry.id,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        full: entry.sizes.full,
        number: entry.sizes.number,
        group: entry.group,
        pinned: Boolean(entry.pinned),
      });
    }
    // 人物名牌與廣場名牌先放；議題區名牌由畫面下方（離鏡頭近）往上放。
    items.sort((a, b) => b.pinned - a.pinned || (a.pinned ? 0 : b.y - a.y));
    labelModes = placeLabels(items, { obstacles: obstacles(), selectedId, previous: labelModes });
    for (const entry of labelEntries) {
      if (labelModes.has(entry.id)) setMode(entry.node, labelModes.get(entry.id));
    }
  }

  // 執行中降級：降像素比、關毛玻璃（.lowfx）、降低陰影更新頻率。
  const applyQuality = (next) => {
    renderer.setPixelRatio(next.pixelRatio);
    shadowEvery = next.shadowEvery;
    document.documentElement.classList.toggle('lowfx', next.lowFx);
  };
  const requestRender = () => {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(render);
  };
  controls.addEventListener('change', requestRender);

  // 依畫面大小決定預設視角（島置中、占畫布約 80%）與距離限制。不能平移，鏡頭只繞著目前的議題區或預設中心轉。
  let home = null;
  // 投影中心移到沒被遮住的區域正中（浮動元件加上卡片）。只移投影中心，鏡頭位置與畫面縮放都不變。
  function applyOffset() {
    const { width, height } = stageSize;
    if (width === 0 || height === 0) return;
    const offset = viewOffset({ width, height, insets: combineInsets(baseInsets, shown, stageSize), canvasFov: FOV });
    camera.fov = offset.fov;
    camera.aspect = offset.fullWidth / offset.fullHeight;
    camera.setViewOffset(offset.fullWidth, offset.fullHeight, offset.x, offset.y, width, height);
    camera.updateProjectionMatrix();
  }

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    stageSize = { width, height };
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    baseInsets = insets();
    applyOffset();
    const narrow = width <= NARROW_WIDTH;
    for (const anchor of labelAnchors) anchor.position.copy(narrow ? LABEL_NARROW : LABEL_WIDE);
    // 斷點換了名牌的字級與內容。
    remeasureLabels();
    // 預設視角只看浮動元件遮住的範圍，不看卡片：卡片開關時不重新構圖。
    const base = viewOffset({ width, height, insets: baseInsets, canvasFov: FOV });
    const view = homeView(outline, { fov: base.visibleFov, aspect: base.visibleAspect });
    Object.assign(controls, cameraLimits(bounds, view.distance));
    home = { ...view, target: new THREE.Vector3(view.target.x, 0, view.target.z) };
    // 使用者還沒轉動、縮放或選過議題區時，畫布尺寸一變就重新構圖。
    if (!touched && !flight.active) placeCamera(home);
    requestRender();
  };
  let touched = false;
  controls.addEventListener('start', () => {
    touched = true;
  });

  function placeCamera({ target, polar, azimuth, distance }) {
    controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth));
    camera.lookAt(target);
  }

  // 鏡頭飛到 target，距離為 distance；沒給 polar 與 azimuth 時保持目前的俯角與方位角。
  // 減少動態時直接切過去。
  function flyTo({ target, distance, polar, azimuth }, done = () => {}) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.phi = polar ?? spherical.phi;
    spherical.theta = azimuth ?? spherical.theta;
    spherical.radius = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    const toPosition = target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
    focus = { x: target.x, z: target.z };
    touched = true;
    controls.enableDamping = !reducedMotion();
    // 飛行途中又選了別的議題區：新的飛行取代前一段，前一段抵達後的動作不再執行。
    flight.start({
      from: { target: controls.target.clone(), position: camera.position.clone() },
      to: { target: target.clone(), position: toPosition },
      now: performance.now(),
      durationMs: flightDuration({ reducedMotion: reducedMotion() }),
      onArrive: done,
    });
    // 減少動態時飛行時間為 0：立刻落在目的地。
    if (reducedMotion()) {
      const pose = flight.step(performance.now());
      controls.target.copy(pose.target);
      camera.position.copy(pose.position);
    }
    requestRender();
  }

  let selectedId = null;
  let dimmed = new Set();
  const paintTile = (id) => {
    const tile = tiles.get(id);
    islandBody.paint(id, { selected: id === selectedId, dimmed: dimmed.has(id) });
    tile.group.position.y = id === selectedId ? SELECTED_LIFT : 0;
    kit.setOwnerOffset(id, tile.group.position.y);
    islandBody.setLift(id, tile.group.position.y);
    decor.setLift(id, tile.group.position.y);
    tile.label.classList.toggle('is-selected', id === selectedId);
    tile.label.classList.toggle('is-dimmed', dimmed.has(id));
  };
  const tileCenter = (id) => {
    const { position } = tiles.get(id).group;
    return { x: position.x, z: position.z };
  };

  function select(areaId) {
    const previous = selectedId;
    selectedId = tiles.has(areaId) ? areaId : null;
    if (previous) paintTile(previous);
    if (selectedId) paintTile(selectedId);
    selection.select(selectedId && tileCenter(selectedId));
    selection.hover(hoveredId && tileCenter(hoveredId));
    // 有選中的議題區時，其他名牌變淡。
    labelRenderer.domElement.classList.toggle('has-selection', Boolean(selectedId));
    labelsDirty = true;
    requestRender();
  }

  // 射線打到的第一個議題區格子或候選人人物，回傳 { areaId } 或 { candidateId }。
  // 合批的零件從零件庫查回議題區，其餘往上找格子群組。裝飾格與路燈的零件沒有議題區，射線穿過去。
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const targetOf = (hit) => {
    if (hit.object.userData.candidateId) return { candidateId: hit.object.userData.candidateId };
    if (hit.object.userData.kit) {
      const areaId = kit.ownerOf(hit);
      return areaId ? { areaId } : null;
    }
    let node = hit.object;
    while (node && !node.userData.areaId) node = node.parent;
    return node ? { areaId: node.userData.areaId } : null;
  };
  function targetAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects([...pickable, ...figureHits], true).map(targetOf).find(Boolean) ?? null;
  }

  // 滑過格子或人物（桌面滑鼠）：格子顯示淡色外框；游標旁顯示議題區編號與名稱，或人物的形狀與姓名。
  // 每幀最多查一次射線。
  const hoverTip = el('p', { class: 'island-hover', 'aria-hidden': 'true' });
  hoverTip.hidden = true;
  stage.append(hoverTip);
  // hoveredId 是滑過的議題區（外框用）；hoveredKey 另含人物，判斷滑過目標有沒有變。
  let hoveredId = null;
  let hoveredKey = null;
  let hoverAt = null;
  let hoverPending = false;
  const setHover = (target) => {
    const key = target ? target.areaId ?? `candidate:${target.candidateId}` : null;
    if (key === hoveredKey) return;
    hoveredKey = key;
    hoveredId = target?.areaId ?? null;
    selection.hover(hoveredId && tileCenter(hoveredId));
    renderer.domElement.classList.toggle('is-hovering', Boolean(target));
    hoverTip.hidden = !target;
    if (target) {
      hoverTip.replaceChildren(...(target.areaId
        ? [...tiles.get(target.areaId).label.childNodes].map((node) => node.cloneNode(true))
        : plate(plaza.figures.find((f) => f.candidateId === target.candidateId))));
    }
    requestRender();
  };
  const updateHover = () => {
    hoverPending = false;
    if (!hoverAt) return setHover(null);
    setHover(targetAt(hoverAt.x, hoverAt.y));
    if (!hoveredKey) return;
    const rect = stage.getBoundingClientRect();
    hoverTip.style.left = `${hoverAt.x - rect.left}px`;
    hoverTip.style.top = `${hoverAt.y - rect.top}px`;
  };

  // 依 pointerId 記每根手指按下的位置；同時有兩指以上（雙指縮放）就整次不算點選。
  // 按下後移動超過門檻（拖曳旋轉）、雙指縮放或滾輪縮放都會取消鏡頭飛行。
  const downs = new Map();
  let multiTouch = false;
  const release = (event) => {
    downs.delete(event.pointerId);
    if (downs.size === 0) multiTouch = false;
  };
  renderer.domElement.addEventListener('pointerdown', (event) => {
    downs.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (downs.size > 1) {
      multiTouch = true;
      flight.cancel();
    }
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (isDrag(downs.get(event.pointerId), { x: event.clientX, y: event.clientY })) flight.cancel();
    if (event.pointerType !== 'mouse') return;
    // 拖曳中不顯示滑過。
    hoverAt = event.buttons === 0 ? { x: event.clientX, y: event.clientY } : null;
    if (!hoverPending) {
      hoverPending = true;
      requestAnimationFrame(updateHover);
    }
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    hoverAt = null;
    setHover(null);
  });
  renderer.domElement.addEventListener('wheel', () => flight.cancel(), { passive: true });
  renderer.domElement.addEventListener('pointercancel', release);
  renderer.domElement.addEventListener('pointerup', (event) => {
    const down = downs.get(event.pointerId);
    const isClick = down && !multiTouch && !isDrag(down, { x: event.clientX, y: event.clientY });
    release(event);
    if (!isClick) return;
    const target = targetAt(event.clientX, event.clientY);
    if (target?.areaId) onSelectArea(target.areaId);
    else if (target?.candidateId) onSelectCandidate?.(target.candidateId);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  document.fonts?.ready.then(() => {
    remeasureLabels();
    requestRender();
  });
  // 使用者中途切換系統的減少動態設定，重畫一次讓動畫停住或開始走。
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', requestRender);

  return {
    // 切換時段：'dawn'、'day'、'dusk'、'night'（island-daylight.js 的 TIMES_OF_DAY），約 1.4 秒補間；
    // 減少動態時直接切過去。不認得的時段回傳 false。
    setTimeOfDay(id) {
      const changed = daylight.set(id, performance.now(), { instant: reducedMotion() });
      if (changed) requestRender();
      return changed;
    },
    timeOfDay() {
      return daylight.current;
    },
    // 暫停按鈕：true 時所有裝飾動畫停在目前畫格。
    setPaused(paused) {
      animator.setPaused(paused);
      requestRender();
    },
    paused() {
      return animator.paused;
    },
    // 給後續的場景模組註冊裝飾動畫 fn(t, dt, env)，回傳取消函式。見 island-clock.js。
    addAnimation(fn) {
      const remove = animator.add(fn);
      requestRender();
      return remove;
    },
    // 上一幀的繪製呼叫數與畫質，給量測與除錯用。
    stats() {
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        // 合批的零件數與合批網格數（每個一次繪製呼叫）。
        parts: kit.meshes.reduce((sum, mesh) => sum + mesh.userData.parts, 0),
        partMeshes: kit.meshes.length,
        pixelRatio: renderer.getPixelRatio(),
        quality: quality.level,
        // 上一幀的夜間係數（補間途中介於兩個時段之間）。
        night: lastNight,
      };
    },
    // 套用篩選結果：只改標記亮暗與議題區淡化，島的形狀不變。
    update(filtered) {
      const next = islandLayout(vm, { filtered });
      dimmed = new Set(next.tiles.filter((t) => t.dimmed).map((t) => t.id));
      for (const tileInfo of next.tiles) {
        const tile = tiles.get(tileInfo.id);
        if (!tile) continue;
        tileInfo.markers.forEach((info, i) => setMarkerLit(tile.markers[i], info.lit));
        paintTile(tileInfo.id);
      }
      requestRender();
    },
    // 選中議題區並把鏡頭飛過去，抵達後呼叫 done。
    focusArea(areaId, done) {
      const tile = tiles.get(areaId);
      if (!tile) return false;
      select(areaId);
      const target = new THREE.Vector3(tile.group.position.x, TILE_SURFACE, tile.group.position.z);
      flyTo({ target, distance: Math.min(FOCUS_DISTANCE, home?.distance ?? FOCUS_DISTANCE) }, done);
      return true;
    },
    // 工具列的「全景」：回到預設視角，選中的議題區不變。
    showAll() {
      if (home) flyTo(home);
    },
    // 政見卡片遮住的範圍（getBoundingClientRect，卡片關閉時傳 null）。畫面偏移把投影中心移到其餘可見區正中，
    // 選中的議題區落在可見區中央；鏡頭不動，偏移平滑跟上，減少動態時直接到位。
    setCover(rect) {
      labelsDirty = true;
      const box = stage.getBoundingClientRect();
      // 表格檢視時畫布隱藏、量不到大小，不更新；卡片關閉時一律清掉偏移。
      if (rect && (box.width === 0 || box.height === 0)) return;
      const local = rect
        ? { left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top }
        : { left: 0, top: 0, right: 0, bottom: 0 };
      cover = coverInsets(local, { width: box.width, height: box.height });
      requestRender();
    },
    resize,
    // 浮動元件變了（例如名牌開關、索引抽屜或候選人資料卡開關）時重排名牌。
    refreshLabels() {
      labelsDirty = true;
      requestRender();
    },
  };
}
