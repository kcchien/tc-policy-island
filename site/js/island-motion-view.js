// 島嶼的動態：每格的循環道具、市民、沿步道環與橋繞行的公車與火車。步道與橋本身是島體（island-body-view.js）。
// 配置一律來自 island-motion.js 的 motionPlan（只讀格子，不讀政見）；這裡只把配置畫成 3D。
// 靜態零件（道具底座）用零件庫的共用幾何，之後由 instancify 合批；
// 會動的零件每種一個 InstancedMesh，每幀由動畫迴圈更新矩陣，繪製呼叫數不隨格子數增加。

import * as THREE from 'three';
import {
  CITIZEN_FIGURE, CITIZEN_ROLES, citizenPose, citizenZoom, loopPose, motionPlan, RIDE_LIFT, VEHICLE_HALF_WIDTH, vehiclePose,
} from './island-motion.js';
import { tileAt } from './island-body.js';
import { material, PALETTE, PARTS, TILE_SURFACE } from './island-models.js';

// 3D 材質色碼，受禁用色檢查（ADR 0001）。衣服只用低飽和的大地色，不用任何政黨或候選人的識別色。
export const MOTION_PALETTE = {
  road: 0x8c847b,
  skin: 0xc49a7c,
  trousers: 0x4f4a45,
  clothes: [0x8a5a44, 0x9a7b55, 0x6f6a58, 0xa86f5a, 0x7c6f66, 0xb59a74],
  hair: [0x3a302a, 0x5a4636, 0x6e655d, 0x2e2a27],
  eye: 0x2b2522,
  shadow: 0x3a332e,
  // 角色配件：學童帽用米色（不用常見的亮黃），其他都是低飽和的大地色。
  cap: 0xcdbb94,
  cane: 0x5e4a3c,
  bike: 0x5e5852,
  helmet: 0xc4a467,
  suitcase: 0x7a6a5e,
  stroller: 0x9a8b7c,
  train: 0x7a5c4c,
  trainRoof: 0x5e5852,
  bus: 0xb08a4e,
  busRoof: 0x8e6f42,
  cloth: 0xc8b47a,
  sail: 0xddd3c4,
  hull: 0x6b4a3c,
  steel: 0x6e655d,
  stone: 0xa59a8c,
};

// 車輛底部離步道面的高度（步道略高出島頂面）。
const VEHICLE_LIFT = 0.008;
// 橋的甲板頂面高出步道面的量（island-body-view.js 的甲板厚 0.022，中心在步道面）。
const BRIDGE_DECK = 0.011;
// 市民角色 → 角色資料（配件代號）。
const roleOf = (citizen) => CITIZEN_ROLES.find((r) => r.id === citizen.role);

// 零件庫的共用單位幾何（零件代號與 island-models.js 相同，同種形體合進同一桶）。
const unitBox = () => PARTS.box(1, 1, 1).geometry;
const unitCyl = (segments = 8) => PARTS.cyl(1, 1, 1, segments).geometry;
const unitIco = () => PARTS.ico(1).geometry;

// 靜態零件：共用單位幾何撐成 scale，instancify 會合批。
const part = (geometry, color, { scale = [1, 1, 1], ...at } = {}) => PARTS.mesh({ geometry, scale }, color, at);

// 逐實例上色的零件共用一份材質（底色維持預設，乘上實例顏色）。
let tintedMaterial = null;

// 會動的零件：每種一個 InstancedMesh，原點在零件的轉軸。
// color 是單一顏色，或每個實例一個顏色的函式 (i) → 色碼。發光件用共用的發光材質，顏色同樣寫在實例上。
function movingMesh(geometry, color, count, { glowMaterial = null } = {}) {
  const perInstance = typeof color === 'function' || glowMaterial;
  tintedMaterial ??= new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 });
  const base = glowMaterial ?? (perInstance ? tintedMaterial : material(color));
  const mesh = new THREE.InstancedMesh(geometry, base, count);
  if (perInstance) {
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) mesh.setColorAt(i, c.setHex(typeof color === 'function' ? color(i) : color));
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = !glowMaterial;
  mesh.receiveShadow = !glowMaterial;
  // 實例每幀移動，建立時的包圍球不準，不做視錐剔除。
  mesh.frustumCulled = false;
  mesh.userData.dynamic = true;
  return mesh;
}

