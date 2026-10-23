## 專案慣例（台中政見島）

用 `GLOSSARY.md` 的詞彙命名與撰寫。任何改動不得違反 `docs/adr/0001-neutrality-rules.md` 的中立規則。

### 技術限制

- 純靜態網站：HTML 加 importmap、原生 ES 模組、手寫 CSS 變數。不用框架、不打包。
- 工具與測試只用 Node 24 內建模組（`node:test`、`node:assert`、`node:fs` 等）。`package.json` 不得有任何相依欄位，也不得出現 lockfile 與 `node_modules`，`test/repo.test.js` 會擋。
- `site/js/` 的模組瀏覽器與 Node 共用，只能 import 同目錄的相對路徑，不得 import `node:` 模組。只給 Node 用的程式放 `scripts/`。

### 指令

| 指令 | 作用 |
|---|---|
| `node --test` | 跑全部測試（`test/**/*.js`） |
| `node scripts/build.js [--raw data/raw] [--out site/data/dataset.json]` | 原始資料 → 公開資料集；驗證失敗列出全部錯誤並以結束碼 1 退出 |
| `node scripts/gates.js [site]` | 對建置後的網站目錄跑上線關卡，任一項失敗結束碼 1 |
| `node scripts/preview.js [--port 8000] [--dir site]` | 本機預覽網站目錄 |
| `npm run check` | 測試 → 建置 → 關卡，交件前跑這個 |

看夾具資料的畫面：`node scripts/build.js --raw test/fixtures/raw-sample` 後開預覽；看完再跑一次 `node scripts/build.js` 換回正式資料。CI（`.github/workflows/check.yml`）每次 push 跑測試、建置、關卡，不部署。

### 目錄

```
site/                  部署根目錄（Cloudflare Pages 只上傳這裡）
  index.html           importmap 與頁面骨架
  css/main.css         配色變數（依 ADR 0001）
  js/dataset.js        政見資料集：欄位表、驗證、排除未核對、候選人排序
  js/view-model.js     檢視模型：議題區 × 候選人矩陣
  js/table-view.js     表格檢視
  js/filter.js         搜尋與行政區篩選（filterViewModel）
  js/policy-card.js    政見卡片（兩種檢視共用）
  js/app-state.js      網址參數與檢視選擇
  js/main.js           進站流程：選檢視、載入資料、接上篩選與卡片
  js/dom.js            建立 DOM 節點的小工具（不用 innerHTML）
  _headers             Cloudflare Pages 回應標頭（出處快照指定 UTF-8）
  data/dataset.json    建置產物，不進版控
  data/snapshots/      建置時複製的公開出處快照，不進版控
  vendor/three/        three.js r160（島嶼檢視的票加入）
data/raw/              原始資料（建置輸入）
  meta.json  candidates.json  issue-areas.json
  sources/<candidateId>.json   每位候選人一檔，陣列
  policies/<candidateId>.json  每位候選人一檔，陣列
data/snapshots/        出處的文字快照，檔名 <sourceId>.txt
scripts/               Node 工具；scripts/gates/ 每項關卡一個模組
test/                  node:test 測試；test/fixtures/ 放夾具
```

### 資料結構

欄位的唯一定義是 `site/js/dataset.js` 的 `SCHEMAS`。改欄位時同時改 `SCHEMAS`、本節與測試。欄位名用英文 camelCase，內容只有中文，不做雙語結構。`?` 表示可為 `null`。

- **meta**：`dataCutoffDate`（YYYY-MM-DD）、`checklistVersion?`。公開資料集另加 `candidateOrder`（`name-strokes` 或 `ballot-number`）與 `builtAt`。
- **候選人**：`id`、`name`、`party`、`ballotNumber?`、`nameStrokes`、`rawPolicyItems { total?, sourceIds[] }`（原始政見條目總數與其出處，`total` 為 `null` 表示尚未統計）、`dataStatus?`（例如「尚無一手來源」）。號次須全部為 `null`（抽籤前，依筆畫排序）或全部填寫（抽籤後，依號次排序）；排序鍵不得相同。
- **議題區**：`id`、`name`、`departments[]`、`description`、`axial [q, r]`（不得重複）、`localElementId?`。
- **出處**：`id`、`candidateId`、`url`、`archiveUrl?`、`archiveError?`（存檔失敗原因）、`snapshotPath`（相對 repo 根目錄）、`snapshotSha256`、`sourceType`（`official-website`、`official-facebook`、`policy-presentation`、`election-bulletin`，中文名見 `SOURCE_TYPES`）、`title`、`retrievedAt`。
- **政見**：`id`、`candidateId`、`issueAreaId`（恰好一個）、`summary`、`quotes[] { text, sourceId }`（至少一則，出處須屬同一位候選人）、`districts[]`（`TAICHUNG_DISTRICTS` 的 29 區正式名稱，可空）、`conflictNote?`（出處說法不一標註）、`verification`。
- **核對紀錄** `verification`：`layer1 { status, checkedAt? }`、`layer2 { status, reason?, checklistVersion?, model?, checkedAt? }`。`status` 為 `pending`（未核對）、`pass`、`fail`。有結果時其餘欄位必填。兩層都是 `pass` 才進公開資料集；出處只公開被公開政見引用、或列在 `rawPolicyItems.sourceIds` 的那些。
- 排序規則的欄位與說明文字只定義在 `CANDIDATE_ORDER_RULES`，判斷用 `candidateOrderOf`。

檢視模型（`buildViewModel`）輸出 `rows[].cells[]`，每格 `status` 為 `has-policies` 或 `no-policies`，候選人附 `policyCount` 與 `rawPolicyItems`，另有 `noPolicyText` 與 `candidateOrderNote`。政見的 `quotes[].source` 附出處的中文來源類型與 `snapshotUrl`（網站上的出處快照位置）。島嶼檢視與表格檢視都只讀檢視模型。`filterViewModel` 篩選後，沒有符合政見的格子 `status` 為 `no-matches`，沒有任何符合政見的議題區整列移除。

網址參數（`app-state.js`）：`area` 議題區、`policy` 政見、`q` 關鍵字、`district` 適用行政區、`view`（`island` 或 `table`）。不支援 WebGL 時一律用表格檢視。

### 資料與夾具

- `data/raw/` 只放從一手來源抽取的真實資料。示範或測試用的政見一律放 `test/fixtures/`，候選人用虛構的「範例甲乙丙」「候選人甲乙丙」，不掛真實候選人的名字。
- 新增上線關卡：在 `scripts/gates/` 寫一個 `{ id, name, check(site) }` 模組（`check` 回傳失敗訊息陣列，`site.dataset()` 讀公開資料集），加進 `scripts/gates/index.js` 的 `GATES`，並在 `test/gates.test.js` 用夾具網站目錄驗證擋下違規、放行合規。
- `test/` 底下的 `.js` 都會被 `node --test` 當成測試檔執行，夾具模組不要有副作用。
- 無頭 Chrome 的 `--window-size` 有最小寬度，390px 截圖會被裁切，手機版改用可模擬裝置寬度的瀏覽器驗證。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
