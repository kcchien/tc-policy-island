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
| `node scripts/verify.js [--raw data/raw] [--candidate <id>]... [--skip-passed] [--profiles-only] [--jobs 1] [--brand-terms data/rules/brand-terms.json] [--model claude-opus-5-5] [--claude claude] [--date YYYY-MM-DD]` | 先對候選人資料跑逐字比對（只有第一層、不花費用），結果寫回 `candidates.json`，`--profiles-only` 到此為止。再對政見跑兩層核對（ADR 0002），結果寫回 `policies/*.json`；第一層不過不送第二層，`--skip-passed` 只跑未核對、已退回或以舊版檢核表通過的政見。第二層每筆開一個全新 `claude -p` session，會花費用，`--jobs` 是同時執行的 session 數；提示詞中的候選人姓名與政黨以「○○」遮蔽 |
| `node scripts/fetch-source.js --candidate <id> --id <sourceId> --url <url> --type <來源類型> [--title <標題>] [--html <本機 HTML 檔>] [--pdf <本機 PDF 檔> [--page 1] [--glyph-map <字型對照檔>] [--pdftotext pdftotext]] [--no-archive] [--raw data/raw] [--snapshots data/snapshots] [--date YYYY-MM-DD]` | 擷取一個出處：頁面可見文字存成 `data/snapshots/<sourceId>.txt`、送 Wayback Machine 存檔（失敗只記原因）、出處紀錄寫進 `sources/<candidateId>.json`（同識別碼取代）。要登入或瀏覽器渲染的頁面先另存 HTML 再用 `--html`。PDF（選舉公報）先下載再用 `--pdf`，以 poppler 的 pdftotext 轉出指定頁；字形抽不出文字時用 `--glyph-map` 還原，見 `data/extraction/candidate-profiles.md`。`snapshotNote` 自動註明轉換方法 |
| `npm run check` | 測試 → 建置 → 關卡，交件前跑這個 |
| `node scripts/deploy.js [--dry-run] [--wrangler wrangler]`（`npm run deploy`） | 測試 → 建置 → 關卡 → `wrangler pages deploy site` 到 Cloudflare Pages 專案 `tc-policy-island` 的正式環境（`--branch main`），專案不存在時先建立；任一步失敗結束碼 1、不部署。`--dry-run` 跑完檢查與唯讀的專案查詢，只列出建立與部署指令。真的部署只由維護者執行；試部署流程用 `--dry-run` 或 `--wrangler` 指向假指令 |

看夾具資料的畫面：`node scripts/build.js --raw test/fixtures/raw-sample` 後開預覽；看完再跑一次 `node scripts/build.js` 換回正式資料。CI（`.github/workflows/check.yml`）每次 push 跑測試、建置、關卡，不部署。

### 目錄