const boxGeometry = (w, h, d, { pivot = [0, 0, 0] } = {}) => new THREE.BoxGeometry(w, h, d).translate(...pivot);

// 道具姿勢換算用的暫存，每幀重複使用。
const ripple = new THREE.Matrix4();
const jet = new THREE.Vector3();

// 循環道具：每個題材的靜態底座與會動的零件，以原尺寸組好，放上格子時乘配置的倍率（island-motion.js 的 LOOP_SCALE）。
// 原尺寸的範圍：底座與低處零件在半徑 0.05 以內，高 0.45 以內；會動零件離地 0.18 以上才可伸出到半徑 0.15
// （對應 island-motion.js 的 LOOP_CORE、LOOP_HEIGHT、LOOP_REACH、LOOP_REACH_FROM，測試據此確認不擋住標記、不進元素區）。
// 道具周圍的鋪面與灌木不跟著放大，固定 PAD_SCALE 倍；灌木放在朝格心的一側，避開格緣的市民路線。
const PAD_SCALE = 1.25;
// moving 的 transform(pose, m) 把零件在道具座標裡的矩陣寫進 m。
const LOOP_PROPS = {
  windmill: {
    base: () => [
      part(unitCyl(6), MOTION_PALETTE.stone, { scale: [0.045, 0.3, 0.045], y: 0.15 }),
      part(unitBox(), PALETTE.roof, { scale: [0.06, 0.05, 0.07], y: 0.31 }),
    ],
    moving: [{
      geometry: () => {
        const blade = boxGeometry(0.018, 0.13, 0.008, { pivot: [0, 0.065, 0] });
        const blades = [0, 1, 2, 3].map((i) => blade.clone().rotateZ((i * Math.PI) / 2));
        return mergeGeometries(blades);
      },
      color: MOTION_PALETTE.sail,
      transform: (pose, m) => m.makeRotationZ(pose.spin).setPosition(0, 0.31, 0.045),
    }],
  },
  fountain: {
    base: () => [
      part(unitCyl(10), MOTION_PALETTE.stone, { scale: [0.05, 0.04, 0.05], y: 0.02 }),
      part(unitCyl(10), PALETTE.shallow, { scale: [0.042, 0.01, 0.042], y: 0.042 }),
      part(unitCyl(6), MOTION_PALETTE.stone, { scale: [0.012, 0.08, 0.012], y: 0.08 }),
    ],
    moving: [{
      geometry: () => new THREE.ConeGeometry(0.032, 0.14, 6, 1, true).translate(0, -0.07, 0).rotateX(Math.PI),
      color: PALETTE.shallow,
      transform: (pose, m) => m.makeRotationY(pose.spin).scale(jet.set(1, pose.jet, 1)).setPosition(0, 0.12, 0),
    }],
  },
  flag: {
    base: () => [
      part(unitCyl(6), MOTION_PALETTE.stone, { scale: [0.035, 0.03, 0.035], y: 0.015 }),
      part(unitCyl(5), MOTION_PALETTE.steel, { scale: [0.008, 0.38, 0.008], y: 0.19 }),
    ],
    moving: [{
      geometry: () => boxGeometry(0.13, 0.075, 0.006, { pivot: [0.065, 0, 0] }),
      color: MOTION_PALETTE.cloth,
      transform: (pose, m) => m.makeRotationY(pose.wave).multiply(ripple.makeRotationX(pose.ripple)).setPosition(0, 0.33, 0),
    }],
  },
  crane: {
    base: () => [
      part(unitBox(), MOTION_PALETTE.stone, { scale: [0.07, 0.03, 0.07], y: 0.015 }),
      part(unitBox(), PALETTE.syrup, { scale: [0.025, 0.34, 0.025], y: 0.2 }),
    ],
    moving: [
      {
        geometry: () => mergeGeometries([
          boxGeometry(0.18, 0.018, 0.018, { pivot: [0.05, 0, 0] }),
          boxGeometry(0.035, 0.03, 0.03, { pivot: [-0.045, -0.005, 0] }),
        ]),
        color: PALETTE.syrup,
        transform: (pose, m) => m.makeRotationY(pose.swing).setPosition(0, 0.37, 0),
      },
      {
        geometry: () => mergeGeometries([
          boxGeometry(0.003, 0.08, 0.003, { pivot: [0, -0.04, 0] }),
          boxGeometry(0.02, 0.02, 0.02, { pivot: [0, -0.09, 0] }),
        ]),
        color: MOTION_PALETTE.steel,
        // 吊鉤掛在吊臂前端，跟著吊臂轉，上下收放。
        transform: (pose, m) => m.makeTranslation(0.12 * Math.cos(pose.swing), 0.36 + pose.hook, -0.12 * Math.sin(pose.swing)),
      },
    ],
  },
  boat: {
    base: () => [
      part(unitCyl(12), MOTION_PALETTE.stone, { scale: [0.05, 0.03, 0.05], y: 0.015 }),
      part(unitCyl(12), PALETTE.water, { scale: [0.044, 0.01, 0.044], y: 0.032 }),
    ],
    moving: [{
      geometry: () => mergeGeometries([
        boxGeometry(0.046, 0.014, 0.022, { pivot: [0, 0.008, 0] }),
        new THREE.ConeGeometry(0.02, 0.06, 3).translate(0, 0.045, 0),
      ]),
      color: MOTION_PALETTE.hull,
      transform: (pose, m) => m.makeRotationZ(pose.roll).setPosition(pose.drift, 0.04 + pose.bob, 0),
    }],
  },
};

