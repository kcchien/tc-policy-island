// 上線關卡「人物一致」：載入網站目錄裡的 island-plaza.js，檢查三位候選人人物外觀相同，
// 走到同一格時三人的目的地、出發與抵達時間與途中姿勢相同（ADR 0001）。

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { orderCandidates } from '../../site/js/dataset.js';
import { buildViewModel } from '../../site/js/view-model.js';
import { islandLayout } from '../../site/js/island-layout.js';
// 什麼算「外觀相同」由 repo 的定義決定，不由受檢的網站模組自己決定。
import { figureLook } from '../../site/js/island-plaza.js';
import { policyVariants } from '../lib/policy-variants.js';

// 網站上的人物配置模組。關卡直接載入網站目錄裡的這一份，檢查的就是要上線的程式。
export const PLAZA_MODULE = 'js/island-plaza.js';

export default {
  id: 'figure-consistency',
  name: '人物一致：三位候選人人物的幾何、尺寸、材質與動畫相同，依排序規則等距並排，同時走到同一格',
  check(site) {
    const path = join(site.dir, PLAZA_MODULE);
    if (!existsSync(path)) return [`找不到人物配置模組 ${PLAZA_MODULE}`];
    // Node 24 可以同步 require ES 模組；關卡介面是同步的。
    const plazaModule = createRequire(import.meta.url)(path);
    const dataset = site.dataset();
    const layout = islandLayout(buildViewModel(dataset));
    const plaza = plazaModule.plazaLayout(layout);
    if (!plaza.tile) return ['島上沒有候選人廣場（需要至少一個裝飾格）'];
    if (plaza.figures.length === 0) return ['候選人廣場上沒有候選人人物'];

    const failures = [];
    const { figures } = plaza;
    const expected = orderCandidates(dataset.candidates).candidates.map((c) => c.id);
    const actual = figures.map((f) => f.candidateId);
    if (actual.join() !== expected.join()) {
      failures.push(`人物順序應為 ${expected.join('、')}（依排序規則），實際為 ${actual.join('、')}`);
    }

    // 以第一位為準，列出外觀參數（幾何、尺寸、材質、待機動畫）不同的人物。
    const reference = JSON.stringify(figureLook(figures[0]));
    const differing = figures.filter((f) => JSON.stringify(figureLook(f)) !== reference).map((f) => f.candidateId);
    if (differing.length > 0) {
      failures.push(`人物 ${differing.join('、')} 的幾何、尺寸、材質或待機動畫參數與 ${figures[0].candidateId} 不同`);
    }

    // 由西到東同一列、等距並排。
    const xs = figures.map((f) => f.position.x);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    const sameRow = figures.every((f) => Math.abs(f.position.z - figures[0].position.z) < 1e-9);
    if (!sameRow || gaps.some((gap) => gap <= 0 || Math.abs(gap - gaps[0]) > 1e-9)) {
      failures.push(`人物沒有由西到東同一列等距並排：${figures.map((f) => `${f.candidateId} (${f.position.x.toFixed(3)}, ${f.position.z.toFixed(3)})`).join('、')}`);
    }
    return [...failures, ...walkFailures(plazaModule, { dataset, layout, plaza })];
  },
};

// 選中格抬高的高度（island-selection.js 的 SELECTED_LIFT；該模組載入 three.js，Node 不載）。
const SELECTED_LIFT = 0.12;
const near = (a, b) => Math.abs(a - b) < 1e-9;
// 姿勢的每個欄位都相同；數字容許浮點誤差。
const samePose = (a, b) => Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every((key) => (typeof a[key] === 'number' ? near(a[key], b[key]) : a[key] === b[key]));

