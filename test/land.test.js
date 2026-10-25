import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrapper = join(root, 'scripts/land.sh');

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'tpi-land-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const recorder = join(dir, 'fake land.sh');
  const argvPath = join(dir, 'argv.json');
  writeFileSync(recorder, `#!/bin/bash
exec "$LAND_TEST_NODE" --input-type=module - "$@" <<'JS'
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.LAND_TEST_ARGV, JSON.stringify(process.argv.slice(2)));
process.exitCode = Number(process.env.LAND_TEST_EXIT ?? 0);
JS
`);
  return {
    dir,
    run: (args, env = {}) => spawnSync('bash', [wrapper, ...args], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, HERDR_LAND_SCRIPT: recorder, LAND_TEST_NODE: process.execPath, LAND_TEST_ARGV: argvPath, ...env },
    }),
    argv: () => JSON.parse(readFileSync(argvPath, 'utf8')),
    called: () => existsSync(argvPath),
  };
}

test('release 把針對性檢查及固定部署指令交給既有 land，保留空格與 shell 字面文字', (t) => {
  const fake = setup(t);
  const comment = '更新照片：保留 $HOME、`date` 與 "引號"';
  const check = 'node --test "test/land.test.js"';

  const result = fake.run(['feat/proportionate-validation', '-', comment, '--check', check, '--release']);

  assert.equal(result.status, 0, result.stderr);
  const worktrees = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' });
  assert.equal(worktrees.status, 0, worktrees.stderr);
  const hub = worktrees.stdout.match(/^worktree (.+)$/m)[1];
  assert.deepEqual(fake.argv(), [
    'feat/proportionate-validation', '-', comment,
    '--repo', hub,
    '--check', check, '--release', 'npm run deploy',
  ]);
});

test('非 release 固定完整 check，不能以 --check 縮減整合檢查', (t) => {
  const fake = setup(t);
  const result = fake.run(['feat/example', '123', '整合變更']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fake.argv().slice(-2), ['--check', 'npm run check']);
  assert.equal(fake.argv().includes('--release'), false);
  assert.notEqual(fake.run(['feat/example', '-', '整合', '--check', 'git diff --check']).status, 0);
});

test('dry-run 連同 release 原樣傳給 land，包裝腳本不執行 check 或部署', (t) => {
  const fake = setup(t);
  const marker = join(fake.dir, 'should not exist');
  const check = `touch '${marker}'`;
  const result = fake.run(['feat/example', '-', '試跑', '--dry-run', '--release', '--check', check]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fake.argv().slice(-5), ['--check', check, '--release', 'npm run deploy', '--dry-run']);
  assert.equal(existsSync(marker), false);
});

test('拒絕缺漏、空白、重複、未知參數與自訂部署指令，不呼叫 land', (t) => {
  const fake = setup(t);
  const base = ['feat/example', '-', '更新'];
  const invalid = [
    [], ['feat/example', '-'], ['', '-', '更新'], ['feat/example', 'oops', '更新'], ['feat/example', '-', ' '],
    [...base, '--release'], [...base, '--release', '--check'], [...base, '--release', '--check', '  '],
    [...base, '--release', '--check', '--dry-run'], [...base, '--unknown'],
    [...base, '--release', 'echo deploy'], [...base, '--dry-run', '--dry-run'],
    [...base, '--release', '--release'], [...base, '--check', 'true', '--check', 'false', '--release'],
  ];
  for (const args of invalid) {
    const result = fake.run(args);
    assert.notEqual(result.status, 0, JSON.stringify(args));
    assert.ok(result.stderr.trim(), JSON.stringify(args));
  }
  assert.equal(fake.called(), false);
});

test('找不到腳本時清楚失敗，並保留既有 land 的失敗結束碼', (t) => {
  const fake = setup(t);
  const args = ['feat/example', '-', '更新'];

  const missing = fake.run(args, { HERDR_LAND_SCRIPT: join(fake.dir, 'missing.sh') });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /HERDR_LAND_SCRIPT/);
  assert.equal(fake.run(args, { LAND_TEST_EXIT: '5' }).status, 5);
});
