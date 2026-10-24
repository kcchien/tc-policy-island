// 上線關卡：對網站目錄跑 gates/index.js 的 GATES，印出每項結果。參數與注意事項見 USAGE（--help）。
import { resolve } from 'node:path';
import { runGates } from './gates/index.js';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '上線關卡：對建置後的網站目錄逐項檢查，列出每項關卡的結果與失敗原因。',
  usage: [
    ['node scripts/gates.js [網站目錄]', '對網站目錄跑全部上線關卡（預設 site）'],
    ['node scripts/gates.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  notes: [
    '任一項關卡失敗即以結束碼 1 退出，不得部署。部署前與 CI 都要跑。',
    '檢查的是建置產物，先跑 node scripts/build.js。',
    '新增關卡的做法見 AGENTS.md「資料與夾具」。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

const siteDir = resolve(process.argv[2] ?? 'site');
const results = runGates(siteDir);

for (const { id, name, failures } of results) {
  console.log(`${failures.length === 0 ? '✓' : '✗'} ${name}（${id}）`);
  for (const failure of failures) console.log(`    ${failure}`);
}

const failed = results.filter((r) => r.failures.length > 0).length;
console.log(failed === 0 ? `\n全部 ${results.length} 項關卡通過` : `\n${failed} 項關卡未通過，不得部署`);
process.exitCode = failed === 0 ? 0 : 1;
