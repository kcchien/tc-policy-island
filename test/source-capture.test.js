import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToSnapshotText, requestArchive } from '../scripts/lib/source-capture.js';

test('出處快照只留頁面可見文字，區塊元素各自成行，行內元素不斷行', () => {
  const html = `<!doctype html><html><head><title>政見頁</title><style>p{color:red}</style>
    <script>var x = "<p>不可見</p>";</script></head>
    <body><nav><a href="/">首頁</a></nav>
    <h1>市政<span class="accent">藍圖</span></h1>
    <!-- 註解不算可見文字 -->
    <ul><li>增設公車路線</li><li>每 15 分鐘&nbsp;一班</li></ul>
    <p>補助 3,000&#20803; 與 &lt;托育&gt; &amp; 津貼<br>第二行</p>
    <noscript>請開啟 JavaScript</noscript><svg><text>圖示</text></svg>
    </body></html>`;

  assert.equal(htmlToSnapshotText(html), [
    '首頁',
    '市政藍圖',
    '增設公車路線',
    '每 15 分鐘 一班',
    '補助 3,000元 與 <托育> & 津貼',
    '第二行',
  ].join('\n') + '\n');
});

const PAGE = 'https://example.org/policy';
const fakeFetch = (respond) => {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push(url);
    return respond(url, options);
  };
  return { fetch, calls };
};

test('送存檔成功時回傳 Wayback 轉址後的存檔網址', async () => {
  const archived = 'https://web.archive.org/web/20261023120000/https://example.org/policy';
  const { fetch, calls } = fakeFetch(() => ({ ok: true, status: 200, url: archived, headers: new Headers() }));

  assert.deepEqual(await requestArchive(PAGE, { fetch }), { archiveUrl: archived, archiveError: null });
  assert.deepEqual(calls, ['https://web.archive.org/save/https://example.org/policy']);
});

test('送存檔失敗時不給存檔網址，記錄失敗原因', async () => {
  const refused = fakeFetch(() => ({ ok: false, status: 429, url: 'https://web.archive.org/save/x', headers: new Headers() }));
  assert.deepEqual(await requestArchive(PAGE, refused), { archiveUrl: null, archiveError: 'Wayback Machine 回應 HTTP 429' });

  const offline = fakeFetch(() => { throw new Error('getaddrinfo ENOTFOUND web.archive.org'); });
  assert.deepEqual(await requestArchive(PAGE, offline), { archiveUrl: null, archiveError: 'Wayback Machine 連線失敗：getaddrinfo ENOTFOUND web.archive.org' });

  const noSnapshot = fakeFetch(() => ({ ok: true, status: 200, url: 'https://web.archive.org/save/https://example.org/policy', headers: new Headers() }));
  assert.deepEqual(await requestArchive(PAGE, noSnapshot), { archiveUrl: null, archiveError: 'Wayback Machine 沒有回傳存檔網址' });
});
