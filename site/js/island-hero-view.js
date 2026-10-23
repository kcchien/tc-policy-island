// 把主題場景（island-heroes.js 的零件資料）畫成 3D。零件用零件庫的共用單位幾何，之後由 instancify 合批，
// 二十座場景的零件只多出十幾個 InstancedMesh。

import * as THREE from 'three';
import { glowSourceMaterial, kitShape } from './island-kit.js';
import { HERO_COLORS, heroSceneFor } from './island-heroes.js';

const materials = new Map();
// 同色共用材質；instancify 只讀顏色，合批後換成黏土材質。
function clay(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color }));
  return materials.get(color);
}

// 一個零件 → Mesh：平移 at · 繞 y 轉 yaw · rot · 縮放 size（與 island-heroes.js 的 partBounds 相同）。
function partMesh(part) {
  const { geometry, glow } = kitShape(part.shape);
  const color = HERO_COLORS[part.color];
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

// 放置介面：議題區 areaId 的主題場景，依 transform { x, y, z, scale, yaw } 放好，回傳 THREE.Group。
// 單位空間底面 ±0.5、高 0～1.5、正面朝 +z；transform 是場景底面中心在父物件座標裡的位置。
// 只依識別碼選場景（ADR 0001）。島體提供每島主建物位置後，在那裡呼叫這個函式即可。
export function buildHeroScene(areaId, { x = 0, y = 0, z = 0, scale = 1, yaw = 0 } = {}) {
  const scene = heroSceneFor(areaId);
  const group = new THREE.Group();
  group.name = `hero:${scene.id}`;
  for (const part of scene.parts) group.add(partMesh(part));
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  group.scale.setScalar(scale);
  return group;
}
