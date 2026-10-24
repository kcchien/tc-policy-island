// 零件庫：靜態零件用共用的單位幾何建立（含圓角盒、四坡屋頂、圓頂、環、稜柱、發光件），場景組好後由 instancify 合批：
// 非發光零件依材質、LOD、投影合併成一個網格（頂點色與議題區序號，選取抬高在著色器做，點選依議題區區段檢查），
// 發光件依形體收進 InstancedMesh。主題場景零件用黏土材質與縮放微抖動；祖先標 userData.lod 的零件另外分桶。
// 分桶規則在 island-parts.js（Node 可測）。
// 會動的零件不要用共用幾何，或在 mesh.userData.dynamic 設 true，instancify 會略過。

import * as THREE from 'three';
import { partBuckets, scaleJitter } from './island-parts.js';

// 合批零件的黏土材質數值。
const CLAY ={ roughness: 0.78, metalness: 0 };

const geometries = new Map();

// 共用的單位幾何：同一個 key 只建一次。零件用 mesh.scale 撐成需要的尺寸。
export function sharedGeometry(key, make) {
  if (!geometries.has(key)) {
    const geometry = make();
    geometry.userData.kitShape = key;
    geometries.set(key, geometry);
  }
  return geometries.get(key);
}

// 圓角盒：細分的單位立方體，把每個頂點收進內盒再沿法向推出圓角半徑 radius。
function roundedBox(radius = 0.12, segments = 4) {
  const geometry = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
  const pos = geometry.attributes.position;
  const inner = 0.5 - radius;
  const v = new THREE.Vector3();
  const core = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    core.set(THREE.MathUtils.clamp(v.x, -inner, inner), THREE.MathUtils.clamp(v.y, -inner, inner), THREE.MathUtils.clamp(v.z, -inner, inner));
    v.sub(core).normalize().multiplyScalar(radius).add(core);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// 主題場景的零件形體（island-heroes.js 的 HERO_SHAPES）：每種都裝在 ±0.5 的單位立方體裡，用縮放撐成零件尺寸。
const KIT_SHAPES = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  rbox: () => roundedBox(),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: () => new THREE.ConeGeometry(0.5, 1, 14),
  sphere: () => new THREE.SphereGeometry(0.5, 16, 12),
  ico: () => new THREE.IcosahedronGeometry(0.5, 1),
  // 圓頂：半球壓成高 1，底面在 y = -0.5。
  dome: () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 2, 1).translate(0, -0.5, 0),
  // 環：立在 x-y 平面（鐘面、車輪、籃框），外徑 1，厚度方向 z 撐滿 ±0.5。
  torus: () => new THREE.TorusGeometry(0.4, 0.1, 8, 20).scale(1, 1, 5),
  // 稜柱：三角形剖面在 x-y 平面（底寬 1、頂點在上），沿 z 拉長，當雙坡屋頂與鋸齒屋頂。
  prism: () => {
    const shape = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0, 0.5)]);
    return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  },
  // 四坡屋頂：四邊錐轉 45 度，底面是邊長 1 的正方形。
  hip: () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4),
};
const GLOW_SHAPES = { glowbox: 'box', glowsphere: 'sphere' };

// 主題場景零件的共用幾何與是否發光。shape 是 HERO_SHAPES 之一。
export function kitShape(shape) {
  const base = GLOW_SHAPES[shape] ?? shape;
  if (!KIT_SHAPES[base]) throw new Error(`零件庫沒有形體 ${shape}`);
  return { geometry: sharedGeometry(`kit:${base}`, KIT_SHAPES[base]), glow: base !== shape };
}

// 發光零件的來源材質：只用來標記「這是發光件」與它的顏色，instancify 會換成共用的發光材質。
export function glowSourceMaterial(color) {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.glow = true;
  return m;
}

const clayMaterials = new Map();
// 同色共用材質；instancify 只讀顏色，合批後換成黏土材質。
function clay(color) {
  if (!clayMaterials.has(color)) clayMaterials.set(color, new THREE.MeshStandardMaterial({ color }));
  return clayMaterials.get(color);
}

// 零件資料（island-heroes.js 的格式 { shape, color, size, at, rot?, yaw? }）→ Mesh，color 依 colors 色表換成色碼。
// 變換是「平移 at · 繞 y 轉 yaw · rot · 縮放 size」（與 island-heroes.js 的 partBounds 相同）。主題場景與靜態裝飾共用。
// castShadow 由呼叫端依 island-parts.js 的 castsShadow 決定，發光件一律不投影。
export function kitPartMesh(part, colors, { castShadow = false } = {}) {
  const { geometry, glow } = kitShape(part.shape);
  const color = colors[part.color];
  const mesh = new THREE.Mesh(geometry, glow ? glowSourceMaterial(color) : clay(color));
  const [rx = 0, ry = 0, rz = 0] = part.rot ?? [];
  const rotation = new THREE.Matrix4().makeRotationY(part.yaw ?? 0)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  mesh.matrix.makeTranslation(...part.at).multiply(rotation).scale(new THREE.Vector3(...part.size));
  mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.castShadow = castShadow && !glow;
  mesh.receiveShadow = !glow;
  return mesh;
}

