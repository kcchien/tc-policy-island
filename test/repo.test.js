import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

test('repo 零 npm 相依：package.json 沒有任何相依欄位，也沒有 lockfile 與 node_modules', () => {
  const pkg = JSON.parse(readFileSync(root('package.json'), 'utf8'));
  const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies']
    .filter((field) => field in pkg);

  assert.deepEqual(dependencyFields, []);
  assert.equal(existsSync(root('package-lock.json')), false);
  assert.equal(existsSync(root('node_modules')), false);
});

// ADR 0003：functions/ 是純靜態網站唯一的例外，只放統計端點。
test('functions/ 只有統計端點一個檔案，不得放其他後端邏輯', () => {
  const entries = readdirSync(root('functions'), { recursive: true }).map((path) => path.split('\\').join('/')).sort();

  assert.deepEqual(entries, ['api', 'api/hit.js']);
});
