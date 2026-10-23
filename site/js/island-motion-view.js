// 島嶼的動態：每格的循環道具、市民、沿步道環與橋繞行的公車與火車。步道與橋本身是島體（island-body-view.js）。
// 配置一律來自 island-motion.js 的 motionPlan（只讀格子，不讀政見）；這裡只把配置畫成 3D。
// 靜態零件（道具底座）用零件庫的共用幾何，之後由 instancify 合批；
// 會動的零件每種一個 InstancedMesh，每幀由動畫迴圈更新矩陣，繪製呼叫數不隨格子數增加。

import * as THREE from 'three';
import { citizenPose, loopPose, motionPlan, VEHICLE_HALF_WIDTH, vehiclePose } from './island-motion.js';
import { tileAt } from './island-body.js';
import { material, PALETTE, PARTS, TILE_SURFACE } from './island-models.js';

// 3D 材質色碼，受禁用色檢查（ADR 0001）。衣服只用低飽和的大地色，不用任何政黨或候選人的識別色。
export const MOTION_PALETTE = {
  road: 0x8c847b,
  skin: 0xc49a7c,
  trousers: 0x4f4a45,
  clothes: [0x8a5a44, 0x9a7b55, 0x6f6a58, 0xa86f5a, 0x7c6f66, 0xb59a74],
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

// 市民：身體、頭、兩條腿，原尺寸頭頂高 0.16、身寬半徑 0.025，放上格子時乘配置的倍率（island-motion.js 的 CITIZEN_SCALE）。
// 腿的原點在髖部，擺動時繞髖部轉。
const CITIZEN = {
  body: () => new THREE.CylinderGeometry(0.02, 0.025, 0.066, 6).translate(0, 0.09, 0),
  head: () => new THREE.SphereGeometry(0.018, 6, 4).translate(0, 0.142, 0),
  leg: () => boxGeometry(0.013, 0.057, 0.013, { pivot: [0, -0.0285, 0] }),
  hip: 0.057,
  legGap: 0.01,
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

  // 市民：每格同數，沿格子的邊走。
  const citizens = areas.flatMap((tile) => tile.citizens.map((citizen) => ({ tile, citizen })));
  // 衣服顏色依市民的順序輪替，與格子內容無關。
  const body = movingMesh(CITIZEN.body(), (i) => MOTION_PALETTE.clothes[i % MOTION_PALETTE.clothes.length], citizens.length);
  const head = movingMesh(CITIZEN.head(), MOTION_PALETTE.skin, citizens.length);
  const legs = movingMesh(CITIZEN.leg(), MOTION_PALETTE.trousers, citizens.length * 2);
  scene.add(body, head, legs);

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

  const citizenMeshes = [body, head, legs];
  const carMeshes = [carBody, carRoof, carWindows, headlights];
  const poses = {};
  const vehiclePoses = new Map();

  function update(t) {
    for (const theme in LOOP_PROPS) poses[theme] = loopPose(theme, t);
    for (const { theme, piece, mesh, spots } of movers) {
      spots.forEach(({ tile, loop }, i) => {
        placeAt(tile.center.x + loop.x, TILE_SURFACE + liftOf(tile.id), tile.center.z + loop.z, loop.mirror ? Math.PI : 0, loop.scale);
        piece.transform(poses[theme], local);
        mesh.setMatrixAt(i, m.multiplyMatrices(place, local));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }

    citizens.forEach(({ tile, citizen }, i) => {
      const pose = citizenPose(tile, citizen, t);
      placeAt(pose.x, TILE_SURFACE + 0.006 + pose.bob * citizen.scale + liftOf(tile.id), pose.z, pose.heading, citizen.scale);
      body.setMatrixAt(i, place);
      head.setMatrixAt(i, place);
      // 兩條腿反向擺動（place 已含倍率，這裡用原尺寸）。
      local.makeRotationZ(pose.legSwing).setPosition(0, CITIZEN.hip, -CITIZEN.legGap);
      legs.setMatrixAt(i * 2, m.multiplyMatrices(place, local));
      local.makeRotationZ(-pose.legSwing).setPosition(0, CITIZEN.hip, CITIZEN.legGap);
      legs.setMatrixAt(i * 2 + 1, m.multiplyMatrices(place, local));
    });
    for (const mesh of citizenMeshes) mesh.instanceMatrix.needsUpdate = true;

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
