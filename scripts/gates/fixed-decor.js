import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildViewModel } from '../../site/js/view-model.js';
import { islandLayout } from '../../site/js/island-layout.js';
// 什麼算「裝飾相同」與每個議題區該配哪座主題場景，由 repo 的定義決定，不由受檢的網站模組自己決定。
import { decorSignature } from '../../site/js/island-decor.js';
import { heroSceneFor } from '../../site/js/island-heroes.js';
import { policyVariants } from '../lib/policy-variants.js';

// 網站上的裝飾配置模組。關卡直接載入網站目錄裡的這一份，檢查的就是要上線的程式。
export const DECOR_MODULE = 'js/island-decor.js';

export default {
  id: 'fixed-decor',
  name: '裝飾數量固定：每個議題區格子的主題場景、家具與植栽數量相同，主題場景只依議題區識別碼決定，配置不隨政見資料改變',
  check(site) {
    const path = join(site.dir, DECOR_MODULE);
    if (!existsSync(path)) return [`找不到裝飾配置模組 ${DECOR_MODULE}`];
    // Node 24 可以同步 require ES 模組；關卡介面是同步的。
    const { decorPlan } = createRequire(import.meta.url)(path);
    const dataset = site.dataset();
    const layout = islandLayout(buildViewModel(dataset));
    const areaIds = layout.tiles.filter((t) => t.kind === 'area').map((t) => t.id);
    const plan = decorPlan(layout);
    const areas = plan.tiles.filter((t) => t.kind === 'area');
    if (areas.map((t) => t.id).join() !== areaIds.join()) {
      return [`裝飾配置的議題區格子 ${areas.map((t) => t.id).join('、')} 與島上的議題區格子不一致`];
    }

    if (areas.length === 0) return [];
    const failures = [];
    // 每格恰好一座主題場景，題材只看議題區識別碼。
    for (const tile of areas) {
      const expected = heroSceneFor(tile.id).id;
      if (!tile.hero) failures.push(`議題區格子 ${tile.id} 沒有主題場景`);
      else if (tile.hero.areaId !== tile.id || tile.hero.sceneId !== expected) {
        failures.push(`議題區格子 ${tile.id} 的主題場景是 ${tile.hero.sceneId}，依議題區識別碼應為 ${expected}`);
      }
    }
    // 以第一格為準，列出裝飾種類、數量、位置或主題場景擺放不同的格子。
    const reference = decorSignature(areas[0]);
    const differing = areas.filter((t) => decorSignature(t) !== reference).map((t) => t.id);
    if (differing.length > 0) {
      failures.push(`議題區格子 ${differing.join('、')} 的裝飾數量、位置或主題場景放大倍率與 ${areas[0].id} 不同`);
    }
    const text = JSON.stringify(plan);
    const leaked = [...dataset.candidates.map((c) => c.id), ...dataset.policies.map((p) => p.id)].filter((id) => text.includes(`"${id}"`));
    if (leaked.length > 0) failures.push(`裝飾配置含候選人或政見識別碼 ${leaked.join('、')}`);

    for (const variant of policyVariants(dataset)) {
      const other = decorPlan(islandLayout(buildViewModel({ ...dataset, policies: variant.policies })));
      if (JSON.stringify(other) !== text) {
        failures.push(`換一份政見資料（${variant.name}）後裝飾配置不同，裝飾配置不得依賴政見資料`);
      }
    }
    return failures;
  },
};