// 主題場景零件庫的形體（kitShape 建的幾何）：用黏土材質並加縮放微抖動。
// 其他零件（格子、在地感元素、路燈、路面）維持原本的低多邊形 flatShading，不受影響。
const isClayShape = (shape) => shape.startsWith('kit:');

// 材質種類：發光、黏土、雙面、一般。透明材質不收（透明物件要排序，合批後會畫錯）。
function materialKind(material, shape) {
  if (material.userData.glow) return 'glow';
  if (material.transparent || !(material instanceof THREE.MeshStandardMaterial)) return null;
  if (material.side === THREE.DoubleSide) return 'standard-double';
  return isClayShape(shape) ? 'clay' : 'standard';
}

// 往上找第一個 userData.areaId，點到零件時才知道是哪個議題區。
function ownerOf(object) {
  for (let node = object; node; node = node.parent) if (node.userData.areaId) return node.userData.areaId;
  return null;
}

// 往上找第一個 userData.lod（遠距離隱藏的分組，例如裝飾的小物件），合批時另外分桶。
function lodOf(object) {
  for (let node = object; node; node = node.parent) if (node.userData.lod) return node.userData.lod;
  return null;
}

// 合併網格的抬高格數上限（議題區數加 1）。
const LIFT_SLOTS = 64;

