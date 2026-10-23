import { buildViewModel } from './view-model.js';
import { renderTable } from './table-view.js';

const DATASET_URL = './data/dataset.json';

async function start() {
  const app = document.getElementById('app');
  try {
    const response = await fetch(DATASET_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const vm = buildViewModel(await response.json());
    document.getElementById('data-cutoff-date').textContent = vm.meta.dataCutoffDate;
    renderTable(app, vm);
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'status status-error';
    message.textContent = `政見資料載入失敗（${error.message}），請稍後重新整理。`;
    app.replaceChildren(message);
  }
}

start();
