// 整理方法頁：填入由公開資料集產生的內容，並在 data-repo-file 容器裡呈現引用 repo 文件的原文。
import { orderCandidates } from './dataset.js';
import { el } from './dom.js';
import { parseMarkdown } from './markdown.js';
import { candidateOrderItems, dataStatusItems, resolveDocLink } from './method-content.js';
import { REPO_FILES_MANIFEST, repoDocumentByPath, repoFileSitePath, repoFileUrl } from './repo-documents.js';

const DATASET_URL = './data/dataset.json';
const MANIFEST_URL = `./data/${REPO_FILES_MANIFEST}`;
const TIER_LABELS = { brand: '品牌用語', frequent: '陣營高頻詞' };

async function fetchOk(url, as) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return as === 'json' ? response.json() : response.text();
}

function inlineNodes(inlines, docPath) {
  return inlines.map((node) => {
    switch (node.type) {
      case 'code':
        return el('code', {}, node.text);
      case 'strong':
        return el('strong', {}, node.text);
      case 'link':
        return el('a', { href: resolveDocLink(docPath, node.href) }, node.text);
      default:
        return node.text;
    }
  });
}

// 文件內的標題降兩級，接在頁面的 h3 文件標題之下。
function blockNodes(blocks, docPath) {
  return blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return el(`h${Math.min(block.level + 3, 6)}`, {}, inlineNodes(block.inlines, docPath));
      case 'paragraph':
        return el('p', {}, inlineNodes(block.inlines, docPath));
      case 'code':
        return el('pre', { class: 'repo-text' }, block.text);
      case 'list':
        return el(block.ordered ? 'ol' : 'ul', { start: block.ordered && block.start !== 1 ? String(block.start) : null },
          block.items.map((item) => el('li', {}, inlineNodes(item.inlines, docPath), blockNodes(item.children, docPath))));
      case 'table':
        return el('div', { class: 'method-table-wrap' }, el('table', { class: 'method-table' },
          el('thead', {}, el('tr', {}, block.header.map((cell) => el('th', { scope: 'col' }, inlineNodes(cell, docPath))))),
          el('tbody', {}, block.rows.map((row) => el('tr', {}, row.map((cell) => el('td', {}, inlineNodes(cell, docPath))))))));
      default:
        return null;
    }
  });
}

function checklistNodes(checklist) {
  return [
    el('p', {}, `版本 ${checklist.version}`),
    el('ol', {}, checklist.items.map((item) => el('li', {},
      el('strong', {}, item.title), el('code', { class: 'repo-id' }, item.id), el('br'), item.rule))),
  ];
}

function brandTermNodes(list, candidateNames) {
  return [
    el('p', {}, `版本 ${list.version}`),
    ...Object.entries(TIER_LABELS).flatMap(([tier, label]) => [
      el('h4', {}, `${label}（${list[tier].length} 個）`),
      el('div', { class: 'method-table-wrap' }, el('table', { class: 'method-table' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '詞'), el('th', { scope: 'col' }, '使用的候選人'), el('th', { scope: 'col' }, '說明'))),
        el('tbody', {}, list[tier].map((entry) => el('tr', {},
          el('td', {}, entry.term),
          el('td', {}, candidateNames.get(entry.candidate) ?? entry.candidate),
          el('td', {}, entry.note ?? '')))))),
    ]),
  ];
}

function documentNodes(doc, text, candidateNames) {
  switch (doc.format) {
    case 'markdown':
      return blockNodes(parseMarkdown(text), doc.path);
    case 'checklist':
      return checklistNodes(JSON.parse(text));
    case 'brand-terms':
      return brandTermNodes(JSON.parse(text), candidateNames);
    default:
      return [el('pre', { class: 'repo-text' }, text)];
  }
}

async function renderRepoDocument(container, available, candidateNames) {
  const doc = repoDocumentByPath(container.dataset.repoFile);
  const sitePath = `./${repoFileSitePath(doc.path)}`;
  const body = el('div', { class: 'repo-document-body' });
  const present = available.has(doc.path);
  const details = el('details', { class: 'repo-document', id: `doc-${doc.id}`, open: container.hasAttribute('data-open') },
    el('summary', {},
      el('span', { class: 'repo-document-label' }, '引用 repo 文件'),
      el('span', { class: 'repo-document-title' }, doc.title),
      el('code', { class: 'repo-document-path' }, doc.path)),
    present
      ? el('p', { class: 'repo-document-links' }, el('a', { href: sitePath }, '原檔'), el('a', { href: repoFileUrl(doc.path) }, '在 GitHub 查看'))
      : null,
    body);
  container.replaceChildren(details);
  if (!present) {
    body.append(el('p', { class: 'repo-document-missing' }, '尚未產生'));
    return;
  }
  try {
    body.replaceChildren(...documentNodes(doc, await fetchOk(sitePath, 'text'), candidateNames));
  } catch (error) {
    body.replaceChildren(el('p', { class: 'status status-error' }, `文件載入失敗（${error.message}），可改看原檔。`));
  }
}

function fillDataset(dataset) {
  document.getElementById('data-cutoff-date').textContent = dataset.meta.dataCutoffDate;
  const statusItems = dataStatusItems(dataset.candidates);
  document.getElementById('data-status-list').replaceChildren(...(statusItems.length > 0
    ? statusItems.map((text) => el('li', {}, text))
    : [el('li', {}, '每位候選人都已有一手來源。')]));
  const { candidateOrder } = orderCandidates(dataset.candidates);
  document.getElementById('order-rule-list').replaceChildren(...candidateOrderItems(candidateOrder).map(({ text, current }) =>
    el('li', { class: current ? 'is-current' : null }, text, current ? el('strong', { class: 'current-rule' }, '（目前採用）') : null)));
  document.querySelector('#issue-area-table tbody').replaceChildren(...dataset.issueAreas.map((area) =>
    el('tr', {}, el('th', { scope: 'row' }, area.name), el('td', {}, area.departments.join('、')), el('td', {}, area.description))));
  document.querySelector('#local-element-table tbody').replaceChildren(...dataset.localElements.map((element) =>
    el('tr', {}, el('th', { scope: 'row' }, element.name), el('td', {}, element.category), el('td', {}, element.place), el('td', {}, element.reason))));
}

async function start() {
  let dataset = null;
  let manifest = { documents: [] };
  try {
    [dataset, manifest] = await Promise.all([fetchOk(DATASET_URL, 'json'), fetchOk(MANIFEST_URL, 'json')]);
    fillDataset(dataset);
  } catch (error) {
    document.getElementById('data-cutoff-date').textContent = `資料載入失敗（${error.message}）`;
  }
  const candidateNames = new Map((dataset?.candidates ?? []).map((c) => [c.id, c.name]));
  const available = new Set(manifest.documents);
  await Promise.all([...document.querySelectorAll('[data-repo-file]')]
    .map((container) => renderRepoDocument(container, available, candidateNames)));
  openHashTarget();
  window.addEventListener('hashchange', openHashTarget);
}

// 網址或頁內連結指向某份文件時，展開並捲到該處。
function openHashTarget() {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;
  if (target instanceof HTMLDetailsElement) target.open = true;
  target.scrollIntoView({ block: 'start' });
}

start();
