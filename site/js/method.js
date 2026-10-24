// 整理方法頁：填入由公開資料集產生的內容與統計的揭露文字，並在 data-repo-file 容器裡呈現引用 repo 文件的原文。
// 進頁時送一次頁面瀏覽。
import { orderCandidates } from './dataset.js';
import { el } from './dom.js';
import { parseMarkdown } from './markdown.js';
import { brandTermsView, candidateOrderItems, checklistView, dataStatusItems, resolveDocLink } from './method-content.js';
import { REPO_FILES_MANIFEST, repoDocumentByPath, repoFileSitePath, repoFileUrl } from './repo-documents.js';
import { pageviewHit, sendHit } from './hits.js';
import { HITS_TEXT, LOAD_TEXT, METHOD_TEXT, REPO_DOCUMENT_TEXT } from './ui-text.js';

const DATASET_URL = './data/dataset.json';
const MANIFEST_URL = `./data/${REPO_FILES_MANIFEST}`;

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

// 文件內的標題降三級（# 成為 h4），接在 summary 裡的 h3 文件標題之下。
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

function checklistNodes({ version, items }) {
  return [
    el('p', {}, METHOD_TEXT.listVersion(version)),
    el('ol', {}, items.map((item) => el('li', {},
      el('strong', {}, item.title), el('code', { class: 'repo-id' }, item.id), el('br'), item.rule))),
  ];
}

// 欄名照原檔的欄位名，候選人欄是原檔的候選人識別碼。
function brandTermNodes({ version, tiers }) {
  return [
    el('p', {}, METHOD_TEXT.listVersion(version)),
    ...tiers.flatMap(({ label, rows }) => [
      el('h4', {}, METHOD_TEXT.tierHeading(label, rows.length)),
      el('div', { class: 'method-table-wrap' }, el('table', { class: 'method-table' },
        el('thead', {}, el('tr', {}, ['term', 'candidate', 'note'].map((key) => el('th', { scope: 'col' }, el('code', {}, key))))),
        el('tbody', {}, rows.map((row) => el('tr', {}, row.map((value) => el('td', {}, value))))))),
    ]),
  ];
}

function documentNodes(doc, text) {
  switch (doc.format) {
    case 'markdown':
      return blockNodes(parseMarkdown(text), doc.path);
    case 'checklist':
      return checklistNodes(checklistView(JSON.parse(text)));
    case 'brand-terms':
      return brandTermNodes(brandTermsView(JSON.parse(text)));
    default:
      return [el('pre', { class: 'repo-text' }, text)];
  }
}

async function renderRepoDocument(container, available) {
  const doc = repoDocumentByPath(container.dataset.repoFile);
  const sitePath = `./${repoFileSitePath(doc.path)}`;
  const body = el('div', { class: 'repo-document-body' });
  const present = available.has(doc.path);
  const text = REPO_DOCUMENT_TEXT[doc.id];
  // 標題與說明用白話，不顯示檔案路徑；需要原檔的人從連結到 GitHub 或下載原始檔案。
  const details = el('details', { class: 'repo-document', id: `doc-${doc.id}`, open: container.hasAttribute('data-open') },
    el('summary', {},
      el('span', { class: 'repo-document-label' }, METHOD_TEXT.documentLabel),
      el('h3', { class: 'repo-document-title' }, text.title),
      el('span', { class: 'repo-document-description' }, text.description)),
    present
      ? el('p', { class: 'repo-document-links' },
        el('a', { href: repoFileUrl(doc.path) }, METHOD_TEXT.viewOnGithub), el('a', { href: sitePath }, METHOD_TEXT.originalFile))
      : null,
    body);
  container.replaceChildren(details);
  if (!present) {
    body.append(el('p', { class: 'repo-document-missing' }, METHOD_TEXT.missing));
    return;
  }
  try {
    body.replaceChildren(...documentNodes(doc, await fetchOk(sitePath, 'text')));
  } catch (error) {
    console.error(error);
    body.replaceChildren(el('p', { class: 'status status-error' }, LOAD_TEXT.documentFailed));
  }
}

function fillDataset(dataset) {
  document.getElementById('data-cutoff-date').textContent = dataset.meta.dataCutoffDate;
  const statusItems = dataStatusItems(dataset.candidates);
  document.getElementById('data-status-list').replaceChildren(...(statusItems.length > 0
    ? statusItems.map((text) => el('li', {}, text))
    : [el('li', {}, METHOD_TEXT.allHaveSources)]));
  const { candidateOrder } = orderCandidates(dataset.candidates);
  document.getElementById('order-rule-list').replaceChildren(...candidateOrderItems(candidateOrder).map(({ text, current }) =>
    el('li', { class: current ? 'is-current' : null }, text, current ? el('strong', { class: 'current-rule' }, METHOD_TEXT.currentRule) : null)));
  fillRows('issue-area-table', dataset.issueAreas.map((area) => [area.name, area.departments.join('、'), area.description]));
  fillRows('local-element-table', dataset.localElements.map((e) => [e.name, e.category, e.place, e.reason]));
}

// 每列第一格是列標題；data-label 讓窄螢幕逐列堆疊時仍看得到欄名。
function fillRows(tableId, rows) {
  const table = document.getElementById(tableId);
  const labels = [...table.querySelectorAll('thead th')].map((th) => th.textContent);
  table.tBodies[0].replaceChildren(...rows.map(([head, ...cells]) => el('tr', {},
    el('th', { scope: 'row' }, head),
    cells.map((text, i) => el('td', { 'data-label': labels[i + 1] }, text)))));
}

async function start() {
  document.getElementById('hits-disclosure').textContent = HITS_TEXT.disclosure;
  sendHit(navigator, pageviewHit('method'));
  const [datasetResult, manifestResult] = await Promise.allSettled([fetchOk(DATASET_URL, 'json'), fetchOk(MANIFEST_URL, 'json')]);
  const dataset = datasetResult.status === 'fulfilled' ? datasetResult.value : null;
  if (dataset) fillDataset(dataset);
  else {
    console.error(datasetResult.reason);
    document.getElementById('data-cutoff-date').textContent = LOAD_TEXT.methodDatasetFailed;
  }
  const containers = [...document.querySelectorAll('[data-repo-file]')];
  // 文件清單載入失敗時說明載入失敗，不誤報成「尚未產生」。
  if (manifestResult.status === 'rejected') {
    console.error(manifestResult.reason);
    for (const container of containers) container.replaceChildren(el('p', { class: 'status status-error' }, LOAD_TEXT.documentsFailed));
    return;
  }
  const available = new Set(manifestResult.value.documents);
  await Promise.all(containers.map((container) => renderRepoDocument(container, available)));
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
