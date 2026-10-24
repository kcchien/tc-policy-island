// 部署流程：測試 → 建置 → 上線關卡 → 統計資料集可用檢查 → （專案不存在時建立）→ wrangler pages deploy。任一步失敗即停，不部署。
// 指令由 run(command, args, { capture }) → { status, stdout } 執行，capture 為 true 時要回傳標準輸出；command 為 'node' 時由呼叫端換成目前的 Node。
// 統計資料集檢查讀 env 的 CLOUDFLARE_API_TOKEN 與 CLOUDFLARE_ACCOUNT_ID，以注入的 fetch 查詢，測試用假的 run 與 fetch。
// 試跑（dryRun）照常跑檢查、統計資料集查詢與唯讀的專案查詢，建立專案與部署只列出指令、不執行。

export const PROJECT_NAME = 'tc-policy-island';
export const PRODUCTION_BRANCH = 'main';
export const SITE_DIR = 'site';

const CHECK_STEPS = [
  { name: '測試', args: ['--test'] },
  { name: '建置', args: ['scripts/build.js'] },
  { name: '上線關卡', args: ['scripts/gates.js'] },
];

// wrangler 4.149 起會把 Pages 專案建立轉交 Workers 而失敗；--force 讓專案直接建在 Pages，之後的部署不需要
const CREATE_ARGS = ['pages', 'project', 'create', PROJECT_NAME, '--production-branch', PRODUCTION_BRANCH, '--force'];
const DEPLOY_ARGS = ['pages', 'deploy', SITE_DIR, '--project-name', PROJECT_NAME, '--branch', PRODUCTION_BRANCH];

// 帳號識別碼：環境變數 CLOUDFLARE_ACCOUNT_ID 優先，其次 wrangler whoami 輸出中的第一個 32 位十六進位字串；都沒有回傳 null。
export function accountIdFrom({ envAccountId, whoamiOutput }) {
  if (envAccountId) return envAccountId;
  return whoamiOutput.match(/\b[0-9a-f]{32}\b/)?.[0] ?? null;
}

// 統計資料集可用檢查：對 Analytics Engine SQL API 送 SELECT 1（唯讀）。帳號未啟用 Analytics Engine 時查詢回 403，
// 部署則要到上傳完才以錯誤碼 10089 失敗，所以在上傳前先查。回傳 { ok, reason?, skipped? }。
// 沒有權杖（用 wrangler login 登入的機器）或找不到帳號識別碼時略過；網路錯誤視為失敗，不放行。
export async function checkStatsDataset({ accountId, token, fetch }) {
  if (!token) return { ok: true, skipped: '略過統計資料集檢查：找不到 CLOUDFLARE_API_TOKEN' };
  if (!accountId) return { ok: true, skipped: '略過統計資料集檢查：找不到帳號識別碼' };
  let response;
  try {
    response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: 'SELECT 1',
    });
  } catch (error) {
    return { ok: false, reason: `無法連到 Cloudflare 統計資料集查詢 API：${error.message}` };
  }
  if (response.status === 403) {
    return {
      ok: false,
      reason: `帳號未啟用 Analytics Engine，到 Cloudflare 後台啟用 Analytics Engine：https://dash.cloudflare.com/${accountId}/workers/analytics-engine`,
    };
  }
  if (response.status !== 200) {
    const body = (await response.text()).slice(0, 200);
    return { ok: false, reason: `統計資料集查詢回 HTTP ${response.status}：${body}` };
  }
  return { ok: true };
}

export async function deploy({ run, log, dryRun = false, env = {}, fetch = globalThis.fetch }) {
  for (const step of CHECK_STEPS) {
    log(`▶ ${step.name}`);
    if (run('node', step.args).status !== 0) {
      log(`✗ ${step.name}失敗，不部署`);
      return { ok: false };
    }
  }

  log('▶ 統計資料集可用檢查');
  const token = env.CLOUDFLARE_API_TOKEN;
  const envAccountId = env.CLOUDFLARE_ACCOUNT_ID;
  const whoamiOutput = token && !envAccountId ? run('wrangler', ['whoami'], { capture: true }).stdout : '';
  const stats = await checkStatsDataset({ accountId: accountIdFrom({ envAccountId, whoamiOutput }), token, fetch });
  if (!stats.ok) {
    log(`✗ ${stats.reason}，不部署`);
    return { ok: false };
  }
  log(stats.skipped ?? '✓ 統計資料集可用');

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
