// 部署流程：測試 → 建置 → 上線關卡 → （專案不存在時建立）→ wrangler pages deploy。任一步失敗即停，不部署。
// 指令由 run(command, args, { capture }) → { status, stdout } 執行，capture 為 true 時要回傳標準輸出；command 為 'node' 時由呼叫端換成目前的 Node。
// 試跑（dryRun）照常跑檢查與唯讀的專案查詢，建立專案與部署只列出指令、不執行。

export const PROJECT_NAME = 'tc-policy-island';
export const PRODUCTION_BRANCH = 'main';
export const SITE_DIR = 'site';

const CHECK_STEPS = [
  { name: '測試', args: ['--test'] },
  { name: '建置', args: ['scripts/build.js'] },
  { name: '上線關卡', args: ['scripts/gates.js'] },
];

const CREATE_ARGS = ['pages', 'project', 'create', PROJECT_NAME, '--production-branch', PRODUCTION_BRANCH];
const DEPLOY_ARGS = ['pages', 'deploy', SITE_DIR, '--project-name', PROJECT_NAME, '--branch', PRODUCTION_BRANCH];

export function deploy({ run, log, dryRun = false }) {
  for (const step of CHECK_STEPS) {
    log(`▶ ${step.name}`);
    if (run('node', step.args).status !== 0) {
      log(`✗ ${step.name}失敗，不部署`);
      return { ok: false };
    }
  }

  const list = run('wrangler', ['pages', 'project', 'list', '--json'], { capture: true });
  if (list.status !== 0) {
    log('✗ 無法列出 Cloudflare Pages 專案（wrangler 是否已登入？），不部署');
    return { ok: false };
  }
  let projects;
  try {
    projects = JSON.parse(list.stdout);
  } catch {
    log('✗ Cloudflare Pages 專案清單不是 JSON，無法判斷專案是否存在，不部署');
    return { ok: false };
  }
  const exists = projects.some((p) => p['Project Name'] === PROJECT_NAME);

  const writes = [
    ...(exists ? [] : [{ name: `建立 Cloudflare Pages 專案 ${PROJECT_NAME}`, args: CREATE_ARGS }]),
    { name: `部署 ${SITE_DIR}/ 到 ${PROJECT_NAME} 正式環境（${PRODUCTION_BRANCH}）`, args: DEPLOY_ARGS },
  ];
  for (const step of writes) {
    if (dryRun) {
      log(`（試跑，不執行）${step.name}：wrangler ${step.args.join(' ')}`);
      continue;
    }
    log(`▶ ${step.name}`);
    if (run('wrangler', step.args).status !== 0) {
      log(`✗ ${step.name}失敗`);
      return { ok: false };
    }
  }
  return { ok: true };
}
