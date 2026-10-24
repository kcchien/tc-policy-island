// 部署到 Cloudflare Pages：node scripts/deploy.js [--dry-run] [--wrangler wrangler]
// 依序跑測試、建置、上線關卡，全過才以 wrangler 部署 site/ 到專案 tc-policy-island 的正式環境（main）；
// 專案不存在時先建立。任一步失敗即以結束碼 1 退出，不部署。--dry-run 只列出建立與部署指令、不執行。
// wrangler 須已在本機登入（wrangler login 或環境變數 CLOUDFLARE_API_TOKEN）。
// 前提：Cloudflare 帳號須啟用 Analytics Engine（統計端點的資料集，ADR 0003），否則上傳完才以錯誤碼 10089 失敗。
// 所以關卡之後、上傳之前先對統計資料集送 SELECT 1（--dry-run 也跑），403 即未啟用，印出後台啟用網址後退出；
// 沒有 CLOUDFLARE_API_TOKEN 或找不到帳號識別碼（CLOUDFLARE_ACCOUNT_ID，其次 wrangler whoami）時略過這步。
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deploy } from './lib/deploy.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    wrangler: { type: 'string', default: 'wrangler' },
  },
});

const COMMANDS = { node: process.execPath, wrangler: values.wrangler };

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(COMMANDS[command], args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (result.error) console.error(result.error.message);
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

const { ok } = await deploy({ run, log: (line) => console.log(line), dryRun: values['dry-run'], env: process.env });
process.exitCode = ok ? 0 : 1;
