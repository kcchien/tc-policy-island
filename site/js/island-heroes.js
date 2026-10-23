// 主題場景：每個議題區一座一眼可辨的小型立體場景（例如交通是公車站與公車、教育是學校與操場）。
// 只做計算，不碰 three.js，瀏覽器與 Node 共用；畫成 3D 在 island-hero-view.js。
// 場景只依議題區識別碼決定，不讀政見資料（ADR 0001：靜態裝飾每格數量固定，主題場景依議題區決定）。
// 主題必須中性，不用與特定市長任期綁定的地標或建設，造型一律是通用的公車站、學校、診所。
//
// 單位空間：底面 x、z 在 ±0.5，高度 0 到 1.5，場景正面朝 +z（南，鏡頭那一側）。
// 零件 { shape, color, size: [寬, 高, 深], at: [x, y, z]（零件外框中心）, rot?: [x, y, z]（弧度，XYZ 順序）, yaw? }，
// 最後的變換是「平移 at · 繞 y 轉 yaw · rot · 縮放 size」。每種 shape 的單位幾何都裝在 ±0.5 的立方體裡（見 HERO_SHAPES）。

// 零件形體，對應零件庫的單位幾何（island-kit.js 的 KIT_SHAPES，經 kitShape 取用；新增形體兩邊都要加）。
// 'glowbox'、'glowsphere' 是發光件（窗、燈），夜裡亮起。
export const HERO_SHAPES = ['box', 'rbox', 'cyl', 'cone', 'sphere', 'ico', 'dome', 'torus', 'prism', 'hip', 'glowbox', 'glowsphere'];

// 主題場景的色碼。上線關卡「禁用色檢查」會掃這些色碼，測試也逐一檢查（ADR 0001）。
export const HERO_COLORS = {
  cream: 0xeee3d0,
  wall: 0xe6d3b8,
  stone: 0xc9bfb0,
  roof: 0xb5583f,
  roofDark: 0x8e4a38,
  timber: 0x8a6448,
  wood: 0xc49a6c,
  leaf: 0x9aa064,
  leafDark: 0x6c6f45,
  leafLight: 0xb3b06a,
  grass: 0xb7b27a,
  soil: 0x8c6a4f,
  sand: 0xd9c9a3,
  water: 0x86a6a2,
  metal: 0x9a958f,
  iron: 0x4f4a45,
  mustard: 0xd8bb4a,
  // 色名不用 CSS 具名色（例如 red、teal），禁用色檢查會把字串當成色碼。
  signal: 0xb0423a,
  jade: 0x5e9a92,
  rose: 0xb07a72,
  chalk: 0x4d564f,
  court: 0xb86e4f,
  line: 0xf0ebe0,
  skin: 0xd9b08c,
  hair: 0x3f3a36,
  glow: 0xe8d488,
  glass: 0xb9b7ad,
  ochre: 0xc9a463,
};

// 地台：每座場景底下一塊薄圓角板，零件從地台頂面（PAD）往上放。
const PAD = 0.04;

const part = (shape, color, size, at, rot, yaw) => ({ shape, color, size, at, ...(rot ? { rot } : {}), ...(yaw ? { yaw } : {}) });
// 底部貼在高度 y 的零件：at 的 y 是外框中心，這裡換算。
const on = (shape, color, [w, h, d], [x, y, z], rot) => part(shape, color, [w, h, d], [x, y + h / 2, z], rot);

// 把一組零件繞 y 轉 yaw 再平移到 (x, z)，給重複的小物件（樹、人、長椅）用。
function place(parts, { x = 0, z = 0, yaw = 0 } = {}) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return parts.map((p) => {
    const [px, py, pz] = p.at;
    const at = [round(x + px * c + pz * s), py, round(z - px * s + pz * c)];
    const turned = (p.yaw ?? 0) + yaw;
    return part(p.shape, p.color, p.size, at, p.rot, turned ? round(turned) : 0);
  });
}
const round = (v) => Math.round(v * 10000) / 10000;
// 整組零件抬高 dy（站在舞台、看台上的人）。
const lift = (parts, dy) => parts.map((p) => ({ ...p, at: [p.at[0], round(p.at[1] + dy), p.at[2]] }));
// 拱橋甲板的高度：t 從 -0.5（岸邊）到 0.5（對岸），中間最高。
const archY = (t) => 0.06 + Math.cos(t * Math.PI) * 0.1;

function pad(color, { w = 0.96, d = 0.96 } = {}) {
  return [part('rbox', color, [w, PAD, d], [0, PAD / 2, 0])];
}

// 小人：Q 版大頭（頭約占四成），hat 是帽子顏色（學童黃帽、工人安全帽、農夫斗笠）。
function person({ shirt = 'jade', pants = 'iron', hat = null, hatShape = 'dome', h = 0.2 } = {}) {
  const leg = h * 0.25;
  const body = h * 0.32;
  const head = h * 0.4;
  const parts = [
    on('box', pants, [h * 0.09, leg, h * 0.1], [-h * 0.06, PAD, 0]),
    on('box', pants, [h * 0.09, leg, h * 0.1], [h * 0.06, PAD, 0]),
    on('rbox', shirt, [h * 0.28, body, h * 0.2], [0, PAD + leg, 0]),
    part('sphere', 'skin', [head, head, head], [0, PAD + leg + body + head * 0.48, 0]),
  ];
  const top = PAD + leg + body + head * 0.55;
  if (hat === null) parts.push(part('dome', 'hair', [head * 1.04, head * 0.55, head * 1.04], [0, top + head * 0.08, -head * 0.03]));
  else if (hatShape === 'cone') parts.push(on('cone', hat, [head * 1.9, head * 0.45, head * 1.9], [0, top + head * 0.12, 0]));
  else parts.push(part('dome', hat, [head * 1.1, head * 0.55, head * 1.1], [0, top + head * 0.1, 0]));
  return parts;
}

// 闊葉樹：樹幹加兩團樹冠，樹冠半徑 r，種在離場景邊緣至少 r 的地方。
function roundTree({ h = 0.4, crown = 'leaf', r = 0.11 } = {}) {
  return [
    on('cyl', 'timber', [0.04, h * 0.5, 0.04], [0, PAD, 0]),
    part('ico', crown, [r * 2, r * 1.9, r * 2], [0, PAD + h * 0.5 + r * 0.7, 0]),
    part('ico', crown, [r * 1.3, r * 1.2, r * 1.3], [r * 0.3, PAD + h * 0.5 + r * 1.4, r * 0.2]),
  ];
}

function pine({ h = 0.42 } = {}) {
  return [
    on('cyl', 'timber', [0.035, h * 0.25, 0.035], [0, PAD, 0]),
    on('cone', 'leafDark', [h * 0.5, h * 0.45, h * 0.5], [0, PAD + h * 0.2, 0]),
    on('cone', 'leaf', [h * 0.36, h * 0.4, h * 0.36], [0, PAD + h * 0.48, 0]),
  ];
}

function bush(r = 0.07, color = 'leaf') {
  return [part('sphere', color, [r * 2, r * 1.6, r * 2], [0, PAD + r * 0.7, 0])];
}

function flowerBed({ w = 0.24, d = 0.08, bloom = 'rose' } = {}) {
  return [
    on('rbox', 'stone', [w, 0.04, d], [0, PAD, 0]),
    on('box', 'soil', [w - 0.03, 0.012, d - 0.03], [0, PAD + 0.04, 0]),
    ...[-1, 0, 1].map((i) => part('sphere', i === 0 ? 'mustard' : bloom, [0.04, 0.04, 0.04], [i * w * 0.3, PAD + 0.07, 0])),
  ];
}

function bench() {
  return [
    on('box', 'wood', [0.18, 0.02, 0.06], [0, PAD + 0.05, 0]),
    on('box', 'wood', [0.18, 0.05, 0.015], [0, PAD + 0.07, -0.025]),
    on('box', 'iron', [0.015, 0.05, 0.05], [-0.07, PAD, 0]),
    on('box', 'iron', [0.015, 0.05, 0.05], [0.07, PAD, 0]),
  ];
}

// 路燈：燈柱加燈泡，夜裡亮起。
function lamp(h = 0.36) {
  return [
    on('cyl', 'iron', [0.02, h, 0.02], [0, PAD, 0]),
    part('glowsphere', 'glow', [0.05, 0.05, 0.05], [0, PAD + h + 0.02, 0]),
  ];
}

// 窗：夜裡亮起的發光片，貼在 z 面（正面）。
function windowsRow({ y, z, xs, w = 0.07, h = 0.08 }) {
  return xs.map((x) => part('glowbox', 'glow', [w, h, 0.012], [x, y, z]));
}

// 四坡屋頂的小屋，正面朝 +z。
function house({ w = 0.4, d = 0.32, h = 0.26, wall = 'cream', roof = 'roof', roofH = 0.18, door = 'timber' } = {}) {
  return [
    on('rbox', wall, [w, h, d], [0, PAD, 0]),
    on('box', 'stone', [w + 0.04, 0.03, d + 0.04], [0, PAD, 0]),
    on('hip', roof, [w + 0.08, roofH, d + 0.08], [0, PAD + h, 0]),
    on('box', roof, [w + 0.1, 0.02, d + 0.1], [0, PAD + h - 0.01, 0]),
    on('box', door, [0.07, 0.13, 0.012], [0, PAD + 0.03, d / 2 + 0.006]),
    ...windowsRow({ y: PAD + h * 0.6, z: d / 2 + 0.006, xs: [-w * 0.3, w * 0.3] }),
  ];
}

