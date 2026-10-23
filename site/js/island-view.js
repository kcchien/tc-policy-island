// 島嶼檢視：把島嶼配置畫成 3D 場景。只讀檢視模型（經 island-layout.js），不直接碰公開資料集。
// 由 main.js 以動態 import 載入，不支援 WebGL 的裝置不會下載 three.js。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { cameraLimits, easeInOut, flightPlan, frameIsland, islandLayout, islandPoints, orbitCenter, qualityFor } from './island-layout.js';
import { hexTile, localElementModel, markerModel, PALETTE, setMarkerLit, TILE_SURFACE } from './island-models.js';
import { el } from './dom.js';

const FOV = 32;
// 預設視角的仰角（與正上方的夾角）。窄畫面看得比較正上方，上下兩列的名牌才拉得開。
const POLAR_WIDE = 0.68;
const POLAR_NARROW = 0.42;
const NARROW_WIDTH = 600;
// 飛到議題區時鏡頭與格子的距離。
const FOCUS_DISTANCE = 14;
// 按下與放開的位移在這個像素內才算點選，超過算拖曳旋轉。
const CLICK_SLOP = 6;
// 議題區名牌的錨點（相對格心）。寬畫面的橫書名牌浮在元素北側上方；
// 窄畫面的直書名牌往上長，錨點放在格心正北，名牌落在南北兩列格子的標記之間，不蓋住標記。
const LABEL_WIDE = new THREE.Vector3(0, TILE_SURFACE + 1.35, -0.45);
const LABEL_NARROW = new THREE.Vector3(0, TILE_SURFACE + 0.9, -0.2);
// 構圖時算進的高度：格子頂面加上元素模型的最高高度（island-models.js 的元素區）。
const MODEL_TOP = TILE_SURFACE + 1.1;