// 合併幾個 BufferGeometry（同樣的屬性）成一個。只合 position、normal，夠低多邊形零件用。
function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const arrays = parts.map((g) => g.attributes[name].array);
    const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  return merged;
}

// 市民：Q 版大頭小人，零件的尺寸與位置來自 island-motion.js 的 CITIZEN_FIGURE（原尺寸，臉朝 +x），
// 放上格子時乘配置的倍率與鏡頭距離的放大（citizenZoom）。每種零件一個 InstancedMesh，腿與手臂的原點在上端，擺動時繞髖、肩轉。
const swingPart = (p) => boxGeometry(p.width, p.height, p.width, { pivot: [0, -p.height / 2, 0] });
const CITIZEN_GEOMETRY = {
  leg: swingPart,
  arm: swingPart,
  body: (p) => new THREE.CapsuleGeometry(p.radius, p.length, 3, 8).translate(...p.at),
  head: (p) => new THREE.SphereGeometry(p.radius, 10, 8).translate(...p.at),
  // 髮殼往後腦傾斜，露出額頭與眼睛（鏡頭多半從斜上方看）。
  hair: (p) => new THREE.SphereGeometry(p.radius, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateZ(0.95).translate(...p.at),
  eye: (p) => new THREE.SphereGeometry(p.radius, 5, 4).translate(...p.at),
};
// 零件的顏色：衣服、頭髮依市民的順序輪替，與格子內容無關。
const CITIZEN_COLORS = {
  leg: () => MOTION_PALETTE.trousers,
  arm: (i) => MOTION_PALETTE.clothes[i % MOTION_PALETTE.clothes.length],
  body: (i) => MOTION_PALETTE.clothes[i % MOTION_PALETTE.clothes.length],
  head: () => MOTION_PALETTE.skin,
  hair: (i) => MOTION_PALETTE.hair[i % MOTION_PALETTE.hair.length],
  eye: () => MOTION_PALETTE.eye,
};
const HEAD = CITIZEN_FIGURE.parts.find((p) => p.part === 'head');
const HEAD_TOP = HEAD.at[1] + HEAD.radius;

// 角色配件（原尺寸、臉朝 +x）：大小守住 island-motion.js 的 ACCESSORY_TOP、ACCESSORY_CROWN、ACCESSORY_LOW、ACCESSORY_REACH。
// pose 是手臂的固定姿勢（繞肩往前的角度，null 表示照走路擺動），ride 表示騎在車上（身體抬高、腿踩踏板）。
const wheel = (x, r, tube) => new THREE.TorusGeometry(r, tube, 4, 12).translate(x, r, 0);
const ACCESSORIES = {
  // 學童的圓帽加帽簷，用中性的米色。
  cap: {
    color: MOTION_PALETTE.cap,
    geometry: () => mergeGeometries([
      new THREE.SphereGeometry(HEAD.radius + 0.003, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, HEAD.at[1] + 0.004, 0),
      boxGeometry(0.024, 0.004, 0.026, { pivot: [0.026, HEAD.at[1] + 0.006, 0] }),
    ]),
  },
  // 長者的拐杖，拿在右手（+z 側）往前一點。
  cane: {
    color: MOTION_PALETTE.cane,
    arm: { right: 0.6 },
    geometry: () => mergeGeometries([
      new THREE.CylinderGeometry(0.003, 0.003, 0.058, 5).translate(0.024, 0.029, 0.024),
      boxGeometry(0.014, 0.004, 0.004, { pivot: [0.02, 0.058, 0.024] }),
    ]),
  },
  // 通勤族的腳踏車：兩個輪子、車架、坐墊、把手。
  bicycle: {
    color: MOTION_PALETTE.bike,
    ride: true,
    arm: { left: 0.9, right: 0.9 },
    geometry: () => mergeGeometries([
      wheel(-0.034, 0.019, 0.003),
      wheel(0.034, 0.019, 0.003),
      boxGeometry(0.07, 0.004, 0.004, { pivot: [0, 0.032, 0] }),
      boxGeometry(0.004, 0.022, 0.004, { pivot: [-0.008, 0.04, 0] }),
      boxGeometry(0.014, 0.004, 0.01, { pivot: [-0.008, 0.052, 0] }),
      boxGeometry(0.004, 0.026, 0.004, { pivot: [0.03, 0.044, 0] }),
      boxGeometry(0.004, 0.004, 0.034, { pivot: [0.03, 0.058, 0] }),
    ]),
  },
  // 農夫的斗笠：低平的圓錐。
  strawHat: {
    color: PALETTE.straw,
    geometry: () => new THREE.ConeGeometry(0.042, 0.026, 12).translate(0, 0.142 + 0.013, 0),
  },
  // 工人的安全帽：半球加一圈帽緣。
  helmet: {
    color: MOTION_PALETTE.helmet,
    geometry: () => mergeGeometries([
      new THREE.SphereGeometry(HEAD.radius + 0.004, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, HEAD.at[1] + 0.002, 0),
      new THREE.CylinderGeometry(0.04, 0.04, 0.004, 12).translate(0, HEAD.at[1] + 0.002, 0),
    ]),
  },
  // 旅客的行李箱：拉在身後（-x），手往後伸。
  suitcase: {
    color: MOTION_PALETTE.suitcase,
    arm: { right: -0.45 },
    geometry: () => mergeGeometries([
      boxGeometry(0.024, 0.034, 0.02, { pivot: [-0.045, 0.019, 0.02] }),
      boxGeometry(0.003, 0.03, 0.003, { pivot: [-0.04, 0.05, 0.02] }),
      wheel(-0.045, 0.003, 0.0015),
    ]),
  },
  // 推嬰兒車：車籃、車篷、四個小輪子、把手，兩手往前推。
  stroller: {
    color: MOTION_PALETTE.stroller,
    arm: { left: 0.75, right: 0.75 },
    geometry: () => mergeGeometries([
      boxGeometry(0.036, 0.022, 0.03, { pivot: [0.046, 0.036, 0] }),
      new THREE.SphereGeometry(0.018, 8, 4, 0, Math.PI, 0, Math.PI / 2).rotateY(Math.PI / 2).translate(0.046, 0.047, 0),
      boxGeometry(0.004, 0.04, 0.026, { pivot: [0.026, 0.046, 0] }),
      ...[0.034, 0.054].flatMap((x) => [-0.013, 0.013].map((z) => new THREE.CylinderGeometry(0.007, 0.007, 0.004, 8).rotateX(Math.PI / 2).translate(x, 0.007, z))),
    ]),
  },
};

// 車輛：車身、車頂、兩側窗帶（夜裡發光）、車燈（夜裡發光）。長度方向沿 +x。
const VEHICLES = {
  train: { length: 0.32, width: 2 * VEHICLE_HALF_WIDTH.train, height: 0.07, color: MOTION_PALETTE.train, roof: MOTION_PALETTE.trainRoof },
  bus: { length: 0.22, width: 2 * VEHICLE_HALF_WIDTH.bus, height: 0.075, color: MOTION_PALETTE.bus, roof: MOTION_PALETTE.busRoof },
};

// scene 是島嶼場景；layout 是 islandLayout 的結果；groupOf(areaId) 回傳該格的群組（靜態零件放進去，選取抬高時跟著動）。
// glowMaterial 是 island-environment.js 的共用發光材質。回傳 update(t, dt, env)，用 addAnimation 註冊。
export function createMotion(scene, layout, { level, groupOf, glowMaterial }) {
  const plan = motionPlan(layout, { level });
  const areas = plan.tiles.filter((t) => t.kind === 'area');
  const liftOf = (id) => groupOf(id)?.position.y ?? 0;

  // 循環道具的底座放進格子群組（相對格心），零件庫合批時記得是哪一格。
  for (const tile of areas) {
    const group = groupOf(tile.id);
    for (const loop of tile.loops) {
      const at = (scale) => {
        const holder = new THREE.Group();
        holder.position.set(loop.x, TILE_SURFACE, loop.z);
        holder.scale.setScalar(scale);
        holder.rotation.y = loop.mirror ? Math.PI : 0;
        group.add(holder);
        return holder;
      };
      // 道具周圍的小鋪面與兩叢矮灌木，每格都一樣。
      at(PAD_SCALE).add(
        part(unitCyl(10), MOTION_PALETTE.road, { scale: [0.1, 0.008, 0.1], y: 0.004 }),
        // 兩叢南北對稱：東側道具轉 180 度放，對稱才不會讓灌木換到標記那一側。
        part(unitIco(), PALETTE.foliage, { scale: [0.022, 0.02, 0.022], x: 0.08, y: 0.016, z: -0.035 }),
        part(unitIco(), PALETTE.foliageDark, { scale: [0.022, 0.02, 0.022], x: 0.08, y: 0.016, z: 0.035 }),
      );
      at(loop.scale).add(...LOOP_PROPS[tile.theme].base());
    }
  }

  // 會動的道具零件：每個題材的每種零件一個 InstancedMesh，實例是用到該題材的每個道具。
  const movers = [];
  for (const [theme, prop] of Object.entries(LOOP_PROPS)) {
    const spots = areas.filter((t) => t.theme === theme).flatMap((tile) => tile.loops.map((loop) => ({ tile, loop })));
    if (spots.length === 0) continue;
    for (const piece of prop.moving) {
      const mesh = movingMesh(piece.geometry(), piece.color, spots.length);
      scene.add(mesh);
      movers.push({ theme, piece, mesh, spots });
    }
  }

  // 市民：每格同數，沿自己島的步道環走，途中過橋到鄰島再走回來。
  // 每種零件一個 InstancedMesh：同種零件每人有幾個（腿、手臂、眼睛各兩個），實例就是人數的幾倍，依市民順序排。
  const citizens = areas.flatMap((tile) => tile.citizens.map((citizen) => ({ tile, citizen, accessory: ACCESSORIES[roleOf(citizen).accessory] })));
  const citizenParts = Object.entries(CITIZEN_GEOMETRY).map(([name, geometry]) => {
    const parts = CITIZEN_FIGURE.parts.filter((p) => p.part === name);
    const mesh = movingMesh(geometry(parts[0]), (i) => CITIZEN_COLORS[name](Math.floor(i / parts.length)), citizens.length * parts.length);
    // 眼睛太小，不投影。
    mesh.castShadow = name !== 'eye';
    scene.add(mesh);
    return { name, parts, mesh };
  });
  // 腳下的假影子：半透明的深色圓片，不寫深度，不受光。
  const shadowMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(CITIZEN_FIGURE.shadow.radius, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: MOTION_PALETTE.shadow, transparent: true, opacity: CITIZEN_FIGURE.shadow.opacity, depthWrite: false }),
    citizens.length,
  );
  shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadowMesh.frustumCulled = false;
  shadowMesh.userData.dynamic = true;
  scene.add(shadowMesh);
  // 配件：每種一個 InstancedMesh，實例是有這種配件的市民。
  const accessoryMeshes = new Map(Object.entries(ACCESSORIES).flatMap(([name, spec]) => {
    const owners = citizens.filter((c) => c.accessory === spec);
    if (owners.length === 0) return [];
    const mesh = movingMesh(spec.geometry(), spec.color, owners.length);
    scene.add(mesh);
    return [[spec, { mesh, owners }]];
  }));

  // 車輛：每節車廂一組車身、車頂、窗帶、車燈。
  const cars = plan.vehicles.flatMap((vehicle) => Array.from({ length: vehicle.cars }, (_, index) => ({ vehicle, index, spec: VEHICLES[vehicle.kind] })));
  const lifted = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const carBody = movingMesh(lifted(), (i) => cars[i].spec.color, cars.length);
  const carRoof = movingMesh(lifted(), (i) => cars[i].spec.roof, cars.length);
  const carWindows = movingMesh(new THREE.BoxGeometry(1, 1, 1), PALETTE.windowGlow, cars.length, { glowMaterial });
  // 車燈只在每輛車的第一節車頭。
  const leads = cars.filter((car) => car.index === 0);
  const headlights = movingMesh(new THREE.BoxGeometry(0.008, 0.014, 0.05), PALETTE.lampGlow, leads.length, { glowMaterial });
  scene.add(carBody, carRoof, carWindows, headlights);

  const m = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const place = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  // heading 是 atan2(dz, dx)；零件的長度方向是 +x，繞 y 轉 -heading 才會對齊行進方向。
  const placeAt = (x, y, z, heading, scale = 1) => place.compose(v.set(x, y, z), q.setFromAxisAngle(up, -heading), s.setScalar(scale));

  const carMeshes = [carBody, carRoof, carWindows, headlights];
  const poses = {};
  const vehiclePoses = new Map();

  // env.cameraDistance 是鏡頭到旋轉中心的距離，市民依此放大（citizenZoom）。
  function update(t, dt, env = {}) {
    for (const theme in LOOP_PROPS) poses[theme] = loopPose(theme, t);
    for (const { theme, piece, mesh, spots } of movers) {
      spots.forEach(({ tile, loop }, i) => {
        placeAt(tile.center.x + loop.x, TILE_SURFACE + liftOf(tile.id), tile.center.z + loop.z, loop.mirror ? Math.PI : 0, loop.scale);
        piece.transform(poses[theme], local);
        mesh.setMatrixAt(i, m.multiplyMatrices(place, local));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    const zoom = citizenZoom(env.cameraDistance ?? 0);
    citizens.forEach(({ tile, citizen, accessory }, i) => {
      const pose = citizenPose(tile, citizen, t);
      const scale = citizen.scale * zoom;
      // 在島上跟著選取抬高（在橋面中段不屬於任何島），過橋時跟著拱起；影子貼地，不跟著起伏。
      // 步道面高出島頂面 0.006；橋面的甲板再厚一些，上橋時漸漸墊高。
      const deck = BRIDGE_DECK * Math.min(1, pose.y / 0.02);
      const ground = TILE_SURFACE + 0.006 + pose.y + deck + liftOf(tileAt(layout, pose));
      placeAt(pose.x, ground + 0.001, pose.z, pose.heading, scale);
      shadowMesh.setMatrixAt(i, place);
      // 身體的抬高（原尺寸）：走路的起伏，騎車時另坐高一點。
      const lift = pose.bob + (accessory?.ride ? RIDE_LIFT : 0);
      placeAt(pose.x, ground, pose.z, pose.heading, scale);
      for (const { name, parts, mesh } of citizenParts) {
        parts.forEach((p, k) => {
          if (name === 'leg' || name === 'arm') {
            // 左右兩側（-z、+z）反向擺動；配件指定的手臂姿勢固定不擺。
            const side = p.at[2] < 0 ? 'left' : 'right';
            const fixed = name === 'arm' ? accessory?.arm?.[side] : undefined;
            const swing = fixed ?? (name === 'leg' ? pose.legSwing : pose.armSwing) * (side === 'left' ? 1 : -1);
            local.makeRotationZ(swing).setPosition(p.at[0], p.at[1] + p.height / 2 + lift, p.at[2]);
          } else {
            local.makeTranslation(0, lift, 0);
          }
          mesh.setMatrixAt(i * parts.length + k, m.multiplyMatrices(place, local));
        });
      }
      if (accessory) {
        const { mesh, owners } = accessoryMeshes.get(accessory);
        // 帽子跟著頭起伏；車子與行李箱在地上。
        local.makeTranslation(0, accessory.ride || accessory.arm ? 0 : lift, 0);
        mesh.setMatrixAt(owners.indexOf(citizens[i]), m.multiplyMatrices(place, local));
      }
    });
    for (const { mesh } of citizenParts) mesh.instanceMatrix.needsUpdate = true;
    shadowMesh.instanceMatrix.needsUpdate = true;
    for (const { mesh } of accessoryMeshes.values()) mesh.instanceMatrix.needsUpdate = true;

    for (const vehicle of plan.vehicles) vehiclePoses.set(vehicle, vehiclePose(plan.ring, vehicle, t, plan.ringLength));
    cars.forEach(({ vehicle, index, spec }, i) => {
      const pose = vehiclePoses.get(vehicle)[index];
      // 車輛走在步道環上，過橋時跟著拱起（pose.y）；在選中的島上跟著抬高，在橋面中段不屬於任何島。
      placeAt(pose.x, TILE_SURFACE + VEHICLE_LIFT + pose.y + liftOf(tileAt(layout, pose)), pose.z, pose.heading);
      carBody.setMatrixAt(i, m.multiplyMatrices(place, local.makeScale(spec.length, spec.height * 0.85, spec.width)));
      local.makeScale(spec.length * 0.96, spec.height * 0.15, spec.width * 0.9).setPosition(0, spec.height * 0.85, 0);
      carRoof.setMatrixAt(i, m.multiplyMatrices(place, local));
      local.makeScale(spec.length * 0.8, spec.height * 0.22, spec.width * 1.04).setPosition(0, spec.height * 0.55, 0);
      carWindows.setMatrixAt(i, m.multiplyMatrices(place, local));
      if (index === 0) {
        local.makeTranslation(spec.length / 2 + 0.002, spec.height * 0.3, 0);
        headlights.setMatrixAt(leads.indexOf(cars[i]), m.multiplyMatrices(place, local));
      }
    });
    for (const mesh of carMeshes) mesh.instanceMatrix.needsUpdate = true;
  }

  update(0);
  return { plan, update };
}
