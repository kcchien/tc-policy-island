import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// docs/architecture.md 只列分組與檔名，各模組的職責寫在檔頭註解，所以每個模組開頭都要有註解。
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MODULE_DIRS = ['site/js', 'scripts', 'functions'];

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

test('site/js、scripts 與 functions 的每個模組開頭都有檔頭註解', () => {
  const files = MODULE_DIRS.flatMap((dir) => jsFiles(join(ROOT, dir)));
  assert.ok(files.length > 0);
  const missing = files
    .filter((path) => !/^(#![^\n]*\n)?\/\/ \S/.test(readFileSync(path, 'utf8')))
    .map((path) => relative(ROOT, path));
  assert.deepEqual(missing, []);
});
