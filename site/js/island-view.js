// 島嶼檢視：把島嶼配置畫成 3D 場景。只讀檢視模型（經 island-layout.js），不直接碰公開資料集。
// 由 main.js 以動態 import 載入，不支援 WebGL 的裝置不會下載 three.js。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { cameraLimits, flightPlan, islandLayout, islandPoints, orbitCenter, tileCorners, viewOffset } from './island-layout.js';
import { approachInsets, combineInsets, coverInsets, createCameraFlight, homeView, isDrag, sameInsets } from './island-camera.js';
import { createSelection, SELECTED_LIFT } from './island-selection.js';
import { createFpsGovernor, initialQuality } from './island-quality.js';
import { createDaylight } from './island-daylight.js';
import { createAnimator } from './island-clock.js';
import { createEnvironment } from './island-environment.js';
import { instancify } from './island-kit.js';
import { hexTile, localElementModel, markerModel, PALETTE, setMarkerLit, streetLamps, TILE_SURFACE } from './island-models.js';
import { el } from './dom.js';

const FOV = 32;
// 窄畫面的名牌改成直書（見 LABEL_NARROW）。全景的俯角與方位角由 island-camera.js 的 homeView 依長寬比決定。
const NARROW_WIDTH = 600;
// 飛到議題區時鏡頭與格子的距離。
const FOCUS_DISTANCE = 14;
// 議題區名牌的錨點（相對格心）。寬畫面的橫書名牌浮在元素北側上方；
// 窄畫面的直書名牌往上長，錨點放在格心正北，名牌落在南北兩列格子的標記之間，不蓋住標記。
const LABEL_WIDE = new THREE.Vector3(0, TILE_SURFACE + 1.35, -0.45);
const LABEL_NARROW = new THREE.Vector3(0, TILE_SURFACE + 0.9, -0.2);
// 構圖時算進的高度：格子頂面加上元素模型的最高高度（island-models.js 的元素區）。
const MODEL_TOP = TILE_SURFACE + 1.1;

