// 零件庫：靜態零件用共用的單位幾何建立，場景組好後由 instancify 依形體與材質種類收進 InstancedMesh，
// 每桶一次繪製呼叫，每個實例各自上色與變換。分桶規則在 island-parts.js（Node 可測）。
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
export function kitPartMesh(part, colors) {
  const { geometry, glow } = kitShape(part.shape);
  const color = colors[part.color];
  const mesh = new THREE.Mesh(geometry, glow ? glowSourceMaterial(color) : clay(color));
  const [rx = 0, ry = 0, rz = 0] = part.rot ?? [];
  const rotation = new THREE.Matrix4().makeRotationY(part.yaw ?? 0)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  mesh.matrix.makeTranslation(...part.at).multiply(rotation).scale(new THREE.Vector3(...part.size));
  mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
  mesh.castShadow = !glow;
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

// 把 root 底下用共用幾何、材質可合批的靜態零件換成 InstancedMesh，加到 root。
// glowMaterial 是所有發光件共用的材質（顏色每幀乘夜間係數）。祖先設了 userData.lod 的零件另外分桶，
// 那幾個 InstancedMesh 的 userData.lod 標明分組，呼叫端依鏡頭距離整個隱藏。
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
  const meshes = partBuckets(parts).map((bucket) => {
    const mesh = new THREE.InstancedMesh(bucket.items[0].geometry, base[bucket.material], bucket.items.length);
    bucket.items.forEach((part, i) => {
      // 主題場景零件的縮放微抖動（island-parts.js 的 scaleJitter），共面的零件錯開一點，不會 z-fighting。
      if (isClayShape(part.shape)) {
        const j = scaleJitter(serial++);
        part.transform.multiply(jitter.makeScale(j, j, j));
      }
      mesh.setMatrixAt(i, part.transform);
      mesh.setColorAt(i, color.setHex(part.color));
    });
    mesh.castShadow = bucket.material !== 'glow' && bucket.items.some((p) => p.castShadow);
    mesh.receiveShadow = bucket.material !== 'glow';
    mesh.userData.items = bucket.items.map((p) => ({ owner: p.owner, transform: p.transform }));
    if (bucket.lod) mesh.userData.lod = bucket.lod;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  });

  const offsets = new Map();
  const offset = new THREE.Matrix4();
  const moved = new THREE.Matrix4();
  return {
    meshes,
    // 射線打到的實例屬於哪個議題區。
    ownerOf(hit) {
      return hit.object.userData.items?.[hit.instanceId]?.owner ?? null;
    },
    // 把某議題區的零件整體抬高 y（選取時格子抬高，零件要跟著）。
    setOwnerOffset(owner, y) {
      // 篩選時每格都會重畫一次，高度沒變就不必重寫實例矩陣。
      if ((offsets.get(owner) ?? 0) === y) return;
      offsets.set(owner, y);
      offset.makeTranslation(0, y, 0);
      for (const mesh of meshes) {
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
