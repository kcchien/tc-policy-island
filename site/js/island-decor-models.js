// 靜態裝飾的模型：路燈、各樹種的大樹、花台、長椅、垃圾桶、盆栽、盆花與踏石。只做計算，不碰 three.js，
// 瀏覽器與 Node 共用；零件格式與主題場景相同（island-heroes.js），畫成 3D 在 island-decor-view.js。色碼在 DECOR_COLORS。
// 尺寸是場景單位（不是單位空間）：底面中心在原點，y 從島面往上，正面朝 +z。
// 每種模型不得高過、寬過 island-decor.js 的 DECOR_KINDS（height、reach），標記的視線測試靠這些範圍，測試會檢查。

// 裝飾的色碼。上線關卡「禁用色檢查」會掃這些色碼，測試也逐一檢查（ADR 0001）。
// 樹葉用偏黃的橄欖色（色相低於 75 度），櫻花樣式用低飽和的灰粉米色，不落在綠與粉紅範圍。
export const DECOR_COLORS = {
  iron: 0x4f4a45,
  lampCap: 0x6b625a,
  glow: 0xe8d488,
  timber: 0x7a5a44,
  leaf: 0x9aa064,
  leafDark: 0x6c6f45,
  leafLight: 0xb3b06a,
  needle: 0x6a6a4a,
  blossom: 0xc4aba3,
  blossomLight: 0xd6c2ba,
  fruit: 0xc08a4e,
  palmLeaf: 0x8f8f58,
  palmTrunk: 0x9c8366,
  willow: 0xa3a473,
  stone: 0xc9bfb0,
  paver: 0xd2c6b4,
  soil: 0x8c6a4f,
  pot: 0xa86a4f,
  wood: 0xb08a62,
  bloomGold: 0xd8bb4a,
  bloomRose: 0xb07a72,
  bloomCream: 0xeee3d0,
  bin: 0x7d7468,
};

const round = (v) => Math.round(v * 1e4) / 1e4 + 0;
const part = (shape, color, size, at, rot, yaw) => ({ shape, color, size, at: at.map(round), ...(rot ? { rot } : {}), ...(yaw ? { yaw: round(yaw) } : {}) });
// 底部貼在高度 y 的零件。
const on = (shape, color, [w, h, d], [x, y, z], rot) => part(shape, color, [w, h, d], [x, y + h / 2, z], rot);
// 繞 y 等分 n 份的角度。
const around = (n, start = 0) => Array.from({ length: n }, (_, i) => start + (i * 2 * Math.PI) / n);

// 路燈：圓底座、細燈柱、燈罩下的燈泡（夜裡亮起）。燈下的光池在 island-decor-view.js。
function lamp() {
  return [
    on('cyl', 'iron', [0.045, 0.02, 0.045], [0, 0, 0]),
    on('cyl', 'iron', [0.02, 0.29, 0.02], [0, 0.02, 0]),
    part('glowsphere', 'glow', [0.06, 0.06, 0.06], [0, 0.32, 0]),
    on('cone', 'lampCap', [0.07, 0.03, 0.07], [0, 0.33, 0]),
  ];
}

