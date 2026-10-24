// 上線關卡「人物一致」：載入網站目錄裡的 island-plaza.js，檢查三位候選人人物外觀相同（ADR 0001）。

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { orderCandidates } from '../../site/js/dataset.js';
import { buildViewModel } from '../../site/js/view-model.js';
import { islandLayout } from '../../site/js/island-layout.js';
// 什麼算「外觀相同」由 repo 的定義決定，不由受檢的網站模組自己決定。
import { figureLook } from '../../site/js/island-plaza.js';

// 網站上的人物配置模組。關卡直接載入網站目錄裡的這一份，檢查的就是要上線的程式。
export const PLAZA_MODULE = 'js/island-plaza.js';

export default {
  id: 'figure-consistency',
  name: '人物一致：三位候選人人物的幾何、尺寸、材質與待機動畫相同，依排序規則等距並排',
  check(site) {
    const path = join(site.dir, PLAZA_MODULE);
    if (!existsSync(path)) return [`找不到人物配置模組 ${PLAZA_MODULE}`];
    // Node 24 可以同步 require ES 模組；關卡介面是同步的。
    const { plazaLayout } = createRequire(import.meta.url)(path);
    const dataset = site.dataset();
    const plaza = plazaLayout(islandLayout(buildViewModel(dataset)));
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
    return failures;
  },
};
