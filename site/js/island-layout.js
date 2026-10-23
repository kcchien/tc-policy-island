// 島嶼配置：檢視模型 → 島上每一格的位置、在地感元素與候選人標記，以及鏡頭與畫質參數。
// 只做計算，不碰 three.js 與 DOM，瀏覽器與 Node 共用，不得引用 node: 模組。
// 格子配置的做法見 docs/rules/island-layout.md。

// 候選人依排序配形狀，三人同色同尺寸，只以形狀區分（ADR 0001）。
// sides 是多邊形邊數（0 為圓），start 是第一個頂點的方位角：三角形尖端朝北（-z），正方形邊與格線平行。
export const MARKER_SHAPES = [
  { shape: 'circle', symbol: '○', sides: 0, start: 0 },
  { shape: 'triangle', symbol: '△', sides: 3, start: -Math.PI / 2 },
  { shape: 'square', symbol: '□', sides: 4, start: Math.PI / 4 },
];

// 格心到頂點的距離（場景單位）。
export const HEX_SIZE = 1;
// 標記尺寸固定，不隨政見數量改變。尺寸以面積計：三種形狀的面積都等於半徑 MARKER_SIZE 的圓，
// 外接圓相同的話三角形只有圓的四成大，看起來就不是同尺寸。
const MARKER_SIZE = 0.17;

// 等面積下各形狀的外接圓半徑：正 n 邊形面積 = n/2 · r² · sin(2π/n)。
function circumradius(sides, size) {
  if (sides === 0) return size;
  return size * Math.sqrt((2 * Math.PI) / (sides * Math.sin((2 * Math.PI) / sides)));
}

// 多邊形標記的頂點，相對標記中心的 [x, z]。
export function markerOutline({ sides, start, radius }) {
  return Array.from({ length: sides }, (_, i) => {
    const a = start + (i / sides) * Math.PI * 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}
// 三個標記排在格子南側（靠近鏡頭的一側），由西到東依候選人排序。
const MARKER_SPACING = 0.42;
const MARKER_ROW_Z = 0.52;

// 尖頂六角格的軸向座標換成平面座標：q 往東（+x），r 往南（+z）。
export function axialToPosition([q, r], size = HEX_SIZE) {
  return { x: size * Math.sqrt(3) * (q + r / 2), z: size * 1.5 * r };
}

export function markerLegend(vm) {
  return vm.candidates.map((candidate, index) => ({
    candidateId: candidate.id,
    name: candidate.name,
    ...MARKER_SHAPES[index % MARKER_SHAPES.length],
  }));
}

function markersOf(row, legend) {
  const offset = (legend.length - 1) / 2;
  return legend.map((entry, index) => {
    const cell = row?.cells.find((c) => c.candidateId === entry.candidateId);
    return {
      candidateId: entry.candidateId,
      name: entry.name,
      shape: entry.shape,
      symbol: entry.symbol,
      sides: entry.sides,
      start: entry.start,
      size: MARKER_SIZE,
      radius: circumradius(entry.sides, MARKER_SIZE),
      lit: Boolean(cell && cell.policies.length > 0),
      offset: { x: (index - offset) * MARKER_SPACING, z: MARKER_ROW_Z },
    };
  });
}

function boundsOf(tiles) {
  const xs = tiles.map((t) => t.position.x);
  const zs = tiles.map((t) => t.position.z);
  // 範圍含格子本身的大小，不只是格心。尖頂六角格東西半寬是 √3/2 倍格徑，南北半高是 1 倍。
  const halfWidth = (HEX_SIZE * Math.sqrt(3)) / 2;
  const minX = Math.min(...xs) - halfWidth;
  const maxX = Math.max(...xs) + halfWidth;
  const minZ = Math.min(...zs) - HEX_SIZE;
  const maxZ = Math.max(...zs) + HEX_SIZE;
  return {
    minX, maxX, minZ, maxZ,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    radius: Math.hypot(maxX - minX, maxZ - minZ) / 2,
  };
}

// filtered 是 filterViewModel 篩選後的檢視模型。篩選只改標記亮暗與淡化，不改島的形狀。
export function islandLayout(vm, { filtered = null } = {}) {
  const legend = markerLegend(vm);
  const shown = new Map((filtered ?? vm).rows.map((row) => [row.issueArea.id, row]));
  const tiles = [
    ...vm.rows.map((row) => ({
      kind: 'area',
      id: row.issueArea.id,
      name: row.issueArea.name,
      axial: row.issueArea.axial,
      position: axialToPosition(row.issueArea.axial),
      localElement: row.localElement,
      dimmed: !shown.has(row.issueArea.id),
      markers: markersOf(shown.get(row.issueArea.id), legend),
    })),
    ...vm.decorativeTiles.map((tile) => ({
      kind: 'decorative',
      id: tile.id,
      name: null,
      axial: tile.axial,
      position: axialToPosition(tile.axial),
      localElement: tile.localElement,
      dimmed: false,
      markers: [],
    })),
  ];
  return { hexSize: HEX_SIZE, tiles, bounds: boundsOf(tiles), legend };
}

// 構圖用的島外形點：每格六個頂點（水面高度 0 與格子頂面 surface），加上格心上方元素模型的頂點 top。
// 用實際格子而不用矩形包圍盒，包圍盒的角落在水上，會讓島被縮得太小。
export function islandPoints(layout, { surface, top }) {
  const points = [];
  for (const { position } of layout.tiles) {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = position.x + Math.cos(a) * layout.hexSize;
      const z = position.z + Math.sin(a) * layout.hexSize;
      points.push({ x, y: 0, z }, { x, y: surface, z });
    }
    points.push({ x: position.x, y: top, z: position.z });
  }
  return points;
}

// 鏡頭在 target 的正南方、與正上方夾 polar 角、距離 distance，看向 target。
// 回傳各點投影到畫面後的範圍，以正規化座標表示（畫布左右、上下都是 -1~1，上方為正）。
export function projectedBox(points, { fov, aspect, polar, target, distance }) {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const [s, c] = [Math.sin(polar), Math.cos(polar)];
  const eye = { x: target.x, y: target.y + c * distance, z: target.z + s * distance };
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const p of points) {
    const v = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
    // 鏡頭的右方 (1, 0, 0)、上方 (0, s, -c)、前方 (0, -c, -s)。
    const depth = -c * v.y - s * v.z;
    const px = v.x / (depth * tanV * aspect);
    const py = (s * v.y - c * v.z) / (depth * tanV);
    box.minX = Math.min(box.minX, px);
    box.maxX = Math.max(box.maxX, px);
    box.minY = Math.min(box.minY, py);
    box.maxY = Math.max(box.maxY, py);
  }
  return box;
}

