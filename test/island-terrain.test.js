import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import {
  ambientAt, OUTSKIRTS_DETAIL, planOutskirts, RIDGE_RINGS, SEA_LEVEL, TERRACE_STEP,
} from '../site/js/island-terrain.js';
import { createAnimator } from '../site/js/island-clock.js';
import { makeRaw } from './fixtures/make-raw.js';

// 夾具的兩個議題區加上一圈裝飾格，島有一點大小，外圍才排得下樹與霧。
const layoutOf = (mutate = () => {}) => {
  const raw = makeRaw();
  raw.decorativeTiles = [[2, 0], [-1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [-1, 1], [2, -1]]
    .map((axial, i) => ({ id: `tile-${i}`, axial, localElementId: null }));
  mutate(raw);
  return islandLayout(buildViewModel(buildPublicDataset(raw)));
};

test('樹與霧的數量依畫質遞減：高 > 中 > 低，配置照畫質的數量排滿', () => {
  const layout = layoutOf();
  const plans = ['high', 'medium', 'low'].map((quality) => planOutskirts(layout, { quality }));

  for (const [i, quality] of ['high', 'medium', 'low'].entries()) {
    assert.equal(plans[i].trees.length, OUTSKIRTS_DETAIL[quality].trees);
    assert.equal(plans[i].fogBanks.length, OUTSKIRTS_DETAIL[quality].fogBanks);
  }
  const [high, medium, low] = plans;
  assert.ok(high.trees.length > medium.trees.length && medium.trees.length > low.trees.length);
  assert.ok(high.fogBanks.length > medium.fogBanks.length && medium.fogBanks.length > low.fogBanks.length);
});

test('背景樹數千棵，分針葉與闊葉兩種，數量依畫質遞減；針葉多長在較高的山坡', () => {
  const layout = layoutOf();
  const plans = Object.fromEntries(['high', 'medium', 'low'].map((quality) => [quality, planOutskirts(layout, { quality })]));
  const count = (plan, kind) => plan.trees.filter((t) => t.kind === kind).length;

  assert.ok(plans.high.trees.length >= 2500, `高畫質 ${plans.high.trees.length} 棵`);
  assert.ok(plans.high.trees.length > plans.medium.trees.length && plans.medium.trees.length > plans.low.trees.length);
  for (const [quality, plan] of Object.entries(plans)) {
    assert.ok(count(plan, 'conifer') > 0 && count(plan, 'broadleaf') > 0, `${quality} 兩種樹都有`);
    assert.equal(count(plan, 'conifer') + count(plan, 'broadleaf'), plan.trees.length);
  }
  const meanY = (kind) => {
    const trees = plans.high.trees.filter((t) => t.kind === kind);
    return trees.reduce((sum, t) => sum + t.y, 0) / trees.length;
  };
  assert.ok(meanY('conifer') > meanY('broadleaf'), `針葉平均高度 ${meanY('conifer').toFixed(2)}、闊葉 ${meanY('broadleaf').toFixed(2)}`);
});

test('雲、海上的小島與帆船依畫質遞減，至少一座燈塔', () => {
  const layout = layoutOf();
  const [high, medium, low] = ['high', 'medium', 'low'].map((quality) => planOutskirts(layout, { quality }));
  for (const key of ['clouds', 'boats', 'islets']) {
    assert.ok(high[key].length >= medium[key].length && medium[key].length >= low[key].length, key);
    assert.ok(low[key].length > 0, `低畫質也有 ${key}`);
  }
  assert.ok(high.clouds.length >= 12);
  for (const plan of [high, low]) assert.ok(plan.lighthouse, '有燈塔');
});

test('東側山坡有梯田：丘陵上的高度集中在台階的踏面，不是平順的坡', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const { maxX, minZ, maxZ } = layout.bounds;
  const fractions = [];
  for (let x = maxX + 8; x <= maxX + 40; x += 0.37) {
    for (let z = minZ - 10; z <= maxZ + 10; z += 0.41) {
      const h = plan.heightAt(x, z);
      if (h > 1.4 && h < 7) fractions.push((h % TERRACE_STEP) / TERRACE_STEP);
    }
  }
  assert.ok(fractions.length > 200, `丘陵取樣 ${fractions.length} 點`);
  const onTread = fractions.filter((f) => f < 0.35).length / fractions.length;
  // 平順的坡約 35% 落在踏面附近；有梯田時多數點在踏面上。
  assert.ok(onTread > 0.6, `踏面比例 ${onTread.toFixed(2)}`);
});