```
site/                  部署根目錄（Cloudflare Pages 只上傳這裡）
  index.html           importmap 與頁面骨架
  method.html          整理方法頁（頁首與頁尾都連得到）
  css/main.css         配色變數（依 ADR 0001）
  js/dataset.js        政見資料集：欄位表、驗證、排除未核對、候選人排序
  js/view-model.js     檢視模型：議題區 × 候選人矩陣
  js/table-view.js     表格檢視
  js/filter.js         搜尋與行政區篩選（filterViewModel）
  js/policy-card.js    政見卡片（兩種檢視共用）
  js/candidate-card.js 候選人資料卡：內容純函式 profileCardContent（Node 可測）、三張同尺寸卡片、對話框（索引候選人分頁、表格欄頭、網址共用）
  js/sheet.js          手機底部抽屜的三段拖曳（snapSheet 純函式、bindSheetDrag）與卡片對話框共用行為（bindSheetDialog）
  js/app-state.js      網址參數與檢視選擇
  js/main.js           進站流程：選檢視、載入資料、接上篩選與卡片、檢視切換
  js/island-layout.js  島嶼配置（不碰 three.js，Node 可測）：格子位置、格子頂點、候選人標記、構圖（可轉方位角）、鏡頭限制、畫面偏移（viewOffset）
  js/island-models.js  格子、在地感元素、標記與人物模型，以及 3D 材質色碼（PALETTE，禁用色檢查會掃）
  js/island-view.js    島嶼檢視的 3D 場景；main.js 第一次進入島嶼檢視時才動態載入。控制介面含 setTimeOfDay、setPaused、addAnimation、stats、setCover（政見卡片遮住的範圍，main.js 依卡片大小呼叫）
  js/island-daylight.js 晝夜：四個時段的關鍵影格（天空、光照、霧、水、夜間係數）與 1.4 秒補間（Node 可測，色碼受禁用色檢查）
  js/island-quality.js 畫質三段、社群 App 內建瀏覽器低畫質、執行中 fps 自動降級（Node 可測）
  js/island-clock.js   動畫迴圈時間：統一推進、暫停、減少動態停在固定畫格；後續動畫一律用它註冊（Node 可測）
  js/island-camera.js  鏡頭（Node 可測）：飛行（1.15 秒、依經過時間、拖曳取消）、卡片遮住範圍的畫面偏移與平滑、預設視角（直式畫面較低俯角並轉方位角）
  js/island-selection.js 選取回饋：選中格子的六角外框（不受遮擋）、呼吸光環、滑過的淡色外框
  js/island-plaza.js   候選人廣場與人物配置（Node 可測，不 import 其他模組）：廣場格、三人同款的零件、尺寸、顏色、待機動畫；關卡「人物一致」直接載入網站目錄裡這一份
  js/island-parts.js   零件分桶規則與實例縮放微抖動（Node 可測）
  js/island-kit.js     零件庫：共用單位幾何（含圓角盒、四坡屋頂、圓頂、環、稜柱、發光件），instancify 把靜態零件合批成 InstancedMesh（主題場景零件用黏土材質與縮放微抖動）
  js/island-heroes.js  主題場景（Node 可測）：20 個議題區各一座的零件資料（單位空間）、只依識別碼選場景、擺放（heroPlan，島體提供主題場景位置前暫放在元素區西半）、色碼
  js/island-hero-view.js 主題場景畫成 3D：buildHeroScene(areaId, transform)
  js/island-environment.js 天空漸層球、光源、霧、水面、夜間發光材質
  js/island-terrain.js 外圍地形的配置（Node 可測）：雜訊地形（西側海與浪花線、南北平原的田塊與河流、東側丘陵升高成山脈）、地面色、各畫質的樹、霧、聚落數量、樹群、聚落、霧團、雲、飛鳥與依動畫時間的位置；高度不超過「離島距離 × 斜率」，不擋格子；只讀格子位置
  js/island-outskirts.js 外圍地形的 3D 場景：地形網格（每面一色）、樹群與聚落 InstancedMesh、霧團、雲與雲影、飛鳥；用 addAnimation 的時間移動
  js/island-motion.js  動態配置（Node 可測）：每格循環動畫題材、市民、路網、環線與車輛，以及各自隨時間的姿勢；只讀格子，不讀政見，受關卡「動態數量固定」檢查
  js/island-motion-view.js 把動態配置畫成 3D：循環道具、市民、公車與火車、路面與環線堤，會動的零件每種一個 InstancedMesh
  js/island-list.js    索引面板：議題區清單（含編號）、標記圖例（候選人分頁的卡片在 candidate-card.js）
  js/dom.js            建立 DOM 節點的小工具（不用 innerHTML）
  js/repo-documents.js 引用 repo 文件清單 REPO_DOCUMENTS（整理方法頁照原文公開的檔案）
  js/markdown.js       repo 文件的 Markdown 解析（只支援 repo 用到的寫法）
  js/method-content.js 整理方法頁由資料產生的內容
  js/method.js         整理方法頁的進站流程
  _headers             Cloudflare Pages 回應標頭（出處快照指定 UTF-8）
  data/dataset.json    建置產物，不進版控
  data/snapshots/      建置時複製的公開出處快照，不進版控
  data/repo-files/     建置時逐字複製的引用 repo 文件，與清單 data/repo-files.json 都不進版控
  vendor/three/        three.js r160（three@0.160.0 的 three.module.min.js、OrbitControls、CSS2DRenderer 與授權）
data/raw/              原始資料（建置輸入）
  meta.json  candidates.json  issue-areas.json
  local-elements.json  decorative-tiles.json   元素清單與裝飾格（可省略，視為空陣列；但上線關卡「人物一致」要求至少一個裝飾格當候選人廣場）
  sources/<candidateId>.json   每位候選人一檔，陣列
  policies/<candidateId>.json  每位候選人一檔，陣列
data/snapshots/        出處的文字快照，檔名 <sourceId>.txt
data/extraction/       政見抽取指示 instructions.md、候選人資料抽取方法 candidate-profiles.md、每位候選人的抽取紀錄 records/、PDF 字型對照檔 glyph-maps/
data/verification/     檢核表 checklist.json 與第二層提示詞 layer2-prompt.md，同一版本號，改內容就升版；核對報告寫在 report.md（整理方法頁照原文公開，還沒有時顯示「尚未產生」）
data/rules/            品牌用語清單 brand-terms.json、禁用色範圍 forbidden-colors.json（關卡與核對讀這裡）
docs/rules/            公開的分類規則、政見與議題區對照表、品牌用語、元素清單、禁用色、島嶼格子配置說明
scripts/               Node 工具；scripts/gates/ 每項關卡一個模組
test/                  node:test 測試；test/fixtures/ 放夾具
```

