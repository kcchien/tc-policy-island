// 島嶼檢視的外圍：把 island-terrain.js 的配置畫成地形、背景樹（針葉與闊葉）、聚落、霧團、雲（含地上的雲影）、飛鳥、
// 三圈遠山剪影，以及海上的小島、燈塔與帆船。
// 會動的部分由 update(t, dt, env) 依動畫時間擺位置（用 addAnimation 註冊），水面波紋的時間也由這裡交給環境；
// 暫停與減少動態時全部跟著靜止。
// 只讀格子位置，不讀政見資料（ADR 0001）；色碼都在 island-terrain.js 的 TERRAIN_PALETTE。

import * as THREE from 'three';
import { ambientAt, planOutskirts, SEA_LEVEL, silhouetteColor, TERRAIN_PALETTE } from './island-terrain.js';
import { PALETTE } from './island-models.js';

// 夜間係數超過這個值，鳥回巢不畫。
const BIRDS_UNTIL_NIGHT = 0.75;

// 地形網格：平面依高度抬起，每個三角面取面心的地面色（田塊、浪花線的邊界才清楚），flatShading 呈現低多邊形的面。
function terrainMesh(plan, material) {
  const size = plan.extent * 2;
  const segments = plan.detail.segments;
  const grid = new THREE.PlaneGeometry(size, size, segments, segments);
  grid.rotateX(-Math.PI / 2);
  grid.translate(plan.center.x, 0, plan.center.z);
  // 先在共用頂點的網格上算高度（每個格點算一次），再展開成每面獨立的頂點。
  const shared = grid.attributes.position;
  for (let i = 0; i < shared.count; i++) shared.setY(i, plan.heightAt(shared.getX(i), shared.getZ(i)));
  const geometry = grid.toNonIndexed();
  grid.dispose();
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i += 3) {
    const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3;
    const z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    color.setHex(plan.colorAt(x, z));
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

// 雲影：在地形與水面的材質加一段著色器，雲正下方的地面依距離變暗。uniform 每幀由 update 更新。
// 陣列長度就是雲的數量（依畫質），低畫質每個像素少算幾朵。材質原本就有的著色器修改（水面）先做，再接雲影。
function addCloudShadows(material, uniforms) {
  const count = uniforms.cloudShadows.value.length;
  const previous = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloudGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloudGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vCloudGround;\nuniform vec4 cloudShadows[${count}];`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cloudShade = 0.0;
        for (int i = 0; i < ${count}; i++) {
          vec4 c = cloudShadows[i];
          cloudShade = max(cloudShade, c.w * (1.0 - smoothstep(c.z * 0.4, c.z, distance(vCloudGround, c.xy))));
        }
        diffuseColor.rgb *= 1.0 - cloudShade;`);
  };
  material.customProgramCacheKey = () => `${previousKey()}|cloud-shadows-${count}`;
  material.needsUpdate = true;
}

