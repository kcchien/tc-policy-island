// 島嶼檢視的外圍：把 island-terrain.js 的配置畫成地形、樹群、霧團、雲（含地上的雲影）與飛鳥。
// 會動的部分由 update(t, dt, env) 依動畫時間擺位置（用 addAnimation 註冊），暫停與減少動態時跟著靜止。
// 只讀格子位置，不讀政見資料（ADR 0001）；色碼都在 island-terrain.js 的 TERRAIN_PALETTE。

import * as THREE from 'three';
import { ambientAt, planOutskirts, TERRAIN_PALETTE, terrainColor } from './island-terrain.js';

// 夜間係數超過這個值，鳥回巢不畫。
const BIRDS_UNTIL_NIGHT = 0.75;
// 雲影最多幾朵（著色器的陣列長度），與雲的數量上限相同。
const MAX_CLOUD_SHADOWS = 9;

// 地形網格：平面依高度抬起，每個頂點依高度上色，flatShading 呈現低多邊形的面。
function terrainMesh(plan, material) {
  const size = plan.extent * 2;
  const geometry = new THREE.PlaneGeometry(size, size, plan.segments, plan.segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(plan.center.x, 0, plan.center.z);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const h = plan.heightAt(position.getX(i), position.getZ(i));
    position.setY(i, h);
    color.setHex(terrainColor(h)).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

// 雲影：在地形與水面的材質加一段著色器，雲正下方的地面依距離變暗。uniform 每幀由 update 更新。
function cloudShadowUniforms() {
  return {
    cloudShadows: { value: Array.from({ length: MAX_CLOUD_SHADOWS }, () => new THREE.Vector4()) },
  };
}
export function addCloudShadows(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloudGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloudGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vCloudGround;\nuniform vec4 cloudShadows[${MAX_CLOUD_SHADOWS}];`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cloudShade = 0.0;
        for (int i = 0; i < ${MAX_CLOUD_SHADOWS}; i++) {
          vec4 c = cloudShadows[i];
          cloudShade = max(cloudShade, c.w * (1.0 - smoothstep(c.z * 0.4, c.z, distance(vCloudGround, c.xy))));
        }
        diffuseColor.rgb *= 1.0 - cloudShade;`);
  };
  material.customProgramCacheKey = () => 'cloud-shadows';
  material.needsUpdate = true;
}

// 霧團的透明度貼圖：中心不透明、往外漸淡的圓。只用灰階數值，不寫色碼。
function softDisc(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.round(255 * (1 - Math.min(1, d)) ** 1.6);
      data.set([a, a, a, 255], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

// 一朵鳥翅：從身體往外的扁三角形，繞身體軸（x 軸）轉動就是拍翅。
function wingGeometry(side) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0.05, 0, 0, -0.06, 0, 0, -0.02, 0, 0.26 * side], 3));
  g.computeVertexNormals();
  return g;
}

