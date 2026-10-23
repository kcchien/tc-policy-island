// 島體的 3D 場景：每座小島的頂面（程序地面貼圖）、側壁、頂緣圖案帶、步道環、路緣、路燈，
// 島外的淺水環與泡沫環，以及相鄰島之間的拱橋。配置來自 island-body.js（只看格子位置，不讀政見）。
// 靜態零件用零件庫的共用幾何，放進格子群組（選取抬高時跟著動），之後由 instancify 合批；
// 側壁用水面材質、淺水與泡沫環半透明，這三種自己建 InstancedMesh。

import * as THREE from 'three';
import {
  BRIDGE, bridgeLift, CHANNEL_WIDTH, cornerAngle, ISLAND_APOTHEM, ISLAND_RADIUS, islandBody, WALKWAY, WALKWAY_APOTHEM,
} from './island-body.js';
import { sharedGeometry } from './island-kit.js';
import { material, streetLamps, TILE_SURFACE } from './island-models.js';
import { SEA_LEVEL } from './island-terrain.js';

// 3D 材質與貼圖色碼，受禁用色檢查（ADR 0001）。沿用本站赭色系，不用參考網站的識別色。
export const BODY_PALETTE = {
  // 島頂面的底色（乘上地面貼圖）：議題區、選中、淡化、裝飾格、候選人廣場。
  top: 0xe3cfb6,
  topSelected: 0xeddcc6,
  topDimmed: 0xb3aba2,
  topDecorative: 0xd6c6b0,
  topPlaza: 0xdcd2c2,
  // 地面貼圖：亮底加較暗的紋路，乘上頂面底色後才是畫面上的顏色。
  groundBase: 0xf2ece4,
  groundMark: 0xd9cfc2,
  walkway: 0xc4a184,
  walkwayJoint: 0xa8876c,
  curb: 0xe0d0bb,
  // 頂緣圖案帶：每島一個主色與淺色交錯，主色依格子順序輪替，與議題內容無關。
  band: [0xb5734f, 0xa8805a, 0x9a6b52, 0xc08f62, 0x8f6a58],
  bandLight: 0xe6d8c4,
  shallow: 0xb7c7c2,
  foam: 0xece6dc,
  plank: 0xa27b5c,
  rail: 0x6e5a4c,
};

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;
// 側壁從水面下延伸到圖案帶下緣；圖案帶在頂面下 BAND_HEIGHT 的範圍。
const BAND_HEIGHT = 0.08;
const BAND_DEPTH = 0.03;
const BAND_BLOCKS = 8;
const WALL_BOTTOM = SEA_LEVEL - 0.3;
// 路緣高出頂面、步道略高出頂面，避免與頂面 z-fighting。
const CURB_WIDTH = 0.017;
const CURB_HEIGHT = 0.025;
const WALK_LIFT = 0.006;
// 島外的淺水環與泡沫環（離島緣的寬度）。淺水環寬半條水道，相鄰兩島的淺水環在水道正中相接、不重疊
// （兩層半透明疊在一起會比外圍深一截）。
const SHALLOW_WIDTH = CHANNEL_WIDTH / 2;
const FOAM_WIDTH = 0.08;
// 地面貼圖的世界座標比例：每 GROUND_TILE 場景單位重複一次，紋路跨島連續。
const GROUND_TILE = 1.4;

// 邊心距換成外接半徑（六角環的幾何用外接半徑）。
const radiusOf = (apothem) => apothem / Math.cos(Math.PI / 6);

// 尖頂六角形（頂點朝南北）的平面形狀：Shape 在 x-y 平面，轉平後 y 對應 -z，頂點仍在 ±30 度、±90 度、±150 度。
function hexShape(radius) {
  return new THREE.Shape(Array.from({ length: 6 }, (_, i) => new THREE.Vector2(Math.cos(cornerAngle(i)) * radius, Math.sin(cornerAngle(i)) * radius)));
}

