## 專案慣例（台中政見島）

用 `GLOSSARY.md` 的詞彙命名與撰寫。任何改動不得違反 `docs/adr/0001-neutrality-rules.md` 的中立規則。

### 技術限制

- 純靜態網站：HTML 加 importmap、原生 ES 模組、手寫 CSS 變數。不用框架、不打包。
- 工具與測試只用 Node 24 內建模組（`node:test`、`node:assert`、`node:fs` 等）。`package.json` 不得有任何相依欄位，也不得出現 lockfile 與 `node_modules`，`test/repo.test.js` 會擋。
- `site/js/` 的模組瀏覽器與 Node 共用，只能 import 同目錄的相對路徑，不得 import `node:` 模組。只給 Node 用的程式放 `scripts/`。
- 例外：repo 根目錄的 `functions/` 只放統計端點 `functions/api/hit.js`（Cloudflare Pages Function，綁定設定在 `wrangler.toml`），不得放其他後端邏輯，也不得讀或記錄可識別讀者的資料，見 `docs/adr/0003-hit-counter-on-pages-function.md`。`test/repo.test.js` 會擋。

### 指令

| 指令 | 作用 |
|---|---|
| `node --test` | 跑全部測試（`test/**/*.js`） |
| `node scripts/build.js` | 原始資料 → 公開資料集。參數與注意事項看 `--help` |
| `node scripts/gates.js` | 對建置後的網站目錄跑上線關卡。參數與注意事項看 `--help` |
| `node scripts/preview.js` | 本機預覽網站目錄。參數與注意事項看 `--help` |
| `node scripts/verify.js` | 核對候選人資料與政見（ADR 0002），第二層會花費用。參數與注意事項看 `--help` |
| `node scripts/fetch-source.js` | 擷取一個出處（出處快照、存檔、出處紀錄），或補送存檔。參數與注意事項看 `--help` |
| `node scripts/speak.js` | 生成政見語音音檔與清單（`data/audio/`），會花點數，正式資料先跑 `--dry-run`。參數與注意事項看 `--help` |
| `node scripts/shoot.js` | 截圖與版面量測，手機版驗證用這個。參數與注意事項看 `--help` |
| `npm run check` | 測試 → 建置 → 關卡，交件前跑這個 |
| `node scripts/deploy.js`（`npm run deploy`） | 檢查後部署到 Cloudflare Pages，真的部署只由維護者執行。參數與注意事項看 `--help` |

看夾具資料的畫面：`node scripts/build.js --raw test/fixtures/raw-sample` 後開預覽；看完再跑一次 `node scripts/build.js` 換回正式資料。CI（`.github/workflows/check.yml`）每次 push 跑測試、建置、關卡，不部署。

### 目錄與模組

改 `site/js/`、`scripts/` 或資料結構前，先讀 `docs/architecture.md`：目錄、模組分組、跨模組流程，以及配置模組與關卡的相依。各模組的職責寫在檔頭註解。新增、改名或刪除模組時同步更新分組清單。

易踩的坑：

- `site/data/` 是建置產物、不進版控，內容取決於上一次建置用的原始資料（正式資料或夾具）。
- 島嶼檢視與表格檢視只讀檢視模型（`buildViewModel`），不直接讀資料集；島上標記只表示有無政見，不呈現政見數量。
- 主題場景、靜態裝飾與動態只依議題區識別碼與格子決定，不讀政見；新增裝飾改 `island-decor.js` 的 `decorPlan`，每個議題區格子要相同。關卡「裝飾數量固定」「動態數量固定」「人物一致」在 Node 直接載入網站目錄裡的配置模組與它們 import 的模組，所以配置模組只能 import 同樣不碰 three.js 的模組。
- 候選人資料卡一次開三張（`main.js` 的 `openCandidateCard`），不要只放一張。
- `data/verification/` 的檢核表與第二層提示詞共用同一版本號，改內容就升版。`data/extraction/instructions.md` 改判準就升版；平行抽取遇到新判斷題的流程見該檔「判準的裁決」。
- 審查準則在 `CODING_STANDARDS.md`：做 code review 時讀；改動會依候選人而不同、送提示詞給 AI，或套用抽取判準時也照它做。