// 走到同一格（ADR 0001）：對每個議題區，三人都有目的地、與自己標記的相對位置相同；去程與回程同時出發、同時抵達，
// 途中每一刻相對起點的位移、朝向與步伐都相同；目的地不隨政見資料改變。
function walkFailures({ figureDestinations, walkPlan, walkPose }, { dataset, layout, plaza }) {
  if (![figureDestinations, walkPlan, walkPose].every((fn) => typeof fn === 'function')) {
    return [`人物配置模組 ${PLAZA_MODULE} 缺少走到同一格的 figureDestinations、walkPlan 或 walkPose`];
  }
  const { figures } = plaza;
  const ids = figures.map((f) => f.candidateId);
  const areas = layout.tiles.filter((t) => t.kind === 'area');
  // 每類問題記下出錯的候選人與議題區，最後各合成一條訊息。
  const problems = new Map();
  const report = (what, candidateIds, areaId) => {
    if (candidateIds.length === 0) return;
    const entry = problems.get(what) ?? { candidates: new Set(), areas: new Set() };
    for (const id of candidateIds) entry.candidates.add(id);
    entry.areas.add(areaId);
    problems.set(what, entry);
  };
  const differing = (values, same) => ids.filter((_, i) => !same(values[i], values[0]));

  for (const tile of areas) {
    const destinations = figureDestinations(layout, tile.id);
    const byId = new Map(destinations.map((d) => [d.candidateId, d]));
    report('沒有目的地', ids.filter((id) => !byId.has(id)), tile.id);
    if (!ids.every((id) => byId.has(id))) continue;
    const ends = ids.map((id) => byId.get(id).position);
    const relative = ends.map((p, i) => ({ x: p.x - (tile.position.x + tile.markers[i].offset.x), z: p.z - (tile.position.z + tile.markers[i].offset.z) }));
    report('目的地與自己標記的相對位置和其他人不同', differing(relative, (a, b) => near(a.x, b.x) && near(a.z, b.z)), tile.id);

    // 去程從廣場走上抬高的選中格，回程從選中格走回廣場。
    const home = figures.map((f) => ({ ...f.position, y: 0 }));
    const lifted = ends.map((p) => ({ ...p, y: SELECTED_LIFT }));
    for (const [trip, starts, targets] of [['去程', home, lifted], ['回程', lifted, home]]) {
      const plans = figures.map((f, i) => walkPlan(starts[i], targets[i], f.walk));
      report(`${trip}出發或抵達時間和其他人不同`, differing(plans, (a, b) => a.departSeconds === b.departSeconds && a.arriveSeconds === b.arriveSeconds), tile.id);
      const last = Math.max(...plans.map((p) => p.arriveSeconds));
      for (let k = 0; k <= 16; k++) {
        const poses = plans.map((plan, i) => {
          const { x, z, ...rest } = walkPose(plan, figures[i].walk, (last * k) / 16);
          return { dx: x - starts[i].x, dz: z - starts[i].z, ...rest };
        });
        report(`${trip}途中的位移、朝向或步伐和其他人不同`, differing(poses, samePose), tile.id);
      }
      const arrived = plans.map((plan, i) => walkPose(plan, figures[i].walk, last));
      report(`${trip}沒有停在目的地`, ids.filter((_, i) => !near(arrived[i].x, targets[i].x) || !near(arrived[i].z, targets[i].z)), tile.id);
    }
  }

  const failures = [...problems].map(([what, { candidates, areas: where }]) =>
    `走到同一格：人物 ${[...candidates].join('、')} 的${what}（議題區 ${[...where].join('、')}）`);
  // 目的地只依標記位置：換一份政見資料重算，結果必須相同。
  const expected = JSON.stringify(areas.map((t) => figureDestinations(layout, t.id)));
  for (const variant of policyVariants(dataset)) {
    const other = islandLayout(buildViewModel({ ...dataset, policies: variant.policies }));
    if (JSON.stringify(areas.map((t) => figureDestinations(other, t.id))) !== expected) {
      failures.push(`走到同一格：換一份政見資料（${variant.name}）後目的地不同，目的地不得依賴政見資料`);
    }
  }
  return failures;
}