### 資料結構

欄位的唯一定義是 `site/js/dataset.js` 的 `SCHEMAS`。改欄位時同時改 `SCHEMAS`、本節與測試。欄位名用英文 camelCase，內容只有中文，不做雙語結構。`?` 表示可為 `null`。

- **meta**：`dataCutoffDate`（YYYY-MM-DD）、`checklistVersion?`。公開資料集另加 `candidateOrder`（`name-strokes` 或 `ballot-number`）與 `builtAt`。
- **候選人**：`id`、`name`、`party`、`ballotNumber?`、`nameStrokes`、`rawPolicyItems { total?, sourceIds[] }`（原始政見條目總數與其出處，`total` 為 `null` 表示尚未統計）、`dataStatus?`（例如「尚無一手來源」，指政見）、`profile?`（候選人資料，`null` 表示尚未收錄）。號次須全部為 `null`（抽籤前，依筆畫排序）或全部填寫（抽籤後，依號次排序）；排序鍵不得相同。
- **議題區**：`id`、`name`、`departments[]`、`description`、`axial [q, r]`、`localElementId?`。清單依 `docs/rules/classification-rules.md` 劃分，數量與島的格數無關。
- **元素**：`id`、`name`、`category`（`LOCAL_ELEMENT_CATEGORIES`：自然景觀、小吃、老建築）、`place`、`reason`（與任何市長任期的政績無關的理由）。
- **裝飾格**：`id`、`axial [q, r]`、`localElementId?`。島上沒有議題區的格子。議題區與裝飾格的座標不得重複，每個元素只放一格。公開資料集另含 `localElements` 與 `decorativeTiles`。
- **出處**：`id`、`candidateId`、`url`、`archiveUrl?`、`archiveError?`（存檔失敗原因）、`snapshotPath`（相對 repo 根目錄）、`snapshotSha256`、`snapshotNote?`（快照的產生方式，例如 PDF 轉文字與字型對照還原；取自網頁可見文字時為 `null`）、`sourceType`（`official-website`、`official-facebook`、`policy-presentation`、`election-bulletin`，中文名見 `SOURCE_TYPES`）、`title`、`retrievedAt`。
- **政見**：`id`、`candidateId`、`issueAreaId`（恰好一個）、`summary`、`quotes[] { text, sourceId }`（至少一則，出處須屬同一位候選人）、`districts[]`（`TAICHUNG_DISTRICTS` 的 29 區正式名稱，可空）、`conflictNote?`（出處說法不一標註）、`verification`。
- **核對紀錄** `verification`：`layer1 { status, checkedAt? }`、`layer2 { status, reason?, checklistVersion?, model?, checkedAt? }`。`status` 為 `pending`（未核對）、`pass`、`fail`。有結果時其餘欄位必填。兩層都是 `pass` 才進公開資料集；出處只公開被公開政見引用、列在 `rawPolicyItems.sourceIds`、或是公開候選人資料出處的那些。
- **候選人資料** `profile`：`birthYear`、`education[]`、`experience[]`（學歷與經歷逐字照出處）、`sourceId`（出處須屬同一位候選人）、`electionYear`、`electionName`（資料取自哪一場選舉，例如「第11屆立法委員選舉（臺中市第8選舉區）」）、`verification { layer1 { status, checkedAt? } }`。只有第一層（逐字比對），`pass` 才公開，否則公開資料集的 `profile` 為 `null`。姓名與政黨沿用候選人的欄位。抽取方法見 `data/extraction/candidate-profiles.md`。
- 排序規則的欄位與說明文字只定義在 `CANDIDATE_ORDER_RULES`，判斷用 `candidateOrderOf`。