### 資料結構

欄位的唯一定義是 `site/js/dataset.js` 的 `SCHEMAS`。改欄位時同時改 `SCHEMAS`、本節與測試。欄位名用英文 camelCase，內容只有中文，不做雙語結構。`?` 表示可為 `null`。

- **meta**：`dataCutoffDate`（YYYY-MM-DD）、`checklistVersion?`、`electionSchedule?`。公開資料集另加 `candidateOrder`（`name-strokes` 或 `ballot-number`）與 `builtAt`。
- **選舉時程** `electionSchedule`：原始資料放 `data/raw/election-schedule.json`，建置時併進 `meta`，沒有檔案時為 `null`（頁首不顯示）。`votingDate`、`events[] { id, name, date, endDate?（期間的最後一天）, sourceUrl, sourceTitle }`。日期只收中選會或選舉委員會的公告，`sourceUrl` 須在 `cec.gov.tw` 底下，`sourceTitle` 照公告標題。
- **候選人**：`id`、`name`、`party`、`ballotNumber?`、`nameStrokes`、`rawPolicyItems { total?, sourceIds[] }`（原始政見條目總數與其出處，`total` 為 `null` 表示尚未統計）、`dataStatus?`（例如「尚無一手來源」，指政見）、`profile?`（候選人資料，`null` 表示尚未收錄）。號次須全部為 `null`（抽籤前，依筆畫排序）或全部填寫（抽籤後，依號次排序）；排序鍵不得相同。
- **議題區**：`id`、`name`、`departments[]`、`description`、`axial [q, r]`、`localElementId?`。清單依 `docs/rules/classification-rules.md` 劃分，數量與島的格數無關。
- **元素**：`id`、`name`、`category`（`LOCAL_ELEMENT_CATEGORIES`：自然景觀、小吃、老建築）、`place`、`reason`（與任何市長任期的政績無關的理由）。
- **裝飾格**：`id`、`axial [q, r]`、`localElementId?`。島上沒有議題區的格子。議題區與裝飾格的座標不得重複，每個元素只放一格。公開資料集另含 `localElements` 與 `decorativeTiles`。
- **出處**：`id`、`candidateId`、`url`、`archiveUrl?`、`archiveError?`（存檔失敗原因）、`snapshotPath`（相對 repo 根目錄）、`snapshotSha256`、`snapshotNote?`（快照的產生方式，例如 PDF 轉文字與字型對照還原；取自網頁可見文字時為 `null`；給維護者看，畫面只在有字形還原時以 `snapshotNoteText` 改寫成白話）、`sourceType`（`official-website`、`official-facebook`、`policy-presentation`、`election-bulletin`，中文名見 `SOURCE_TYPES`）、`title`、`retrievedAt`。
- **政見**：`id`、`candidateId`、`issueAreaId`（恰好一個）、`summary`、`quotes[] { text, sourceId }`（至少一則，出處須屬同一位候選人）、`districts[]`（`TAICHUNG_DISTRICTS` 的 29 區正式名稱，可空）、`conflictNote?`（出處說法不一標註）、`verification`。公開資料集另加 `audioUrl`（政見音檔，相對網站根目錄）：建置時每條公開政見在 `data/audio/manifest.json` 都有相符音檔才全部加上，否則全部沒有這個欄位（`SCHEMAS` 欄位名結尾的 `?` 表示可以沒有）。
- **核對紀錄** `verification`：`layer1 { status, checkedAt? }`、`layer2 { status, reason?, checklistVersion?, model?, checkedAt? }`。`status` 為 `pending`（未核對）、`pass`、`fail`。有結果時其餘欄位必填。兩層都是 `pass` 才進公開資料集；出處只公開被公開政見引用、列在 `rawPolicyItems.sourceIds`、或是公開候選人資料出處的那些。
- **候選人資料** `profile`：`birthYear`、`education[]`、`experience[]`（學歷與經歷逐字照出處）、`sourceId`（出處須屬同一位候選人）、`electionYear`、`electionName`（資料取自哪一場選舉，例如「第11屆立法委員選舉（臺中市第8選舉區）」）、`verification { layer1 { status, checkedAt? } }`。只有第一層（逐字比對），`pass` 才公開，否則公開資料集的 `profile` 為 `null`。姓名與政黨沿用候選人的欄位。抽取方法見 `data/extraction/candidate-profiles.md`。
- 排序規則的欄位與說明文字只定義在 `CANDIDATE_ORDER_RULES`，判斷用 `candidateOrderOf`。
- **正式肖像** `portrait?`：只在公開候選人，建置時全部核對完成才三人一起加入 `{ url, sourceId, electionYear, retrievedAt }`，否則全部沒有此欄位。出處與候選人資料須相同，`url` 只指向本站 `data/portraits/<candidateId>.png`。原始照片及完整來源授權清單放 `data/portraits/`，以 `scripts/lib/portraits.js` 核對。僅 `candidate-card.js` 共用資料卡可呈現，任一載入失敗全頁三人均回退。見 ADR 0001 正式肖像有限例外。

