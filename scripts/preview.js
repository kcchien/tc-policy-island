// 本機預覽：node scripts/preview.js [--port 8000] [--dir site]
// 只供本機開發，不是正式部署用的伺服器。開啟前請先執行建置指令產生公開資料集。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { exitWithUsage, formatUsage, wantsHelp } from './lib/usage.js';

const USAGE = formatUsage({
  summary: '本機預覽：以本機 HTTP 伺服器開網站目錄，Ctrl+C 結束。',
  usage: [
    ['node scripts/preview.js [參數]', '開本機預覽'],
    ['node scripts/preview.js --help', '顯示這段說明（-h 也一樣）'],
  ],
  sections: [
    {
      title: '參數',
      rows: [
        ['--port <埠>', '監聽的埠（預設 8000）'],
        ['--dir <目錄>', '網站目錄（預設 site）'],
      ],
    },
  ],
  notes: [
    '只供本機開發，不是正式部署用的伺服器。',
    '開啟前先跑 node scripts/build.js 產生公開資料集；npm run preview 會先建置再開。',
  ],
});

if (wantsHelp(process.argv.slice(2))) exitWithUsage(USAGE);

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8000' },
    dir: { type: 'string', default: 'site' },
  },
});

const root = resolve(values.dir);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const path = normalize(join(root, decoded));
  if (path !== root && !path.startsWith(root + sep)) return null;
  const info = await stat(path).catch(() => null);
  if (!info) return null;
  return info.isDirectory() ? join(path, 'index.html') : path;
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const file = await resolveFile(pathname);
  const body = file && (await readFile(file).catch(() => null));
  if (!body) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`找不到 ${pathname}`);
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(body);
});

server.listen(Number(values.port), () => {
  console.log(`本機預覽：http://localhost:${values.port}/（網站目錄 ${values.dir}，Ctrl+C 結束）`);
});
