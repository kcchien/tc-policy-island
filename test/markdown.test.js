import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMarkdown, plainText } from '../site/js/markdown.js';
import { REPO_DOCUMENTS } from '../site/js/repo-documents.js';

test('標題、段落、行內程式碼、粗體與連結', () => {
  const blocks = parseMarkdown('# 分類規則\n\n本文件說明 `data/raw/issue-areas.json` 的\n**議題區**，見 [對照表](policy-area-mapping.md)。');

  assert.deepEqual(blocks, [
    { type: 'heading', level: 1, inlines: [{ type: 'text', text: '分類規則' }] },
    {
      type: 'paragraph',
      inlines: [
        { type: 'text', text: '本文件說明 ' },
        { type: 'code', text: 'data/raw/issue-areas.json' },
        { type: 'text', text: ' 的\n' },
        { type: 'strong', text: '議題區' },
        { type: 'text', text: '，見 ' },
        { type: 'link', text: '對照表', href: 'policy-area-mapping.md' },
        { type: 'text', text: '。' },
      ],
    },
  ]);
});

test('有序清單內的巢狀無序清單', () => {
  const blocks = parseMarkdown('1. 第一點\n2. 第二點：\n   - 子項甲\n   - 子項乙\n3. 第三點');

  assert.deepEqual(blocks, [{
    type: 'list',
    ordered: true,
    start: 1,
    items: [
      { inlines: [{ type: 'text', text: '第一點' }], children: [] },
      {
        inlines: [{ type: 'text', text: '第二點：' }],
        children: [{
          type: 'list',
          ordered: false,
          start: 1,
          items: [
            { inlines: [{ type: 'text', text: '子項甲' }], children: [] },
            { inlines: [{ type: 'text', text: '子項乙' }], children: [] },
          ],
        }],
      },
      { inlines: [{ type: 'text', text: '第三點' }], children: [] },
    ],
  }]);
});

test('從中間編號開始的有序清單保留起始編號', () => {
  const [list] = parseMarkdown('7. 一條政見\n8. 原文引述');

  assert.equal(list.start, 7);
});

test('表格與程式碼區塊', () => {
  const blocks = parseMarkdown('| 議題區 | 對應局處 |\n|---|---|\n| 交通 | 交通局、`捷運` |\n\n```\nr=-2  [治安]\n```');

  assert.deepEqual(blocks, [
    {
      type: 'table',
      header: [[{ type: 'text', text: '議題區' }], [{ type: 'text', text: '對應局處' }]],
      rows: [[[{ type: 'text', text: '交通' }], [{ type: 'text', text: '交通局、' }, { type: 'code', text: '捷運' }]]],
    },
    { type: 'code', text: 'r=-2  [治安]' },
  ]);
});

// 呈現時不得漏字：每份 Markdown 文件去掉標記後的每一行文字，都要出現在解析結果的純文字中。
const stripMarkup = (line) => line
  .replace(/^\s*(#+|[-*]|\d+\.|```)\s?/, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\*\*|`/g, '')
  .replace(/\|/g, '')
  .replace(/^-+$/, '')
  .replace(/\s+/g, '');

for (const doc of REPO_DOCUMENTS.filter((d) => d.format === 'markdown' && !d.optional)) {
  test(`${doc.title}（${doc.path}）解析後不漏字`, () => {
    const text = readFileSync(new URL(`../${doc.path}`, import.meta.url), 'utf8');
    const rendered = plainText(parseMarkdown(text)).replace(/\s+/g, '');

    const lost = text.split('\n').map(stripMarkup).filter((line) => line && !rendered.includes(line));
    assert.deepEqual(lost, []);
  });
}
