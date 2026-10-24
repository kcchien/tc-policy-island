// 閱讀流程的瀏覽器回歸測試：使用既有 CDP 與 Node 內建 HTTP 提供網站，無 Chrome 的環境略過。
// 不讀建置產物；公開資料集由虛構候選人夾具產生。畫面證據仍由 scripts/shoot.js 擷取。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { findChrome, launchChrome, openPage } from '../scripts/lib/cdp.js';
import { buildPublicDataset } from '../site/js/dataset.js';
import { makeRaw } from './fixtures/make-raw.js';

let chromePath;
try { chromePath = findChrome(); } catch { /* CI 沒有 Chrome 時仍跑其餘 Node 測試。 */ }

test('政見卡片初次可讀、篩選可辨認且可清除，表格定位避開實際欄頭', { skip: !chromePath }, async (t) => {
  const raw = makeRaw();
  raw.issueAreas[0].name = '交通';
  raw.issueAreas[0].description = '公車、捷運、鐵路、道路、停車與自行車路網。';
  raw.policies[0].summary = '增設公車路線，串連車站與住宅區，並延長末班車服務時間，方便市民通勤與返家。';
  raw.policies.push(
    { ...structuredClone(raw.policies[0]), id: 'p-a2', summary: '捷運路網銜接車站', districts: ['大里區'], conflictNote: '兩個出處說法不同' },
    { ...structuredClone(raw.policies[0]), id: 'p-a3', summary: '增設自行車停車空間' },
  );
  raw.candidates.find((c) => c.id === 'cand-c').dataStatus = '尚無一手來源';
  const dataset = buildPublicDataset(raw);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/data/dataset.json') {
      res.writeHead(200, { 'Content-Type': mime['.json'] });
      res.end(JSON.stringify(dataset));
      return;
    }
    if (path === '/api/hit') { res.writeHead(204); res.end(); return; }
    try {
      const file = path === '/' ? '/index.html' : path;
      const content = await readFile(new URL(`../site${file}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome({ chrome: chromePath });
  t.after(async () => { await chrome.close(); await new Promise((resolve) => server.close(resolve)); });
  const page = await openPage(chrome.browser);
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const open = async (width, height, search = '?view=table&area=area-a') => {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 800 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.send('Page.navigate', { url: base + '/' + search });
    for (let i = 0; i < 100; i++) {
      if (await evaluate("Boolean(document.querySelector('.policy-card[open]'))")) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail('政見卡片未開啟');
  };

  for (const [width, height] of [[390, 844], [360, 800]]) {
    await t.test(`${width}×${height}：初次開卡摘要完整可見，空欄與補件可見，保留手動半高與候選人資料卡`, async () => {
      await open(width, height);
      const layout = await evaluate(`(() => {
        const card = document.querySelector('.policy-card');
        const summary = card.querySelector('.is-active .policy-summary').getBoundingClientRect();
        const column = card.querySelector('.card-columns').getBoundingClientRect();
        const number = card.querySelector('.card-number').getBoundingClientRect();
        const title = card.querySelector('.card-title').getBoundingClientRect();
        return { snap: card.dataset.snap, top: summary.top, bottom: summary.bottom, columnBottom: column.bottom, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, width: innerWidth, alignedTitle: Math.abs(number.top - title.top) < 1 };
      })()`);
      assert.equal(layout.snap, 'full');
      assert.ok(layout.top >= 0 && layout.bottom <= Math.min(layout.height, layout.columnBottom), JSON.stringify(layout));
      assert.equal(layout.scrollWidth, layout.width);
      assert.equal(layout.alignedTitle, true);
      const steps = await evaluate(`(() => {
        const r = document.querySelector('.policy-card .card-steps').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, limit: document.querySelector('.policy-card .card-columns').getBoundingClientRect().bottom };
      })()`);
      assert.ok(steps.top >= steps.limit - 1 && steps.bottom <= height, JSON.stringify(steps));
      const empty = await evaluate(`(() => {
        document.getElementById('card-tab-2').click();
        const nodes = [...document.querySelectorAll('.policy-card .is-active .no-policy, .policy-card .is-active .source-report')];
        return nodes.map((n) => ({ text: n.textContent, top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom, limit: document.querySelector('.policy-card .card-columns').getBoundingClientRect().bottom }));
      })()`);
      assert.equal(empty.length, 2);
      assert.ok(empty.every((n) => n.top >= 0 && n.bottom <= Math.min(height, n.limit)), JSON.stringify(empty));
      const state = await evaluate(`(() => {
        document.querySelector('.policy-card .card-handle').click();
        const half = document.querySelector('.policy-card').dataset.snap;
        document.querySelector('.policy-card .card-handle').click();
        const full = document.querySelector('.policy-card').dataset.snap;
        document.querySelector('.policy-card .card-close').click();
        document.querySelector('.candidate-strip button').click();
        return { half, full, profile: document.querySelector('.candidate-dialog').dataset.snap };
      })()`);
      assert.deepEqual(state, { half: 'half', full: 'full', profile: 'half' });
    });
  }

  await t.test('說明與篩選直接可見，清除回到收錄狀態並把焦點留在搜尋', async () => {
    await open(390, 844, '?view=table&area=area-a&q=公車&district=大里區');
    const result = await evaluate(`(() => {
      const initial = {
        foldedTools: document.querySelectorAll('.card-context, .card-filter-tools, .card-share').length,
        query: document.getElementById('card-search').value,
        district: document.getElementById('card-district').value,
        descriptionVisible: document.querySelector('.card-head .card-description').getBoundingClientRect().height > 0,
        controlsVisible: [...document.querySelectorAll('.card-filters input, .card-filters select, .card-clear-filter')].every((n) => n.getBoundingClientRect().height > 0),
      };
      document.querySelector('.card-clear-filter').click();
      return { initial, empty: [...document.querySelectorAll('.policy-card .no-policy')].map((n) => n.textContent), query: document.getElementById('card-search').value, district: document.getElementById('card-district').value, focused: document.activeElement.id, clearDisabled: document.querySelector('.card-clear-filter').disabled };
    })()`);
    assert.deepEqual(result.initial, { foldedTools: 0, query: '公車', district: '大里區', descriptionVisible: true, controlsVisible: true });
    assert.equal(result.query, '');
    assert.equal(result.district, '');
    assert.equal(result.focused, 'card-search');
    assert.equal(result.clearDisabled, true);
    assert.deepEqual(result.empty, ['本站尚未收錄這個議題的政見（截至 2026-10-23）']);
  });

  await t.test('數量收進三人一致的收錄說明，未知不改成零；場景設定使用可展開入口且保留功能', async () => {
    await open(390, 844);
    const reading = await evaluate(`(() => ({
      notes: [...document.querySelectorAll('.policy-card .collection-note')].map((n) => ({ open: n.open, text: n.textContent })),
      heads: [...document.querySelectorAll('.card-column-head')].map((n) => n.textContent),
      tableNotes: document.querySelectorAll('.policy-table thead .collection-note').length,
      background: getComputedStyle(document.getElementById('controls')).visibility,
    }))()`);
    assert.equal(reading.notes.length, 3);
    assert.equal(reading.tableNotes, 3);
    assert.ok(reading.notes.every((n) => !n.open && n.text.includes('原始政見條目尚未統計') && n.text.includes('不代表') && n.text.includes('2026-10-23')));
    assert.ok(reading.heads.every((text) => !text.includes('筆政見') && !text.includes('原始政見')));
    assert.equal(reading.background, 'hidden');
    await evaluate("document.querySelector('.policy-card').close()");
    const scene = await evaluate(`(() => {
      const settings = document.getElementById('scene-controls');
      const initial = settings.open;
      settings.querySelector('summary').click();
      document.getElementById('tool-pause').click();
      document.getElementById('tool-labels').click();
      return { initial, open: settings.open, name: settings.querySelector('summary').textContent.trim(), timeButtons: settings.querySelectorAll('[data-time]').length, paused: document.getElementById('tool-pause').getAttribute('aria-pressed'), labels: document.getElementById('tool-labels').getAttribute('aria-pressed'), music: Boolean(settings.querySelector('#tool-music')), volume: Boolean(settings.querySelector('#tool-music-volume')), indexOutside: !settings.contains(document.getElementById('tool-index')), viewsOutside: !settings.contains(document.querySelector('.view-switch')), background: getComputedStyle(document.getElementById('controls')).visibility };
    })()`);
    assert.deepEqual(scene, { initial: false, open: true, name: '場景設定', timeButtons: 5, paused: 'true', labels: 'false', music: true, volume: true, indexOutside: true, viewsOutside: true, background: 'visible' });
  });

  await t.test('來源狀態只在收錄說明，共通核對限制只有一份且保留逐筆核對紀錄', async () => {
    await open(1366, 900);
    const disclosure = await evaluate(`(() => {
      document.querySelector('.card-expand').click();
      const card = document.querySelector('.policy-card');
      return {
        sourceNotes: [...card.querySelectorAll('.collection-note')].map((n) => n.textContent),
        persistentSources: card.querySelectorAll('.card-column > .data-status').length,
        scopes: card.querySelectorAll('.verification-scope').length,
        repeatedScopes: card.querySelectorAll('.policy .verification-scope').length,
        records: card.querySelectorAll('.verification-line').length,
        method: card.querySelector('.verification-scope a').getAttribute('href'),
        tableSources: document.querySelectorAll('.policy-table .data-status').length,
      };
    })()`);
    assert.ok(disclosure.sourceNotes.every((text) => text.includes('本站已取得') || text.includes('本站尚未取得')));
    assert.equal(disclosure.persistentSources, 0);
    assert.equal(disclosure.scopes, 1);
    assert.equal(disclosure.repeatedScopes, 0);
    assert.equal(disclosure.records, 4);
    assert.equal(disclosure.method, './method.html#verification');
    assert.equal(disclosure.tableSources, 0);
  });

  await t.test('序號依各候選人在本議題的完整順序，篩選後固定且不改複製與朗讀內容', async () => {
    await open(390, 844);
    const numbers = await evaluate(`(async () => {
      const read = () => [...document.querySelectorAll('.card-column')].map((column) => [...column.querySelectorAll('.policy-number')].map((n) => n.textContent));
      const initial = read();
      const search = document.getElementById('card-search');
      search.value = '捷運'; search.dispatchEvent(new Event('input', { bubbles: true }));
      const filtered = read();
      document.querySelector('.card-clear-filter').click();
      document.getElementById('card-conflict').click();
      const conflicts = read();
      document.querySelector('.card-clear-filter').click();
      const district = document.getElementById('card-district');
      district.value = '大里區'; district.dispatchEvent(new Event('input', { bubbles: true }));
      const districts = read();
      document.querySelector('.card-clear-filter').click();
      document.querySelector('#card-policy-p-a2 .policy-head').click();
      const copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => copied.push(text) } });
      document.querySelector('#card-policy-p-a2 [data-action="copy"]').click();
      const { policySpeech } = await import('./js/policy-text.js');
      const dataset = await (await fetch('./data/dataset.json')).json();
      return { initial, filtered, conflicts, districts, reset: read(), copied: copied[0], speech: policySpeech(dataset.policies.find((p) => p.id === 'p-a2')) };
    })()`);
    assert.deepEqual(numbers.initial, [['01', '02', '03'], ['01'], []]);
    assert.deepEqual(numbers.filtered, [['02'], [], []]);
    assert.deepEqual(numbers.conflicts, [['02'], [], []]);
    assert.deepEqual(numbers.districts, [['02'], [], []]);
    assert.deepEqual(numbers.reset, numbers.initial);
    assert.ok(numbers.copied.includes('摘要：捷運路網銜接車站'));
    assert.ok(!/^02\b/m.test(numbers.copied));
    assert.ok(numbers.speech.startsWith('捷運路網銜接車站'));
    assert.ok(!numbers.speech.includes('02'));
  });

  await t.test('三位數序號與長摘要在手機及桌面不溢出，桌面三欄仍各自捲動並固定欄頭', async () => {
    for (const [width, height] of [[360, 800], [390, 844], [1366, 900], [1536, 960]]) {
      await open(width, height);
      const layout = await evaluate(`(async () => {
        document.querySelector('.policy-card').close();
        const { buildViewModel } = await import('./js/view-model.js');
        const { createPolicyCard } = await import('./js/policy-card.js');
        const dataset = await (await fetch('./data/dataset.json')).json();
        const template = dataset.policies[0];
        dataset.policies = dataset.candidates.flatMap((candidate) => Array.from({ length: 105 }, (_, i) => ({
          ...template, id: candidate.id + '-' + i, candidateId: candidate.id,
          summary: (i === 104 ? '定位測試：' : '') + '增設公車路線與候車空間，串連車站與住宅區，方便市民通勤與返家。',
        })));
        const vm = buildViewModel(dataset);
        const card = createPolicyCard();
        document.querySelector('.policy-card').remove();
        document.body.append(card.element);
        card.open(vm.rows[0], vm);
        card.element.querySelector('.card-expand').click();
        const columns = [...card.element.querySelectorAll('.card-column')];
        const rect = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, top: r.top }; };
        const heads = columns.map((n) => n.querySelector('.card-column-head'));
        const before = heads.map(rect);
        columns.forEach((n) => n.scrollTop = 500);
        const sticky = heads.map((n, i) => Math.abs(rect(n).top - before[i].top) < 1);
        const scrolled = columns.map((n) => n.scrollTop);
        const search = document.getElementById('card-search');
        search.value = '定位測試'; search.dispatchEvent(new Event('input', { bubbles: true }));
        const policies = [...card.element.querySelectorAll('.policy')];
        return {
          numbers: policies.map((n) => n.querySelector('.policy-number').textContent),
          fits: policies.filter((n) => n.getBoundingClientRect().width > 0).every((n) => {
            const number = rect(n.querySelector('.policy-number'));
            const summary = rect(n.querySelector('.policy-summary'));
            return number.right <= summary.left && summary.right <= rect(n).right && summary.width > 150;
          }),
          overflow: card.element.scrollWidth > card.element.clientWidth,
          sticky, scrolled, columnWidths: before.map((r) => r.width),
          toolsOneRow: Math.abs(rect(document.getElementById('card-search')).top - rect(card.element.querySelector('.card-expand')).top) < 1,
          buttonHeights: [...card.element.querySelectorAll('.card-clear-filter, .card-expand')].map((n) => n.getBoundingClientRect().height),
        };
      })()`);
      assert.deepEqual(layout.numbers, ['105', '105', '105']);
      assert.equal(layout.fits, true, JSON.stringify({ width, ...layout }));
      assert.equal(layout.overflow, false);
      assert.ok(layout.buttonHeights.every((n) => n >= 44));
      if (width > 800) {
        assert.equal(layout.toolsOneRow, true);
        assert.ok(layout.sticky.every(Boolean));
        assert.ok(layout.scrolled.every((n) => n > 0));
        assert.ok(Math.max(...layout.columnWidths) - Math.min(...layout.columnWidths) < 1);
      }
    }
  });

  await t.test('摘要展開後出處與朗讀入口仍可用，勾選對照單保留三人與列印出口', async () => {
    await open(390, 844);
    const policy = await evaluate(`(() => {
      document.querySelector('.is-active .policy-head').click();
      const source = document.querySelector('.is-active .source-links a');
      const speak = document.querySelector('.is-active [data-action="speak"]');
      document.querySelector('.is-active .policy-pick input').click();
      return { source: source.href, speak: speak.textContent.trim(), disabled: speak.disabled, picked: document.querySelector('.shortlist-open').hidden === false };
    })()`);
    assert.deepEqual(policy, { source: 'https://example.org/cand-a', speak: '朗讀', disabled: false, picked: true });
    await evaluate("document.querySelector('.policy-card').close()");
    const shortlist = await evaluate(`(() => {
      document.querySelector('.shortlist-open').click();
      return { columns: document.querySelectorAll('.shortlist-dialog .shortlist-column').length, note: document.querySelector('.shortlist-dialog .no-policy').textContent, print: [...document.querySelectorAll('.shortlist-dialog button')].some((n) => n.textContent === '列印' && !n.disabled) };
    })()`);
    assert.deepEqual(shortlist, { columns: 3, note: '本站尚未收錄這個議題的政見（截至 2026-10-23）', print: true });
  });

  await t.test('網址政見、隨機一題與下一題使用全高；Esc 關閉後焦點回到觸發點', async () => {
    await open(390, 844, '?view=table&policy=p-a1');
    assert.equal(await evaluate("document.querySelector('.policy-card').dataset.snap"), 'full');
    await evaluate("document.querySelector('.policy-card').close()");
    await new Promise((resolve) => setTimeout(resolve, 25));
    await evaluate(`(() => {
      const trigger = document.querySelector('#area-area-b .area-open');
      trigger.focus(); trigger.click();
    })()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const focus = await evaluate(`({ open: document.querySelector('.policy-card').open, returned: document.activeElement === document.querySelector('#area-area-b .area-open') })`);
    assert.deepEqual(focus, { open: false, returned: true });
    // 清除閱讀紀錄，確保摘要入口也會經過首次閱讀的重繪。
    await evaluate(`(() => {
      document.querySelector('.reading-clear').click();
      const trigger = document.querySelector('#area-area-a .policy-chip[data-policy="p-a1"]');
      trigger.focus(); trigger.click();
    })()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(await evaluate("document.activeElement === document.querySelector('#area-area-a .policy-chip[data-policy=\"p-a1\"]')"), true);
    const steps = await evaluate(`(() => {
      document.getElementById('random-area').click();
      const random = document.querySelector('.policy-card').dataset.snap;
      document.querySelector('.card-step:last-child').click();
      return { random, next: document.querySelector('.policy-card').dataset.snap };
    })()`);
    assert.deepEqual(steps, { random: 'full', next: 'full' });
  });

  await t.test('長說明與 200% 僅文字放大可自然捲動，摘要、換題與關閉皆可到達', async () => {
    await open(360, 800);
    const zoom = await evaluate(`(() => {
      document.documentElement.style.fontSize = '200%';
      document.querySelector('.card-description').textContent = '公車、捷運、鐵路、道路、停車與自行車路網。'.repeat(8);
      const inner = document.querySelector('.policy-card .card-inner');
      const body = document.querySelector('.policy-card .card-columns');
      inner.scrollTop = inner.scrollHeight;
      const summary = document.querySelector('.is-active .policy-summary');
      summary.scrollIntoView({ block: 'center' });
      const summaryVisible = summary.getBoundingClientRect().top >= 0 && summary.getBoundingClientRect().bottom <= innerHeight;
      const next = document.querySelector('.card-step:last-child');
      next.scrollIntoView({ block: 'center' });
      const nextVisible = next.getBoundingClientRect().bottom <= innerHeight;
      const close = document.querySelector('.policy-card .card-close');
      close.scrollIntoView({ block: 'center' });
      const closeVisible = close.getBoundingClientRect().top >= 0;
      return { scrollable: inner.scrollHeight > inner.clientHeight, bodyHeight: body.clientHeight, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, contextText: document.querySelector('.card-description').textContent, contextClamp: getComputedStyle(document.querySelector('.card-description')).webkitLineClamp, summaryVisible, nextVisible, closeVisible };
    })()`);
    assert.equal(zoom.scrollable, true);
    assert.ok(zoom.bodyHeight > 0);
    assert.equal(zoom.scrollWidth, zoom.width);
    assert.equal(zoom.contextClamp, 'none');
    assert.equal(zoom.summaryVisible, true);
    assert.equal(zoom.nextVisible, true);
    assert.equal(zoom.closeVisible, true);
    assert.ok(zoom.contextText.includes('公車、捷運、鐵路、道路、停車與自行車路網。'.repeat(8)));
  });

  await t.test('表格欄頭高度改變後重新定位，列首仍在欄頭下方；窄版不保留隱藏欄頭高度', async () => {
    await open(1366, 900);
    const desktop = await evaluate(`(async () => {
      document.querySelector('.policy-card').close();
      const { scrollToTableRow } = await import('./js/table-view.js');
      const root = document.getElementById('table-root');
      const heads = [...root.querySelectorAll('thead th')];
      heads.forEach((n) => n.style.paddingBottom = '100px');
      scrollToTableRow(root, 'area-b');
      await new Promise(requestAnimationFrame);
      return {
        margin: parseFloat(document.getElementById('area-area-b').style.scrollMarginTop),
        height: Math.max(...heads.map((n) => n.getBoundingClientRect().height)),
        rowTop: document.getElementById('area-area-b').getBoundingClientRect().top,
        headerBottom: Math.max(...heads.map((n) => n.getBoundingClientRect().bottom)),
      };
    })()`);
    assert.ok(desktop.margin >= desktop.height && desktop.height > 100, JSON.stringify(desktop));
    assert.ok(desktop.rowTop >= desktop.headerBottom - 1, JSON.stringify(desktop));
    await page.send('Emulation.setDeviceMetricsOverride', { width: 680, height: 900, deviceScaleFactor: 1, mobile: false });
    const narrow = await evaluate(`(async () => {
      const { scrollToTableRow } = await import('./js/table-view.js');
      scrollToTableRow(document.getElementById('table-root'), 'area-b');
      return parseFloat(document.getElementById('area-area-b').style.scrollMarginTop);
    })()`);
    assert.equal(narrow, 0);
  });
});