// 把幾個零件幾何（各自套上位置與縮放）併成一個幾何，給背景樹的 InstancedMesh 用（vendor 沒有 BufferGeometryUtils）。
// 只保留位置，法線依面重算；材質用 flatShading。
function mergeParts(parts) {
  const arrays = parts.map(([geometry, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1 }]) => {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry).scale(sx, sy, sz).translate(x, y, z);
    const array = g.attributes.position.array;
    g.dispose();
    geometry.dispose();
    return array;
  });
  const merged = new Float32Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    merged.set(a, offset);
    offset += a.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(merged, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// 背景樹的樹冠，單位空間：底在 y = 0、高 1、半徑 1。針葉是三層圓錐，闊葉是四顆錯開的多面體。
const coniferCanopy = () => mergeParts([
  [new THREE.ConeGeometry(1, 0.5, 6), { y: 0.25 }],
  [new THREE.ConeGeometry(0.78, 0.45, 6), { y: 0.5 }],
  [new THREE.ConeGeometry(0.52, 0.4, 6), { y: 0.8 }],
]);
const broadleafCanopy = () => mergeParts([
  [new THREE.IcosahedronGeometry(0.55, 0), { y: 0.45 }],
  [new THREE.IcosahedronGeometry(0.42, 0), { x: 0.42, y: 0.38, z: 0.12 }],
  [new THREE.IcosahedronGeometry(0.4, 0), { x: -0.36, y: 0.42, z: -0.18 }],
  [new THREE.IcosahedronGeometry(0.36, 0), { x: 0.04, y: 0.72, z: 0.08 }],
]);

// 一圈遠山剪影：沿圓周的垂直帶，底在海面下，頂端照配置的高度。
function ridgeGeometry(plan, ring) {
  const { x: cx, z: cz } = plan.center;
  const positions = [];
  for (const { angle, height } of ring.points) {
    const x = cx + Math.cos(angle) * ring.radius;
    const z = cz + Math.sin(angle) * ring.radius;
    positions.push(x, -2, z, x, height, z);
  }
  const index = [];
  for (let k = 0; k < ring.points.length - 1; k++) {
    const a = k * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
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

// environment 是 createEnvironment 的結果（水面材質要加雲影）。回傳 { plan, update(t, dt, env) }；env 有 night、fog（霧色）與 skyHorizon（地平線色）。
export function createOutskirts(scene, { layout, quality, environment }) {
  const plan = planOutskirts(layout, { quality: quality.level });
  const group = new THREE.Group();
  group.name = 'outskirts';

  const shadows = { cloudShadows: { value: Array.from({ length: Math.max(1, plan.clouds.length) }, () => new THREE.Vector4()) } };
  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  addCloudShadows(groundMaterial, shadows);
  addCloudShadows(environment.waterMaterial, shadows);
  group.add(terrainMesh(plan, groundMaterial));

  // 背景樹：針葉與闊葉的樹冠各一個 InstancedMesh，樹幹共用一個；每棵樹各自的位置、大小與樹冠色。
  // 數千棵都不投影（只接收），陰影貼圖只畫島與近處物件。
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  const treeMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
  const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.6, 1, 5).translate(0, 0.5, 0);
  const trunk = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.trunk, flatShading: true, roughness: 0.9 }), Math.max(1, plan.trees.length));
  trunk.count = plan.trees.length;
  const canopies = [['conifer', coniferCanopy()], ['broadleaf', broadleafCanopy()]].map(([kind, geometry]) => {
    const trees = plan.trees.filter((tree) => tree.kind === kind);
    const mesh = new THREE.InstancedMesh(geometry, treeMaterial, Math.max(1, trees.length));
    mesh.count = trees.length;
    trees.forEach((tree, i) => {
      q.setFromAxisAngle(up, tree.rotation);
      mesh.setMatrixAt(i, m.compose(p.set(tree.x, tree.y + tree.trunk, tree.z), q, s.set(tree.radius, tree.height - tree.trunk, tree.radius)));
      mesh.setColorAt(i, color.setHex(tree.color));
    });
    return { mesh, trees };
  });
  canopies.flatMap(({ trees }) => trees).forEach((tree, i) => {
    q.setFromAxisAngle(up, tree.rotation);
    trunk.setMatrixAt(i, m.compose(p.set(tree.x, tree.y - 0.05, tree.z), q, s.set(tree.radius * 0.2, tree.trunk + 0.08, tree.radius * 0.2)));
  });
  for (const mesh of [trunk, ...canopies.map((c) => c.mesh)]) {
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  // 聚落：牆與屋頂各一個 InstancedMesh。屋頂是四角錐，屋頂色每戶各自取。
  const wallGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofGeometry = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const walls = new THREE.InstancedMesh(wallGeometry, new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.wall, flatShading: true, roughness: 0.9 }), Math.max(1, plan.houses.length));
  const roofs = new THREE.InstancedMesh(roofGeometry, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), Math.max(1, plan.houses.length));
  walls.count = roofs.count = plan.houses.length;
  plan.houses.forEach((house, i) => {
    q.setFromAxisAngle(up, house.rotation);
    walls.setMatrixAt(i, m.compose(p.set(house.x, house.y - 0.03, house.z), q, s.set(house.width, house.height + 0.03, house.depth)));
    roofs.setMatrixAt(i, m.compose(p.set(house.x, house.y + house.height, house.z), q, s.set(house.width * 1.1, house.roof, house.depth * 1.1)));
    roofs.setColorAt(i, color.setHex(house.roofColor));
  });
  for (const mesh of [walls, roofs]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // 霧團：貼地的扁平圓，顏色跟著時段的霧色。
  // 每團各自一份材質（透明度不同），共用透明度貼圖與幾何。
  const fogAlpha = softDisc();
  const fogDisc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const fogMeshes = plan.fogBanks.map((bank) => {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: fogAlpha, color: TERRAIN_PALETTE.cloud });
    const mesh = new THREE.Mesh(fogDisc, material);
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
    new THREE.IcosahedronGeometry(1, 1),
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

  // 遠山剪影：每圈一個不受光照與霧的平面帶，顏色每幀依時段算（silhouetteColor），越外圈越接近地平線色。
  const ridgeMeshes = plan.ridges.map((ring) => {
    const mesh = new THREE.Mesh(ridgeGeometry(plan, ring), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false, toneMapped: false }));
    group.add(mesh);
    return mesh;
  });

  // 海上小島：低矮的岩丘，每座一棵闊葉樹（燈塔那座除外）。
  const islets = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.55, 1, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.islet, flatShading: true, roughness: 0.95 }),
    Math.max(1, plan.islets.length),
  );
  islets.count = plan.islets.length;
  const isletTrees = plan.islets.filter((o) => o.tree);
  const isletCanopy = new THREE.InstancedMesh(broadleafCanopy(), treeMaterial, Math.max(1, isletTrees.length));
  isletCanopy.count = isletTrees.length;
  plan.islets.forEach((islet, i) => {
    q.setFromAxisAngle(up, islet.rotation);
    islets.setMatrixAt(i, m.compose(p.set(islet.x, SEA_LEVEL - 0.3, islet.z), q, s.set(islet.radius, islet.top - SEA_LEVEL + 0.3, islet.radius)));
  });
  isletTrees.forEach((islet, i) => {
    const { height, radius } = islet.tree;
    q.setFromAxisAngle(up, islet.rotation);
    isletCanopy.setMatrixAt(i, m.compose(p.set(islet.x, islet.top - 0.05, islet.z), q, s.set(radius, height, radius)));
    isletCanopy.setColorAt(i, color.setHex(islet.tree.color));
  });
  for (const mesh of [islets, isletCanopy]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // 燈塔：塔身、紅色環帶、燈室（夜裡發光，與窗戶共用發光材質）、屋頂。
  if (plan.lighthouse) {
    const { x, y, z, height } = plan.lighthouse;
    const tower = new THREE.Group();
    tower.position.set(x, y, z);
    const solid = (geometry, hex, at) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness: 0.8 }));
      mesh.position.y = at;
      mesh.castShadow = true;
      tower.add(mesh);
    };
    solid(new THREE.CylinderGeometry(0.16, 0.26, height * 0.78, 10), TERRAIN_PALETTE.lighthouse, height * 0.39);
    solid(new THREE.CylinderGeometry(0.2, 0.22, height * 0.14, 10), TERRAIN_PALETTE.lighthouseBand, height * 0.45);
    // 發光材質本身是白色乘倍率，顏色由實例色給（與島上路燈同色）。
    const lamp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, height * 0.12, 8), environment.glowMaterial, 1);
    lamp.setMatrixAt(0, m.makeTranslation(0, height * 0.84, 0));
    lamp.setColorAt(0, color.setHex(PALETTE.lampGlow));
    lamp.computeBoundingSphere();
    tower.add(lamp);
    solid(new THREE.ConeGeometry(0.2, height * 0.1, 8), TERRAIN_PALETTE.lighthouseBand, height * 0.95);
    group.add(tower);
  }

  // 帆船：船身與三角帆各一個 InstancedMesh，每幀依動畫時間擺位置。
  const hullGeometry = new THREE.CylinderGeometry(0.12, 0.08, 0.7, 6, 1).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.05, 0);
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.12, -0.22, 0, plan.sailHeight, 0.02, 0, 0.12, 0.26], 3));
  sailGeometry.computeVertexNormals();
  const hulls = new THREE.InstancedMesh(hullGeometry, new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.hull, flatShading: true, roughness: 0.85 }), Math.max(1, plan.boats.length));
  const sails = new THREE.InstancedMesh(sailGeometry, new THREE.MeshStandardMaterial({ color: TERRAIN_PALETTE.sail, side: THREE.DoubleSide, flatShading: true, roughness: 0.9 }), Math.max(1, plan.boats.length));
  for (const mesh of [hulls, sails]) {
    mesh.count = plan.boats.length;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  scene.add(group);

  const ridgeLighting = { night: 0, skyHorizon: 0 };
  const fogColor = new THREE.Color();
  const euler = new THREE.Euler();
  const local = new THREE.Vector3();
  return {
    plan,
    group,
    update(t, dt, env = {}) {
      const night = env.night ?? 0;
      const { clouds, fogBanks, birds, boats, waterTime } = ambientAt(plan, t);
      environment.setWaterTime(waterTime);

      // 遠山剪影往地平線色混。
      if (env.skyHorizon !== undefined) {
        ridgeLighting.night = night;
        ridgeLighting.skyHorizon = env.skyHorizon;
        ridgeMeshes.forEach((mesh, i) => mesh.material.color.setHex(silhouetteColor(ridgeLighting, i)));
      }

      boats.forEach((boat, i) => {
        euler.set(0, boat.heading, boat.roll, 'YXZ');
        q.setFromEuler(euler);
        const size = plan.boats[i].size;
        m.compose(p.set(boat.x, SEA_LEVEL + boat.bob, boat.z), q, s.set(size, size, size));
        hulls.setMatrixAt(i, m);
        sails.setMatrixAt(i, m);
      });
      hulls.instanceMatrix.needsUpdate = true;
      sails.instanceMatrix.needsUpdate = true;

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