// onSelectArea(areaId) 在使用者點選議題區格子時呼叫。
// reducedMotion 是讀取目前「減少動態」設定的函式，讓使用者中途改設定也會生效。
// insets() 回傳畫布四邊被浮動元件遮住的像素寬度 { top, right, bottom, left }。
export function createIslandView(stage, { vm, reducedMotion, onSelectArea, insets = () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }) {
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
  const { bounds } = layout;
  const outline = islandPoints(layout, { surface: TILE_SURFACE, top: MODEL_TOP });
  const center = new THREE.Vector3(bounds.center.x, 0, bounds.center.z);

  // 晝夜（預設白天）、天空、光照與發光材質。
  const daylight = createDaylight();
  const environment = createEnvironment(scene, { center, radius: bounds.radius, quality });
  // 裝飾動畫的時間；後續的動畫用 animator.add 註冊（見 island-clock.js）。
  const animator = createAnimator({ reducedMotion });
  const governor = createFpsGovernor(quality);
  let shadowEvery = quality.shadowEvery;
  let frame = 0;
  let lastNight = 0;

  // 每格一個群組：格子、在地感元素、三個標記、議題區名牌。
  const tiles = new Map();
  const pickable = [];
  const labelAnchors = [];
  for (const tileInfo of layout.tiles) {
    const g = new THREE.Group();
    g.position.set(tileInfo.position.x, 0, tileInfo.position.z);
    const { tile, top } = hexTile(layout.hexSize);
    if (tileInfo.kind === 'decorative') top.material.color.setHex(PALETTE.decorativeTop);
    g.add(tile);
    const model = tileInfo.localElement && localElementModel(tileInfo.localElement, tileInfo.kind);
    if (model) {
      model.position.y = TILE_SURFACE;
      g.add(model);
    }
    const markers = tileInfo.markers.map((info) => {
      const marker = markerModel(info);
      marker.position.set(info.offset.x, TILE_SURFACE + 0.01, info.offset.z);
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
      g.add(label);
      g.userData.areaId = tileInfo.id;
      pickable.push(g);
      tiles.set(tileInfo.id, { group: g, top, markers, label: name });
    }
    scene.add(g);
  }
  scene.add(streetLamps(tileCorners(layout)));
  // 靜態零件合批成 InstancedMesh，繪製呼叫數只看零件種類，不看零件數。
  const kit = instancify(scene, { glowMaterial: environment.glowMaterial });
  pickable.push(...kit.meshes);
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
    animator.tick(now, { night: lighting.night });
    // 有裝飾動畫在走時每幀重畫，陰影每 shadowEvery 幀更新；畫面靜止時只在有變化才重畫，每次都更新陰影。
    const animating = animator.running;
    frame += 1;
    renderer.shadowMap.needsUpdate = !animating || frame % shadowEvery === 0;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
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
    // 全景只看浮動元件遮住的範圍，不看卡片：卡片開關時不重新構圖。
    const base = viewOffset({ width, height, insets: baseInsets, canvasFov: FOV });
    const view = homeView(outline, { fov: base.visibleFov, aspect: base.visibleAspect, fill: 0.8 });
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

  // 鏡頭飛到 target，距離為 distance；沒給 view 時保持目前的方位角與俯角，給了就轉到該視角。
  // 減少動態時直接切過去。
  function flyTo(target, distance, done = () => {}, view = null) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (view) {
      spherical.phi = view.polar;
      spherical.theta = view.azimuth;
    }
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
      durationMs: flightPlan({ reducedMotion: reducedMotion() }).durationMs,
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
    const color = id === selectedId ? PALETTE.landSelected : dimmed.has(id) ? PALETTE.landDimmed : PALETTE.landTop;
    tile.top.material.color.setHex(color);
    tile.group.position.y = id === selectedId ? SELECTED_LIFT : 0;
    kit.setOwnerOffset(id, tile.group.position.y);
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
    requestRender();
  }

  // 射線打到的第一個議題區格子：合批的零件從實例查回議題區，其餘往上找格子群組。
  // 裝飾格與路燈的零件沒有議題區，射線穿過去。
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const areaOf = (hit) => {
    if (hit.object.isInstancedMesh) return kit.ownerOf(hit);
    let node = hit.object;
    while (node && !node.userData.areaId) node = node.parent;
    return node?.userData.areaId ?? null;
  };
  function areaAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickable, true).map(areaOf).find(Boolean) ?? null;
  }

  // 滑過格子（桌面滑鼠）：淡色外框，游標旁顯示議題區編號與名稱。每幀最多查一次射線。
  const hoverTip = el('p', { class: 'island-hover', 'aria-hidden': 'true' });
  hoverTip.hidden = true;
  stage.append(hoverTip);
  let hoveredId = null;
  let hoverAt = null;
  let hoverPending = false;
  const setHover = (areaId) => {
    if (areaId === hoveredId) return;
    hoveredId = areaId;
    selection.hover(areaId && tileCenter(areaId));
    renderer.domElement.classList.toggle('is-hovering', Boolean(areaId));
    hoverTip.hidden = !areaId;
    if (areaId) {
      const label = tiles.get(areaId).label;
      hoverTip.replaceChildren(...[...label.childNodes].map((node) => node.cloneNode(true)));
    }
    requestRender();
  };
  const updateHover = () => {
    hoverPending = false;
    if (!hoverAt) return setHover(null);
    setHover(areaAt(hoverAt.x, hoverAt.y));
    if (!hoveredId) return;
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
    const areaId = areaAt(event.clientX, event.clientY);
    if (areaId) onSelectArea(areaId);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
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
        // 合批的零件數與 InstancedMesh 數（每個一次繪製呼叫）。
        parts: kit.meshes.reduce((sum, mesh) => sum + mesh.count, 0),
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
      flyTo(target, Math.min(FOCUS_DISTANCE, home?.distance ?? FOCUS_DISTANCE), done);
      return true;
    },
    // 回到全景視角，選中的議題區不變。
    showAll() {
      if (home) flyTo(home.target, home.distance, undefined, home);
    },
    // 政見卡片遮住的範圍（getBoundingClientRect，卡片關閉時傳 null）。畫面偏移把投影中心移到其餘可見區正中，
    // 選中的議題區落在可見區中央；鏡頭不動，偏移平滑跟上，減少動態時直接到位。
    setCover(rect) {
      const box = stage.getBoundingClientRect();
      const local = rect
        ? { left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top }
        : { left: 0, top: 0, right: 0, bottom: 0 };
      cover = coverInsets(local, { width: box.width, height: box.height });
      requestRender();
    },
    resize,
  };
}