// 六角環的實心框（外接半徑 outer、inner），高 height，底面在 y = 0。
function hexFrame(outer, inner, height) {
  const shape = hexShape(outer);
  shape.holes.push(new THREE.Path(hexShape(inner).getPoints().reverse()));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 平放的六角環（水面上的淺水與泡沫）。
function flatHexRing(inner, outer) {
  const geometry = new THREE.RingGeometry(inner, outer, 6, 1, Math.PI / 6);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 地面貼圖：三種紋路（磚紋、斑點、條紋），依格子順序輪替。亮底加暗紋，顏色由頂面材質的底色決定。
function groundTexture(kind) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = hex(BODY_PALETTE.groundBase);
  g.fillRect(0, 0, size, size);
  g.fillStyle = hex(BODY_PALETTE.groundMark);
  // 固定種子的亂數，每次載入的紋路相同。
  let seed = 7 + kind * 101;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === 0) {
    // 磚紋：錯縫的長方形鋪面。
    const [w, h] = [32, 16];
    for (let row = 0; row < size / h; row++) {
      g.fillRect(0, row * h, size, 1.5);
      for (let col = 0; col <= size / w; col++) g.fillRect(col * w + (row % 2) * (w / 2), row * h, 1.5, h);
    }
  } else if (kind === 1) {
    // 斑點：散布的小圓點。
    for (let i = 0; i < 260; i++) {
      g.beginPath();
      g.arc(rand() * size, rand() * size, 1 + rand() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // 條紋：斜向的細條。
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(Math.PI / 4);
    for (let x = -size; x < size; x += 18) g.fillRect(x, -size, 3, size * 2);
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// 島頂面：六角形平面，UV 用世界座標除以 GROUND_TILE，相鄰島的紋路對得上。每島一份幾何（UV 不同）、一份材質（選取與淡化換底色）。
function islandTop(position, texture, color) {
  const geometry = new THREE.ShapeGeometry(hexShape(ISLAND_RADIUS - CURB_WIDTH / 2));
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + position.x) / GROUND_TILE, (pos.getZ(i) + position.z) / GROUND_TILE);
  const top = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, map: texture, roughness: 0.92, metalness: 0 }));
  top.position.y = TILE_SURFACE;
  top.receiveShadow = true;
  return top;
}