// 車：車身、車頂、四輪、車燈。color 是車身色。
function vehicle({ l = 0.42, w = 0.16, h = 0.14, color = 'mustard', cabin = true } = {}) {
  const wheel = 0.075;
  const parts = [
    on('rbox', color, [w, h, l], [0, PAD + wheel * 0.45, 0]),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part('torus', 'iron', [wheel, wheel, 0.03], [sx * (w / 2), PAD + wheel / 2, sz * l * 0.32], null, Math.PI / 2))),
    part('glowbox', 'glow', [w * 0.7, h * 0.3, 0.012], [0, PAD + wheel * 0.45 + h * 0.55, l / 2 + 0.006]),
  ];
  if (cabin) parts.push(...[-1, 1].map((sx) => part('glowbox', 'glass', [0.012, h * 0.35, l * 0.7], [sx * (w / 2 + 0.006), PAD + wheel * 0.45 + h * 0.62, 0])));
  return parts;
}

function fence({ from, to, posts = 5, h = 0.07, color = 'wood' }) {
  const [x0, z0] = from;
  const [x1, z1] = to;
  const length = Math.hypot(x1 - x0, z1 - z0);
  const yaw = -Math.atan2(z1 - z0, x1 - x0);
  const parts = [part('box', color, [length, 0.015, 0.012], [(x0 + x1) / 2, PAD + h * 0.7, (z0 + z1) / 2], null, yaw)];
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    parts.push(on('box', color, [0.018, h, 0.018], [x0 + (x1 - x0) * t, PAD, z0 + (z1 - z0) * t]));
  }
  return parts;
}