檢視模型的輸出、網址參數與候選人資料卡的開啟流程見 `docs/architecture.md`。

### 資料與夾具

- `data/raw/` 只放從一手來源抽取的真實資料。示範或測試用的政見一律放 `test/fixtures/`，候選人用虛構的「範例甲乙丙」「候選人甲乙丙」，不掛真實候選人的名字。
- `data/audio/*.mp3` 不進版控，由維護者在部署機器用 `node scripts/speak.js` 生成（要裝 ffmpeg）；清單 `data/audio/manifest.json` 進版控。音檔不齊時建置不公開任何音檔，所以 CI 沒有音檔也會過。
- 新增上線關卡：在 `scripts/gates/` 寫一個 `{ id, name, check(site) }` 模組（`check` 回傳失敗訊息陣列，`site.dataset()` 讀公開資料集），加進 `scripts/gates/index.js` 的 `GATES`，並在 `test/gates.test.js` 用夾具網站目錄驗證擋下違規、放行合規。
- 品牌用語掃描與禁用色檢查讀 `data/rules/` 的正式清單；`site.files()` 列出網站目錄全部檔案，`site.readText(path)` 讀檔。改清單或新增網站文案後跑 `node --test test/rules.test.js`，它會用正式資料檢查本站文案、檔名與專案名。
- 給市民看的文字（頁面 HTML、`site/js/ui-text.js`、公開資料集中整理者撰寫的欄位）不得外漏內部細節：檔案路徑、副檔名、工具名、字型名、模型代號、程式欄位名、版本識別碼、雜湊值與「出處快照」「存檔網址」這類內部術語，由上線關卡「受眾文案」（`scripts/lib/audience-text.js`）擋下。畫面用白話：出處快照寫「原文存檔」、存檔網址寫「網頁備份」、核對兩層寫「原文逐字比對」「AI 依公開檢核表檢查」。原文引述、候選人資料原文與逐字公開的 repo 文件不掃。
- 整理方法頁要照原文公開的 repo 檔案加進 `site/js/repo-documents.js` 的 `REPO_DOCUMENTS`、在 `site/js/ui-text.js` 的 `REPO_DOCUMENT_TEXT` 寫白話標題與說明（頁面不顯示檔案路徑），並在 `site/method.html` 放一個 `data-repo-file="<repo 路徑>"` 容器。逐字副本不受品牌用語掃描，由關卡 `repo-documents` 驗證逐字相同，見 `docs/rules/brand-terms.md`「例外：引用 repo 文件」。頁面文案不要寫進這些檔案。
- 新增 ADR 要同時列入整理方法頁（REPO_DOCUMENTS、REPO_DOCUMENT_TEXT、method.html 容器），test/method-page.test.js 會擋。
- `test/` 底下的 `.js` 都會被 `node --test` 當成測試檔執行，夾具模組不要有副作用。
- 無頭 Chrome 的 `--window-size` 有最小寬度，390px 截圖會被裁切，手機版改用可模擬裝置寬度的瀏覽器驗證。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