// 零件庫的靜態零件：共用幾何 key、顏色與變換，加進 parent（之後由 instancify 合批）。
function part(parent, key, make, color, { x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0, scale = [1, 1, 1] } = {}) {
  const m = new THREE.Mesh(sharedGeometry(key, make), material(color));
  m.position.set(x, y, z);
  m.rotation.set(rotX, rotY, rotZ, 'YXZ');
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const unitBox = () => new THREE.BoxGeometry(1, 1, 1);

// 島緣一圈：每條邊 BAND_BLOCKS 塊，主色與淺色交錯，貼著側壁上緣。
function bandBlocks(group, color) {
  const length = ISLAND_RADIUS / BAND_BLOCKS;
  for (let side = 0; side < 6; side++) {
    const a = (side * Math.PI) / 3;
    const [nx, nz] = [Math.cos(a), Math.sin(a)];
    for (let k = 0; k < BAND_BLOCKS; k++) {
      // 沿邊的位置：從一端到另一端，邊的方向與法線垂直。
      const t = (k + 0.5) / BAND_BLOCKS - 0.5;
      const along = t * ISLAND_RADIUS;
      part(group, 'box', unitBox, k % 2 === 0 ? color : BODY_PALETTE.bandLight, {
        x: nx * (ISLAND_APOTHEM - BAND_DEPTH / 2 + 0.002) - nz * along,
        y: TILE_SURFACE - BAND_HEIGHT / 2,
        z: nz * (ISLAND_APOTHEM - BAND_DEPTH / 2 + 0.002) + nx * along,
        rotY: -a,
        scale: [BAND_DEPTH, BAND_HEIGHT, length * 0.98],
      });
    }
  }
}

// 拱橋：planks 片甲板沿拱線排列，兩側各一排欄杆。橋不屬於任何一島，選取抬高時不動。
function bridgeParts(parent, { from, to, length }) {
  const [dx, dz] = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  const heading = Math.atan2(dz, dx);
  const step = length / BRIDGE.planks;
  for (let k = 0; k < BRIDGE.planks; k++) {
    const t = (k + 0.5) / BRIDGE.planks;
    const slope = Math.atan((bridgeLift(t + 0.01) - bridgeLift(t - 0.01)) / (0.02 * length));
    const at = { x: from[0] + dx * length * t, y: TILE_SURFACE + WALK_LIFT + bridgeLift(t), z: from[1] + dz * length * t };
    part(parent, 'box', unitBox, BODY_PALETTE.plank, { ...at, rotY: -heading, rotZ: slope, scale: [step * 0.88, 0.022, BRIDGE.width] });
    for (const side of [-1, 1]) {
      const off = side * (BRIDGE.width / 2 - 0.008);
      part(parent, 'box', unitBox, BODY_PALETTE.rail, {
        x: at.x - dz * off, y: at.y + 0.05, z: at.z + dx * off, rotY: -heading, rotZ: slope, scale: [step, 0.012, 0.012],
      });
      if (k % 2 === 0) {
        part(parent, 'box', unitBox, BODY_PALETTE.rail, { x: at.x - dz * off, y: at.y + 0.025, z: at.z + dx * off, scale: [0.014, 0.05, 0.014] });
      }
    }
  }
}

// scene 是島嶼場景；layout 是 islandLayout 的結果；groupOf(tileId) 回傳每格的群組（所有格子，含裝飾格）。
// waterMaterial 是水面材質（island-environment.js），側壁共用它，看起來像浮在淺海上。
// plazaId 是候選人廣場那格。回傳 { paint(tileId, { selected, dimmed }), setLift(tileId, y) } 給選取用。
export function createIslandBody(scene, layout, { groupOf, waterMaterial, plazaId }) {
  const body = islandBody(layout);
  const textures = [0, 1, 2].map(groundTexture);
  const tops = new Map();
  const baseColor = new Map();
  const walkOuter = radiusOf(WALKWAY_APOTHEM + WALKWAY.width / 2);
  const walkInner = radiusOf(WALKWAY_APOTHEM - WALKWAY.width / 2);

  layout.tiles.forEach((tile, index) => {
    const group = groupOf(tile.id);
    const color = tile.id === plazaId ? BODY_PALETTE.topPlaza : tile.kind === 'decorative' ? BODY_PALETTE.topDecorative : BODY_PALETTE.top;
    const top = islandTop(tile.position, textures[index % textures.length], color);
    group.add(top);
    tops.set(tile.id, top);
    baseColor.set(tile.id, color);
    bandBlocks(group, BODY_PALETTE.band[index % BODY_PALETTE.band.length]);
    part(group, 'island-curb', () => hexFrame(ISLAND_RADIUS, ISLAND_RADIUS - radiusOf(CURB_WIDTH), CURB_HEIGHT), BODY_PALETTE.curb, { y: TILE_SURFACE });
    part(group, 'island-walkway', () => hexFrame(walkOuter, walkInner, WALK_LIFT), BODY_PALETTE.walkway, { y: TILE_SURFACE });
    // 步道的接縫：每條邊三道橫向細縫，看得出是鋪面。
    for (let side = 0; side < 6; side++) {
      const a = (side * Math.PI) / 3;
      for (const along of [-0.35, 0, 0.35]) {
        part(group, 'box', unitBox, BODY_PALETTE.walkwayJoint, {
          x: Math.cos(a) * WALKWAY_APOTHEM - Math.sin(a) * along * WALKWAY.radius,
          y: TILE_SURFACE + WALK_LIFT + 0.001,
          z: Math.sin(a) * WALKWAY_APOTHEM + Math.cos(a) * along * WALKWAY.radius,
          rotY: -a,
          scale: [WALKWAY.width * 0.96, 0.002, 0.012],
        });
      }
    }
    const lamps = streetLamps(body.lamps.filter((l) => l.tileId === tile.id).map((l) => [l.x - tile.position.x, l.z - tile.position.z]));
    group.add(lamps);
  });

  const bridges = new THREE.Group();
  for (const bridge of body.bridges) bridgeParts(bridges, bridge);
  scene.add(bridges);

  // 側壁：每島一個實例，共用水面材質。抬高時改這一格的矩陣。
  const wallHeight = TILE_SURFACE - BAND_HEIGHT + 0.01 - WALL_BOTTOM;
  const wall = new THREE.InstancedMesh(new THREE.CylinderGeometry(ISLAND_RADIUS * 0.998, ISLAND_RADIUS * 0.998, wallHeight, 6, 1, true), waterMaterial, layout.tiles.length);
  const m = new THREE.Matrix4();
  const wallAt = (i, lift) => {
    const { x, z } = layout.tiles[i].position;
    wall.setMatrixAt(i, m.makeTranslation(x, WALL_BOTTOM + wallHeight / 2 + lift, z));
  };
  layout.tiles.forEach((_, i) => wallAt(i, 0));
  wall.receiveShadow = true;
  scene.add(wall);

  // 淺水環與泡沫環：半透明，平放在水面上，不隨選取抬高。
  const ring = (inner, outer, color, opacity, y) => {
    const mesh = new THREE.InstancedMesh(
      flatHexRing(inner, outer),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false, roughness: 0.8, metalness: 0 }),
      layout.tiles.length,
    );
    layout.tiles.forEach(({ position }, i) => mesh.setMatrixAt(i, m.makeTranslation(position.x, y, position.z)));
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  ring(ISLAND_RADIUS, radiusOf(ISLAND_APOTHEM + SHALLOW_WIDTH), BODY_PALETTE.shallow, 0.35, SEA_LEVEL + 0.004);
  ring(ISLAND_RADIUS, radiusOf(ISLAND_APOTHEM + FOAM_WIDTH), BODY_PALETTE.foam, 0.55, SEA_LEVEL + 0.008);

  const indexOf = new Map(layout.tiles.map((t, i) => [t.id, i]));
  return {
    // 島頂面的底色：selected 選中、dimmed 被篩選淡化，否則回到原本的底色。
    paint(tileId, { selected = false, dimmed = false } = {}) {
      const color = selected ? BODY_PALETTE.topSelected : dimmed ? BODY_PALETTE.topDimmed : baseColor.get(tileId);
      tops.get(tileId)?.material.color.setHex(color);
    },
    // 選取時島整體抬高 y：側壁跟著動（其他零件在格子群組裡，由群組與零件庫處理）。
    setLift(tileId, y) {
      const i = indexOf.get(tileId);
      if (i === undefined) return;
      wallAt(i, y);
      wall.instanceMatrix.needsUpdate = true;
    },
  };
}