// 各議題區的主題場景。name 是場景的白話描述（文件與截圖總表用）。
const SCENES = {
  // 交通：公車站候車亭、停靠的公車、斑馬線與紅綠燈、腳踏車架。
  transportation: {
    name: '公車站與公車',
    build: () => [
      ...pad('stone'),
      on('box', 'iron', [0.96, 0.01, 0.32], [0, PAD, 0.18]),
      ...[-0.3, -0.18, -0.06].map((x) => on('box', 'line', [0.07, 0.006, 0.24], [x, PAD + 0.01, 0.18])),
      ...place(vehicle({ l: 0.62, w: 0.2, h: 0.2, color: 'mustard' }), { x: 0.16, z: 0.2, yaw: Math.PI / 2 }),
      on('box', 'jade', [0.62, 0.035, 0.205], [0.16, PAD + 0.16, 0.2]),
      // 候車亭：頂棚、背板、柱、長椅、站牌。
      on('box', 'iron', [0.02, 0.32, 0.02], [-0.32, PAD, -0.08]),
      on('box', 'iron', [0.02, 0.32, 0.02], [0.08, PAD, -0.08]),
      on('box', 'iron', [0.02, 0.32, 0.02], [-0.32, PAD, -0.24]),
      on('box', 'iron', [0.02, 0.32, 0.02], [0.08, PAD, -0.24]),
      on('rbox', 'jade', [0.5, 0.035, 0.24], [-0.12, PAD + 0.32, -0.16]),
      on('box', 'glass', [0.42, 0.22, 0.012], [-0.12, PAD + 0.06, -0.25]),
      ...place(bench(), { x: -0.12, z: -0.18 }),
      ...place(person({ shirt: 'rose' }), { x: -0.2, z: -0.13 }),
      ...place(person({ shirt: 'jade', hat: 'mustard', h: 0.16 }), { x: -0.02, z: -0.12 }),
      on('cyl', 'iron', [0.02, 0.36, 0.02], [0.2, PAD, -0.1]),
      part('cyl', 'mustard', [0.1, 0.1, 0.02], [0.2, PAD + 0.36, -0.1], [Math.PI / 2, 0, 0]),
      // 紅綠燈。
      on('cyl', 'iron', [0.025, 0.4, 0.025], [0.42, PAD, -0.02]),
      on('rbox', 'iron', [0.06, 0.16, 0.05], [0.42, PAD + 0.36, -0.02]),
      ...['signal', 'mustard', 'leaf'].map((c, i) => part('glowsphere', c, [0.035, 0.035, 0.02], [0.42, PAD + 0.48 - i * 0.05, 0.005])),
      // 腳踏車架與兩輛腳踏車。
      on('box', 'metal', [0.3, 0.02, 0.02], [0.26, PAD + 0.06, -0.38]),
      ...[0.16, 0.34].flatMap((x) => [
        part('torus', 'iron', [0.08, 0.08, 0.015], [x - 0.05, PAD + 0.04, -0.33], null, Math.PI / 2),
        part('torus', 'iron', [0.08, 0.08, 0.015], [x + 0.05, PAD + 0.04, -0.33], null, Math.PI / 2),
        part('box', 'signal', [0.1, 0.012, 0.012], [x, PAD + 0.07, -0.33]),
      ]),
      ...place(roundTree({ h: 0.36 }), { x: -0.37, z: -0.37 }),
    ],
  },
  // 治安與消防：消防隊車庫、消防車與雲梯、瞭望塔、消防栓、交通錐。
  'public-safety': {
    name: '消防隊與消防車',
    build: () => [
      ...pad('stone'),
      on('rbox', 'cream', [0.6, 0.34, 0.34], [-0.1, PAD, -0.24]),
      on('box', 'signal', [0.64, 0.05, 0.36], [-0.1, PAD + 0.34, -0.24]),
      ...[-0.28, 0.08].map((x) => on('box', 'roofDark', [0.2, 0.22, 0.012], [x, PAD, -0.065])),
      ...[-0.28, 0.08].flatMap((x) => [0.05, 0.1, 0.15].map((y) => on('box', 'metal', [0.2, 0.008, 0.014], [x, PAD + y, -0.06]))),
      ...windowsRow({ y: PAD + 0.28, z: -0.064, xs: [-0.32, -0.2, -0.04, 0.12] }),
      // 瞭望塔與警示燈。
      on('rbox', 'cream', [0.16, 0.66, 0.16], [0.32, PAD, -0.32]),
      on('box', 'signal', [0.2, 0.05, 0.2], [0.32, PAD + 0.66, -0.32]),
      on('hip', 'roofDark', [0.22, 0.12, 0.22], [0.32, PAD + 0.71, -0.32]),
      part('glowsphere', 'signal', [0.06, 0.06, 0.06], [0.32, PAD + 0.88, -0.32]),
      ...windowsRow({ y: PAD + 0.5, z: -0.234, xs: [0.32] }),
      // 消防車與雲梯。
      ...place(vehicle({ l: 0.5, w: 0.18, h: 0.16, color: 'signal' }), { x: -0.12, z: 0.22, yaw: Math.PI / 2 }),
      part('box', 'metal', [0.42, 0.025, 0.06], [-0.12, PAD + 0.3, 0.22], [0, 0, 0.18]),
      ...[-0.25, -0.15, -0.05, 0.05].map((x) => part('box', 'metal', [0.012, 0.02, 0.07], [x, PAD + 0.29 + (x + 0.12) * 0.18, 0.22])),
      part('glowbox', 'signal', [0.06, 0.03, 0.05], [0.04, PAD + 0.24, 0.22]),
      // 消防栓與交通錐。
      on('cyl', 'signal', [0.06, 0.12, 0.06], [0.38, PAD, 0.18]),
      part('dome', 'signal', [0.07, 0.04, 0.07], [0.38, PAD + 0.14, 0.18]),
      part('cyl', 'signal', [0.03, 0.03, 0.1], [0.38, PAD + 0.08, 0.18], [0, 0, Math.PI / 2]),
      ...[[0.3, 0.38], [0.42, 0.38]].flatMap(([x, z]) => [
        on('box', 'ochre', [0.06, 0.01, 0.06], [x, PAD, z]),
        on('cone', 'court', [0.05, 0.1, 0.05], [x, PAD + 0.01, z]),
      ]),
      ...place(person({ shirt: 'signal', hat: 'mustard', h: 0.18 }), { x: 0.22, z: 0.06 }),
      ...place(person({ shirt: 'jade', h: 0.18 }), { x: 0.34, z: 0.02 }),
    ],
  },
  // 產業經濟：商店街，條紋遮陽篷的店面、貨箱、推車、招牌。
  economy: {
    name: '商店街',
    build: () => {
      const shop = (x, wall, awning) => [
        on('rbox', wall, [0.28, 0.4, 0.3], [x, PAD, -0.26]),
        on('box', 'roofDark', [0.3, 0.03, 0.32], [x, PAD + 0.4, -0.26]),
        part('glowbox', 'glow', [0.2, 0.14, 0.012], [x, PAD + 0.12, -0.104]),
        ...windowsRow({ y: PAD + 0.32, z: -0.104, xs: [x - 0.07, x + 0.07], w: 0.06, h: 0.06 }),
        ...[-0.1, -0.033, 0.033, 0.1].map((dx, i) => part('box', i % 2 ? 'line' : awning, [0.067, 0.012, 0.13], [x + dx, PAD + 0.24, -0.05], [0.45, 0, 0])),
        on('box', 'wood', [0.18, 0.05, 0.012], [x, PAD + 0.42, -0.11]),
      ];
      return [
        ...pad('sand'),
        ...shop(-0.31, 'cream', 'roof'),
        ...shop(0, 'wall', 'jade'),
        ...shop(0.31, 'cream', 'mustard'),
        // 攤位與貨箱。
        on('box', 'wood', [0.26, 0.1, 0.12], [-0.22, PAD, 0.12]),
        ...[-0.3, -0.22, -0.14].map((x, i) => part('sphere', ['signal', 'mustard', 'leaf'][i], [0.06, 0.05, 0.06], [x, PAD + 0.12, 0.12])),
        ...[[0.16, 0.14], [0.26, 0.14], [0.21, 0.14]].map(([x, z], i) => on('box', 'wood', [0.09, 0.08, 0.09], [x, PAD + (i === 2 ? 0.08 : 0), z])),
        // 推車。
        on('box', 'jade', [0.16, 0.08, 0.1], [0.36, PAD + 0.04, 0.32]),
        part('torus', 'iron', [0.06, 0.06, 0.015], [0.3, PAD + 0.03, 0.37], null, Math.PI / 2),
        part('torus', 'iron', [0.06, 0.06, 0.015], [0.42, PAD + 0.03, 0.37], null, Math.PI / 2),
        part('box', 'iron', [0.012, 0.012, 0.14], [0.27, PAD + 0.14, 0.32], [0.6, 0, 0]),
        ...place(person({ shirt: 'jade' }), { x: -0.06, z: 0.2 }),
        ...place(person({ shirt: 'mustard', h: 0.17 }), { x: 0.02, z: 0.3 }),
        ...place(person({ shirt: 'rose' }), { x: -0.3, z: 0.3 }),
        ...place(lamp(), { x: 0.42, z: 0.02 }),
      ];
    },
  },
  // 勞工：工廠，鋸齒屋頂、煙囪、棧板貨箱、堆高機、戴安全帽的工人。
  labor: {
    name: '工廠與工人',
    build: () => [
      ...pad('stone'),
      on('rbox', 'wall', [0.66, 0.3, 0.42], [-0.12, PAD, -0.22]),
      ...[-0.34, -0.12, 0.1].map((x) => part('prism', 'metal', [0.22, 0.14, 0.42], [x, PAD + 0.37, -0.22], null, 0)),
      ...[-0.34, -0.12, 0.1].map((x) => part('glowbox', 'glow', [0.012, 0.1, 0.38], [x + 0.105, PAD + 0.36, -0.22])),
      on('box', 'roofDark', [0.2, 0.2, 0.012], [-0.2, PAD, -0.005]),
      ...windowsRow({ y: PAD + 0.22, z: -0.004, xs: [0.0, 0.12], w: 0.08, h: 0.06 }),
      // 煙囪。
      on('cyl', 'roof', [0.1, 0.72, 0.1], [0.34, PAD, -0.34]),
      on('cyl', 'iron', [0.12, 0.04, 0.12], [0.34, PAD + 0.72, -0.34]),
      // 棧板與貨箱。
      ...[[0.1, 0.18], [0.24, 0.18]].flatMap(([x, z]) => [
        on('box', 'wood', [0.14, 0.03, 0.14], [x, PAD, z]),
        on('box', 'ochre', [0.12, 0.1, 0.12], [x, PAD + 0.03, z]),
      ]),
      on('box', 'ochre', [0.12, 0.1, 0.12], [0.1, PAD + 0.13, 0.18]),
      // 堆高機。
      on('rbox', 'mustard', [0.14, 0.1, 0.18], [-0.24, PAD + 0.04, 0.24]),
      on('box', 'iron', [0.012, 0.16, 0.012], [-0.29, PAD + 0.14, 0.27]),
      on('box', 'iron', [0.012, 0.16, 0.012], [-0.19, PAD + 0.14, 0.27]),
      on('hip', 'iron', [0.16, 0.03, 0.12], [-0.24, PAD + 0.3, 0.24]),
      on('box', 'metal', [0.12, 0.012, 0.12], [-0.24, PAD + 0.06, 0.4]),
      ...[-1, 1].flatMap((sx) => [0.18, 0.3].map((z) => part('torus', 'iron', [0.06, 0.06, 0.02], [-0.24 + sx * 0.07, PAD + 0.03, z], null, Math.PI / 2))),
      ...place(person({ shirt: 'jade', hat: 'mustard' }), { x: 0.04, z: 0.36 }),
      ...place(person({ shirt: 'court', hat: 'mustard' }), { x: 0.38, z: 0.3 }),
      ...place(person({ shirt: 'mustard', pants: 'jade', hat: 'line', h: 0.18 }), { x: 0.4, z: 0.08 }),
    ],
  },
  // 農業與動物保護：田畦、紅頂穀倉、乳牛與綿羊、圍欄、狗屋。
  'agriculture-animals': {
    name: '農田與小動物',
    build: () => {
      const cow = (x, z, yaw, color = 'cream') => place([
        on('rbox', color, [0.18, 0.09, 0.09], [0, PAD + 0.06, 0]),
        part('rbox', 'hair', [0.06, 0.04, 0.092], [0.02, PAD + 0.12, 0]),
        part('rbox', color, [0.07, 0.07, 0.07], [0.11, PAD + 0.14, 0]),
        part('box', 'rose', [0.02, 0.03, 0.05], [0.15, PAD + 0.12, 0]),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on('box', 'hair', [0.02, 0.06, 0.02], [sx * 0.06, PAD, sz * 0.03]))),
      ], { x, z, yaw });
      const sheep = (x, z) => [
        part('sphere', 'line', [0.12, 0.09, 0.09], [x, PAD + 0.08, z]),
        part('sphere', 'hair', [0.045, 0.05, 0.045], [x + 0.065, PAD + 0.1, z]),
        ...[-1, 1].map((sx) => on('box', 'hair', [0.015, 0.04, 0.015], [x + sx * 0.03, PAD, z])),
      ];
      return [
        ...pad('grass'),
        // 田畦與作物。
        on('box', 'soil', [0.5, 0.02, 0.36], [-0.2, PAD, -0.24]),
        ...[-0.38, -0.29, -0.2, -0.11, -0.02].flatMap((x) => [
          on('box', 'soil', [0.05, 0.03, 0.32], [x, PAD + 0.02, -0.24]),
          ...[-0.36, -0.24, -0.12].map((z) => part('sphere', 'leaf', [0.055, 0.06, 0.055], [x, PAD + 0.07, z])),
        ]),
        // 穀倉。
        on('rbox', 'signal', [0.24, 0.24, 0.26], [0.3, PAD, -0.28]),
        part('prism', 'roofDark', [0.3, 0.14, 0.3], [0.3, PAD + 0.31, -0.28], null, Math.PI / 2),
        on('box', 'line', [0.1, 0.14, 0.012], [0.3, PAD, -0.144]),
        part('box', 'line', [0.012, 0.15, 0.014], [0.3, PAD + 0.07, -0.142], [0, 0, 0.6]),
        part('glowbox', 'glow', [0.06, 0.04, 0.012], [0.3, PAD + 0.22, -0.144]),
        // 圍欄與動物。
        ...fence({ from: [-0.44, 0.02], to: [0.44, 0.02], posts: 7 }),
        ...fence({ from: [-0.44, 0.02], to: [-0.44, 0.42], posts: 4 }),
        ...cow(-0.2, 0.22, 0.3),
        ...cow(0.06, 0.3, -0.4, 'wall'),
        ...sheep(0.28, 0.18),
        ...sheep(0.36, 0.32),
        on('box', 'wood', [0.14, 0.04, 0.05], [-0.32, PAD, 0.36]),
        on('box', 'water', [0.12, 0.006, 0.035], [-0.32, PAD + 0.04, 0.36]),
        // 狗屋與小狗。
        on('box', 'wood', [0.1, 0.08, 0.1], [0.4, PAD, 0.02 - 0.12]),
        part('prism', 'roof', [0.12, 0.06, 0.12], [0.4, PAD + 0.11, -0.1], null, Math.PI / 2),
        part('sphere', 'ochre', [0.06, 0.045, 0.045], [0.32, PAD + 0.04, -0.06]),
        part('sphere', 'ochre', [0.035, 0.035, 0.035], [0.29, PAD + 0.07, -0.06]),
        ...place(person({ shirt: 'leafDark', hat: 'ochre', hatShape: 'cone' }), { x: 0.08, z: -0.1 }),
      ];
    },
  },
  // 觀光：涼亭、紀念品攤位、指示牌、拖著行李箱的旅客、相機。
  tourism: {
    name: '涼亭與攤位',
    build: () => [
      ...pad('sand'),
      // 涼亭：台基、四柱、四坡屋頂與寶頂。
      on('rbox', 'stone', [0.4, 0.05, 0.4], [-0.2, PAD, -0.2]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on('cyl', 'roof', [0.035, 0.3, 0.035], [-0.2 + sx * 0.15, PAD + 0.05, -0.2 + sz * 0.15]))),
      on('box', 'roofDark', [0.42, 0.03, 0.42], [-0.2, PAD + 0.35, -0.2]),
      on('hip', 'roof', [0.5, 0.2, 0.5], [-0.2, PAD + 0.38, -0.2]),
      on('sphere', 'mustard', [0.05, 0.05, 0.05], [-0.2, PAD + 0.57, -0.2]),
      ...place(bench(), { x: -0.2, z: -0.22 }),
      // 攤位。
      on('box', 'wood', [0.3, 0.12, 0.14], [0.26, PAD, 0.04]),
      ...[-1, 1].map((sx) => on('box', 'timber', [0.02, 0.3, 0.02], [0.26 + sx * 0.14, PAD, -0.02])),
      ...[-0.11, -0.037, 0.037, 0.11].map((dx, i) => part('box', i % 2 ? 'line' : 'jade', [0.074, 0.012, 0.18], [0.26 + dx, PAD + 0.31, 0.03], [0.25, 0, 0])),
      ...[0.18, 0.26, 0.34].map((x, i) => on('rbox', ['mustard', 'rose', 'jade'][i], [0.05, 0.05, 0.05], [x, PAD + 0.12, 0.06])),
      part('glowsphere', 'glow', [0.04, 0.04, 0.04], [0.26, PAD + 0.26, 0.04]),
      // 指示牌。
      on('cyl', 'timber', [0.025, 0.36, 0.025], [0.28, PAD, -0.32]),
      ...[[0.32, 'wood', 0.3], [0.26, 'jade', -0.4], [0.2, 'wood', 0.1]].map(([y, c, yaw]) => part('box', c, [0.16, 0.04, 0.012], [0.28, PAD + y, -0.32], null, yaw)),
      // 旅客、行李箱、相機腳架。
      ...place(person({ shirt: 'mustard' }), { x: -0.08, z: 0.24 }),
      on('rbox', 'jade', [0.06, 0.09, 0.04], [-0.02, PAD, 0.26]),
      on('box', 'iron', [0.008, 0.06, 0.008], [-0.02, PAD + 0.09, 0.26]),
      ...place(person({ shirt: 'rose', h: 0.18 }), { x: -0.32, z: 0.24 }),
      ...[-1, 0, 1].map((i) => part('cyl', 'iron', [0.01, 0.16, 0.01], [-0.42 + i * 0.02, PAD + 0.08, 0.32 + Math.abs(i) * 0.01], [0, 0, i * 0.2])),
      on('rbox', 'iron', [0.05, 0.035, 0.03], [-0.42, PAD + 0.16, 0.32]),
      ...place(flowerBed(), { x: 0.22, z: 0.36 }),
      ...place(roundTree({ h: 0.34, crown: 'leafLight' }), { x: 0.37, z: -0.12 }),
    ],
  },
  // 社會福利：社區照顧中心，無障礙坡道與扶手、輪椅、拄拐杖的長者、菜圃。
  'social-welfare': {
    name: '社區照顧中心',
    build: () => [
      ...pad('grass'),
      ...place(house({ w: 0.56, d: 0.32, h: 0.28, wall: 'wall', roof: 'roofDark' }), { x: -0.1, z: -0.26 }),
      on('box', 'cream', [0.3, 0.14, 0.012], [-0.1, PAD + 0.3, -0.098]),
      part('sphere', 'rose', [0.06, 0.06, 0.02], [-0.1, PAD + 0.37, -0.09]),
      // 坡道與扶手。
      part('box', 'stone', [0.26, 0.03, 0.1], [0.12, PAD + 0.035, -0.04], [0, 0, -0.2]),
      on('box', 'stone', [0.12, 0.06, 0.12], [-0.06, PAD, -0.04]),
      ...[-0.09, 0.01].map((dz) => part('box', 'metal', [0.26, 0.01, 0.01], [0.12, PAD + 0.12, dz - 0.0], [0, 0, -0.2])),
      ...[0.02, 0.12, 0.22].flatMap((x) => [-0.09, 0.01].map((z) => on('box', 'metal', [0.01, 0.08 - (x - 0.02) * 0.2, 0.01], [x, PAD + 0.04 - (x - 0.02) * 0.2, z]))),
      // 輪椅。
      ...place([
        on('box', 'jade', [0.08, 0.02, 0.08], [0, PAD + 0.06, 0]),
        on('box', 'jade', [0.08, 0.08, 0.015], [0, PAD + 0.06, -0.04]),
        part('torus', 'iron', [0.09, 0.09, 0.015], [-0.05, PAD + 0.045, 0], null, Math.PI / 2),
        part('torus', 'iron', [0.09, 0.09, 0.015], [0.05, PAD + 0.045, 0], null, Math.PI / 2),
        part('sphere', 'skin', [0.06, 0.06, 0.06], [0, PAD + 0.17, -0.01]),
        on('rbox', 'rose', [0.07, 0.06, 0.05], [0, PAD + 0.08, -0.01]),
        part('dome', 'line', [0.062, 0.03, 0.062], [0, PAD + 0.2, -0.012]),
      ], { x: 0.3, z: 0.16 }),
      // 拄拐杖的長者與陪伴者。
      ...place([...person({ shirt: 'ochre', hat: 'line' }), part('cyl', 'timber', [0.012, 0.14, 0.012], [0.06, PAD + 0.07, 0.02])], { x: 0.06, z: 0.2 }),
      ...place(person({ shirt: 'jade', h: 0.21 }), { x: -0.06, z: 0.26 }),
      // 菜圃與長椅。
      on('rbox', 'wood', [0.26, 0.06, 0.14], [-0.3, PAD, 0.24]),
      ...[-0.38, -0.3, -0.22].map((x) => part('sphere', 'leaf', [0.06, 0.05, 0.06], [x, PAD + 0.08, 0.24])),
      ...place(bench(), { x: 0.3, z: -0.18, yaw: -Math.PI / 2 }),
      ...place(roundTree({ h: 0.36 }), { x: 0.37, z: -0.37 }),
      ...place(bush(), { x: -0.42, z: 0.0 }),
      ...place(bush(0.05, 'leafDark'), { x: 0.2, z: 0.4 }),
    ],
  },
  // 醫療衛生：診所，十字標誌、雨庇、救護車、候診長椅。
  health: {
    name: '診所與救護車',
    build: () => [
      ...pad('stone'),
      on('rbox', 'cream', [0.62, 0.4, 0.34], [-0.06, PAD, -0.24]),
      on('box', 'stone', [0.66, 0.03, 0.38], [-0.06, PAD + 0.4, -0.24]),
      ...windowsRow({ y: PAD + 0.3, z: -0.064, xs: [-0.3, -0.18, 0.06, 0.18] }),
      ...windowsRow({ y: PAD + 0.16, z: -0.064, xs: [-0.3, 0.18] }),
      on('box', 'glass', [0.14, 0.16, 0.012], [-0.06, PAD, -0.064]),
      // 雨庇。
      on('box', 'jade', [0.24, 0.025, 0.12], [-0.06, PAD + 0.19, -0.01]),
      ...[-1, 1].map((sx) => on('cyl', 'metal', [0.015, 0.19, 0.015], [-0.06 + sx * 0.1, PAD, 0.04])),
      // 屋頂十字招牌。
      on('rbox', 'line', [0.16, 0.16, 0.04], [-0.06, PAD + 0.43, -0.24]),
      part('box', 'signal', [0.12, 0.035, 0.045], [-0.06, PAD + 0.51, -0.24]),
      part('box', 'signal', [0.035, 0.12, 0.045], [-0.06, PAD + 0.51, -0.24]),
      // 側翼。
      on('rbox', 'wall', [0.16, 0.26, 0.26], [0.36, PAD, -0.28]),
      part('glowbox', 'glow', [0.012, 0.08, 0.08], [0.28 - 0.001, PAD + 0.16, -0.22]),
      ...windowsRow({ y: PAD + 0.16, z: -0.144, xs: [0.36] }),
      // 救護車。
      ...place(vehicle({ l: 0.38, w: 0.17, h: 0.17, color: 'line' }), { x: 0.2, z: 0.24, yaw: Math.PI / 2 }),
      part('box', 'signal', [0.385, 0.03, 0.175], [0.2, PAD + 0.13, 0.24]),
      part('glowbox', 'signal', [0.04, 0.025, 0.04], [0.12, PAD + 0.25, 0.24]),
      part('glowbox', 'jade', [0.04, 0.025, 0.04], [0.28, PAD + 0.25, 0.24]),
      // 候診長椅與人。
      ...place(bench(), { x: -0.28, z: 0.1 }),
      ...place(person({ shirt: 'line', pants: 'jade' }), { x: -0.1, z: 0.12 }),
      ...place(person({ shirt: 'rose', h: 0.16 }), { x: -0.34, z: 0.12 }),
      ...place(flowerBed({ bloom: 'mustard' }), { x: -0.3, z: 0.34 }),
      ...place(bush(), { x: 0.42, z: 0.0 }),
    ],
  },
  // 教育：學校，鐘面、升旗台、跑道操場、籃框、戴黃帽的學童。
  education: {
    name: '學校與操場',
    build: () => [
      ...pad('grass'),
      on('rbox', 'cream', [0.72, 0.36, 0.22], [0, PAD, -0.34]),
      on('box', 'roof', [0.76, 0.03, 0.26], [0, PAD + 0.36, -0.34]),
      ...windowsRow({ y: PAD + 0.26, z: -0.226, xs: [-0.28, -0.16, 0.16, 0.28] }),
      ...windowsRow({ y: PAD + 0.12, z: -0.226, xs: [-0.28, -0.16, 0.16, 0.28] }),
      // 中央門樓與鐘。
      on('rbox', 'wall', [0.18, 0.5, 0.24], [0, PAD, -0.33]),
      on('hip', 'roof', [0.24, 0.14, 0.28], [0, PAD + 0.5, -0.33]),
      part('cyl', 'line', [0.1, 0.1, 0.02], [0, PAD + 0.4, -0.205], [Math.PI / 2, 0, 0]),
      part('torus', 'iron', [0.11, 0.11, 0.02], [0, PAD + 0.4, -0.2]),
      part('box', 'iron', [0.008, 0.04, 0.01], [0, PAD + 0.415, -0.192]),
      part('box', 'iron', [0.03, 0.008, 0.01], [0.012, PAD + 0.4, -0.192]),
      on('box', 'timber', [0.1, 0.14, 0.012], [0, PAD, -0.205]),
      // 跑道與操場。
      on('rbox', 'court', [0.64, 0.012, 0.36], [-0.06, PAD, 0.18]),
      on('rbox', 'grass', [0.44, 0.014, 0.18], [-0.06, PAD, 0.18]),
      on('box', 'line', [0.62, 0.016, 0.006], [-0.06, PAD, 0.32]),
      on('box', 'line', [0.006, 0.016, 0.18], [-0.06, PAD, 0.18]),
      // 籃框。
      on('cyl', 'iron', [0.02, 0.3, 0.02], [0.4, PAD, 0.12]),
      on('box', 'line', [0.012, 0.09, 0.12], [0.39, PAD + 0.28, 0.12]),
      part('torus', 'signal', [0.06, 0.06, 0.012], [0.36, PAD + 0.27, 0.12], [Math.PI / 2, 0, 0]),
      // 升旗台（旗桿不掛旗）。
      on('rbox', 'stone', [0.12, 0.04, 0.12], [0.4, PAD, -0.12]),
      on('cyl', 'metal', [0.015, 0.56, 0.015], [0.4, PAD + 0.04, -0.12]),
      part('sphere', 'mustard', [0.03, 0.03, 0.03], [0.4, PAD + 0.61, -0.12]),
      // 學童。
      ...[[-0.24, 0.16, 'rose'], [-0.06, 0.22, 'jade'], [0.12, 0.14, 'line']].flatMap(([x, z, shirt]) =>
        place(person({ shirt, pants: 'jade', hat: 'mustard', h: 0.16 }), { x, z })),
      ...place(person({ shirt: 'ochre', h: 0.21 }), { x: 0.24, z: 0.32 }),
      part('sphere', 'court', [0.04, 0.04, 0.04], [0.28, PAD + 0.02, 0.18]),
      ...place(roundTree({ h: 0.34 }), { x: -0.38, z: -0.12 }),
    ],
  },
  // 文化：戶外舞台，背板、燈架、聚光燈、喇叭、觀眾長椅。
  culture: {
    name: '戶外舞台',
    build: () => [
      ...pad('sand'),
      on('rbox', 'wood', [0.7, 0.1, 0.36], [0, PAD, -0.22]),
      on('box', 'timber', [0.72, 0.02, 0.38], [0, PAD + 0.1, -0.22]),
      ...[-0.15, 0, 0.15].map((x) => on('box', 'stone', [0.12, 0.025, 0.06], [x, PAD, 0.0 - 0.02 + Math.abs(x) * 0])),
      // 背板與布幕。
      on('rbox', 'roofDark', [0.66, 0.42, 0.04], [0, PAD + 0.12, -0.38]),
      ...[-1, 1].map((sx) => on('rbox', 'signal', [0.14, 0.42, 0.05], [sx * 0.27, PAD + 0.12, -0.35])),
      // 燈架、聚光燈。
      ...[-1, 1].map((sx) => on('box', 'iron', [0.025, 0.62, 0.025], [sx * 0.35, PAD, -0.06])),
      on('box', 'iron', [0.72, 0.025, 0.025], [0, PAD + 0.6, -0.06]),
      ...[-0.24, -0.08, 0.08, 0.24].map((x) => part('glowsphere', 'glow', [0.045, 0.045, 0.045], [x, PAD + 0.57, -0.05])),
      ...[-1, 1].map((sx) => part('cyl', 'iron', [0.05, 0.08, 0.05], [sx * 0.2, PAD + 0.56, -0.05], [0.6, 0, 0])),
      // 喇叭。
      ...[-1, 1].flatMap((sx) => [
        on('rbox', 'iron', [0.09, 0.16, 0.08], [sx * 0.42, PAD, 0.02]),
        part('cyl', 'metal', [0.05, 0.05, 0.01], [sx * 0.42, PAD + 0.1, 0.065], [Math.PI / 2, 0, 0]),
      ]),
      // 表演者。
      ...lift(place(person({ shirt: 'mustard', h: 0.22 }), { x: -0.08, z: -0.22 }), 0.12),
      ...lift(place(person({ shirt: 'jade', h: 0.22 }), { x: 0.1, z: -0.24 }), 0.12),
      on('cyl', 'iron', [0.01, 0.16, 0.01], [-0.02, PAD + 0.12, -0.16]),
      // 觀眾長椅與觀眾。
      ...[[-0.18, 0.22], [0.18, 0.22], [-0.18, 0.38], [0.18, 0.38]].flatMap(([x, z]) => place(bench(), { x, z, yaw: Math.PI })),
      ...[[-0.22, 0.2, 'rose'], [0.14, 0.2, 'ochre'], [0.22, 0.36, 'jade']].flatMap(([x, z, shirt]) =>
        place(person({ shirt, h: 0.18 }), { x, z, yaw: Math.PI })),
    ],
  },
  // 原住民族事務：高架穀倉（柱上防鼠板）、織布機、竹籬、小米田。
  'indigenous-affairs': {
    name: '高架穀倉與織布機',
    build: () => [
      ...pad('grass'),
      // 高架穀倉：四柱、防鼠圓板、倉體、茅草屋頂、梯子。
      ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [
        on('cyl', 'timber', [0.035, 0.2, 0.035], [-0.18 + sx * 0.12, PAD, -0.22 + sz * 0.1]),
        on('cyl', 'stone', [0.09, 0.015, 0.09], [-0.18 + sx * 0.12, PAD + 0.18, -0.22 + sz * 0.1]),
      ])),
      on('box', 'wood', [0.34, 0.03, 0.28], [-0.18, PAD + 0.2, -0.22]),
      on('rbox', 'wood', [0.3, 0.2, 0.24], [-0.18, PAD + 0.23, -0.22]),
      ...[-0.12, -0.06, 0, 0.06, 0.12].map((dx) => on('box', 'timber', [0.012, 0.2, 0.245], [-0.18 + dx, PAD + 0.23, -0.22])),
      part('prism', 'ochre', [0.44, 0.24, 0.4], [-0.18, PAD + 0.55, -0.22], null, 0),
      ...[0.04, 0.09, 0.14].map((y) => part('box', 'timber', [0.1, 0.012, 0.012], [-0.04 + 0.02, PAD + y, -0.05])),
      ...[-1, 1].map((sx) => part('box', 'timber', [0.012, 0.22, 0.012], [-0.02 + sx * 0.05, PAD + 0.1, -0.05], [-0.3, 0, 0])),
      // 織布機與織布者。
      ...[-1, 1].map((sx) => on('box', 'timber', [0.02, 0.18, 0.02], [0.28 + sx * 0.1, PAD, 0.14])),
      part('cyl', 'wood', [0.03, 0.22, 0.03], [0.28, PAD + 0.18, 0.14], [0, 0, Math.PI / 2]),
      part('cyl', 'wood', [0.03, 0.22, 0.03], [0.28, PAD + 0.05, 0.26], [0, 0, Math.PI / 2]),
      ...['signal', 'mustard', 'iron', 'signal', 'cream'].map((c, i) => part('box', c, [0.03, 0.15, 0.006], [0.2 + i * 0.04, PAD + 0.12, 0.2], [0.75, 0, 0])),
      ...place(person({ shirt: 'signal', pants: 'iron' }), { x: 0.28, z: 0.36, yaw: Math.PI }),
      // 竹籬。
      ...[-0.44, -0.4, -0.36, -0.32, -0.28, -0.24].map((x, i) => on('cyl', 'leafLight', [0.03, 0.16 + (i % 2) * 0.03, 0.03], [x, PAD, 0.12])),
      part('box', 'wood', [0.24, 0.012, 0.012], [-0.34, PAD + 0.1, 0.13]),
      // 小米田。
      ...[0.06, 0.16, 0.26, 0.36].flatMap((x) => [-0.4, -0.3, -0.2].flatMap((z) => [
        on('cyl', 'leaf', [0.01, 0.12, 0.01], [x, PAD, z]),
        part('sphere', 'ochre', [0.04, 0.06, 0.04], [x + 0.01, PAD + 0.13, z]),
      ])),
      ...place(pine({ h: 0.42 }), { x: -0.38, z: 0.36 }),
      ...place(person({ shirt: 'jade', h: 0.18 }), { x: -0.12, z: 0.28 }),
    ],
  },
  // 客家事務：油紙傘攤、茶園、拱門小屋、擂茶碗。
  'hakka-affairs': {
    name: '油紙傘與茶園',
    build: () => {
      const umbrella = (x, z, color, tilt = 0) => [
        part('cone', color, [0.2, 0.08, 0.2], [x, PAD + 0.24, z], [tilt, 0, 0]),
        part('sphere', 'wood', [0.02, 0.02, 0.02], [x, PAD + 0.29, z]),
        on('cyl', 'timber', [0.01, 0.2, 0.01], [x, PAD, z]),
      ];
      return [
        ...pad('sand'),
        // 伙房：白牆、黑瓦、紅門。
        ...place(house({ w: 0.48, d: 0.26, h: 0.24, wall: 'cream', roof: 'iron', door: 'signal' }), { x: -0.14, z: -0.3 }),
        part('torus', 'timber', [0.1, 0.1, 0.02], [-0.14, PAD + 0.16, -0.165]),
        ...[-1, 1].map((sx) => on('box', 'signal', [0.04, 0.16, 0.012], [-0.14 + sx * 0.1, PAD + 0.04, -0.164])),
        // 茶園：一行行修剪整齊的茶樹。
        ...[0.14, 0.24, 0.34, 0.44].flatMap((z) => [
          on('rbox', 'leafDark', [0.34, 0.07, 0.06], [-0.24, PAD, z - 0.14 + 0.0]),
          on('rbox', 'leaf', [0.32, 0.03, 0.05], [-0.24, PAD + 0.06, z - 0.14]),
        ]),
        // 油紙傘攤。
        on('box', 'wood', [0.3, 0.06, 0.16], [0.28, PAD, 0.24]),
        ...umbrella(0.18, 0.08, 'signal'),
        ...umbrella(0.38, 0.08, 'mustard'),
        ...umbrella(0.28, -0.04, 'jade'),
        part('cone', 'rose', [0.12, 0.05, 0.12], [0.22, PAD + 0.1, 0.26], [0.4, 0, 0]),
        part('cone', 'ochre', [0.12, 0.05, 0.12], [0.34, PAD + 0.1, 0.26], [0.4, 0, 0]),
        // 擂茶碗與茶壺。
        on('cyl', 'wood', [0.12, 0.05, 0.12], [0.36, PAD, -0.24]),
        on('cyl', 'leafDark', [0.1, 0.01, 0.1], [0.36, PAD + 0.05, -0.24]),
        part('cyl', 'timber', [0.015, 0.16, 0.015], [0.38, PAD + 0.1, -0.24], [0, 0, -0.5]),
        on('sphere', 'roofDark', [0.08, 0.07, 0.08], [0.22, PAD, -0.2]),
        part('cyl', 'roofDark', [0.015, 0.05, 0.015], [0.26, PAD + 0.05, -0.2], [0, 0, -0.8]),
        ...place(person({ shirt: 'jade', hat: 'ochre', hatShape: 'cone' }), { x: 0.0, z: 0.36 }),
        ...place(person({ shirt: 'rose', h: 0.18 }), { x: 0.14, z: 0.38 }),
        ...place(roundTree({ h: 0.36, crown: 'cream' }), { x: 0.37, z: -0.37 }),
      ];
    },
  },
  // 環境保護：資源回收站（三色回收桶）、風力發電機、太陽能板、樹。
  environment: {
    name: '回收站與風車',
    build: () => [
      ...pad('grass'),
      // 回收站的頂棚。
      on('rbox', 'stone', [0.46, 0.03, 0.26], [-0.16, PAD, 0.16]),
      ...[-1, 1].map((sx) => on('box', 'iron', [0.02, 0.26, 0.02], [-0.16 + sx * 0.21, PAD, 0.04])),
      on('box', 'leafDark', [0.48, 0.025, 0.28], [-0.16, PAD + 0.26, 0.15]),
      ...['mustard', 'court', 'metal', 'jade'].flatMap((c, i) => [
        on('rbox', c, [0.09, 0.14, 0.09], [-0.32 + i * 0.105, PAD + 0.03, 0.16]),
        on('box', 'iron', [0.04, 0.01, 0.01], [-0.32 + i * 0.105, PAD + 0.14, 0.206]),
      ]),
      // 風力發電機：塔柱、機艙、三片葉片（靜態，不屬於動態元素）。
      on('cyl', 'line', [0.05, 0.9, 0.05], [0.2, PAD, -0.28]),
      on('rbox', 'line', [0.06, 0.06, 0.12], [0.2, PAD + 0.9, -0.29]),
      part('sphere', 'stone', [0.05, 0.05, 0.05], [0.2, PAD + 0.93, -0.22]),
      ...[0, 2.094, 4.189].map((a) => part('box', 'line', [0.03, 0.26, 0.012], [0.2 + Math.sin(a) * 0.13, PAD + 0.93 + Math.cos(a) * 0.13, -0.21], [0, 0, -a])),
      // 太陽能板。
      ...[-0.36, -0.12].flatMap((x) => [
        on('box', 'iron', [0.02, 0.08, 0.02], [x, PAD, -0.28]),
        part('box', 'chalk', [0.2, 0.012, 0.14], [x, PAD + 0.1, -0.28], [0.5, 0, 0]),
        part('box', 'metal', [0.21, 0.004, 0.006], [x, PAD + 0.107, -0.281], [0.5, 0, 0]),
      ]),
      ...place(roundTree({ h: 0.4 }), { x: 0.14, z: 0.3 }),
      ...place(pine({ h: 0.36 }), { x: 0.4, z: 0.2 }),
      ...place(bush(0.06, 'leafDark'), { x: 0.3, z: 0.42 }),
      ...place(person({ shirt: 'leaf', h: 0.18 }), { x: -0.08, z: 0.4 }),
      on('rbox', 'ochre', [0.06, 0.05, 0.05], [0.0, PAD, 0.4]),
    ],
  },
  // 水利：河道穿過，兩岸石砌、拱橋、水門、蘆葦、小船。
  water: {
    name: '河道與小橋',
    build: () => [
      ...pad('grass'),
      on('box', 'stone', [0.96, 0.03, 0.4], [0, PAD, 0.0]),
      on('box', 'water', [0.96, 0.034, 0.3], [0, PAD, 0.0]),
      ...[-1, 1].map((sz) => on('box', 'stone', [0.96, 0.06, 0.05], [0, PAD, sz * 0.175])),
      // 拱橋：九片甲板沿拱形排列。
      ...Array.from({ length: 9 }, (_, i) => {
        const t = i / 8 - 0.5;
        return part('box', 'wood', [0.14, 0.025, 0.07], [-0.06, PAD + archY(t), t * 0.52], [t * 1.3, 0, 0]);
      }),
      ...[-1, 1].flatMap((sx) => [-0.5, 0, 0.5].map((t) => on('box', 'timber', [0.015, 0.08, 0.015], [-0.06 + sx * 0.07, PAD + archY(t), t * 0.52]))),
      // 水門。
      ...[-1, 1].map((sx) => on('rbox', 'stone', [0.06, 0.26, 0.06], [0.3 + sx * 0.08, PAD, -0.17 + 0.0])),
      on('box', 'metal', [0.18, 0.04, 0.06], [0.3, PAD + 0.26, -0.17]),
      on('box', 'iron', [0.1, 0.12, 0.02], [0.3, PAD + 0.04, -0.15]),
      part('torus', 'signal', [0.06, 0.06, 0.012], [0.3, PAD + 0.33, -0.17], [Math.PI / 2, 0, 0]),
      // 小船。
      part('rbox', 'wood', [0.18, 0.04, 0.07], [0.3, PAD + 0.05, 0.06]),
      on('box', 'timber', [0.012, 0.12, 0.012], [0.3, PAD + 0.07, 0.06]),
      // 蘆葦與岸邊的樹。
      ...[[-0.4, 0.14], [-0.34, -0.14], [0.42, -0.12], [0.1, 0.14]].flatMap(([x, z]) => [0, 0.03, -0.03].map((dx, i) =>
        on('cone', 'ochre', [0.02, 0.14 + i * 0.02, 0.02], [x + dx, PAD + 0.03, z]))),
      ...place(roundTree({ h: 0.4, crown: 'leafLight' }), { x: -0.32, z: -0.34 }),
      ...place(roundTree({ h: 0.34 }), { x: 0.34, z: 0.36 }),
      ...place(person({ shirt: 'mustard', h: 0.18 }), { x: -0.3, z: 0.34 }),
      ...place(person({ shirt: 'jade', h: 0.18 }), { x: 0.06, z: -0.36 }),
      ...place(bench(), { x: 0.1, z: 0.36, yaw: Math.PI }),
    ],
  },
  // 都市發展與住宅：公寓、透天厝、施工中的鷹架、行道樹。
  'urban-housing': {
    name: '公寓與住宅',
    build: () => [
      ...pad('stone'),
      // 公寓：四層窗戶、陽台。
      on('rbox', 'wall', [0.34, 0.72, 0.3], [-0.26, PAD, -0.26]),
      on('box', 'roofDark', [0.36, 0.03, 0.32], [-0.26, PAD + 0.72, -0.26]),
      ...[0.14, 0.3, 0.46, 0.62].flatMap((y) => [
        ...windowsRow({ y: PAD + y, z: -0.104, xs: [-0.36, -0.26, -0.16], w: 0.06, h: 0.07 }),
        on('box', 'stone', [0.34, 0.012, 0.04], [-0.26, PAD + y - 0.06, -0.09]),
      ]),
      on('box', 'timber', [0.08, 0.1, 0.012], [-0.26, PAD, -0.104]),
      // 透天厝兩棟。
      ...[0.08, 0.28].flatMap((x, i) => [
        on('rbox', i ? 'cream' : 'sand', [0.18, 0.46, 0.26], [x, PAD, -0.3]),
        on('box', i ? 'roof' : 'roofDark', [0.2, 0.03, 0.28], [x, PAD + 0.46, -0.3]),
        ...windowsRow({ y: PAD + 0.36, z: -0.164, xs: [x], w: 0.1 }),
        ...windowsRow({ y: PAD + 0.22, z: -0.164, xs: [x], w: 0.1 }),
        on('box', 'metal', [0.12, 0.1, 0.012], [x, PAD, -0.164]),
      ]),
      // 施工鷹架。
      on('rbox', 'stone', [0.2, 0.26, 0.18], [0.3, PAD, 0.16]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on('box', 'mustard', [0.012, 0.34, 0.012], [0.3 + sx * 0.12, PAD, 0.16 + sz * 0.11]))),
      ...[0.12, 0.24, 0.34].map((y) => on('box', 'mustard', [0.25, 0.012, 0.012], [0.3, PAD + y, 0.27])),
      ...place(person({ shirt: 'jade', hat: 'mustard', h: 0.17 }), { x: 0.12, z: 0.28 }),
      // 行道樹與人行道。
      on('box', 'sand', [0.6, 0.012, 0.12], [-0.16, PAD, 0.04]),
      ...[-0.37, -0.12].flatMap((x) => place(roundTree({ h: 0.34 }), { x, z: 0.18 })),
      ...place(person({ shirt: 'rose' }), { x: -0.26, z: 0.32 }),
      ...place(bench(), { x: 0.0, z: 0.36 }),
      ...place(lamp(), { x: 0.08, z: 0.06 }),
    ],
  },
  // 運動：籃球場與跑者，看台、球、計分板。
  sports: {
    name: '球場',
    build: () => [
      ...pad('grass'),
      on('rbox', 'court', [0.84, 0.012, 0.5], [0, PAD, -0.12]),
      on('box', 'line', [0.8, 0.014, 0.008], [0, PAD, -0.36]),
      on('box', 'line', [0.8, 0.014, 0.008], [0, PAD, 0.12]),
      on('box', 'line', [0.008, 0.014, 0.48], [0, PAD, -0.12]),
      part('torus', 'line', [0.16, 0.16, 0.01], [0, PAD + 0.016, -0.12], [Math.PI / 2, 0, 0]),
      ...[-1, 1].flatMap((sx) => [
        on('box', 'line', [0.008, 0.014, 0.24], [sx * 0.4, PAD, -0.12]),
        on('box', 'jade', [0.14, 0.014, 0.18], [sx * 0.32, PAD, -0.12]),
        on('cyl', 'iron', [0.025, 0.36, 0.025], [sx * 0.44, PAD, -0.12]),
        on('box', 'line', [0.015, 0.1, 0.16], [sx * 0.42, PAD + 0.32, -0.12]),
        part('torus', 'signal', [0.07, 0.07, 0.012], [sx * 0.38, PAD + 0.33, -0.12], [Math.PI / 2, 0, 0]),
      ]),
      // 計分板。
      ...[-1, 1].map((sx) => on('box', 'iron', [0.02, 0.4, 0.02], [sx * 0.12, PAD, -0.44])),
      on('rbox', 'iron', [0.3, 0.14, 0.04], [0, PAD + 0.4, -0.44]),
      part('glowbox', 'glow', [0.08, 0.06, 0.012], [-0.07, PAD + 0.47, -0.418]),
      part('glowbox', 'glow', [0.08, 0.06, 0.012], [0.07, PAD + 0.47, -0.418]),
      // 球員與球。
      ...[[-0.18, -0.2, 'mustard'], [0.14, -0.04, 'jade'], [0.24, -0.24, 'mustard'], [-0.06, -0.02, 'jade']].flatMap(([x, z, shirt]) =>
        place(person({ shirt, pants: shirt === 'jade' ? 'line' : 'iron' }), { x, z })),
      part('sphere', 'court', [0.05, 0.05, 0.05], [0.04, PAD + 0.24, -0.1]),
      // 看台。
      // 矮看台在球場南側（靠鏡頭），三階都低，不擋球場。
      ...[0, 1, 2].map((i) => on('box', i % 2 ? 'stone' : 'wood', [0.6, 0.025 + i * 0.025, 0.07], [0, PAD, 0.22 + i * 0.07])),
      // 觀眾坐在第一、二排的頂面上。
      ...[[-0.2, 0], [0.1, 1], [0.22, 0]].flatMap(([x, row], i) =>
        lift(place(person({ shirt: ['rose', 'ochre', 'line'][i], h: 0.16 }), { x, z: 0.22 + row * 0.07, yaw: Math.PI }), 0.025 + row * 0.025)),
    ],
  },
  // 公園綠地：溜滑梯、鞦韆、蹺蹺板、池塘、步道、大樹與花圃。
  parks: {
    name: '公園與遊戲場',
    build: () => [
      ...pad('grass'),
      // 步道。
      on('rbox', 'sand', [0.14, 0.01, 0.96], [0.02, PAD, 0]),
      // 池塘。
      on('cyl', 'stone', [0.34, 0.03, 0.26], [-0.26, PAD, 0.2]),
      on('cyl', 'water', [0.3, 0.034, 0.22], [-0.26, PAD, 0.2]),
      part('sphere', 'line', [0.05, 0.04, 0.04], [-0.3, PAD + 0.05, 0.18]),
      part('sphere', 'line', [0.025, 0.025, 0.025], [-0.27, PAD + 0.08, 0.18]),
      part('cone', 'mustard', [0.015, 0.02, 0.015], [-0.255, PAD + 0.08, 0.18], [0, 0, -Math.PI / 2]),
      // 溜滑梯。
      on('rbox', 'mustard', [0.12, 0.2, 0.12], [0.28, PAD, -0.3]),
      on('hip', 'roof', [0.16, 0.08, 0.16], [0.28, PAD + 0.28, -0.3]),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on('box', 'iron', [0.012, 0.08, 0.012], [0.28 + sx * 0.055, PAD + 0.2, -0.3 + sz * 0.055]))),
      part('box', 'jade', [0.07, 0.012, 0.26], [0.28, PAD + 0.11, -0.13], [0.7, 0, 0]),
      ...[0.06, 0.12].map((y) => part('box', 'iron', [0.08, 0.008, 0.008], [0.28, PAD + y, -0.38])),
      // 鞦韆。
      ...[-1, 1].map((sx) => part('box', 'iron', [0.015, 0.28, 0.015], [-0.26 + sx * 0.16, PAD + 0.14, -0.3], [0.2, 0, 0])),
      ...[-1, 1].map((sx) => part('box', 'iron', [0.015, 0.28, 0.015], [-0.26 + sx * 0.16, PAD + 0.14, -0.3], [-0.2, 0, 0])),
      on('box', 'iron', [0.34, 0.015, 0.015], [-0.26, PAD + 0.27, -0.3]),
      ...[-0.06, 0.06].flatMap((dx) => [
        ...[-1, 1].map((sx) => on('box', 'metal', [0.004, 0.18, 0.004], [-0.26 + dx + sx * 0.025, PAD + 0.09, -0.3])),
        on('box', 'signal', [0.07, 0.012, 0.04], [-0.26 + dx, PAD + 0.085, -0.3]),
      ]),
      // 蹺蹺板。
      on('cyl', 'iron', [0.04, 0.05, 0.04], [0.3, PAD, 0.02]),
      part('box', 'court', [0.3, 0.015, 0.04], [0.3, PAD + 0.06, 0.02], [0, 0, 0.2]),
      // 大樹、花圃、長椅、遊玩的孩子。
      ...place(roundTree({ h: 0.46, r: 0.14 }), { x: 0.34, z: 0.33 }),
      ...place(roundTree({ h: 0.4, crown: 'leafLight' }), { x: -0.38, z: -0.06 }),
      ...place(flowerBed({ bloom: 'rose' }), { x: 0.24, z: 0.2 }),
      ...place(bench(), { x: -0.12, z: 0.4, yaw: Math.PI / 2 }),
      ...place(person({ shirt: 'rose', hat: 'mustard', h: 0.15 }), { x: 0.16, z: -0.14 }),
      ...place(person({ shirt: 'jade', h: 0.15 }), { x: -0.08, z: -0.12 }),
      ...place(person({ shirt: 'ochre', h: 0.21 }), { x: 0.02, z: 0.14 }),
    ],
  },
  // 民政：區公所，服務窗口、公布欄、郵筒、排隊的人。
  'civil-affairs': {
    name: '區公所與公布欄',
    build: () => [
      ...pad('stone'),
      on('rbox', 'wall', [0.7, 0.34, 0.3], [0, PAD, -0.28]),
      on('box', 'roofDark', [0.74, 0.03, 0.34], [0, PAD + 0.34, -0.28]),
      on('rbox', 'cream', [0.26, 0.1, 0.06], [0, PAD + 0.37, -0.26]),
      ...windowsRow({ y: PAD + 0.25, z: -0.124, xs: [-0.26, -0.14, 0.14, 0.26] }),
      // 入口、服務窗口。
      on('box', 'glass', [0.18, 0.18, 0.012], [0, PAD, -0.124]),
      on('box', 'stone', [0.3, 0.03, 0.1], [0, PAD, -0.08]),
      part('glowbox', 'glow', [0.16, 0.08, 0.012], [-0.24, PAD + 0.12, -0.124]),
      on('box', 'wood', [0.18, 0.02, 0.05], [-0.24, PAD + 0.08, -0.1]),
      // 雨庇。
      on('box', 'jade', [0.3, 0.02, 0.12], [0, PAD + 0.2, -0.07]),
      // 公布欄。
      ...[-1, 1].map((sx) => on('box', 'timber', [0.02, 0.26, 0.02], [0.3 + sx * 0.12, PAD, 0.08])),
      on('rbox', 'wood', [0.26, 0.16, 0.025], [0.3, PAD + 0.1, 0.08]),
      ...[[0.22, 'line'], [0.29, 'mustard'], [0.36, 'line'], [0.255, 'rose'], [0.33, 'line']].map(([x, c], i) =>
        part('box', c, [0.05, 0.06, 0.004], [x, PAD + (i < 3 ? 0.21 : 0.14), 0.094])),
      on('hip', 'roofDark', [0.3, 0.06, 0.08], [0.3, PAD + 0.26, 0.08]),
      // 郵筒。
      on('rbox', 'mustard', [0.07, 0.14, 0.07], [-0.4, PAD, 0.04]),
      on('rbox', 'signal', [0.07, 0.14, 0.07], [-0.31, PAD, 0.04]),
      ...[-0.4, -0.31].map((x) => part('dome', 'iron', [0.075, 0.03, 0.075], [x, PAD + 0.155, 0.04])),
      // 排隊的人。
      ...[[-0.24, 0.0, 'jade'], [-0.2, 0.14, 'rose'], [-0.14, 0.28, 'ochre'], [0.1, 0.26, 'mustard']].flatMap(([x, z, shirt]) =>
        place(person({ shirt }), { x, z, yaw: Math.PI })),
      ...place(flowerBed({ w: 0.2 }), { x: 0.32, z: 0.34 }),
      ...place(roundTree({ h: 0.34 }), { x: 0.37, z: -0.37 }),
      ...place(lamp(), { x: -0.42, z: 0.36 }),
    ],
  },
  // 數位發展：通訊鐵塔、碟形天線、機房（燈號）、拿平板的人。
  digital: {
    name: '通訊塔與機房',
    build: () => [
      ...pad('stone'),
      // 機房。
      on('rbox', 'stone', [0.5, 0.26, 0.3], [-0.2, PAD, -0.24]),
      on('box', 'iron', [0.52, 0.03, 0.32], [-0.2, PAD + 0.26, -0.24]),
      ...[-0.36, -0.26, -0.16, -0.06].flatMap((x) => [
        on('rbox', 'iron', [0.07, 0.2, 0.012], [x, PAD + 0.02, -0.084]),
        part('glowbox', 'jade', [0.02, 0.012, 0.006], [x - 0.015, PAD + 0.16, -0.077]),
        part('glowbox', 'glow', [0.02, 0.012, 0.006], [x + 0.015, PAD + 0.12, -0.077]),
      ]),
      // 碟形天線。
      on('cyl', 'metal', [0.03, 0.08, 0.03], [-0.3, PAD + 0.29, -0.28]),
      part('dome', 'line', [0.16, 0.06, 0.16], [-0.3, PAD + 0.42, -0.27], [-0.9, 0, 0]),
      part('cyl', 'iron', [0.01, 0.08, 0.01], [-0.3, PAD + 0.45, -0.22], [0.7, 0, 0]),
      // 通訊鐵塔：三根斜柱、橫撐、頂端燈。
      ...[0, 2.094, 4.189].map((a) => part('cyl', 'metal', [0.02, 0.9, 0.02], [0.28 + Math.sin(a) * 0.06, PAD + 0.45, -0.24 + Math.cos(a) * 0.06], [Math.cos(a) * 0.1, 0, -Math.sin(a) * 0.1])),
      ...[0.2, 0.4, 0.6, 0.8].map((y) => part('torus', 'metal', [0.22 - y * 0.15, 0.22 - y * 0.15, 0.015], [0.28, PAD + y, -0.24], [Math.PI / 2, 0, 0])),
      on('cyl', 'iron', [0.012, 0.16, 0.012], [0.28, PAD + 0.9, -0.24]),
      part('glowsphere', 'signal', [0.04, 0.04, 0.04], [0.28, PAD + 1.07, -0.24]),
      ...[-1, 1].map((sx) => part('rbox', 'line', [0.04, 0.12, 0.02], [0.28 + sx * 0.06, PAD + 0.74, -0.24], null, sx * 0.5)),
      // 戶外資訊亭與使用者。
      on('rbox', 'jade', [0.12, 0.26, 0.06], [0.06, PAD, 0.14]),
      part('glowbox', 'glow', [0.09, 0.1, 0.006], [0.06, PAD + 0.18, 0.173]),
      ...place([...person({ shirt: 'mustard' }), part('box', 'iron', [0.05, 0.035, 0.006], [0.04, PAD + 0.12, 0.04], [-0.5, 0, 0])], { x: -0.22, z: 0.22 }),
      ...place(person({ shirt: 'rose', h: 0.18 }), { x: 0.06, z: 0.3, yaw: Math.PI }),
      ...place(bench(), { x: 0.32, z: 0.3 }),
      ...place(bush(), { x: 0.42, z: 0.08 }),
      ...place(roundTree({ h: 0.34 }), { x: -0.38, z: 0.36 }),
    ],
  },
  // 市政治理：市政廳加鐘塔，列柱、山牆、台階、草坪。造型是通用的市政廳，不是任何真實建築。
  'city-governance': {
    name: '市政廳與鐘塔',
    build: () => [
      ...pad('grass'),
      // 台基與台階。
      on('rbox', 'stone', [0.8, 0.05, 0.46], [0, PAD, -0.2]),
      ...[0, 1, 2].map((i) => on('box', 'stone', [0.3, 0.05 - i * 0.015, 0.05], [0, PAD, 0.055 + i * 0.05])),
      // 主體、列柱、山牆。
      on('rbox', 'cream', [0.72, 0.3, 0.3], [0, PAD + 0.05, -0.26]),
      ...[-0.27, -0.16, -0.05, 0.05, 0.16, 0.27].map((x) => on('cyl', 'line', [0.04, 0.26, 0.04], [x, PAD + 0.05, -0.08])),
      on('box', 'stone', [0.66, 0.04, 0.1], [0, PAD + 0.31, -0.09]),
      part('prism', 'wall', [0.66, 0.12, 0.1], [0, PAD + 0.41, -0.09]),
      on('box', 'roofDark', [0.76, 0.03, 0.34], [0, PAD + 0.35, -0.26]),
      ...windowsRow({ y: PAD + 0.22, z: -0.106, xs: [-0.22, -0.11, 0.11, 0.22], h: 0.1 }),
      on('box', 'timber', [0.08, 0.16, 0.012], [0, PAD + 0.05, -0.106]),
      // 鐘塔。
      on('rbox', 'wall', [0.18, 0.66, 0.18], [0, PAD + 0.35, -0.3]),
      ...[-1, 1].map((sx) => on('box', 'stone', [0.2, 0.025, 0.2], [0, PAD + (sx > 0 ? 0.98 : 0.68), -0.3])),
      part('cyl', 'line', [0.12, 0.12, 0.02], [0, PAD + 0.86, -0.205], [Math.PI / 2, 0, 0]),
      part('torus', 'iron', [0.13, 0.13, 0.02], [0, PAD + 0.86, -0.2]),
      part('box', 'iron', [0.008, 0.05, 0.01], [0, PAD + 0.88, -0.192]),
      part('box', 'iron', [0.035, 0.008, 0.01], [0.015, PAD + 0.86, -0.192]),
      on('hip', 'roof', [0.24, 0.2, 0.24], [0, PAD + 1.0, -0.3]),
      part('glowsphere', 'glow', [0.035, 0.035, 0.035], [0, PAD + 1.22, -0.3]),
      // 草坪、樹、長椅、路燈、市民。
      ...[-1, 1].flatMap((sx) => [
        ...place(roundTree({ h: 0.38 }), { x: sx * 0.37, z: 0.28 }),
        ...place(flowerBed({ w: 0.2 }), { x: sx * 0.24, z: 0.34 }),
        ...place(lamp(), { x: sx * 0.2, z: 0.14 }),
      ]),
      ...place(person({ shirt: 'jade' }), { x: -0.1, z: 0.26 }),
      ...place(person({ shirt: 'rose', h: 0.18 }), { x: 0.08, z: 0.3 }),
    ],
  },
};

