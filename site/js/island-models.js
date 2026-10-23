// 島嶼檢視的低多邊形模型：格子、在地感元素、候選人標記。全部由程式產生，不載入外部模型檔。
// 3D 材質色碼只寫在 PALETTE，一律用 0xrrggbb，上線關卡「禁用色檢查」會掃這些色碼（ADR 0001）。

import * as THREE from 'three';

export const PALETTE = {
  background: 0xe8e0d2,
  water: 0x7d9a98,
  shallow: 0x98aeaa,
  landTop: 0xc99a83,
  landSide: 0x8e4b32,
  landSelected: 0xd9b59c,
  landDimmed: 0xb3aba2,
  decorativeTop: 0xbba893,
  mud: 0x8f7a64,
  rock: 0x8a7f74,
  rockDark: 0x6e655d,
  snow: 0xeae6df,
  laterite: 0xa0583c,
  lateriteDark: 0x7e4330,
  foliage: 0x8c8a62,
  foliageDark: 0x6f6d4f,
  reed: 0x9c9470,
  straw: 0xc8b47a,
  porcelain: 0xddd3c4,
  broth: 0xa9764f,
  noodle: 0xd8c49a,
  tea: 0xb88b62,
  pearl: 0x3a2f28,
  pastry: 0xd2ad80,
  pastryDark: 0xb48a5c,
  taro: 0x9a8c90,
  potato: 0xae7448,
  shavedIce: 0xece6da,
  bean: 0x7a4a3a,
  fruit: 0xa84a3a,
  syrup: 0xc9a463,
  brick: 0xa65a46,
  wall: 0xd9cbb5,
  roof: 0x6b4a3c,
  roofTile: 0x5f5853,
  timber: 0x5e5852,
  tile: 0xb8b0a4,
  markerLit: 0xf1e4c8,
  markerGlow: 0x8a6f4a,
  markerOff: 0x6b6560,
  hemiSky: 0xf4efe6,
  hemiGround: 0x8e4b32,
  sun: 0xf2e6d4,
};

