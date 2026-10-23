// 零件庫：靜態零件用共用的單位幾何建立，場景組好後由 instancify 依形體與材質種類收進 InstancedMesh，
// 每桶一次繪製呼叫，每個實例各自上色與變換。分桶規則在 island-parts.js（Node 可測）。
// 會動的零件不要用共用幾何，或在 mesh.userData.dynamic 設 true，instancify 會略過。

import * as THREE from 'three';
import { partBuckets } from './island-parts.js';

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

// 發光零件的來源材質：只用來標記「這是發光件」與它的顏色，instancify 會換成共用的發光材質。
export function glowSourceMaterial(color) {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.glow = true;
  return m;
}

// 材質種類：發光、雙面、一般。透明材質不收（透明物件要排序，合批後會畫錯）。
function materialKind(material) {
  if (material.userData.glow) return 'glow';
  if (material.transparent || !(material instanceof THREE.MeshStandardMaterial)) return null;
  return material.side === THREE.DoubleSide ? 'standard-double' : 'standard';
}

// 往上找第一個 userData.areaId，點到零件時才知道是哪個議題區。
function ownerOf(object) {
  for (let node = object; node; node = node.parent) if (node.userData.areaId) return node.userData.areaId;
  return null;
}

// 把 root 底下用共用幾何、材質可合批的靜態零件換成 InstancedMesh，加到 root。
// glowMaterial 是所有發光件共用的材質（顏色每幀乘夜間係數）。
// 回傳 { meshes, ownerOf(hit), setOwnerOffset(owner, y) }。
export function instancify(root, { glowMaterial }) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const parts = [];
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.dynamic) return;
    const shape = object.geometry.userData.kitShape;
    const kind = shape && materialKind(object.material);
    if (!kind) return;
    parts.push({
      shape,
      material: kind,
      transform: new THREE.Matrix4().multiplyMatrices(toRoot, object.matrixWorld),
      color: object.material.color.getHex(),
      geometry: object.geometry,
      castShadow: object.castShadow,
      owner: ownerOf(object),
      object,
    });
  });
  for (const part of parts) part.object.removeFromParent();

  const base = {
    standard: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 }),
    'standard-double': new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    glow: glowMaterial,
  };
  const color = new THREE.Color();
  const meshes = partBuckets(parts).map((bucket) => {
    const mesh = new THREE.InstancedMesh(bucket.items[0].geometry, base[bucket.material], bucket.items.length);
    bucket.items.forEach((part, i) => {
      mesh.setMatrixAt(i, part.transform);
      mesh.setColorAt(i, color.setHex(part.color));
    });
    mesh.castShadow = bucket.material !== 'glow' && bucket.items.some((p) => p.castShadow);
    mesh.receiveShadow = bucket.material !== 'glow';
    mesh.userData.items = bucket.items.map((p) => ({ owner: p.owner, transform: p.transform }));
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  });

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