檢視模型（`buildViewModel`）輸出 `rows[].cells[]` 與議題區編號 `rows[].number`（依資料順序的 `01`、`02`⋯，篩選不重編），每格 `status` 為 `has-policies` 或 `no-policies`，候選人附 `policyCount`、`rawPolicyItems` 與 `profileSource`（候選人資料的出處，含 `snapshotNote`；`profile` 為 `null` 時也是 `null`），另有 `noPolicyText` 與 `candidateOrderNote`。政見的 `quotes[].source` 附出處的中文來源類型與 `snapshotUrl`（網站上的出處快照位置）。島嶼檢視與表格檢視都只讀檢視模型；島嶼檢視另用 `rows[].localElement`（議題區配對的元素）與 `decorativeTiles[]`（含 `localElement`）。島上標記的亮暗由 `islandLayout` 依格子有無政見決定，不呈現政見數量。`filterViewModel` 篩選後，沒有符合政見的格子 `status` 為 `no-matches`，沒有任何符合政見的議題區整列移除。

網址參數（`app-state.js`）：`area` 議題區、`policy` 政見、`candidate` 候選人（開該候選人的候選人資料卡）、`q` 關鍵字、`district` 適用行政區、`view`（`island` 或 `table`）。不支援 WebGL 時一律用表格檢視。

開啟候選人資料卡：`main.js` 的 `openCandidateCard(candidateId)`，開啟對話框（手機為底部抽屜），三張卡片依排序規則並排，捲到並標示該候選人那張，網址寫入 `candidate`；候選人不存在時回傳 `false`。不要只放一張卡片，三人篇幅須相同（ADR 0001）。`main.js` 把它以 `onSelectCandidate` 傳給 `createIslandView`，點候選人人物或廣場名牌上的姓名時呼叫。進站時網址的優先順序是 `policy`、`area`、`candidate`，開其中一種卡片會清掉另外兩個參數。

### 資料與夾具

- `data/raw/` 只放從一手來源抽取的真實資料。示範或測試用的政見一律放 `test/fixtures/`，候選人用虛構的「範例甲乙丙」「候選人甲乙丙」，不掛真實候選人的名字。
- 新增上線關卡：在 `scripts/gates/` 寫一個 `{ id, name, check(site) }` 模組（`check` 回傳失敗訊息陣列，`site.dataset()` 讀公開資料集），加進 `scripts/gates/index.js` 的 `GATES`，並在 `test/gates.test.js` 用夾具網站目錄驗證擋下違規、放行合規。
- 品牌用語掃描與禁用色檢查讀 `data/rules/` 的正式清單；`site.files()` 列出網站目錄全部檔案，`site.readText(path)` 讀檔。改清單或新增網站文案後跑 `node --test test/rules.test.js`，它會用正式資料檢查本站文案、檔名與專案名。
- 整理方法頁要照原文公開的 repo 檔案加進 `site/js/repo-documents.js` 的 `REPO_DOCUMENTS`，並在 `site/method.html` 放一個 `data-repo-file="<repo 路徑>"` 容器。逐字副本不受品牌用語掃描，由關卡 `repo-documents` 驗證逐字相同，見 `docs/rules/brand-terms.md`「例外：引用 repo 文件」。頁面文案不要寫進這些檔案。
- `test/` 底下的 `.js` 都會被 `node --test` 當成測試檔執行，夾具模組不要有副作用。
- 無頭 Chrome 的 `--window-size` 有最小寬度，390px 截圖會被裁切，手機版改用可模擬裝置寬度的瀏覽器驗證。

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
