// 把主題場景（island-heroes.js 的零件資料）畫成 3D。零件用零件庫的共用單位幾何，之後由 instancify 合批，
// 二十座場景的零件只多出十幾個 InstancedMesh。

import * as THREE from 'three';
import { kitPartMesh } from './island-kit.js';
import { HERO_COLORS, heroSceneFor } from './island-heroes.js';
import { castsShadow } from './island-parts.js';

// 放置介面：議題區 areaId 的主題場景，依 transform { x, y, z, scale, yaw } 放好，回傳 THREE.Group。
// 單位空間底面 ±0.5、高 0～1.5、正面朝 +z；transform 是場景底面中心在父物件座標裡的位置。
// 只依識別碼選場景（ADR 0001）。島體提供每島的主題場景位置後，在那裡呼叫這個函式即可。
export function buildHeroScene(areaId, { x = 0, y = 0, z = 0, scale = 1, yaw = 0 } = {}) {
  const scene = heroSceneFor(areaId);
  const group = new THREE.Group();
  group.name = `hero:${scene.id}`;
  for (const part of scene.parts) group.add(kitPartMesh(part, HERO_COLORS, { castShadow: castsShadow('hero') }));
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  group.scale.setScalar(scale);
  return group;
}
