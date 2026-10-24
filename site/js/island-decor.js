// 島上的靜態裝飾配置：主題場景、路燈、大樹、長椅、花台、盆栽、垃圾桶與踏石。只做計算，不碰 three.js，
// 瀏覽器與 Node 共用；畫成 3D 在 island-decor-view.js。
// 靜態裝飾數量固定（ADR 0001）：每個議題區格子的裝飾種類、數量、位置與主題場景放大倍率相同，
// 只讀格子的種類、順序與位置，不讀標記亮暗與政見。上線關卡「裝飾數量固定」會換一份政見資料重算，結果必須相同；
// 關卡也要載入這裡 import 的模組，所以只能 import 同樣不碰 three.js 的模組。
// 大樹的樹種依格子位置，相鄰格不同；每種裝飾的高度與寬度上限與小物件的隱藏距離（LOD_DISTANCE）也定義在這裡。

import { islandBody, TILE_SLOTS, WALKWAY, WALKWAY_APOTHEM } from './island-body.js';
import { heroPlan } from './island-heroes.js';
import { MARKER_ROW } from './island-layout.js';
import { LOOP_CORE, LOOP_SPOTS } from './island-motion.js';
import { plazaLayout } from './island-plaza.js';

// 大樹的樹種，依格子的軸向座標決定（與議題內容無關），島上相鄰的兩格樹種不同。
export const TREE_SPECIES = ['round', 'conifer', 'blossom', 'fruit', 'palm', 'willow'];
// 六角格的三色著色：(q - r) 除以 3 的餘數，六個鄰格都和自己不同；再依列的奇偶選前三種或後三種，六種都用得到。
const mod = (n, m) => ((n % m) + m) % m;
const speciesAt = ([q, r]) => TREE_SPECIES[mod(q - r, 3) + 3 * mod(r, 2)];

// 裝飾的種類。radius 是底部占地的半徑（場景單位，大樹只算樹幹與樹穴），height 是離島面的最高高度，
// reach 是最寬處的半徑（大樹的樹冠可以伸出占地範圍）。island-decor-models.js 的模型要守住這些範圍，
// 標記的視線測試靠它們。small 為 true 的小物件在鏡頭拉遠時隱藏（LOD_DISTANCE）。
export const DECOR_KINDS = {
  lamp: { radius: 0.02, height: 0.36, reach: 0.035, small: false },
  tree: { radius: 0.05, height: 0.58, reach: 0.16, small: false },
  flowerbed: { radius: 0.12, height: 0.09, reach: 0.12, small: false },
  bench: { radius: 0.08, height: 0.08, reach: 0.08, small: true },
  bin: { radius: 0.03, height: 0.07, reach: 0.03, small: true },
  shrub: { radius: 0.035, height: 0.1, reach: 0.035, small: true },
  flowers: { radius: 0.035, height: 0.08, reach: 0.035, small: true },
  stone: { radius: 0.03, height: 0.006, reach: 0.03, small: true },
};

// 小物件（small）在鏡頭離旋轉中心超過這個距離時隱藏。桌面預設視角約 29 還看得到（留一點餘裕），
// 手機直式的預設視角（約 44 以上）小物件只剩一兩個像素，隱藏省效能，拉近就出現。
export const LOD_DISTANCE = 34;

// 步道環內緣（市民走在步道內側，身寬約 0.03）：裝飾的占地要在這條線內側。值是格心到邊的距離。
export const DECOR_LIMIT = WALKWAY_APOTHEM - WALKWAY.width / 2 - 0.015;

// 議題區島上的固定位置（相對格心，+z 朝南）。主題場景在北側、在地感元素在西側、標記在南側、循環道具在東西兩側，
// 剩下的空地：北邊兩角與北端種大樹，東側是一棵樹加花台與垃圾桶，東西兩邊各一張長椅面向格心，
// 主題場景南緣一排踏石。其餘沿步道環內緣自動排盆栽與花（rimPlants）。
const AREA_SPOTS = [
  { kind: 'tree', x: -0.6, z: -0.56 },
  { kind: 'tree', x: 0.6, z: -0.56 },
  { kind: 'tree', x: 0, z: -0.86 },
  { kind: 'tree', x: 0.74, z: -0.14 },
  { kind: 'flowerbed', x: 0.62, z: -0.36, yaw: Math.PI / 6 },
  { kind: 'bin', x: 0.8, z: 0.02 },
  { kind: 'bench', x: -0.76, z: 0.15, yaw: Math.PI / 2 },
  { kind: 'bench', x: 0.76, z: 0.15, yaw: -Math.PI / 2 },
  ...[-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].map((x) => ({ kind: 'stone', x, z: 0.22 })),
];

// 沿步道環內緣排盆栽的間距與離邊的距離。
const RIM_STEP = 0.13;
const RIM_APOTHEM = DECOR_LIMIT - DECOR_KINDS.shrub.radius;