// environment 是 createEnvironment 的結果（水面材質要加雲影）。回傳 { plan, update(t, dt, env) }；env 有 night 與 fog（霧色）。
export function createOutskirts(scene, { layout, quality, environment }) {
  const plan = planOutskirts(layout, { quality: quality.level });
  const group = new THREE.Group();
  group.name = 'outskirts';

  const shadows = cloudShadowUniforms();
  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  addCloudShadows(groundMaterial, shadows);
  addCloudShadows(environment.waterMaterial, shadows);
  group.add(terrainMesh(plan, groundMaterial));

  // 樹群：樹冠與樹幹各一個 InstancedMesh，每棵樹各自的位置、大小與樹冠色。
  const canopyGeometry = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
  const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.6, 1, 5).translate(0, 0.5, 0);
  const canopy = new THREE.InstancedMesh(canopyGeometry, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), plan.trees.length);
  const trunk = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.trunk, flatShading: true, roughness: 0.9 }), plan.trees.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  plan.trees.forEach((tree, i) => {
    const trunkHeight = tree.height * 0.28;
    q.setFromAxisAngle(up, tree.rotation);
    trunk.setMatrixAt(i, m.compose(p.set(tree.x, tree.y - 0.05, tree.z), q, s.set(tree.radius * 0.22, trunkHeight + 0.05, tree.radius * 0.22)));
    canopy.setMatrixAt(i, m.compose(p.set(tree.x, tree.y + trunkHeight, tree.z), q, s.set(tree.radius, tree.height - trunkHeight, tree.radius)));
    canopy.setColorAt(i, color.setHex(tree.color));
  });
  for (const mesh of [canopy, trunk]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // 霧團：貼地的扁平圓，顏色跟著時段的霧色。
  const fogMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: softDisc(), color: TERRAIN_PALETTE.cloud });
  const fogDisc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const fogMeshes = plan.fogBanks.map((bank) => {
    const mesh = new THREE.Mesh(fogDisc, fogMaterial.clone());
    mesh.scale.set(bank.size, 1, bank.size * 0.7);
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  });

  // 雲：每朵幾團扁的多面體，全部收在一個 InstancedMesh。
  const puffs = plan.clouds.flatMap((cloud, c) => Array.from({ length: cloud.puffs }, (_, k) => {
    const spread = (k / Math.max(1, cloud.puffs - 1) - 0.5) * cloud.size * 1.6;
    const r = cloud.size * (0.55 + 0.35 * Math.sin(cloud.seed + k * 2.1) ** 2);
    return { cloud: c, offset: new THREE.Vector3(spread, (k % 2) * 0.25 * cloud.size, Math.cos(cloud.seed + k) * 0.3 * cloud.size), r };
  }));
  const cloudMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.cloud, flatShading: true, roughness: 1 }),
    Math.max(1, puffs.length),
  );
  cloudMesh.count = puffs.length;
  cloudMesh.frustumCulled = false;
  group.add(cloudMesh);

  // 飛鳥：每隻兩片翅膀，左右翅各一個 InstancedMesh。
  const birdMaterial = new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.bird, side: THREE.DoubleSide, flatShading: true });
  const wings = [1, -1].map((side) => {
    const mesh = new THREE.InstancedMesh(wingGeometry(side), birdMaterial, Math.max(1, plan.birds.length));
    mesh.count = plan.birds.length;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { side, mesh };
  });

  scene.add(group);

  const fogColor = new THREE.Color();
  const euler = new THREE.Euler();
  const local = new THREE.Vector3();
  return {
    plan,
    group,
    update(t, dt, env = {}) {
      const night = env.night ?? 0;
      const { clouds, fogBanks, birds } = ambientAt(plan, t);

      if (env.fog !== undefined) fogColor.setHex(env.fog);
      fogMeshes.forEach((mesh, i) => {
        mesh.position.set(fogBanks[i].x, fogBanks[i].y, fogBanks[i].z);
        if (env.fog !== undefined) mesh.material.color.copy(fogColor);
        mesh.material.opacity = fogBanks[i].opacity * (1 - 0.35 * night);
      });

      puffs.forEach((puff, i) => {
        const cloud = clouds[puff.cloud];
        q.setFromAxisAngle(up, cloud.heading);
        local.copy(puff.offset).applyQuaternion(q);
        cloudMesh.setMatrixAt(i, m.compose(p.set(cloud.x + local.x, cloud.y + local.y, cloud.z + local.z), q, s.set(puff.r * 1.3, puff.r * 0.7, puff.r)));
      });
      cloudMesh.instanceMatrix.needsUpdate = true;
      // 雲影落在雲正下方，夜裡沒有日光就淡掉。
      shadows.cloudShadows.value.forEach((v, i) => {
        const cloud = clouds[i];
        if (cloud) v.set(cloud.x, cloud.z, plan.clouds[i].size * 2.4, 0.22 * (1 - night));
        else v.set(0, 0, 1, 0);
      });

      const showBirds = night < BIRDS_UNTIL_NIGHT;
      for (const { side, mesh } of wings) {
        mesh.visible = showBirds;
        if (!showBirds) continue;
        birds.forEach((bird, i) => {
          euler.set(side * bird.flap, bird.heading, 0, 'YXZ');
          q.setFromEuler(euler);
          mesh.setMatrixAt(i, m.compose(p.set(bird.x, bird.y, bird.z), q, s.set(0.9, 0.9, 0.9)));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
