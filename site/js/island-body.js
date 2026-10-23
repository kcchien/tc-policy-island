// 島體配置：分離的六角小島、島間水道、拱橋、步道環與行人路網。只做計算，不碰 three.js，瀏覽器與 Node 共用，
// 不 import 其他模組（island-layout.js 從這裡取島的尺寸）。畫成 3D 在 island-body-view.js。
// 島體每格相同，只看格子的位置，不讀政見（ADR 0001）。

// 每格是一座尖頂六角小島（頂點朝南北）。ISLAND_RADIUS 是島頂面的外接半徑；相鄰兩島的對邊之間隔 CHANNEL_WIDTH 的水道。
export const ISLAND_RADIUS = 1.25;
export const CHANNEL_WIDTH = 0.28;
// 尖頂六角形的邊心距（格心到邊的距離）是外接半徑的 √3/2 倍。
export const apothemOf = (radius) => (radius * Math.sqrt(3)) / 2;
export const ISLAND_APOTHEM = apothemOf(ISLAND_RADIUS);
// 軸向座標換平面座標用的格距：相鄰格心距離是 √3 倍格距，等於兩個邊心距加水道。
export const GRID_SPACING = (2 * ISLAND_APOTHEM + CHANNEL_WIDTH) / Math.sqrt(3);

// 步道環：島緣內側一圈尖頂六角形的步道，radius 是中線的外接半徑，width 是路寬。
// 路寬容得下市民、公車、火車三條線（island-motion.js 的車道）；外緣離島緣留一道窄路緣（約 0.017），
// 內緣離格心的邊心距約 0.875，三個標記（island-layout.js）剛好在內側。
export const WALKWAY = { radius: 1.12, width: 0.19 };
// 步道中線的邊心距：橋頭（邊中點）與市民路線都從這裡算。
export const WALKWAY_APOTHEM = apothemOf(WALKWAY.radius);

// 路燈離格心的距離（頂點方向）：火車在轉角外緣約 1.22，島緣 1.25。
const LAMP_RADIUS = 1.24;

// 島上的位置（相對格心，場景單位）。每個議題區島都相同，與政見無關（ADR 0001）。
// hero：主題場景（island-heroes.js）。模型在單位空間設計（底面 x、z 在 ±0.5、高 0~maxHeight），放大 size 倍後底面中心放在 (x, z)。
//   放在北側（離預設鏡頭較遠），不擋南側的標記。單位空間高過 maxHeight 會擋到東南、西南鄰島的標記
//   （預設視角的視線測試），island-heroes.js 的 heroSlotTransform 會把超高的場景等比縮小。
// element：在地感元素的範圍 { minX, maxX, minZ, maxZ, maxY }，議題區島放在主題場景西側當次要元素；
//   裝飾格沒有標記與主題場景，元素放大置中。
export const TILE_SLOTS = {
  hero: { x: 0, z: -0.4, size: 0.72, maxHeight: 1.2, facing: 0 },
  element: {
    area: { minX: -0.84, maxX: -0.44, minZ: -0.37, maxZ: 0.03, maxY: 0.55 },
    decorative: { minX: -0.7, maxX: 0.7, minZ: -0.55, maxZ: 0.55, maxY: 1.35 },
    // 候選人廣場（island-plaza.js）：南半站三個候選人人物，元素放在北半。
    plaza: { minX: -0.7, maxX: 0.7, minZ: -0.6, maxZ: 0.12, maxY: 1 },
  },
};

// 尖頂六角形的方位角：頂點從東南（30 度）起每 60 度一個，邊中點從正東（0 度）起。
// 角度依俯視 +x 往東、+z 往南量，與 island-layout.js 的頂點順序相同。
export const cornerAngle = (i) => Math.PI / 6 + (i * Math.PI) / 3;
const sideAngle = (i) => (i * Math.PI) / 3;

// 相鄰的六個方向（軸向座標差），順序與 sideAngle 相同：東、東北、西北、西、西南、東南。
// 俯視時 +z 朝南，所以 sideAngle 從正東轉向 +z（東南）；方向表依此對齊。
const SIDE_DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

const axialKey = ([q, r]) => `${q},${r}`;

