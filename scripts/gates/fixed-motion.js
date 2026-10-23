import { createRequire } from 'node:module';
import { join } from 'node:path';
import { buildViewModel } from '../../site/js/view-model.js';
import { islandLayout } from '../../site/js/island-layout.js';
import { motionSignature } from '../../site/js/island-motion.js';
import { policyVariants } from '../lib/policy-variants.js';

// 網站上的動態配置模組。關卡直接載入網站目錄裡的這一份，檢查的就是要上線的程式。
export const MOTION_MODULE = 'js/island-motion.js';


export default {
  id: 'fixed-motion',
  name: '動態數量固定：每個議題區格子的動態數量與強度相同，且不隨政見資料改變',
  check(site) {
    if (!site.files().includes(MOTION_MODULE)) return [`找不到動態配置模組 ${MOTION_MODULE}`];
    // Node 24 可以同步 require ES 模組；關卡介面是同步的。
    // 配置來自網站上的模組；比對用的簽章（motionSignature）與島嶼配置用 repo 的版本，
    // 網站上的模組不能自己決定什麼算相同。
    const { motionPlan, MOTION_LEVELS } = createRequire(import.meta.url)(join(site.dir, MOTION_MODULE));
    const dataset = site.dataset();
    const layout = islandLayout(buildViewModel(dataset));
    const areaIds = layout.tiles.filter((t) => t.kind === 'area').map((t) => t.id);
    const failures = [];

    for (const level of Object.keys(MOTION_LEVELS)) {
      const plan = motionPlan(layout, { level });
      const areas = plan.tiles.filter((t) => t.kind === 'area');
      if (areas.map((t) => t.id).join() !== areaIds.join()) {
        failures.push(`${level} 畫質：動態配置的議題區格子 ${areas.map((t) => t.id).join('、')} 與島上的議題區格子不一致`);
        continue;
      }
      // 以第一格為準，列出數量或強度不同的格子。
      const expected = motionSignature(areas[0]);
      const differing = areas.filter((t) => motionSignature(t) !== expected).map((t) => t.id);
      if (differing.length > 0) {
        failures.push(`${level} 畫質：議題區格子 ${differing.join('、')} 的動態數量或強度與 ${areas[0].id} 不同`);
      }
      const text = JSON.stringify(plan);
      const leaked = [...dataset.candidates.map((c) => c.id), ...dataset.policies.map((p) => p.id)].filter((id) => text.includes(`"${id}"`));
      if (leaked.length > 0) failures.push(`${level} 畫質：動態配置含候選人或政見識別碼 ${leaked.join('、')}`);

      for (const variant of policyVariants(dataset)) {
        const other = motionPlan(islandLayout(buildViewModel({ ...dataset, policies: variant.policies })), { level });
        if (JSON.stringify(other) !== text) {
          failures.push(`${level} 畫質：換一份政見資料（${variant.name}）後動態配置不同，動態配置不得依賴政見資料`);
        }
      }
    }
    return failures;
  },
};
