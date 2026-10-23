import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { figureLook, figurePose, plazaLayout } from '../site/js/island-plaza.js';
import { makeRaw } from './fixtures/make-raw.js';

const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));

// 正式資料的兩個裝飾格：東端在北排，西南角在最南排。
function withDecorativeTiles(raw = makeRaw()) {
  raw.decorativeTiles = [
    { id: 'tile-east', axial: [4, -2], localElementId: null },
    { id: 'tile-south-east', axial: [1, 2], localElementId: null },
    { id: 'tile-south-west', axial: [-1, 2], localElementId: null },
  ];
  return raw;
}

test('候選人廣場是最南排的裝飾格，同一排取最西的一格', () => {
  const plaza = plazaLayout(layoutOf(withDecorativeTiles()));

  assert.equal(plaza.tile.id, 'tile-south-west');
});

test('沒有裝飾格時沒有候選人廣場，也沒有人物', () => {
  const plaza = plazaLayout(layoutOf(makeRaw()));

  assert.equal(plaza.tile, null);
  assert.deepEqual(plaza.figures, []);
});

test('三個人物依排序規則由西到東並排在廣場南半，配 ○ △ □，間距相同', () => {
  const plaza = plazaLayout(layoutOf(withDecorativeTiles()));

  // 夾具候選人依筆畫：甲 6、乙 7、丙 9。
  assert.deepEqual(plaza.figures.map((f) => [f.candidateId, f.name, f.symbol]), [
    ['cand-a', '候選人甲', '○'],
    ['cand-b', '候選人乙', '△'],
    ['cand-c', '候選人丙', '□'],
  ]);
  const [a, b, c] = plaza.figures.map((f) => f.position);
  const center = plaza.tile.position;
  assert.ok(a.x < b.x && b.x < c.x);
  assert.ok(Math.abs((b.x - a.x) - (c.x - b.x)) < 1e-9);
  assert.equal(b.x, center.x);
  assert.ok(a.z === b.z && b.z === c.z && a.z > center.z, '同一列、在格心南側');
  // 間距與議題區格子上的標記相同，底座與標記同尺寸。
  const layout = layoutOf(withDecorativeTiles());
  const markers = layout.tiles.find((t) => t.kind === 'area').markers;
  assert.ok(Math.abs((b.x - a.x) - (markers[1].offset.x - markers[0].offset.x)) < 1e-9);
  assert.deepEqual(plaza.figures.map((f) => f.padRadius), markers.map((m) => m.radius));
});

test('抽籤後依號次排：號次改變人物順序跟著變', () => {
  const raw = withDecorativeTiles();
  const ballots = { 'cand-a': 3, 'cand-b': 1, 'cand-c': 2 };
  for (const c of raw.candidates) c.ballotNumber = ballots[c.id];

  const plaza = plazaLayout(layoutOf(raw));

  assert.deepEqual(plaza.figures.map((f) => [f.candidateId, f.symbol]), [['cand-b', '○'], ['cand-c', '△'], ['cand-a', '□']]);
});

test('三個人物的幾何、尺寸、材質與待機動畫參數完全相同，只有身分與位置不同', () => {
  const plaza = plazaLayout(layoutOf(withDecorativeTiles()));

  const looks = plaza.figures.map(figureLook);
  assert.deepEqual(looks[1], looks[0]);
  // 外觀不含身分與位置，但含底座面積。
  assert.deepEqual(Object.keys(looks[0]).filter((key) => ['candidateId', 'name', 'symbol', 'position'].includes(key)), []);
  assert.equal(looks[0].pad.size, plaza.figures[2].pad.size);
  assert.deepEqual(looks[2], looks[0]);
  assert.ok(looks[0].parts.length > 0);
  assert.ok(looks[0].idle.periodSeconds > 0);
  // 每個人物是各自的物件，關卡才能抓到單一人物被改動。
  assert.notEqual(plaza.figures[0].parts, plaza.figures[1].parts);
});

test('候選人人物是 Q 版中性造型：大頭（約占身高四成）、髮殼、圓點眼睛，只用中性色，不用照片或貼圖', () => {
  const [figure] = plazaLayout(layoutOf(withDecorativeTiles())).figures;
  const head = figure.parts.find((p) => p.part === 'head');
  const top = Math.max(...figure.parts.map((p) => p.at[1] + (p.radius ?? p.height / 2)));

  assert.deepEqual([...new Set(figure.parts.map((p) => p.part))].sort(), ['arm', 'body', 'eye', 'hair', 'head', 'leg']);
  const ratio = (head.radius * 2) / top;
  assert.ok(ratio >= 0.36 && ratio <= 0.44, `頭占身高 ${ratio.toFixed(2)}`);
  // 名牌在頭頂上方。
  assert.ok(figure.labelHeight > top * figure.scale);
  // 每個零件的顏色是人物專用的中性色代號，不含任何影像來源。
  assert.ok(figure.parts.every((p) => ['figure', 'figureHead', 'figureHair', 'figureEye'].includes(p.color)), JSON.stringify(figure.parts.map((p) => p.color)));
  assert.ok(!JSON.stringify(figure).match(/texture|image|photo|url/i));
});

test('人物配置不受政見資料影響', () => {
  const raw = withDecorativeTiles();
  const withPolicies = plazaLayout(layoutOf(raw));
  raw.policies = [];

  assert.deepEqual(plazaLayout(layoutOf(raw)), withPolicies);
});

test('待機動畫在動畫時間 0 是靜止姿勢（減少動態時停在這裡），之後只有輕微擺動', () => {
  const [figure] = plazaLayout(layoutOf(withDecorativeTiles())).figures;

  assert.deepEqual(figurePose(figure.idle, 0), { stretch: 1, tilt: 0 });
  for (const t of [0.4, 1.3, 2.9]) {
    const pose = figurePose(figure.idle, t);
    assert.ok(pose.stretch >= 1 && pose.stretch <= 1.05, `t=${t} 伸縮 ${pose.stretch}`);
    assert.ok(Math.abs(pose.tilt) <= 0.06, `t=${t} 擺動 ${pose.tilt}`);
  }
  assert.notDeepEqual(figurePose(figure.idle, 0.9), figurePose(figure.idle, 0));
});