test('三圈遠山剪影在地形網格外，西側海上沒有山，越外圈越高；全部在高度上限下方', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  assert.equal(plan.ridges.length, RIDGE_RINGS);
  plan.ridges.forEach((ring, i) => {
    assert.ok(ring.radius > plan.extent * Math.SQRT2, `第 ${i + 1} 圈半徑 ${ring.radius}`);
    if (i > 0) assert.ok(ring.radius > plan.ridges[i - 1].radius);
    const heightAtAngle = (angle) => ring.points.reduce((best, p) => (Math.abs(p.angle - angle) < Math.abs(best.angle - angle) ? p : best)).height;
    // 角度從 +x（東）量起；π 是正西。
    assert.ok(heightAtAngle(0) > 6, `正東 ${heightAtAngle(0)}`);
    for (const p of ring.points) {
      assert.ok(Math.cos(p.angle) > -0.75 || p.height <= SEA_LEVEL, `西側 ${p.angle.toFixed(2)} 高 ${p.height}`);
      const x = plan.center.x + Math.cos(p.angle) * ring.radius;
      const z = plan.center.z + Math.sin(p.angle) * ring.radius;
      assert.ok(p.height <= plan.clearanceAt(x, z), `第 ${i + 1} 圈 ${p.angle.toFixed(2)}`);
    }
  });
  const peak = (ring) => Math.max(...ring.points.map((p) => p.height));
  assert.ok(peak(plan.ridges[2]) > peak(plan.ridges[0]));
});

test('小島、燈塔、帆船都在島西側的海上，頂端在高度上限下方，帆船整段航程都在海上', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const sea = (x, z) => plan.heightAt(x, z) < SEA_LEVEL - 0.3;
  for (const islet of plan.islets) {
    assert.ok(islet.x < layout.bounds.minX, '小島在島西側');
    for (let k = 0; k < 8; k++) assert.ok(sea(islet.x + Math.cos(k) * (islet.radius + 0.5), islet.z + Math.sin(k) * (islet.radius + 0.5)), '小島四周是海');
    // 島頂加上島上的樹（燈塔那座看燈塔）都在上限下方。
    const top = islet.top + (islet.lighthouse ? plan.lighthouse.height : islet.tree.height);
    assert.ok(top <= plan.clearanceAt(islet.x, islet.z), `小島頂端 ${top.toFixed(2)}`);
  }
  const { lighthouse } = plan;
  const lit = plan.islets.filter((islet) => islet.lighthouse);
  assert.equal(lit.length, 1, '恰好一座小島立燈塔');
  assert.deepEqual([lit[0].x, lit[0].z, lit[0].top], [lighthouse.x, lighthouse.z, lighthouse.y]);
  assert.equal(lit[0].tree, null);
  assert.ok(lighthouse.y + lighthouse.height <= plan.clearanceAt(lighthouse.x, lighthouse.z));
  for (const boat of plan.boats) assert.ok(boat.top >= plan.sailHeight * boat.size, '桅杆頂含船的大小');
  for (let t = 0; t < 900; t += 13) {
    ambientAt(plan, t).boats.forEach((boat, i) => {
      assert.ok(boat.x < layout.bounds.minX && sea(boat.x, boat.z), `帆船 (${boat.x.toFixed(1)}, ${boat.z.toFixed(1)})`);
      assert.ok(SEA_LEVEL + plan.boats[i].top <= plan.clearanceAt(boat.x, boat.z));
    });
  }
});

test('西側是海、東側是山稜：島西方的地面在水面下，島東方越往東越高', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const { minX, maxX, center } = layout.bounds;

  for (const d of [8, 15, 30]) assert.ok(plan.heightAt(minX - d, center.z) < SEA_LEVEL, `島西 ${d} 單位應是海`);
  const east = [10, 25, 45].map((d) => plan.heightAt(maxX + d, center.z));
  assert.ok(east[0] > SEA_LEVEL, '島東 10 單位應是陸地');
  assert.ok(east[0] < east[1] && east[1] < east[2], `往東越高：${east.map((h) => h.toFixed(1))}`);
  assert.ok(east[2] > 8, '遠處的山稜至少 8 單位高');
});

test('島的東半部接著平原，南北兩側與東側離島邊 1.6 的地面都在水面上，只留環線堤那一圈窄水面', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const { maxX, minZ, maxZ, center } = layout.bounds;

  const near = [[maxX + 1.6, center.z], [maxX - 1, minZ - 1.6], [maxX - 1, maxZ + 1.6]];
  for (const [x, z] of near) assert.ok(plan.heightAt(x, z) > SEA_LEVEL, `(${x.toFixed(1)}, ${z.toFixed(1)}) 應是陸地`);
});

test('格子外緣一圈（環線堤的位置）的地面在水面下，外圍平地不蓋住環線', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const centers = layout.tiles.map((t) => t.position);
  // 每格六條邊的中點往外推 0.17（環線離格線的距離），推出去後不在別格裡的就是島的外緣。
  const ring = layout.tiles.flatMap(({ position }) => Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    const r = (layout.hexSize * Math.sqrt(3)) / 2 + 0.17;
    return [position.x + Math.cos(a) * r, position.z + Math.sin(a) * r];
  })).filter(([x, z]) => centers.every((c) => Math.hypot(x - c.x, z - c.z) > layout.hexSize));

  assert.ok(ring.length > 6);
  for (const [x, z] of ring) assert.ok(plan.heightAt(x, z) < SEA_LEVEL, `(${x.toFixed(2)}, ${z.toFixed(2)}) ${plan.heightAt(x, z).toFixed(2)}`);
});

