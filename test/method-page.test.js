import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidateOrderItems, dataStatusItems, resolveDocLink } from '../site/js/method-content.js';
import { REPO_DOCUMENTS } from '../site/js/repo-documents.js';
import { candidate } from './fixtures/make-raw.js';

const page = (name) => readFileSync(new URL(`../site/${name}`, import.meta.url), 'utf8');

test('repo 文件中的相對連結：方法頁有收錄的文件連到頁內，沒收錄的連到 GitHub 上的原檔', () => {
  const from = 'docs/rules/classification-rules.md';

  assert.equal(resolveDocLink(from, 'local-elements.md'), '#doc-local-elements');
  assert.equal(resolveDocLink(from, '../adr/0001-neutrality-rules.md'), '#doc-adr-neutrality');
  assert.equal(resolveDocLink(from, 'policy-area-mapping.md'), 'https://github.com/kcchien/tc-policy-island/blob/main/docs/rules/policy-area-mapping.md');
  assert.equal(resolveDocLink(from, 'https://example.org/a'), 'https://example.org/a');
});

test('只列出有資料狀態說明的候選人，附姓名與政黨', () => {
  const candidates = [
    candidate('cand-a', '候選人甲', 5),
    { ...candidate('cand-c', '候選人丙', 9), dataStatus: '尚無一手來源' },
  ];

  assert.deepEqual(dataStatusItems(candidates), ['候選人丙（候選人丙所屬政黨）：尚無一手來源']);
});

test('排序規則說明列出兩種規則，標出目前採用的那一種', () => {
  assert.deepEqual(candidateOrderItems('name-strokes'), [
    { text: '候選人排列依姓名筆畫由少到多（號次抽籤前）', current: true },
    { text: '候選人排列依選委會抽籤號次', current: false },
  ]);
});

test('整理方法頁可從首頁的頁首與頁尾進入', () => {
  const html = page('index.html');
  const header = html.match(/<header[\s\S]*?<\/header>/)[0];
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];

  assert.match(header, /href="\.\/method\.html"/);
  assert.match(footer, /href="\.\/method\.html"/);
});

test('整理方法頁為每份引用 repo 文件留一個標了 data-repo-file 的容器，並提供公開資料集下載', () => {
  const html = page('method.html');
  const marked = [...html.matchAll(/data-repo-file="([^"]+)"/g)].map((m) => m[1]);

  assert.deepEqual(marked.toSorted(), REPO_DOCUMENTS.map((doc) => doc.path).toSorted());
  assert.match(html, /<a [^>]*href="\.\/data\/dataset\.json"[^>]*download/);
  assert.match(html, /https:\/\/github\.com\/kcchien\/tc-policy-island\/issues/);
});