const materials = new Map();
// 同色共用材質。flatShading 讓多邊形面清楚，是低多邊形的風格。
export function material(color, options = {}) {
  const key = `${color}:${JSON.stringify(options)}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...options }));
  }
  return materials.get(key);
}

function mesh(geometry, color, { x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0, side } = {}) {
  const m = new THREE.Mesh(geometry, side ? material(color, { side }) : material(color));
  m.position.set(x, y, z);
  m.rotation.set(rotX, rotY, rotZ);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const group = (...children) => {
  const g = new THREE.Group();
  g.add(...children.flat());
  return g;
};

// 格子：深色土層加淺色頂面，尖頂六角形（CylinderGeometry 六邊時頂點朝南北）。
export const TILE_HEIGHT = 0.36;
const TILE_TOP = 0.08;
export function hexTile(size) {
  const base = mesh(new THREE.CylinderGeometry(size * 0.98, size * 1.02, TILE_HEIGHT, 6), PALETTE.landSide, { y: TILE_HEIGHT / 2 });
  const top = mesh(new THREE.CylinderGeometry(size * 0.96, size * 0.98, TILE_TOP, 6), PALETTE.landTop, { y: TILE_HEIGHT + TILE_TOP / 2 });
  top.material = top.material.clone();
  return { tile: group(base, top), top };
}
export const TILE_SURFACE = TILE_HEIGHT + TILE_TOP;

// 常用形體。每個元素先在約 1.5 × 1.05 的範圍內組好，再由 fitInto 縮放到格子的元素區。
const cone = (r, h, segments = 6) => new THREE.ConeGeometry(r, h, segments);
const cyl = (rt, rb, h, segments = 10) => new THREE.CylinderGeometry(rt, rb, h, segments);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rockGeo = (r, detail = 0) => new THREE.DodecahedronGeometry(r, detail);

function conifer(x, z, h = 0.42) {
  return [
    mesh(cyl(0.025, 0.035, h * 0.3, 5), PALETTE.timber, { x, y: h * 0.15, z }),
    mesh(cone(h * 0.3, h * 0.55, 6), PALETTE.foliageDark, { x, y: h * 0.45, z }),
    mesh(cone(h * 0.22, h * 0.42, 6), PALETTE.foliage, { x, y: h * 0.72, z }),
  ];
}

function roundTree(x, z, h = 0.36) {
  return [
    mesh(cyl(0.025, 0.035, h * 0.45, 5), PALETTE.timber, { x, y: h * 0.22, z }),
    mesh(new THREE.IcosahedronGeometry(h * 0.33, 0), PALETTE.foliage, { x, y: h * 0.68, z }),
  ];
}

// 以拉伸剖面做的山脊或台地：剖面在 x-y 平面，沿 z 拉伸 depth。
function ridge(points, depth, color) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, color);
}

// 碗：碗身、湯面、配料。
function bowl({ r = 0.5, fill, extras = [] }) {
  return [
    mesh(cyl(r * 0.55, r * 0.5, 0.05, 14), PALETTE.porcelain, { y: 0.025 }),
    mesh(cyl(r, r * 0.6, r * 0.6, 14), PALETTE.porcelain, { y: 0.05 + r * 0.3 }),
    mesh(cyl(r * 0.92, r * 0.92, 0.03, 14), fill, { y: 0.05 + r * 0.58 }),
    ...extras.map((make) => make(0.05 + r * 0.6)),
  ];
}

function chopsticks(x, y, z, rotY = 0.3) {
  return [-0.03, 0.03].map((dx) => mesh(box(0.025, 0.025, 0.9), PALETTE.timber, { x: x + dx, y, z, rotY }));
}

function plate(r = 0.62) {
  return mesh(cyl(r, r * 0.85, 0.05, 16), PALETTE.porcelain, { y: 0.025 });
}

// 尖頂屋：牆身加雙坡屋頂，ridgeTips 為燕尾脊（屋脊兩端上翹）。
function hall({ w, d, h, roofH = 0.22, wallColor = PALETTE.brick, roofColor = PALETTE.roofTile, swallowtail = true, x = 0, z = 0, rotY = 0 }) {
  const roofShape = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.06, 0), new THREE.Vector2(d / 2 + 0.06, 0), new THREE.Vector2(0, roofH)]);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.08, bevelEnabled: false });
  roofGeo.translate(0, 0, -(w + 0.08) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const parts = [mesh(box(w, h, d), wallColor), mesh(roofGeo, roofColor)];
  parts[0].position.y = h / 2;
  parts[1].position.y = h;
  if (swallowtail) {
    parts.push(mesh(box(w + 0.1, 0.04, 0.05), roofColor, { y: h + roofH + 0.01 }));
    for (const side of [-1, 1]) {
      parts.push(mesh(box(0.14, 0.035, 0.05), roofColor, { x: side * (w / 2 + 0.08), y: h + roofH + 0.05, rotZ: side * 0.6 }));
    }
  }
  const g = group(parts);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

// 三合院：正身加左右護龍圍出前埕。
function courtyardHouse({ pond = false } = {}) {
  const parts = [
    mesh(box(1.5, 0.03, 1.0), PALETTE.straw, { y: 0.015 }),
    hall({ w: 0.9, d: 0.3, h: 0.28, z: -0.32 }),
    hall({ w: 0.5, d: 0.24, h: 0.22, x: -0.55, z: 0.02, rotY: Math.PI / 2, roofH: 0.16 }),
    hall({ w: 0.5, d: 0.24, h: 0.22, x: 0.55, z: 0.02, rotY: Math.PI / 2, roofH: 0.16 }),
  ];
  if (pond) {
    // 屋前半月池。
    parts.push(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16, 1, false, Math.PI / 2, Math.PI), PALETTE.water, { y: 0.03, z: 0.34 }));
  } else {
    parts.push(...roundTree(-0.62, 0.38, 0.34), ...roundTree(0.62, 0.38, 0.34));
  }
  return group(parts);
}

function wetland({ birds = 3, channel = false } = {}) {
  const parts = [
    mesh(cyl(0.78, 0.8, 0.03, 12), PALETTE.mud, { y: 0.015 }),
    mesh(cyl(0.55, 0.58, 0.035, 10), PALETTE.shallow, { x: 0.12, y: 0.03, z: 0.05 }),
  ];
  if (channel) parts.push(mesh(box(0.22, 0.04, 1.2), PALETTE.water, { x: -0.25, y: 0.035, rotY: 0.6 }));
  const reeds = [[-0.6, -0.15], [-0.55, 0.2], [-0.45, -0.38], [0.6, -0.3], [0.62, 0.15], [-0.1, -0.5], [0.3, -0.48], [0.45, 0.42]];
  for (const [x, z] of reeds) {
    for (const [dx, dz, h] of [[0, 0, 0.32], [0.05, 0.03, 0.26], [-0.04, 0.04, 0.22]]) {
      parts.push(mesh(cone(0.025, h, 4), PALETTE.reed, { x: x + dx, y: h / 2 + 0.02, z: z + dz }));
    }
  }
  // 白鷺：身體、長頸、頭。
  [[0.05, -0.05], [0.3, 0.2], [-0.2, 0.25]].slice(0, birds).forEach(([x, z], i) => {
    parts.push(
      mesh(new THREE.SphereGeometry(0.07, 6, 4), PALETTE.porcelain, { x, y: 0.16, z }),
      mesh(cyl(0.015, 0.02, 0.14, 4), PALETTE.porcelain, { x: x + 0.05, y: 0.25, z, rotZ: -0.4 }),
      mesh(new THREE.SphereGeometry(0.03, 5, 3), PALETTE.porcelain, { x: x + 0.08, y: 0.32, z }),
      mesh(cyl(0.008, 0.008, 0.14, 3), PALETTE.timber, { x, y: 0.07, z }),
    );
    if (i === 0) parts.push(mesh(cone(0.01, 0.08, 3), PALETTE.syrup, { x: x + 0.13, y: 0.32, z, rotZ: -Math.PI / 2 }));
  });
  return group(parts);
}

function snowPeak(r, h, x, z, { snow = true, color = PALETTE.rock, segments = 6, rotY = 0 } = {}) {
  const parts = [mesh(cone(r, h, segments), color, { x, y: h / 2, z, rotY })];
  if (snow) parts.push(mesh(cone(r * 0.42, h * 0.42, segments), PALETTE.snow, { x, y: h * 0.79 + 0.005, z, rotY }));
  return parts;
}

const BUILDERS = {
  // 大肚山：紅土台地，頂部平坦，坡面紅土裸露，台地上一排樹。
  'dadu-plateau': () => group(
    ridge([[-0.78, 0], [0.78, 0], [0.55, 0.36], [0.3, 0.42], [-0.35, 0.42], [-0.6, 0.34]], 0.95, PALETTE.laterite),
    mesh(box(0.84, 0.03, 0.8), PALETTE.foliage, { y: 0.43 }),
    ridge([[-0.78, 0], [-0.6, 0.34], [-0.66, 0]], 0.95, PALETTE.lateriteDark),
    ...[-0.32, -0.08, 0.16].flatMap((x, i) => roundTree(x, -0.2 + i * 0.18, 0.34).map((m) => (m.position.y += 0.44, m))),
  ),
  // 鐵砧山：形如鐵砧的平頂山丘。
  'tiezhen-mountain': () => group(
    ridge([[-0.78, 0], [0.78, 0], [0.5, 0.18], [0.62, 0.5], [-0.62, 0.5], [-0.5, 0.18]], 0.9, PALETTE.rock),
    mesh(box(1.26, 0.04, 0.92), PALETTE.foliage, { y: 0.52 }),
    ...conifer(-0.35, -0.15, 0.36).map((m) => (m.position.y += 0.54, m)),
    ...conifer(0.3, 0.1, 0.32).map((m) => (m.position.y += 0.54, m)),
  ),
  // 高美濕地：泥灘、淺水、蘆葦與白鷺。
  'gaomei-wetland': () => wetland(),
  // 大肚溪口濕地：河道流入泥灘。
  'dadu-river-mouth': () => wetland({ birds: 2, channel: true }),
  // 新社河階台地：三層階地，田埂分出田塊。
  'xinshe-terraces': () => {
    const parts = [];
    [[1.5, 1.05, 0.12, 0, PALETTE.laterite], [1.15, 0.72, 0.26, -0.14, PALETTE.lateriteDark], [0.8, 0.42, 0.4, -0.26, PALETTE.laterite]]
      .forEach(([w, d, h, z, color], level) => {
        parts.push(mesh(box(w, h, d), color, { y: h / 2, z }));
        const fieldColor = level === 1 ? PALETTE.straw : PALETTE.foliage;
        parts.push(mesh(box(w - 0.08, 0.02, d - 0.08), fieldColor, { y: h + 0.01, z }));
        for (const fx of [-w / 4, 0, w / 4]) parts.push(mesh(box(0.025, 0.035, d - 0.08), PALETTE.lateriteDark, { x: fx, y: h + 0.02, z }));
      });
    return group(parts);
  },
  // 鳶嘴山：尖銳的岩峰，峰頂像鳥嘴一樣斜伸。
  'yuanzui-mountain': () => group(
    mesh(cone(0.75, 0.3, 7), PALETTE.foliageDark, { y: 0.15 }),
    mesh(cone(0.28, 0.95, 5), PALETTE.rock, { x: -0.12, y: 0.62, rotZ: 0.12 }),
    mesh(cone(0.2, 0.7, 5), PALETTE.rockDark, { x: 0.28, y: 0.5, z: 0.1, rotZ: -0.1 }),
    mesh(cone(0.07, 0.36, 4), PALETTE.rockDark, { x: 0.02, y: 1.08, rotZ: -1.1 }),
    ...conifer(-0.55, 0.2, 0.3), ...conifer(0.55, -0.2, 0.3),
  ),
  // 大雪山：覆滿針葉林的山。
  daxueshan: () => group(
    mesh(cone(0.75, 0.55, 8), PALETTE.foliageDark, { y: 0.275 }),
    ...[[0, -0.05, 0.5], [-0.32, 0.15, 0.42], [0.32, 0.12, 0.42], [-0.15, -0.35, 0.42], [0.2, -0.32, 0.4], [-0.5, -0.2, 0.36], [0.52, -0.15, 0.36], [0, 0.4, 0.36], [-0.45, 0.42, 0.34], [0.45, 0.4, 0.34]]
      .flatMap(([x, z, h]) => conifer(x, z, h).map((m) => (m.position.y += 0.55 - Math.hypot(x, z) * 0.7, m))),
  ),
  // 雪山：台中境內最高的山，雪白的尖峰與稜線。
  'xue-mountain': () => group(
    ...snowPeak(0.55, 1.2, 0, -0.05),
    ...snowPeak(0.36, 0.75, 0.48, 0.12, { color: PALETTE.rockDark }),
    ...snowPeak(0.32, 0.6, -0.5, 0.15, { snow: false, color: PALETTE.rockDark }),
  ),
  // 南湖大山：寬大的山體，多個積雪山峰。
  'nanhu-mountain': () => group(
    ridge([[-0.8, 0], [0.8, 0], [0.5, 0.4], [-0.5, 0.4]], 0.9, PALETTE.rock),
    ...snowPeak(0.32, 0.65, -0.3, 0, { rotY: 0.3 }).map((m) => (m.position.y += 0.35, m)),
    ...snowPeak(0.36, 0.8, 0.15, -0.05).map((m) => (m.position.y += 0.35, m)),
    ...snowPeak(0.26, 0.5, 0.48, 0.05, { rotY: 0.5 }).map((m) => (m.position.y += 0.35, m)),
  ),
  // 七家灣溪：山谷中的蜿蜒溪流，兩岸針葉林與溪石。
  'qijiawan-creek': () => {
    const bends = [[-0.65, -0.4, 0.5], [-0.3, -0.12, -0.4], [0.05, 0.08, 0.5], [0.4, 0.3, -0.35], [0.7, 0.45, 0.4]];
    return group(
      mesh(box(1.5, 0.04, 1.05), PALETTE.foliage, { y: 0.02 }),
      ...bends.map(([x, z, rot]) => mesh(box(0.42, 0.05, 0.16), PALETTE.water, { x, y: 0.035, z, rotY: rot })),
      ...[[-0.45, -0.32], [0.2, 0.16], [0.55, 0.42]].map(([x, z]) => mesh(rockGeo(0.06), PALETTE.rock, { x, y: 0.07, z })),
      ...conifer(-0.55, 0.3, 0.46), ...conifer(-0.2, 0.38, 0.4), ...conifer(0.35, -0.3, 0.46), ...conifer(0.62, -0.05, 0.4), ...conifer(-0.05, -0.38, 0.38),
    );
  },
  // 太陽餅：盤上疊著酥皮圓餅，切開的一塊露出內餡。
  suncake: () => group(
    plate(0.75),
    mesh(cyl(0.42, 0.44, 0.13, 16), PALETTE.pastry, { x: -0.18, y: 0.115 }),
    mesh(cyl(0.36, 0.36, 0.015, 16), PALETTE.pastryDark, { x: -0.18, y: 0.185 }),
    mesh(cyl(0.36, 0.38, 0.12, 16), PALETTE.pastry, { x: 0.12, y: 0.25, z: -0.05 }),
    mesh(cyl(0.28, 0.28, 0.015, 16), PALETTE.pastryDark, { x: 0.12, y: 0.315, z: -0.05 }),
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12, 1, false, 0, Math.PI / 2.5), PALETTE.pastry, { x: 0.42, y: 0.11, z: 0.28 }),
    mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12, 1, false, 0, Math.PI / 2.5), PALETTE.syrup, { x: 0.42, y: 0.11, z: 0.28 }),
  ),
  // 珍珠奶茶：大杯奶茶、封膜、粗吸管，杯底一層珍珠。
  'bubble-tea': () => group(
    mesh(box(1.4, 0.04, 0.95), PALETTE.timber, { y: 0.02 }),
    mesh(cyl(0.3, 0.24, 0.82, 14), PALETTE.tea, { y: 0.45 }),
    mesh(cyl(0.245, 0.24, 0.14, 14), PALETTE.pearl, { y: 0.11 }),
    mesh(cyl(0.31, 0.31, 0.04, 14), PALETTE.porcelain, { y: 0.88 }),
    mesh(cyl(0.035, 0.035, 0.6, 6), PALETTE.porcelain, { x: 0.06, y: 1.05, rotZ: 0.15 }),
    ...[[-0.45, 0.25], [0.5, 0.2], [0.42, -0.3], [-0.5, -0.2], [0.55, 0.38]].map(([x, z]) => mesh(new THREE.IcosahedronGeometry(0.05, 0), PALETTE.pearl, { x, y: 0.08, z })),
  ),
  // 大麵羹：大碗裡粗黃的鹼麵與筷子。
  'da-mian-geng': () => group(
    ...bowl({ r: 0.62, fill: PALETTE.broth, extras: [
      (y) => [[-0.2, 0], [0, 0.1], [0.18, -0.08], [-0.05, -0.18], [0.25, 0.15]].map(([x, z], i) => mesh(cyl(0.025, 0.025, 0.55, 5), PALETTE.noodle, { x, y: y + 0.03, z, rotX: Math.PI / 2, rotY: i * 0.7 })),
    ] }),
    ...chopsticks(0.15, 0.5, 0, 0.5),
  ),
  // 麻薏湯：墨綠湯色的碗，裡面有地瓜塊，旁邊放一束黃麻嫩葉。
  'mayi-soup': () => group(
    ...bowl({ r: 0.56, fill: PALETTE.foliageDark, extras: [
      (y) => [[-0.15, 0.05], [0.12, -0.1], [0.08, 0.18]].map(([x, z]) => mesh(box(0.13, 0.08, 0.1), PALETTE.potato, { x, y: y + 0.02, z, rotY: x * 5 })),
    ] }),
    ...[[-0.62, 0.3], [-0.58, 0.42], [-0.7, 0.4]].map(([x, z], i) => mesh(cone(0.09, 0.3, 4), PALETTE.foliage, { x, y: 0.06, z, rotX: Math.PI / 2, rotY: i * 0.4 })),
  ),
  // 蜜豆冰：碗上堆成小山的剉冰，淋糖水、放蜜豆與水果。
  'mitou-ice': () => group(
    ...bowl({ r: 0.55, fill: PALETTE.shavedIce, extras: [
      (y) => mesh(new THREE.IcosahedronGeometry(0.45, 0), PALETTE.shavedIce, { y: y + 0.22 }),
      (y) => mesh(cone(0.36, 0.2, 7), PALETTE.syrup, { y: y + 0.6 }),
      (y) => [[-0.18, 0.15], [0.15, 0.2], [0.05, -0.2], [-0.22, -0.12], [0.25, -0.05]].map(([x, z], i) => mesh(new THREE.IcosahedronGeometry(0.055, 0), i % 2 ? PALETTE.fruit : PALETTE.bean, { x, y: y + 0.42, z })),
    ] }),
  ),
  // 粄條：盤上寬扁的米白麵條，配筷子與一小碟。
  'ban-tiao': () => group(
    plate(0.7),
    ...[-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((x, i) => mesh(box(0.1, 0.035, 0.7), PALETTE.shavedIce, { x, y: 0.07 + (i % 2) * 0.03, rotY: 0.25 })),
    mesh(cyl(0.18, 0.14, 0.06, 10), PALETTE.porcelain, { x: 0.6, y: 0.03, z: 0.32 }),
    mesh(cyl(0.16, 0.16, 0.02, 10), PALETTE.broth, { x: 0.6, y: 0.065, z: 0.32 }),
    ...chopsticks(-0.2, 0.13, 0.05, 0.9),
  ),
  // 筒仔米糕：倒扣在盤上的圓筒米糕，頂上一片肉，旁邊放竹筒。
  'tube-rice-pudding': () => group(
    plate(0.7),
    mesh(cyl(0.28, 0.3, 0.42, 12), PALETTE.broth, { x: -0.12, y: 0.26 }),
    mesh(cyl(0.2, 0.2, 0.05, 10), PALETTE.bean, { x: -0.12, y: 0.495 }),
    mesh(cyl(0.18, 0.18, 0.5, 8), PALETTE.straw, { x: 0.45, y: 0.25, z: 0.05, rotZ: Math.PI / 2.3 }),
  ),
  // 大甲芋頭：芋田裡的大葉芋頭株，田邊放著剖開的芋頭。
  'dajia-taro': () => {
    const plant = (x, z, s = 1) => [
      mesh(cyl(0.02, 0.025, 0.35 * s, 4), PALETTE.foliage, { x, y: 0.2 * s, z }),
      mesh(cone(0.22 * s, 0.1, 6), PALETTE.foliage, { x, y: 0.4 * s, z, rotX: Math.PI, rotZ: 0.35 }),
    ];
    return group(
      mesh(box(1.5, 0.04, 1.0), PALETTE.mud, { y: 0.02 }),
      ...[-0.25, 0.05, 0.35].map((z) => mesh(box(1.4, 0.03, 0.04), PALETTE.lateriteDark, { y: 0.05, z })),
      ...[[-0.5, -0.38], [-0.1, -0.4], [0.3, -0.36], [-0.3, -0.08], [0.1, -0.1], [0.5, -0.12]].flatMap(([x, z]) => plant(x, z, 1.2)),
      mesh(rockGeo(0.22), PALETTE.taro, { x: -0.3, y: 0.24, z: 0.32 }),
      mesh(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI), PALETTE.shavedIce, { x: 0.25, y: 0.12, z: 0.3, rotX: -Math.PI / 2 }),
    );
  },
  // 台中公園湖心亭：湖中兩座相連的亭子，屋頂四角上翹。
  'lake-pavilion': () => {
    const pavilion = (x) => [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => mesh(cyl(0.025, 0.025, 0.3, 5), PALETTE.brick, { x: x + sx * 0.17, y: 0.27, z: sz * 0.17 })),
      mesh(box(0.42, 0.05, 0.42), PALETTE.wall, { x, y: 0.12 }),
      mesh(cone(0.38, 0.26, 4), PALETTE.roofTile, { x, y: 0.55, rotY: Math.PI / 4 }),
      mesh(cone(0.05, 0.14, 4), PALETTE.roofTile, { x, y: 0.72 }),
    ];
    return group(
      mesh(cyl(0.78, 0.78, 0.04, 14), PALETTE.water, { y: 0.02 }),
      mesh(box(1.5, 0.05, 0.12), PALETTE.wall, { y: 0.07, z: 0.42 }),
      mesh(box(0.12, 0.05, 0.4), PALETTE.wall, { y: 0.07, z: 0.22 }),
      ...pavilion(-0.28), ...pavilion(0.28),
      mesh(box(0.2, 0.05, 0.2), PALETTE.wall, { y: 0.12 }),
    );
  },
  // 東海大學路思義教堂：兩對彎曲屋面向上收成尖頂，屋脊中間留一道天窗縫。
  'luce-chapel': () => {
    const panel = (side) => {
      const geometry = new THREE.PlaneGeometry(0.7, 1.15, 6, 10);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) + 0.575) / 1.15; // 0 底、1 頂
        // 屋面向下外擴成弧形，頂端內收；寬度往上收窄。
        pos.setX(i, pos.getX(i) * (1 - 0.55 * t));
        pos.setZ(i, side * (0.42 * (1 - t) ** 2 + 0.03));
      }
      geometry.computeVertexNormals();
      geometry.rotateY(Math.PI / 2);
      return mesh(geometry, PALETTE.tile, { y: 0.575, side: THREE.DoubleSide });
    };
    return group(
      mesh(box(1.5, 0.03, 1.0), PALETTE.foliage, { y: 0.015 }),
      group(panel(-1), panel(1)),
      ...roundTree(-0.62, 0.3, 0.36), ...roundTree(0.62, -0.3, 0.36), ...roundTree(0.6, 0.32, 0.3),
    );
  },
  // 筱雲山莊：紅磚三合院，燕尾屋脊，院前兩棵樹。
  'xiaoyun-manor': () => courtyardHouse(),
  // 社口林宅：紅磚三合院，屋前半月池。
  'shekou-lin-residence': () => courtyardHouse({ pond: true }),
};

// 元素清單新增項目時若沒有專屬模型，依類別給通用模型。
const BY_CATEGORY = {
  自然景觀: () => group(...snowPeak(0.6, 0.8, 0, 0, { snow: false })),
  小吃: () => group(...bowl({ fill: PALETTE.broth })),
  老建築: () => courtyardHouse(),
};

// 元素區：有標記的議題區格子留出南側的標記帶，元素放在北側；裝飾格沒有標記，元素可以放大置中。
// 範圍是相對格心的 x、z 與最高高度。格子頂面半徑 0.96，標記帶從 z = 0.32 開始；
// 北側不超過 -0.74，免得碰到北鄰格子的標記帶。
const ELEMENT_AREA = {
  area: { minX: -0.76, maxX: 0.76, minZ: -0.74, maxZ: 0.24, maxY: 1.25 },
  decorative: { minX: -0.8, maxX: 0.8, minZ: -0.7, maxZ: 0.7, maxY: 1.35 },
};

// 把模型等比例縮放到元素區內，水平置中、底部貼齊格子頂面（y = 0）。
function fitInto(model, area) {
  model.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(model);
  const size = bbox.getSize(new THREE.Vector3());
  const scale = Math.min((area.maxX - area.minX) / size.x, (area.maxZ - area.minZ) / size.z, area.maxY / size.y);
  model.scale.setScalar(scale);
  const center = bbox.getCenter(new THREE.Vector3());
  model.position.set(
    (area.minX + area.maxX) / 2 - center.x * scale,
    -bbox.min.y * scale,
    (area.minZ + area.maxZ) / 2 - center.z * scale,
  );
  const wrapper = new THREE.Group();
  wrapper.add(model);
  return wrapper;
}

// kind 是 'area'（議題區，留標記帶）或 'decorative'（裝飾格）。
export function localElementModel(element, kind = 'area') {
  const build = BUILDERS[element.id] ?? BY_CATEGORY[element.category];
  return build ? fitInto(build(), ELEMENT_AREA[kind]) : null;
}

// 候選人標記：同尺寸、同色，只以形狀區分。size 是外接圓半徑。
function markerShape(shape, size) {
  if (shape === 'circle') {
    const s = new THREE.Shape();
    s.absarc(0, 0, size, 0, Math.PI * 2, false);
    return s;
  }
  const sides = shape === 'triangle' ? 3 : 4;
  const start = shape === 'triangle' ? Math.PI / 2 : Math.PI / 4;
  return new THREE.Shape(Array.from({ length: sides }, (_, i) => {
    const a = start + (i / sides) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * size, Math.sin(a) * size);
  }));
}

const MARKER_DEPTH = 0.07;
const litMaterial = () => material(PALETTE.markerLit, { emissive: PALETTE.markerGlow, emissiveIntensity: 0.6 });
const offMaterial = () => material(PALETTE.markerOff, { transparent: true, opacity: 0.55 });

// 標記平躺在格子上、略為墊高，從斜上方看得到形狀。
export function markerModel({ shape, size }) {
  const geometry = new THREE.ExtrudeGeometry(markerShape(shape, size), { depth: MARKER_DEPTH, bevelEnabled: false, curveSegments: 16 });
  geometry.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geometry, offMaterial());
  m.castShadow = true;
  return m;
}

export function setMarkerLit(marker, lit) {
  marker.material = lit ? litMaterial() : offMaterial();
}