// 對不到專屬場景的議題區（例如測試夾具）用的通用場景：小屋、樹與花圃。仍只依識別碼決定。
const GENERIC = {
  name: '小屋與花園',
  build: () => [
    ...pad('grass'),
    ...place(house({ w: 0.44, d: 0.34, h: 0.28 }), { x: -0.08, z: -0.18 }),
    ...place(roundTree({ h: 0.4 }), { x: 0.34, z: -0.3 }),
    ...place(pine({ h: 0.4 }), { x: -0.38, z: -0.36 }),
    ...place(flowerBed(), { x: -0.18, z: 0.24 }),
    ...place(flowerBed({ bloom: 'mustard' }), { x: 0.14, z: 0.24 }),
    ...place(bench(), { x: 0.32, z: 0.06, yaw: -Math.PI / 2 }),
    ...place(person({ shirt: 'jade' }), { x: 0.0, z: 0.38 }),
    ...place(lamp(), { x: 0.4, z: 0.36 }),
  ],
};

const build = (id, scene) => Object.freeze({ id, name: scene.name, parts: Object.freeze(scene.build()) });
export const HERO_SCENES = Object.freeze(Object.fromEntries(Object.entries(SCENES).map(([id, scene]) => [id, build(id, scene)])));
const GENERIC_SCENE = build('generic', GENERIC);