// onSelectArea(areaId) 在使用者點選議題區格子時呼叫。
// reducedMotion 是讀取目前「減少動態」設定的函式，讓使用者中途改設定也會生效。
export function createIslandView(stage, { vm, reducedMotion, onSelectArea }) {
  const quality = qualityFor({
    width: window.innerWidth,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    devicePixelRatio: window.devicePixelRatio || 1,
  });

  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'low-power' });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.classList.add('island-canvas');
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.classList.add('island-labels');
  labelRenderer.domElement.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement, labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.background);
  scene.fog = new THREE.Fog(PALETTE.background, 60, 140);

  const layout = islandLayout(vm);
  const { bounds } = layout;
  const outline = islandPoints(layout, { surface: TILE_SURFACE, top: MODEL_TOP });
  const center = new THREE.Vector3(bounds.center.x, 0, bounds.center.z);

  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.6));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(center.x - 10, 22, center.z + 12);
  sun.target.position.copy(center);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -bounds.radius, right: bounds.radius, top: bounds.radius, bottom: -bounds.radius, near: 1, far: 60 });
  scene.add(sun, sun.target);

  const water = new THREE.Mesh(new THREE.CircleGeometry(bounds.radius * 6, 48), new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.75 }));
  water.rotation.x = -Math.PI / 2;
  water.position.copy(center).setY(0.12);
  water.receiveShadow = true;
  scene.add(water);

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
      const name = el('span', { class: 'island-label' }, tileInfo.name);
      const label = new CSS2DObject(el('span', { class: 'island-label-anchor' }, name));
      labelAnchors.push(label);
      g.add(label);
      g.userData.areaId = tileInfo.id;
      pickable.push(g);
      tiles.set(tileInfo.id, { group: g, top, markers, label: name });
    }
    scene.add(g);
  }

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion();
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  let renderPending = false;
  let flight = null;
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
    if (flight) stepFlight(now);
    else recenter();
    const moving = controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    if (moving || flight) requestRender();
  };
  const requestRender = () => {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(render);
  };
  controls.addEventListener('change', requestRender);

  // 依畫面大小決定預設視角（島置中、占畫布約 80%）與距離限制。不能平移，鏡頭只繞著目前的議題區或預設中心轉。
  let home = null;
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const narrow = width <= NARROW_WIDTH;
    const polar = narrow ? POLAR_NARROW : POLAR_WIDE;
    for (const anchor of labelAnchors) anchor.position.copy(narrow ? LABEL_NARROW : LABEL_WIDE);
    const frame = frameIsland(outline, { fov: FOV, aspect, polar, fill: 0.8 });
    Object.assign(controls, cameraLimits(bounds, frame.distance));
    home = { polar, distance: frame.distance, target: new THREE.Vector3(frame.target.x, 0, frame.target.z) };
    // 使用者還沒轉動、縮放或選過議題區時，畫布尺寸一變就重新構圖。
    if (!touched && !flight) placeCamera(home.target, polar, home.distance);
    requestRender();
  };
  let touched = false;
  controls.addEventListener('start', () => {
    touched = true;
  });

  function placeCamera(target, polar, distance) {
    controls.target.copy(target);
    camera.position.set(target.x, target.y + Math.cos(polar) * distance, target.z + Math.sin(polar) * distance);
    camera.lookAt(target);
  }

  function stepFlight(now) {
    const t = Math.min(1, (now - flight.start) / flight.duration);
    const k = easeInOut(t);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, k);
    if (t >= 1) {
      const done = flight.done;
      flight = null;
      done();
    }
  }

  // 鏡頭飛到 target，保持目前的方位角，距離為 distance。減少動態時直接切過去。
  function flyTo(target, distance, done = () => {}) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.radius = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    const toPosition = target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
    focus = { x: target.x, z: target.z };
    touched = true;
    controls.enableDamping = !reducedMotion();
    const { durationMs } = flightPlan({ reducedMotion: reducedMotion() });
    if (durationMs === 0) {
      flight = null;
      controls.target.copy(target);
      camera.position.copy(toPosition);
      requestRender();
      done();
      return;
    }
    flight = {
      start: performance.now(),
      duration: durationMs,
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      fromPosition: camera.position.clone(),
      toPosition,
      done,
    };
    requestRender();
  }

  let selectedId = null;
  let dimmed = new Set();
  const paintTile = (id) => {
    const tile = tiles.get(id);
    const color = id === selectedId ? PALETTE.landSelected : dimmed.has(id) ? PALETTE.landDimmed : PALETTE.landTop;
    tile.top.material.color.setHex(color);
    tile.group.position.y = id === selectedId ? 0.12 : 0;
    tile.label.classList.toggle('is-selected', id === selectedId);
    tile.label.classList.toggle('is-dimmed', dimmed.has(id));
  };

  function select(areaId) {
    const previous = selectedId;
    selectedId = tiles.has(areaId) ? areaId : null;
    if (previous) paintTile(previous);
    if (selectedId) paintTile(selectedId);
    requestRender();
  }

  // 點選：射線打到的第一個議題區格子。
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // 依 pointerId 記每根手指按下的位置；同時有兩指以上（雙指縮放）就整次不算點選。
  const downs = new Map();
  let multiTouch = false;
  const release = (event) => {
    downs.delete(event.pointerId);
    if (downs.size === 0) multiTouch = false;
  };
  renderer.domElement.addEventListener('pointerdown', (event) => {
    downs.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (downs.size > 1) multiTouch = true;
  });
  renderer.domElement.addEventListener('pointercancel', release);
  renderer.domElement.addEventListener('pointerup', (event) => {
    const down = downs.get(event.pointerId);
    const isClick = down && !multiTouch && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= CLICK_SLOP;
    release(event);
    if (!isClick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, true)[0];
    let node = hit?.object;
    while (node && !node.userData.areaId) node = node.parent;
    if (node) onSelectArea(node.userData.areaId);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  return {
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
    // 回到看得到整座島的距離，選中的議題區不變。
    showAll() {
      if (home) flyTo(home.target, home.distance);
    },
    resize,
  };
}
