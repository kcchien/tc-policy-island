import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceReportHref, SOURCE_REPORT_TEMPLATE } from '../site/js/report-link.js';

const TEMPLATE_FILE = new URL(`../.github/ISSUE_TEMPLATE/${SOURCE_REPORT_TEMPLATE}`, import.meta.url);

test('市民補件的網址開本 repo 的回報範本，標題與欄位預填議題區與候選人姓名，並標上待分類', () => {
  const href = sourceReportHref({ areaName: '交通', candidateName: '候選人甲' });
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, 'https://github.com/kcchien/tc-policy-island/issues/new');
  assert.equal(url.searchParams.get('template'), 'source-report.yml');
  assert.equal(url.searchParams.get('labels'), 'needs-triage');
  assert.equal(url.searchParams.get('title'), '補件：交通／候選人甲');
  assert.equal(url.searchParams.get('area'), '交通');
  assert.equal(url.searchParams.get('candidate'), '候選人甲');
});

test('名稱裡的特殊字元正確編碼，不會截斷或混入其他參數', () => {
  const href = sourceReportHref({ areaName: '都市發展與住宅 & 公園?#', candidateName: '候選人 乙=丙' });
  assert.ok(!href.includes(' '), href);
  assert.ok(!/[?&]公園/.test(href), href);
  const url = new URL(href);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('area'), '都市發展與住宅 & 公園?#');
  assert.equal(url.searchParams.get('candidate'), '候選人 乙=丙');
});

test('回報範本有網址預填用的欄位：議題區、候選人、來源連結（必填）、來源類型、原文片段', () => {
  const yaml = readFileSync(TEMPLATE_FILE, 'utf8');
  const ids = [...yaml.matchAll(/^\s+id:\s*(\S+)/gm)].map((m) => m[1]);
  assert.deepEqual(ids, ['area', 'candidate', 'source-url', 'source-type', 'quote']);
  // 只有來源連結必填。
  const required = [...yaml.matchAll(/required:\s*true/g)];
  assert.equal(required.length, 1);
  assert.match(yaml, /id: source-url[\s\S]*?required: true[\s\S]*?id: source-type/);
});
