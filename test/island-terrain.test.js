import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicDataset } from '../site/js/dataset.js';
import { buildViewModel } from '../site/js/view-model.js';
import { islandLayout } from '../site/js/island-layout.js';
import { ambientAt, OUTSKIRTS_DETAIL, planOutskirts, SEA_LEVEL } from '../site/js/island-terrain.js';
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

test('外圍的地形、樹、霧團、雲、飛鳥都在高度上限下方，從允許的視角看不會擋住格子', () => {
  const layout = layoutOf();
  for (const quality of ['high', 'low']) {
    const plan = planOutskirts(layout, { quality });
    const below = (x, y, z, what) => assert.ok(y <= plan.clearanceAt(x, z) + 1e-9, `${what} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`);
    for (let x = -plan.extent; x <= plan.extent; x += 1.7) {
      for (let z = -plan.extent; z <= plan.extent; z += 1.7) below(x, plan.heightAt(x, z), z, '地形');
    }
    for (const tree of plan.trees) below(tree.x, tree.y + tree.height, tree.z, '樹頂');
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

test('減少動態與暫停時，雲、霧團、飛鳥停在同一個位置；恢復後才繼續動', () => {
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