// 預設視角：調整鏡頭看的點與距離，讓島（islandPoints）投影後在畫布置中，最長邊占畫布 fill 的比例。
export function frameIsland(points, { fov, aspect, polar, fill = 0.8 }) {
  const tanV = Math.tan((fov * Math.PI) / 360);
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const target = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: 0, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  let distance = span / tanV;
  for (let i = 0; i < 60; i++) {
    const box = projectedBox(points, { fov, aspect, polar, target, distance });
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
    if (Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4 && Math.abs(extent - fill) < 1e-4) break;
    // 畫面上偏右就把看的點往右移；偏上就往北（-z）移。地面的南北向在畫面上會縮成 cos(polar)。
    target.x += cx * tanV * aspect * distance;
    target.z -= (cy * tanV * distance) / Math.cos(polar);
    distance *= extent / fill;
  }
  return { target, distance };
}

// OrbitControls 的限制：不能平移（島不會被拖出畫面），距離依島的大小，仰角保持在水平面以上。
// fit 是預設視角（frameIsland）的距離，距離上限至少要能看到整座島。
export function cameraLimits(bounds, fit) {
  return {
    enablePan: false,
    minDistance: Math.max(3, bounds.radius * 0.35),
    maxDistance: Math.max(bounds.radius * 3.2, fit * 1.25),
    minPolarAngle: 0.15,
    maxPolarAngle: 1.2,
  };
}

// 鏡頭的旋轉中心。飛到議題區後繞該格轉；使用者縮遠時，中心隨距離從該格移回島中心，
// 縮到 range.far（看整座島的距離）時完全回到島中心，島不會偏到畫面外。
export function orbitCenter(focus, center, distance, { near, far }) {
  const t = Math.min(1, Math.max(0, (distance - near) / (far - near)));
  return { x: focus.x + (center.x - focus.x) * t, z: focus.z + (center.z - focus.z) * t };
}

// 鏡頭飛到議題區的時間。減少動態時為 0，直接切到目的地。
export function flightPlan({ reducedMotion }) {
  return { durationMs: reducedMotion ? 0 : 900 };
}

// 飛行進度的緩動（0~1 → 0~1），起訖都放慢。
export const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
