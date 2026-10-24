import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 參數與注意事項的唯一出處是各腳本的 --help（AGENTS.md 指令表只寫用途），所以每支指令腳本都要有。
const SCRIPTS_DIR = fileURLToPath(new URL('../scripts/', import.meta.url));
const SCRIPTS = readdirSync(SCRIPTS_DIR).filter((name) => name.endsWith('.js'));

const runScript = (name, args, options = {}) =>
  spawnSync(process.execPath, [join(SCRIPTS_DIR, name), ...args], { encoding: 'utf8', timeout: 10_000, ...options });

test('每支 scripts/*.js 的 --help 與 -h 都印出用法並以結束碼 0 結束', () => {
  assert.ok(SCRIPTS.length >= 7);
  for (const name of SCRIPTS) {
    for (const flag of ['--help', '-h']) {
      const result = runScript(name, [flag]);
      assert.equal(result.status, 0, `${name} ${flag}：${result.stderr}`);
      assert.match(result.stdout, /用法/, `${name} ${flag} 沒有印出用法`);
      assert.equal(result.stderr, '', `${name} ${flag} 不應有錯誤輸出`);
    }
  }
});

test('AGENTS.md 指令表每列不超過 160 字元，參數留給 --help', () => {
  const agents = readFileSync(fileURLToPath(new URL('../AGENTS.md', import.meta.url)), 'utf8');
  const section = agents.slice(agents.indexOf('### 指令'), agents.indexOf('\n### ', agents.indexOf('### 指令') + 1));
  const rows = section.split('\n').filter((line) => line.startsWith('| '));
  assert.ok(rows.length > 2);
  const tooLong = rows.filter((row) => [...row].length > 160);
  assert.deepEqual(tooLong, []);
});

test('--help 不執行腳本本身：不寫檔、不部署、不開伺服器', () => {
  const dir = mkdtempSync(join(tmpdir(), 'script-help-'));
  try {
    const out = join(dir, 'dataset.json');
    assert.equal(runScript('build.js', ['--out', out, '--help']).status, 0);
    assert.equal(existsSync(out), false, 'build.js --help 不應寫出資料集');

    // 指向不存在的指令：若 deploy.js 真的往下跑，會先花時間跑測試再因找不到 wrangler 失敗。
    const deploy = runScript('deploy.js', ['--help', '--wrangler', join(dir, 'missing-wrangler')]);
    assert.equal(deploy.status, 0);
    assert.doesNotMatch(deploy.stdout, /▶/);

    // verify.js 往下跑會讀原始資料，目錄不存在就失敗；fetch-source.js 往下跑會連網與寫出處紀錄。
    assert.equal(runScript('verify.js', ['--help', '--raw', join(dir, 'missing'), '--claude', join(dir, 'missing-claude')]).status, 0);
    const fetch = ['--help', '--candidate', 'x', '--id', 'x', '--url', 'http://127.0.0.1:9/', '--type', 'official-website', '--raw', dir, '--snapshots', dir];
    assert.equal(runScript('fetch-source.js', fetch).status, 0);
    assert.deepEqual(readdirSync(dir), [], 'fetch-source.js --help 不應寫出任何檔案');

    // preview.js 若啟動伺服器就不會自己結束，會撞上逾時。
    const preview = runScript('preview.js', ['--help', '--port', '0']);
    assert.equal(preview.status, 0);
    assert.doesNotMatch(preview.stdout, /http:\/\/localhost/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