const rotX = (a, [x, y, z]) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = (a, [x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotZ = (a, [x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

// 零件的軸對齊外框 { min, max }：單位立方體的八個角照零件的變換算過去（three.js 的 XYZ 歐拉角是 Rx·Ry·Rz）。
// 圓柱、球等形體裝在立方體裡，算出來的外框只會偏大。
export function partBounds({ size, at, rot = [0, 0, 0], yaw = 0 }) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    let v = [sx * size[0], sy * size[1], sz * size[2]];
    v = rotY(yaw, rotX(rot[0], rotY(rot[1], rotZ(rot[2], v))));
    v.forEach((c, i) => {
      min[i] = Math.min(min[i], c + at[i]);
      max[i] = Math.max(max[i], c + at[i]);
    });
  }
  return { min, max };
}

export function sceneBounds(scene) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of scene.parts) {
    const b = partBounds(p);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}

// 議題區的主題場景。只看識別碼。
export function heroSceneFor(areaId) {
  return HERO_SCENES[areaId] ?? GENERIC_SCENE;
}

// 主題場景位置（island-layout.js 每個議題區格子的 heroSlot，數值在 island-body.js 的 TILE_SLOTS.hero）：
// 每座都放大 slot.size 倍（每島同倍率），底面中心放在格心加 (slot.x, slot.z)。
// 放大後不擋到鄰島的標記（預設視角的視線測試在 test/island-motion.test.js）。與政見無關。
export function heroSlotTransform(tile) {
  const slot = tile.heroSlot;
  return {
    x: tile.position.x + slot.x,
    z: tile.position.z + slot.z,
    scale: slot.size,
    yaw: slot.facing,
  };
}

// 每個議題區格子的主題場景與擺放：{ areaId, sceneId, transform: { x, z, scale, yaw } }。
// 只讀格子的識別碼、種類、位置與主題場景位置，不讀標記亮暗與政見。slotOf(tile) 決定擺放。
export function heroPlan(layout, { slotOf = heroSlotTransform } = {}) {
  return layout.tiles
    .filter((tile) => tile.kind === 'area')
    .map((tile) => ({ areaId: tile.id, sceneId: heroSceneFor(tile.id).id, transform: slotOf(tile) }));
}