const round = (v) => Math.round(v * 1e4) / 1e4 + 0;
const withShape = ({ kind, x, z, yaw = 0 }) => ({ kind, x: round(x), z: round(z), yaw: round(yaw), ...DECOR_KINDS[kind] });

// 占用的範圍：{ x, z, radius } 圓或 { minX, maxX, minZ, maxZ } 矩形。
const boxOf = ({ x, z, size }) => ({ minX: x - size / 2, maxX: x + size / 2, minZ: z - size / 2, maxZ: z + size / 2 });
function overlaps(item, zone) {
  if ('radius' in zone) return Math.hypot(item.x - zone.x, item.z - zone.z) < item.radius + zone.radius;
  const dx = Math.max(zone.minX - item.x, 0, item.x - zone.maxX);
  const dz = Math.max(zone.minZ - item.z, 0, item.z - zone.maxZ);
  return Math.hypot(dx, dz) < item.radius;
}

// 議題區島被主題場景、在地感元素、標記與循環道具占用的範圍（相對格心）。
export function reservedZones() {
  return [
    boxOf(TILE_SLOTS.hero),
    TILE_SLOTS.element.area,
    ...MARKER_ROW.centers.map(({ x, z }) => ({ x, z, radius: MARKER_ROW.reach })),
    ...LOOP_SPOTS.map(({ x, z }) => ({ x, z, radius: LOOP_CORE })),
  ];
}

// 沿步道環內緣每 RIM_STEP 一個位置，避開 zones 與 taken，盆栽與花交錯。順序固定：從正東那條邊起逆時針。
function rimPlants(zones, taken) {
  const half = RIM_APOTHEM * Math.tan(Math.PI / 6);
  const count = Math.floor((2 * half) / RIM_STEP);
  const plants = [];
  for (let side = 0; side < 6; side++) {
    const a = (side * Math.PI) / 3;
    for (let k = 0; k <= count; k++) {
      const along = -half + RIM_STEP / 2 + k * RIM_STEP;
      if (along > half - RIM_STEP / 2 + 1e-9) break;
      const spot = withShape({
        kind: plants.length % 2 === 0 ? 'shrub' : 'flowers',
        x: Math.cos(a) * RIM_APOTHEM - Math.sin(a) * along,
        z: Math.sin(a) * RIM_APOTHEM + Math.cos(a) * along,
      });
      if ([...zones, ...taken, ...plants].some((zone) => overlaps(spot, zone))) continue;
      plants.push(spot);
    }
  }
  return plants;
}

// 議題區島的裝飾（相對格心）。每格相同，算一次就好。
function areaItems() {
  const fixed = AREA_SPOTS.map(withShape);
  return [...fixed, ...rimPlants(reservedZones(), fixed)];
}

// 裝飾格沒有主題場景與標記，只沿步道環內緣避開元素放盆栽；候選人廣場（人物站在南半）只有路燈。
function decorativeItems(tile, isPlaza) {
  if (isPlaza) return [];
  return rimPlants([tile.elementSlot], []);
}

// 每格的靜態裝飾。layout 是 islandLayout 的結果，只用 tiles 的 id、kind、axial、position、heroSlot、elementSlot。
// tiles[]：{ id, kind, center, species（大樹樹種）, hero（議題區格子的主題場景擺放，其他為 null）, items[] }，
// items 的 x、z 相對格心，yaw 是繞 y 轉的角度（與 three.js 同向）。路燈來自島體（island-body.js）。
export function decorPlan(layout) {
  const body = islandBody(layout);
  const heroes = new Map(heroPlan(layout).map((hero) => [hero.areaId, hero]));
  const plazaId = plazaLayout(layout).tile?.id;
  const area = areaItems();
  const tiles = layout.tiles.map(({ id, kind, axial, position, elementSlot }) => {
    const lamps = body.lamps.filter((lamp) => lamp.tileId === id)
      .map((lamp) => withShape({ kind: 'lamp', x: lamp.x - position.x, z: lamp.z - position.z }));
    const items = kind === 'area' ? area : decorativeItems({ elementSlot }, id === plazaId);
    return {
      id,
      kind,
      center: { x: position.x, z: position.z },
      species: speciesAt(axial),
      hero: heroes.get(id) ?? null,
      items: [...lamps, ...items.map((item) => ({ ...item }))],
    };
  });
  return { tiles };
}

// 一格裝飾的數量、種類、位置與主題場景擺放，不含格子識別碼、絕對位置、樹種與主題場景的題材。議題區格子之間必須完全相同。
export function decorSignature(tile) {
  const hero = tile.hero && {
    x: round(tile.hero.transform.x - tile.center.x),
    z: round(tile.hero.transform.z - tile.center.z),
    scale: tile.hero.transform.scale,
    yaw: tile.hero.transform.yaw,
  };
  return JSON.stringify({ hero, items: tile.items.map(({ kind, x, z, yaw }) => ({ kind, x, z, yaw })) });
}
