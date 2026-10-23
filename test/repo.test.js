import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