// 材質加上選取抬高：頂點帶議題區序號 kitOwner，頂點著色器加上 kitLift[序號]（所有合併網格共用同一份 lift）。
function withLift(material, lift) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.kitLift = lift;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float kitOwner;\nuniform float kitLift[${LIFT_SLOTS}];`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += kitLift[int(kitOwner)];');
  };
  material.customProgramCacheKey = () => 'kit-lift';
  return material;
}

// 合併桶：每個零件的共用幾何套上自己的變換，連同顏色與議題區序號接成一個網格，整桶一次繪製呼叫。
// 零件已依議題區排序（island-parts.js），每區的三角形連在一起，記成區段與外框；點選時只檢查射線打中外框的區段。
// 法向量一律保留：flatShading 的材質雖然由著色器算面法向量，接收陰影的 normalBias 仍讀頂點法向量，缺了會算出 NaN。
function mergedMesh(bucket, material, { slotOf, lift }) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { geometry } of bucket.items) {
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index ? geometry.index.count : geometry.attributes.position.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  // 顏色存線性值，16 位元避免深色出現色階。
  const colors = new Uint16Array(vertexCount * 3);
  const owners = new Uint8Array(vertexCount);
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const color = new THREE.Color();
  const ranges = [];
  let vo = 0;
  let io = 0;
  for (const part of bucket.items) {
    const { geometry, transform } = part;
    const pos = geometry.attributes.position;
    normalMatrix.getNormalMatrix(transform);
    color.setHex(part.color);
    // instancify 收集零件時 owner 已是議題區識別碼或 null。
    const slot = slotOf(part.owner);
    let range = ranges.at(-1);
    if (!range || range.owner !== part.owner) {
      range = { owner: part.owner, slot, start: io, count: 0, box: new THREE.Box3() };
      ranges.push(range);
    }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(transform);
      position.set([v.x, v.y, v.z], (vo + i) * 3);
      range.box.expandByPoint(v);
      v.fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      normal.set([v.x, v.y, v.z], (vo + i) * 3);
      colors.set([color.r, color.g, color.b].map((c) => Math.round(c * 65535)), (vo + i) * 3);
      owners[vo + i] = slot;
    }
    const start = io;
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) index[io++] = geometry.index.getX(i) + vo;
    else for (let i = 0; i < pos.count; i++) index[io++] = vo + i;
    range.count += io - start;
    vo += pos.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
  merged.setAttribute('kitOwner', new THREE.BufferAttribute(owners, 1));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  // 選取抬高讓包圍球不準；整桶散在全島，本來就幾乎都在畫面裡。
  const mesh = new THREE.Mesh(merged, material);
  mesh.frustumCulled = false;
  const box = new THREE.Box3();
  const up = new THREE.Vector3();
  const saved = new THREE.Matrix4();
  const shift = new THREE.Matrix4();
  // 點選：只對射線打中外框（含抬高）的區段逐三角形檢查，打到的結果記上議題區。
  mesh.raycast = function raycast(raycaster, intersects) {
    saved.copy(this.matrixWorld);
    for (const range of ranges) {
      up.set(0, lift.value[range.slot], 0);
      if (!raycaster.ray.intersectsBox(box.copy(range.box).translate(up).applyMatrix4(saved))) continue;
      merged.setDrawRange(range.start, range.count);
      this.matrixWorld.copy(saved).premultiply(shift.makeTranslation(up.x, up.y, up.z));
      const before = intersects.length;
      THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
      for (let i = before; i < intersects.length; i++) intersects[i].owner = range.owner;
    }
    this.matrixWorld.copy(saved);
    merged.setDrawRange(0, Infinity);
  };
  return mesh;
}

// 把 root 底下用共用幾何、材質可合批的靜態零件合批，加到 root：非發光零件依材質合併成幾個網格，
// 發光件依形體收進 InstancedMesh（island-parts.js 的 partBuckets）。
// glowMaterial 是所有發光件共用的材質（顏色每幀乘夜間係數）。祖先設了 userData.lod 的零件另外分桶，
// 那幾個網格的 userData.lod 標明分組，呼叫端依鏡頭距離整個隱藏。
// 回傳 { meshes, ownerOf(hit), setOwnerOffset(owner, y) }。
export function instancify(root, { glowMaterial }) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const parts = [];
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.dynamic) return;
    const shape = object.geometry.userData.kitShape;
    const kind = shape && materialKind(object.material, shape);
    if (!kind) return;
    parts.push({
      shape,
      material: kind,
      transform: new THREE.Matrix4().multiplyMatrices(toRoot, object.matrixWorld),
      color: object.material.color.getHex(),
      geometry: object.geometry,
      castShadow: object.castShadow,
      owner: ownerOf(object),
      lod: lodOf(object),
      object,
    });
  });
  for (const part of parts) {
    part.object.removeFromParent();
    // 發光件的來源材質每件一個，只用來標記，換掉後就釋放。
    if (part.material === 'glow') part.object.material.dispose();
  }

  const base = {
    standard: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 }),
    'standard-double': new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    // 霧面黏土：roughness 0.78、metalness 0，不用 flatShading，圓角與曲面看起來柔和。
    clay: new THREE.MeshStandardMaterial({ roughness: CLAY.roughness, metalness: CLAY.metalness }),
    glow: glowMaterial,
  };
  const color = new THREE.Color();
  const jitter = new THREE.Matrix4();
  let serial = 0;
  // 合併網格的選取抬高：每個議題區一格（0 號是不屬於任何議題區的零件，永遠是 0），著色器把頂點抬高這個量。
  const slots = new Map([[null, 0]]);
  const slotOf = (owner) => {
    if (!slots.has(owner)) slots.set(owner, slots.size);
    if (slots.size > LIFT_SLOTS) throw new Error(`議題區超過 ${LIFT_SLOTS - 1} 個，合併網格的抬高放不下`);
    return slots.get(owner);
  };
  const lift = { value: new Float32Array(LIFT_SLOTS) };
  const materials = Object.fromEntries(Object.entries(base).map(([kind, material]) => [
    kind, kind === 'glow' ? material : withLift(Object.assign(material, { vertexColors: true }), lift),
  ]));
  const depthMaterial = withLift(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), lift);

  const meshes = partBuckets(parts).map((bucket) => {
    for (const part of bucket.items) {
      // 主題場景零件的縮放微抖動（island-parts.js 的 scaleJitter），共面的零件錯開一點，不會 z-fighting。
      if (isClayShape(part.shape)) {
        const j = scaleJitter(serial++);
        part.transform.multiply(jitter.makeScale(j, j, j));
      }
    }
    let mesh;
    if (bucket.merged) {
      mesh = mergedMesh(bucket, materials[bucket.material], { slotOf, lift });
      if (bucket.castShadow) mesh.customDepthMaterial = depthMaterial;
    } else {
      mesh = new THREE.InstancedMesh(bucket.items[0].geometry, materials[bucket.material], bucket.items.length);
      bucket.items.forEach((part, i) => {
        mesh.setMatrixAt(i, part.transform);
        mesh.setColorAt(i, color.setHex(part.color));
      });
      mesh.userData.items = bucket.items.map((p) => ({ owner: p.owner, transform: p.transform }));
      mesh.computeBoundingSphere();
    }
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.material !== 'glow';
    mesh.userData.kit = true;
    mesh.userData.parts = bucket.items.length;
    if (bucket.lod) mesh.userData.lod = bucket.lod;
    root.add(mesh);
    return mesh;
  });

  const offsets = new Map();
  const offset = new THREE.Matrix4();
  const moved = new THREE.Matrix4();
  return {
    meshes,
    // 射線打到的零件屬於哪個議題區：合併網格由 raycast 記在 hit.owner，InstancedMesh 從實例查。
    ownerOf(hit) {
      if (hit.owner !== undefined) return hit.owner;
      return hit.object.userData.items?.[hit.instanceId]?.owner ?? null;
    },
    // 把某議題區的零件整體抬高 y（選取時格子抬高，零件要跟著）。
    setOwnerOffset(owner, y) {
      // 篩選時每格都會重畫一次，高度沒變就不必重寫實例矩陣。
      if ((offsets.get(owner) ?? 0) === y) return;
      offsets.set(owner, y);
      if (slots.has(owner)) lift.value[slots.get(owner)] = y;
      offset.makeTranslation(0, y, 0);
      for (const mesh of meshes) {
        if (!mesh.isInstancedMesh) continue;
        let changed = false;
        mesh.userData.items.forEach((item, i) => {
          if (item.owner !== owner) return;
          mesh.setMatrixAt(i, moved.multiplyMatrices(offset, item.transform));
          changed = true;
        });
        if (changed) {
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingSphere();
        }
      }
    },
  };
}