// 大樹的樹種（island-decor.js 的 TREE_SPECIES）。全部收在高 0.58、半徑 0.16 以內。
const TREES = {
  round: () => [
    on('cyl', 'timber', [0.04, 0.24, 0.04], [0, 0, 0]),
    part('ico', 'leaf', [0.28, 0.26, 0.28], [0, 0.34, 0]),
    part('ico', 'leafLight', [0.17, 0.16, 0.17], [0.05, 0.46, 0.03]),
  ],
  conifer: () => [
    on('cyl', 'timber', [0.035, 0.12, 0.035], [0, 0, 0]),
    on('cone', 'needle', [0.3, 0.22, 0.3], [0, 0.1, 0]),
    on('cone', 'leafDark', [0.23, 0.2, 0.23], [0, 0.25, 0]),
    on('cone', 'needle', [0.14, 0.15, 0.14], [0, 0.41, 0]),
  ],
  blossom: () => [
    on('cyl', 'timber', [0.035, 0.26, 0.035], [0, 0, 0]),
    on('cyl', 'timber', [0.02, 0.12, 0.02], [0.03, 0.2, 0], [0, 0, -0.5]),
    part('sphere', 'blossom', [0.2, 0.16, 0.2], [-0.05, 0.36, 0]),
    part('sphere', 'blossomLight', [0.18, 0.15, 0.18], [0.06, 0.4, 0.04]),
    part('sphere', 'blossom', [0.15, 0.13, 0.15], [0, 0.47, -0.03]),
  ],
  fruit: () => [
    on('cyl', 'timber', [0.04, 0.2, 0.04], [0, 0, 0]),
    part('sphere', 'leafDark', [0.3, 0.26, 0.3], [0, 0.34, 0]),
    ...around(6, 0.3).map((a, i) => part('sphere', 'fruit', [0.04, 0.04, 0.04], [Math.cos(a) * 0.12, 0.3 + (i % 2) * 0.07, Math.sin(a) * 0.12])),
  ],
  palm: () => [
    on('cyl', 'palmTrunk', [0.035, 0.16, 0.035], [0, 0, 0]),
    on('cyl', 'palmTrunk', [0.03, 0.16, 0.03], [0.008, 0.155, 0], [0, 0, -0.06]),
    on('cyl', 'palmTrunk', [0.026, 0.16, 0.026], [0.02, 0.305, 0], [0, 0, -0.1]),
    // 七片葉子從樹頂往外下垂。
    ...around(7).map((a) => part('box', 'palmLeaf', [0.13, 0.012, 0.045], [0.02 + Math.cos(a) * 0.065, 0.47, -Math.sin(a) * 0.065], [0, 0, -0.35], a)),
    part('sphere', 'palmTrunk', [0.05, 0.05, 0.05], [0.025, 0.48, 0]),
  ],
  willow: () => [
    on('cyl', 'timber', [0.04, 0.3, 0.04], [0, 0, 0]),
    part('sphere', 'willow', [0.26, 0.17, 0.26], [0, 0.46, 0]),
    // 一圈垂下的柳枝。
    ...around(9).map((a) => on('cyl', 'willow', [0.016, 0.2, 0.016], [Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12])),
  ],
};

const MODELS = {
  lamp,
  // 花台：石砌圓角邊框、土、兩叢灌木與三色花。
  flowerbed: () => [
    on('rbox', 'stone', [0.2, 0.045, 0.11], [0, 0, 0]),
    on('box', 'soil', [0.18, 0.01, 0.09], [0, 0.045, 0]),
    part('sphere', 'leaf', [0.07, 0.05, 0.07], [-0.06, 0.064, 0]),
    part('sphere', 'leafDark', [0.06, 0.045, 0.06], [0.065, 0.062, 0.01]),
    ...[['bloomGold', -0.01, 0.025], ['bloomRose', 0.02, -0.025], ['bloomCream', 0.005, 0.0]].map(([color, x, z]) => part('sphere', color, [0.035, 0.035, 0.035], [x, 0.07, z])),
  ],
  // 長椅：木座板、椅背、兩側鐵腳，面向 +z。
  bench: () => [
    on('box', 'wood', [0.15, 0.016, 0.05], [0, 0.036, 0]),
    on('box', 'wood', [0.15, 0.03, 0.012], [0, 0.05, -0.02]),
    ...[-0.06, 0.06].map((x) => on('box', 'iron', [0.012, 0.036, 0.045], [x, 0, 0])),
  ],
  bin: () => [
    on('cyl', 'bin', [0.045, 0.055, 0.045], [0, 0, 0]),
    on('cyl', 'iron', [0.05, 0.012, 0.05], [0, 0.055, 0]),
  ],
  // 盆栽：陶盆加一團灌木。
  shrub: () => [
    on('cyl', 'pot', [0.05, 0.035, 0.05], [0, 0, 0]),
    part('sphere', 'leaf', [0.065, 0.06, 0.065], [0, 0.065, 0]),
  ],
  // 盆花：陶盆、葉叢與四朵花。
  flowers: () => [
    on('cyl', 'pot', [0.05, 0.03, 0.05], [0, 0, 0]),
    part('sphere', 'leafDark', [0.05, 0.03, 0.05], [0, 0.04, 0]),
    ...around(4, 0.4).map((a, i) => part('sphere', ['bloomGold', 'bloomRose', 'bloomCream', 'bloomRose'][i], [0.022, 0.022, 0.022], [Math.cos(a) * 0.015, 0.064, Math.sin(a) * 0.015])),
  ],
  // 踏石：貼地的圓角石板。
  stone: () => [on('rbox', 'paver', [0.055, 0.006, 0.045], [0, 0, 0])],
};

// 一件裝飾的零件。kind 是 DECOR_KINDS 之一；大樹另依 species 選樹種。
export function decorModel(kind, species) {
  const make = kind === 'tree' ? TREES[species] : MODELS[kind];
  if (!make) throw new Error(`沒有裝飾模型 ${kind}${species ? `／${species}` : ''}`);
  return make();
}