// 島體配置。layout 是 islandLayout 的結果，只用 tiles 的 id、axial、position。
// bridges：每對相鄰島一座橋，tiles 是兩島識別碼，from、to 是兩島步道環面對面那條邊的中點 [x, z]，length 是橋長。
export function islandBody(layout) {
  const byAxial = new Map(layout.tiles.map((tile) => [axialKey(tile.axial), tile]));
  const sidePoint = ({ position }, side, distance) =>
    [position.x + Math.cos(sideAngle(side)) * distance, position.z + Math.sin(sideAngle(side)) * distance];
  const bridges = [];
  for (const tile of layout.tiles) {
    // 東、東南、西南三個方向各看一次，每對相鄰島只列一次。
    for (const side of [0, 1, 2]) {
      const [dq, dr] = SIDE_DIRECTIONS[side];
      const other = byAxial.get(axialKey([tile.axial[0] + dq, tile.axial[1] + dr]));
      if (!other) continue;
      const from = sidePoint(tile, side, WALKWAY_APOTHEM);
      const to = sidePoint(other, side + 3, WALKWAY_APOTHEM);
      bridges.push({
        tiles: [tile.id, other.id],
        nodes: [sideNodeId(tile.id, side), sideNodeId(other.id, side + 3)],
        from,
        to,
        length: Math.hypot(to[0] - from[0], to[1] - from[1]),
      });
    }
  }

  // 行人路網：每島步道環中線上 12 個節點（6 個頂點與 6 個邊中點），依方位角順序連成一圈；橋連起相鄰島的邊中點。
  const nodes = [];
  const edges = [];
  for (const tile of layout.tiles) {
    const ring = [];
    for (let i = 0; i < 6; i++) {
      const [sx, sz] = sidePoint(tile, i, WALKWAY_APOTHEM);
      ring.push({ id: sideNodeId(tile.id, i), tileId: tile.id, x: sx, z: sz });
      const a = cornerAngle(i);
      ring.push({ id: `${tile.id}:c${i}`, tileId: tile.id, x: tile.position.x + Math.cos(a) * WALKWAY.radius, z: tile.position.z + Math.sin(a) * WALKWAY.radius });
    }
    nodes.push(...ring);
    ring.forEach((node, i) => edges.push({ a: node.id, b: ring[(i + 1) % ring.length].id, kind: 'walkway' }));
  }
  for (const bridge of bridges) edges.push({ a: bridge.nodes[0], b: bridge.nodes[1], kind: 'bridge' });

  // 路燈：每島六個頂點各一盞，立在步道環外緣與島緣之間的路緣上。
  const lamps = layout.tiles.flatMap((tile) => Array.from({ length: 6 }, (_, i) => ({
    tileId: tile.id,
    x: tile.position.x + Math.cos(cornerAngle(i)) * LAMP_RADIUS,
    z: tile.position.z + Math.sin(cornerAngle(i)) * LAMP_RADIUS,
  })));
  return { bridges, network: { nodes, edges }, lamps };
}

const sideNodeId = (tileId, side) => `${tileId}:s${side % 6}`;

// 拱橋：橋面由 planks 片甲板組成，橋面中間拱起 rise（場景單位），兩端貼齊步道。寬度讓公車與火車在欄杆內側。
export const BRIDGE = { planks: 9, rise: 0.06, width: 0.2 };

// 點 { x, z } 在哪座島的頂面上（尖頂六角形內），回傳格子識別碼；在水道或橋面中段時回傳 null。
// 選取抬高時，車輛用它判斷要不要跟著抬。
export function tileAt(layout, { x, z }) {
  for (const tile of layout.tiles) {
    const [dx, dz] = [x - tile.position.x, z - tile.position.z];
    let reach = 0;
    for (let side = 0; side < 6; side++) reach = Math.max(reach, dx * Math.cos(sideAngle(side)) + dz * Math.sin(sideAngle(side)));
    if (reach <= ISLAND_APOTHEM) return tile.id;
  }
  return null;
}
// 橋上 t（0~1，從一端到另一端）處的拱起高度。
export const bridgeLift = (t) => BRIDGE.rise * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
// 環線過橋時取的分段數，車輛沿拱起的折線走。
const BRIDGE_STEPS = 4;

// 圍住整群島的外圈路線：沿步道環與橋走路網的外側邊界一圈。回傳封閉折線 [[x, z, y]...]，y 是過橋時的拱起高度。
// 方向固定為外側在行進方向的右手邊（island-motion.js 的 pointAlong 車道往右偏就是往外）。
// 只有一座橋連出去的島，路線會過橋繞那座島一圈再從同一座橋回來。
export function outerLoop({ network }) {
  const byId = new Map(network.nodes.map((n) => [n.id, n]));
  const links = new Map(network.nodes.map((n) => [n.id, []]));
  const bridgeKeys = new Set();
  for (const { a, b, kind } of network.edges) {
    links.get(a).push(b);
    links.get(b).push(a);
    if (kind === 'bridge') bridgeKeys.add(`${a}|${b}`).add(`${b}|${a}`);
  }
  // 每個節點的鄰居依方位角排序，走面時在每個節點轉到「來向的下一個」鄰居。
  const angle = (from, to) => Math.atan2(byId.get(to).z - byId.get(from).z, byId.get(to).x - byId.get(from).x);
  for (const [id, list] of links) list.sort((p, q) => angle(id, p) - angle(id, q));
  const visited = new Set();
  let best = null;
  for (const { a, b } of network.edges) {
    for (const [u0, v0] of [[a, b], [b, a]]) {
      if (visited.has(`${u0}|${v0}`)) continue;
      const face = [];
      let [u, v] = [u0, v0];
      while (!visited.has(`${u}|${v}`)) {
        visited.add(`${u}|${v}`);
        face.push([u, v]);
        const around = links.get(v);
        const w = around[(around.indexOf(u) - 1 + around.length) % around.length];
        [u, v] = [v, w];
      }
      const area = signedArea(face.map(([id]) => byId.get(id)));
      if (!best || Math.abs(area) > Math.abs(best.area)) best = { face, area };
    }
  }
  if (!best) return [];
  // 面積為正時外側在左手邊，反過來走。
  const steps = best.area > 0 ? best.face.map(([u, v]) => [v, u]).reverse() : best.face;
  const points = [];
  for (const [u, v] of steps) {
    const [p, q] = [byId.get(u), byId.get(v)];
    points.push([p.x, p.z, 0]);
    if (!bridgeKeys.has(`${u}|${v}`)) continue;
    for (let k = 1; k < BRIDGE_STEPS; k++) {
      const t = k / BRIDGE_STEPS;
      points.push([p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t, bridgeLift(t)]);
    }
  }
  return points;
}

// 俯視平面上多邊形的有向面積（+x 往東、+z 往南）。
function signedArea(points) {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.z - q.x * p.z;
  }, 0) / 2;
}
