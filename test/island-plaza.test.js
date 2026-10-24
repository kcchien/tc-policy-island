import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { figureDestinations, figureLook, figurePose, plazaLayout, walkPlan, walkPose } from '../site/js/island-plaza.js';
import { makeRaw } from './fixtures/make-raw.js';
import { assertFaceVisible } from './fixtures/face.js';

const layoutOf = (raw) => islandLayout(buildViewModel(buildPublicDataset(raw)));
// 行走姿勢取幾個欄位比對；-0 與 0 視為相同。
const pick = (pose, keys = ['x', 'z', 'y', 'legSwing', 'armSwing', 'bob', 'heading']) =>
  Object.fromEntries(keys.map((key) => [key, pose[key] === 0 ? 0 : pose[key]]));

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

  assert.deepEqual([...new Set(figure.parts.map((p) => p.part))].sort(), ['arm', 'body', 'cheek', 'eye', 'hair', 'head', 'leg', 'mouth']);
  assertFaceVisible(figure.parts, { forward: 2 });
  const ratio = (head.radius * 2) / top;
  assert.ok(ratio >= 0.36 && ratio <= 0.44, `頭占身高 ${ratio.toFixed(2)}`);
  // 名牌在頭頂上方。
  assert.ok(figure.labelHeight > top * figure.scale);
  // 每個零件的顏色是人物專用的中性色代號，不含任何影像來源。
  assert.ok(figure.parts.every((p) => ['figure', 'figureHead', 'figureHair', 'figureEye', 'figureCheek'].includes(p.color)), JSON.stringify(figure.parts.map((p) => p.color)));
  assert.ok(!JSON.stringify(figure).match(/texture|image|photo|url/i));
});

test('人物配置不受政見資料影響', () => {
  const raw = withDecorativeTiles();
  const withPolicies = plazaLayout(layoutOf(raw));
  raw.policies = [];

  assert.deepEqual(plazaLayout(layoutOf(raw)), withPolicies);
});

test('走到同一格：三人的目的地依排序規則同一排、等距，各自站在自己標記的正後方（北側），與標記的相對位置相同', () => {
  const layout = layoutOf(withDecorativeTiles());
  const tile = layout.tiles.find((t) => t.id === 'area-a');

  const destinations = figureDestinations(layout, 'area-a');

  assert.deepEqual(destinations.map((d) => d.candidateId), ['cand-a', 'cand-b', 'cand-c']);
  const relative = destinations.map((d, i) => ({
    x: d.position.x - (tile.position.x + tile.markers[i].offset.x),
    z: d.position.z - (tile.position.z + tile.markers[i].offset.z),
  }));
  // 正後方 0.2：標記在人物與南方的鏡頭之間，人物不擋牌面。
  for (const r of relative) {
    assert.ok(Math.abs(r.x) < 1e-9, `東西偏移 ${r.x}`);
    assert.ok(Math.abs(r.z + 0.2) < 1e-9, `南北偏移 ${r.z}`);
  }
  const [a, b, c] = destinations.map((d) => d.position);
  assert.ok(Math.abs((b.x - a.x) - 0.42) < 1e-9 && Math.abs((c.x - b.x) - 0.42) < 1e-9);
});

test('走到同一格：沒有政見的人也有目的地，目的地不受政見資料影響', () => {
  const raw = withDecorativeTiles();
  const layout = layoutOf(raw);
  // 夾具的 cand-c 在 area-a 沒有政見（灰色標記），area-b 三人都沒有。
  assert.equal(layout.tiles.find((t) => t.id === 'area-a').markers[2].lit, false);
  const before = figureDestinations(layout, 'area-b');
  raw.policies = [];

  assert.equal(figureDestinations(layout, 'area-a').length, 3);
  assert.deepEqual(figureDestinations(layoutOf(raw), 'area-b'), before);
  assert.deepEqual(figureDestinations(layoutOf(raw), 'area-a'), figureDestinations(layout, 'area-a'));
  // 不是議題區的格子沒有目的地。
  assert.deepEqual(figureDestinations(layout, 'tile-east'), []);
  assert.deepEqual(figureDestinations(layout, 'nope'), []);
});

