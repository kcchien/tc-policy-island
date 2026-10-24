// 部署到 Cloudflare Pages：指令入口，流程在 lib/deploy.js。參數與注意事項見 USAGE（--help）。
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deploy } from './lib/deploy.js';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '部署到 Cloudflare Pages：測試 → 建置 → 上線關卡 → 統計資料集可用檢查，全過才以 wrangler 部署網站目錄 site 到正式環境。',
  usage: [
    ['node scripts/deploy.js [參數]', '檢查後部署（npm run deploy 相同）'],
    ['node scripts/deploy.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  sections: [
    {
      title: '參數',
      rows: [
        ['--dry-run', '跑完檢查、統計資料集查詢與唯讀的專案查詢，建立專案與部署只列出指令、不執行'],
        ['--wrangler <執行檔>', 'wrangler 指令的路徑（預設 wrangler）'],
      ],
    },
  ],
  notes: [
    '真的部署只由維護者執行。試部署流程用 --dry-run，或用 --wrangler 指向假指令。',
    '部署到 Cloudflare Pages 專案 tc-policy-island 的正式環境（--branch main），專案不存在時先建立。',
    '任一步失敗即以結束碼 1 退出，不部署。',
    'wrangler 須已在本機登入（wrangler login 或環境變數 CLOUDFLARE_API_TOKEN）。',
    '前提：Cloudflare 帳號須啟用 Analytics Engine（統計端點的資料集，ADR 0003），否則上傳完才以錯誤碼 10089 失敗。上傳前會先檢查（--dry-run 也跑），未啟用就印出後台啟用網址後退出。',
    '統計資料集檢查讀環境變數 CLOUDFLARE_API_TOKEN 與 CLOUDFLARE_ACCOUNT_ID（沒有帳號識別碼時改跑 wrangler whoami 取得）；找不到權杖時略過這項檢查。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

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
