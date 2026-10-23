// 上線關卡：node scripts/gates.js [網站目錄，預設 site]
// 任一關卡失敗即以結束碼 1 退出。部署前與 CI 都要跑。
import { resolve } from 'node:path';
import { runGates } from './gates/index.js';

const siteDir = resolve(process.argv[2] ?? 'site');
const results = runGates(siteDir);

for (const { id, name, failures } of results) {
  console.log(`${failures.length === 0 ? '✓' : '✗'} ${name}（${id}）`);
  for (const failure of failures) console.log(`    ${failure}`);
}

const failed = results.filter((r) => r.failures.length > 0).length;
console.log(failed === 0 ? `\n全部 ${results.length} 項關卡通過` : `\n${failed} 項關卡未通過，不得部署`);
process.exitCode = failed === 0 ? 0 : 1;