test('東側的山離島越遠越高：近島處是低矮丘陵，遠處有明顯隆起的主峰', () => {
  const layout = layoutOf();
  const plan = planOutskirts(layout);
  const { maxX, minZ, maxZ } = layout.bounds;
  // 島東緣往東 from~to 單位、南北 spread 範圍內的最高點。
  const highest = (from, to, spread) => {
    let top = -Infinity;
    for (let x = maxX + from; x <= maxX + to; x += 0.5) {
      for (let z = minZ - spread; z <= maxZ + spread; z += 0.5) top = Math.max(top, plan.heightAt(x, z));
    }
    return top;
  };

  assert.ok(highest(1, 5, 0) < 2, `近島五單位內最高 ${highest(1, 5, 0).toFixed(1)}`);
  assert.ok(highest(30, 50, 30) > 12, `遠處最高 ${highest(30, 50, 30).toFixed(1)}`);
});

test('外圍的地形、樹、霧團、雲、飛鳥都在高度上限下方，從允許的視角看不會擋住格子', () => {
  const layout = layoutOf();
  for (const quality of ['high', 'low']) {
    const plan = planOutskirts(layout, { quality });
    const below = (x, y, z, what) => assert.ok(y <= plan.clearanceAt(x, z) + 1e-9, `${what} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`);
    for (let x = -plan.extent; x <= plan.extent; x += 1.7) {
      for (let z = -plan.extent; z <= plan.extent; z += 1.7) below(x, plan.heightAt(x, z), z, '地形');
    }
    for (const tree of plan.trees) below(tree.x, tree.y + tree.height, tree.z, '樹頂');
    for (const house of plan.houses) below(house.x, house.y + house.height + house.roof, house.z, '屋頂');
    assert.ok(plan.houses.length > 0, '平原上有聚落');
    for (let t = 0; t < 600; t += 7) {
      const { clouds, fogBanks, birds } = ambientAt(plan, t);
      for (const c of clouds) below(c.x, c.y, c.z, '雲');
      fogBanks.forEach((f, i) => {
        // 霧團是半徑 size 的扁平圓，邊緣也要在上限下方。
        const { size } = plan.fogBanks[i];
        for (let k = 0; k < 8; k++) below(f.x + Math.cos(k) * size, f.y, f.z + Math.sin(k) * size, '霧團邊緣');
      });
      for (const b of birds) below(b.x, b.y, b.z, '飛鳥');
    }
    assert.ok(plan.birds.length > 0 && plan.clouds.length > 0);
  }
});

test('外圍配置不讀政見資料：拿掉所有政見後，地形、樹、霧、雲、鳥的配置完全相同', () => {
  const withPolicies = planOutskirts(layoutOf());
  const without = planOutskirts(layoutOf((raw) => { raw.policies = []; }));

  const snapshot = (plan) => JSON.stringify(
    { ...plan, heights: [0, 7, 14, 21].map((d) => plan.heightAt(d, -d)) },
    (key, value) => (typeof value === 'function' ? undefined : value),
  );
  assert.equal(snapshot(without), snapshot(withPolicies));
});

test('水面的波紋時間與帆船隨動畫時間前進；動畫時間不變時水面與帆船也不變', () => {
  const plan = planOutskirts(layoutOf());
  const [a, b] = [ambientAt(plan, 10), ambientAt(plan, 12)];
  assert.ok(b.waterTime > a.waterTime);
  assert.notDeepEqual(a.boats, b.boats);
  assert.deepEqual(ambientAt(plan, 10), a);
});

test('減少動態與暫停時，雲、霧團、飛鳥、帆船與水面停在同一個畫格；恢復後才繼續動', () => {
  const plan = planOutskirts(layoutOf());
  const positions = (animator, times) => {
    const seen = [];
    const remove = animator.add((t) => seen.push(JSON.stringify(ambientAt(plan, t))));
    for (const now of times) animator.tick(now);
    remove();
    return seen;
  };

  const reduced = positions(createAnimator({ reducedMotion: () => true }), [0, 500, 1000, 4000]);
  assert.equal(new Set(reduced).size, 1, '減少動態時每一幀都相同');

  const animator = createAnimator();
  animator.tick(0);
  animator.tick(1000);
  animator.setPaused(true);
  const paused = positions(animator, [1500, 2000, 9000]);
  assert.equal(new Set(paused).size, 1, '暫停時每一幀都相同');
  animator.setPaused(false);
  const resumed = positions(animator, [9100, 9200]);
  assert.notEqual(resumed[1], paused[0], '恢復後繼續動');
});
