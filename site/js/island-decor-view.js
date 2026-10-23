// 把裝飾配置（island-decor.js）畫成 3D：每格的主題場景、路燈、大樹、家具與植栽，以及夜裡路燈下的光池。
// 零件用零件庫的共用單位幾何，放進格子群組（選取抬高時跟著動），之後由 instancify 合批；
// 小物件的群組標 userData.lod，合批後另成幾桶，鏡頭拉遠時由 island-view.js 隱藏。光池半透明，自己建 InstancedMesh。

import * as THREE from 'three';
import { decorPlan } from './island-decor.js';
import { DECOR_COLORS, decorModel } from './island-decor-models.js';
import { buildHeroScene } from './island-hero-view.js';
import { kitPartMesh } from './island-kit.js';

// 光池：路燈下貼地的圓形暖光，加法混合，亮度隨夜間係數。
const POOL_RADIUS = 0.15;
const POOL_OPACITY = 0.3;
const POOL_LIFT = 0.008;

// scene 是島嶼場景；layout 是 islandLayout 的結果；groupOf(tileId) 回傳每格的群組（含裝飾格）；surface 是島面高度。
// 回傳 { setNight(night), setLift(tileId, y) }：光池的亮度與選取抬高。
export function createDecor(scene, layout, { groupOf, surface }) {
  const plan = decorPlan(layout);
  const lamps = [];
  for (const tile of plan.tiles) {
    const group = groupOf(tile.id);
    if (tile.hero) {
      // 主題場景的擺放是世界座標，換成格子群組內的座標。
      const { x, z, scale, yaw } = tile.hero.transform;
      group.add(buildHeroScene(tile.id, { x: x - tile.center.x, y: surface, z: z - tile.center.z, scale, yaw }));
    }
    for (const item of tile.items) {
      const model = new THREE.Group();
      for (const part of decorModel(item.kind, tile.species)) model.add(kitPartMesh(part, DECOR_COLORS));
      model.position.set(item.x, surface, item.z);
      model.rotation.y = item.yaw;
      if (item.small) model.userData.lod = 'small';
      group.add(model);
      if (item.kind === 'lamp') lamps.push({ tileId: tile.id, x: tile.center.x + item.x, z: tile.center.z + item.z });
    }
  }

  const poolMaterial = new THREE.MeshBasicMaterial({
    color: DECOR_COLORS.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(POOL_RADIUS, 20).rotateX(-Math.PI / 2), poolMaterial, lamps.length);
  const m = new THREE.Matrix4();
  const lifts = new Map();
  const place = () => {
    lamps.forEach(({ tileId, x, z }, i) => pools.setMatrixAt(i, m.makeTranslation(x, surface + POOL_LIFT + (lifts.get(tileId) ?? 0), z)));
    pools.instanceMatrix.needsUpdate = true;
  };
  place();
  pools.visible = false;
  pools.renderOrder = 1;
  scene.add(pools);

  return {
    setNight(night) {
      poolMaterial.opacity = POOL_OPACITY * night;
      pools.visible = night > 0.02;
    },
    setLift(tileId, y) {
      if ((lifts.get(tileId) ?? 0) === y) return;
      lifts.set(tileId, y);
      place();
    },
  };
}
