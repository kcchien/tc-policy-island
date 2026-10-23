// 候選人廣場與候選人人物的配置。只做計算，不碰 three.js，瀏覽器與 Node 共用，不 import 其他模組：
// 上線關卡「人物一致」直接載入網站目錄裡的這一份來檢查。
// 三人同一款中性人物（ADR 0001）：幾何、尺寸、材質、待機動畫參數完全相同，不模仿長相，
// 只以頭上的 ○△□ 名牌、腳下同形狀的底座與廣場名牌上的姓名區分，依排序規則由西到東並排，不在島上移動。

// 人物由這些零件組成（相對腳底中心，y 朝上，人物面向 +z 也就是南方的鏡頭）。
// shape 是 'cylinder'（radiusTop、radiusBottom、height）、'sphere'（radius）、'capsule'（radius、中段長 length）、
// 'dome'（髮殼：蓋住頭頂 cover × 180 度的半球殼，往後腦傾斜 tilt 弧度）、'disc'（腮紅：radius、thickness）
// 或 'arc'（微笑線：半圓弧，radius、tube），at 是零件中心；腮紅與微笑線貼在頭上、朝外。
// color 是 island-models.js 的 PALETTE 代號，只用人物專用的中性色。
// Q 版大頭：頭的直徑約占身高四成，短髮殼只蓋頭頂與後腦，臉上只有圓點眼睛、腮紅與微笑線，不模仿任何人的長相。
export const FIGURE_PARTS = [
  { part: 'leg', shape: 'cylinder', radiusTop: 0.03, radiusBottom: 0.026, height: 0.13, at: [-0.038, 0.065, 0], color: 'figure' },
  { part: 'leg', shape: 'cylinder', radiusTop: 0.03, radiusBottom: 0.026, height: 0.13, at: [0.038, 0.065, 0], color: 'figure' },
  { part: 'body', shape: 'capsule', radius: 0.075, length: 0.09, at: [0, 0.24, 0], color: 'figure' },
  { part: 'arm', shape: 'cylinder', radiusTop: 0.024, radiusBottom: 0.02, height: 0.14, at: [-0.086, 0.25, 0], color: 'figure' },
  { part: 'arm', shape: 'cylinder', radiusTop: 0.024, radiusBottom: 0.02, height: 0.14, at: [0.086, 0.25, 0], color: 'figure' },
  { part: 'head', shape: 'sphere', radius: 0.114, at: [0, 0.448, 0], color: 'figureHead' },
  { part: 'hair', shape: 'dome', radius: 0.119, cover: 0.42, tilt: 1, at: [0, 0.448, -0.004], color: 'figureHair' },
  { part: 'eye', shape: 'sphere', radius: 0.016, at: [-0.042, 0.478, 0.102], color: 'figureEye' },
  { part: 'eye', shape: 'sphere', radius: 0.016, at: [0.042, 0.478, 0.102], color: 'figureEye' },
  { part: 'cheek', shape: 'disc', radius: 0.018, thickness: 0.004, at: [-0.064, 0.445, 0.094], color: 'figureCheek' },
  { part: 'cheek', shape: 'disc', radius: 0.018, thickness: 0.004, at: [0.064, 0.445, 0.094], color: 'figureCheek' },
  { part: 'mouth', shape: 'arc', radius: 0.024, tube: 0.005, at: [0, 0.437, 0.113], color: 'figureEye' },
];
// 人物頭頂離腳底的高度（零件的單位，乘上 FIGURE_SCALE 才是場景尺寸），名牌放在頭頂上方 LABEL_GAP。
const FIGURE_HEIGHT = 0.57;
const FIGURE_SCALE = 1.4;
const LABEL_GAP = 0.1;

// 待機動畫：輕微呼吸（身體上下伸縮）加左右擺動，週期與幅度三人相同，相位也相同。
// t = 0 是靜止姿勢，減少動態時動畫時間停在 0（island-clock.js），人物就停在這個姿勢。
export const FIGURE_IDLE = { kind: 'breathe', periodSeconds: 3.6, breath: 0.035, sway: 0.05, phase: 0 };

// 三人在廣場南半並排，間距與議題區格子上的標記相同；北半留給格子原本的在地感元素。
const FIGURE_SPACING = 0.42;
const FIGURE_ROW_Z = 0.42;
const SIGN_Z = 1;

// 廣場是最南排的裝飾格（離預設鏡頭最近，人物不會擋到後方議題區的標記），同一排取最西的一格。
function plazaTileOf(layout) {
  const decorative = layout.tiles.filter((tile) => tile.kind === 'decorative');
  const [r, q] = [(t) => t.axial[1], (t) => t.axial[0]];
  return decorative.reduce((best, tile) => (!best || r(tile) > r(best) || (r(tile) === r(best) && q(tile) < q(best)) ? tile : best), null);
}

// layout 是 islandLayout 的結果，只用裝飾格的位置與候選人圖例（排序與形狀），不讀政見。
export function plazaLayout(layout) {
  const tile = plazaTileOf(layout);
  if (!tile) return { tile: null, figures: [] };
  const offset = (layout.legend.length - 1) / 2;
  const figures = layout.legend.map((entry, index) => ({
    candidateId: entry.candidateId,
    name: entry.name,
    symbol: entry.symbol,
    shape: entry.shape,
    sides: entry.sides,
    start: entry.start,
    // 底座的外接圓半徑依形狀不同；面積由 pad.size 決定，三人相同。
    padRadius: entry.radius,
    pad: { size: entry.size, color: 'figurePad', thickness: 0.5 },
    position: { x: tile.position.x + (index - offset) * FIGURE_SPACING, z: tile.position.z + FIGURE_ROW_Z },
    facing: 0,
    scale: FIGURE_SCALE,
    labelHeight: FIGURE_HEIGHT * FIGURE_SCALE + LABEL_GAP,
    // 零件的多邊形細分（圓柱邊數；球體、膠囊與髮殼繞一圈 2 倍、上下 segments 段）與點選範圍的半徑。
    segments: 8,
    hitRadius: 0.19,
    // 每個人物各自一份，關卡才抓得到單一人物被改動。
    parts: structuredClone(FIGURE_PARTS),
    idle: { ...FIGURE_IDLE },
  }));
  // 廣場名牌掛在格子南端：三人的姓名寫在一起、依排序並列。姓名放在各自頭上會互疊，後畫的蓋住先畫的。
  const sign = { x: tile.position.x, z: tile.position.z + SIGN_Z };
  return { tile: { id: tile.id, position: { ...tile.position } }, sign, figures };
}

// 人物的外觀參數：去掉身分（候選人、名牌、形狀）與位置後剩下的部分，三人必須完全相同。
export function figureLook({ candidateId, name, symbol, shape, sides, start, padRadius, position, ...look }) {
  return look;
}

// 待機動畫在動畫時間 t（秒）的姿勢：身體高度倍率 stretch 與左右擺動角 tilt（弧度）。
export function figurePose(idle, t) {
  const a = 2 * Math.PI * (t / idle.periodSeconds + idle.phase);
  return { stretch: 1 + (idle.breath * (1 - Math.cos(a))) / 2, tilt: idle.sway * Math.sin(a) };
}