test('行走路徑固定時長：遠近都在同一個時間抵達，起訖是靜止姿勢、面向南方，途中面向行進方向', () => {
  const [figure] = plazaLayout(layoutOf(withDecorativeTiles())).figures;
  const from = { x: 0, z: 0 };
  const near = walkPlan(from, { x: 0, z: -2 }, figure.walk);
  const far = walkPlan(from, { x: 0, z: -12 }, figure.walk);

  assert.equal(near.departSeconds, 0);
  assert.equal(near.arriveSeconds, far.arriveSeconds);
  assert.ok(near.arriveSeconds >= 1 && near.arriveSeconds <= 2.5, `${near.arriveSeconds} 秒`);
  const rest = { legSwing: 0, armSwing: 0, bob: 0, heading: 0 };
  assert.deepEqual(pick(walkPose(far, figure.walk, 0)), { x: 0, z: 0, y: 0, ...rest });
  assert.deepEqual(pick(walkPose(far, figure.walk, far.arriveSeconds)), { x: 0, z: -12, y: 0, ...rest });
  assert.deepEqual(pick(walkPose(far, figure.walk, far.arriveSeconds + 5)), { x: 0, z: -12, y: 0, ...rest });
  assert.equal(walkPose(far, figure.walk, far.arriveSeconds).arrived, true);
  // 起訖放慢、中途最快，一半時間走到一半；往北走時背對鏡頭（朝 -z 是 π）。
  const middle = walkPose(far, figure.walk, far.arriveSeconds / 2);
  assert.ok(Math.abs(middle.z + 6) < 1e-9, `${middle.z}`);
  assert.ok(Math.abs(Math.abs(middle.heading) - Math.PI) < 1e-9, `${middle.heading}`);
  assert.equal(middle.arrived, false);
  // 途中有步伐：在某些時刻腿與手臂擺動。
  const swings = [0.3, 0.5, 0.7].map((k) => walkPose(far, figure.walk, far.arriveSeconds * k).legSwing);
  assert.ok(swings.some((s) => Math.abs(s) > 0.1), JSON.stringify(swings));
});

test('行走路徑的高度：走上抬高的選中格時在接近終點才踏上去，離開時一出發就踏下來', () => {
  const [figure] = plazaLayout(layoutOf(withDecorativeTiles())).figures;
  const up = walkPlan({ x: 0, z: 0, y: 0 }, { x: 0, z: -6, y: 0.12 }, figure.walk);
  const down = walkPlan({ x: 0, z: -6, y: 0.12 }, { x: 0, z: 0, y: 0 }, figure.walk);

  assert.equal(walkPose(up, figure.walk, up.arriveSeconds / 2).y, 0);
  assert.equal(walkPose(up, figure.walk, up.arriveSeconds).y, 0.12);
  assert.equal(walkPose(down, figure.walk, 0).y, 0.12);
  assert.equal(walkPose(down, figure.walk, down.arriveSeconds / 2).y, 0);
});

test('走到同一格：三人同時出發、同時抵達，任一時刻的位移、朝向與步伐完全相同（三條路徑是同一條平移）', () => {
  const layout = layoutOf(withDecorativeTiles());
  const plaza = plazaLayout(layout);
  for (const areaId of ['area-a', 'area-b']) {
    const destinations = figureDestinations(layout, areaId);
    const plans = plaza.figures.map((f, i) => walkPlan(f.position, destinations[i].position, f.walk));

    assert.deepEqual(new Set(plans.map((p) => `${p.departSeconds}/${p.arriveSeconds}`)).size, 1);
    for (const k of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      const poses = plans.map((p, i) => {
        const { x, z, ...rest } = walkPose(p, plaza.figures[i].walk, p.arriveSeconds * k);
        return { dx: x - p.from.x, dz: z - p.from.z, ...rest };
      });
      for (const pose of poses.slice(1)) {
        for (const key of Object.keys(pose)) {
          assert.ok(typeof pose[key] === 'boolean' ? pose[key] === poses[0][key] : Math.abs(pose[key] - poses[0][key]) < 1e-9, `${areaId} k=${k} ${key}`);
        }
      }
    }
    // 抵達時正好站在目的地。
    plans.forEach((p, i) => assert.deepEqual(pick(walkPose(p, plaza.figures[i].walk, p.arriveSeconds), ['x', 'z']), destinations[i].position));
  }
});

test('減少動態時行走時長為 0：一開始就在目的地', () => {
  const [figure] = plazaLayout(layoutOf(withDecorativeTiles())).figures;
  const plan = walkPlan({ x: 0, z: 0 }, { x: 3, z: -4, y: 0.12 }, { ...figure.walk, durationSeconds: 0 });

  assert.equal(plan.arriveSeconds, 0);
  assert.deepEqual(pick(walkPose(plan, figure.walk, 0), ['x', 'z', 'y', 'arrived']), { x: 3, z: -4, y: 0.12, arrived: true });
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
