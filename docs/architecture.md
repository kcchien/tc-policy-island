# 架構：目錄與模組

逐檔說明 repo 的目錄與 `site/js/` 模組。改 `site/js/`、`scripts/` 或資料結構前先讀這份，找出要改的模組與會一起受影響的關卡與測試。專案慣例與指令在 `AGENTS.md`，欄位定義在 `AGENTS.md`「資料結構」與 `site/js/dataset.js` 的 `SCHEMAS`。

新增、改名或刪除模組時同步更新本檔。

## 頂層目錄

```
site/                  部署根目錄（Cloudflare Pages 只上傳這裡）
data/raw/              原始資料（建置輸入）
  meta.json  candidates.json  issue-areas.json
  local-elements.json  decorative-tiles.json   元素清單與裝飾格（可省略，視為空陣列；但上線關卡「人物一致」要求至少一個裝飾格當候選人廣場）
  sources/<candidateId>.json   每位候選人一檔，陣列
  policies/<candidateId>.json  每位候選人一檔，陣列
data/snapshots/        出處的文字快照，檔名 <sourceId>.txt
data/extraction/       政見抽取指示 instructions.md、判準裁決紀錄 judgement-log.md、候選人資料抽取方法 candidate-profiles.md、每位候選人的抽取紀錄 records/、PDF 字型對照檔 glyph-maps/
data/verification/     檢核表 checklist.json 與第二層提示詞 layer2-prompt.md，同一版本號，改內容就升版；核對報告寫在 report.md（整理方法頁照原文公開，還沒有時顯示「尚未產生」）
data/rules/            品牌用語清單 brand-terms.json、禁用色範圍 forbidden-colors.json（關卡與核對讀這裡）
docs/rules/            公開的分類規則、政見與議題區對照表、品牌用語、元素清單、禁用色、島嶼格子配置說明
scripts/               Node 工具；scripts/gates/ 每項關卡一個模組
test/                  node:test 測試；test/fixtures/ 放夾具
```

## site/ 的頁面、樣式與建置產物

```
site/
  index.html           importmap 與頁面骨架
  method.html          整理方法頁（頁首與頁尾都連得到）
  css/main.css         配色變數（依 ADR 0001）
  _headers             Cloudflare Pages 回應標頭（出處快照指定 UTF-8）
  data/dataset.json    建置產物，不進版控
  data/snapshots/      建置時複製的公開出處快照，不進版控
  data/repo-files/     建置時逐字複製的引用 repo 文件，與清單 data/repo-files.json 都不進版控
  vendor/three/        three.js r160（three@0.160.0 的 three.module.min.js、OrbitControls、CSS2DRenderer 與授權）
```

## site/js：資料、進站流程與共用介面

```
js/dataset.js        政見資料集：欄位表、驗證、排除未核對、候選人排序
js/view-model.js     檢視模型：議題區 × 候選人矩陣
js/filter.js         搜尋與行政區篩選（filterViewModel）
js/app-state.js      網址參數與檢視選擇
js/main.js           進站流程：選檢視、載入資料、接上篩選與卡片、檢視切換、時段（預設自動依台灣時間，每分鐘檢查；點時段改手動）
js/table-view.js     表格檢視
js/policy-card.js    政見卡片（兩種檢視共用）：三欄各自捲動、欄頭固定，政見預設只顯示摘要與行政區、點開看原文與核對紀錄，欄內篩選（filter.js 的 policyMatcher），手機改候選人分頁，桌面島嶼檢視可放大成全高
js/candidate-card.js 候選人資料卡：內容純函式 profileCardContent（Node 可測）、三張同尺寸卡片、對話框（索引候選人分頁、表格欄頭、網址共用）
js/sheet.js          手機底部抽屜的三段拖曳（snapSheet 純函式、bindSheetDrag）與卡片對話框共用行為（bindSheetDialog）
js/island-list.js    索引面板：議題區清單（含編號）、標記圖例（候選人分頁的卡片在 candidate-card.js）
js/ui-text.js        畫面文案：程式產生、給市民看的文字一律放這裡（其他畫面模組不寫中文字串，test/ui-text.test.js 檢查），受上線關卡「受眾文案」掃描
js/dom.js            建立 DOM 節點的小工具（不用 innerHTML）
```

### 檢視模型

檢視模型（`buildViewModel`）輸出 `rows[].cells[]` 與議題區編號 `rows[].number`（依資料順序的 `01`、`02`⋯，篩選不重編），每格 `status` 為 `has-policies` 或 `no-policies`，候選人附 `policyCount`、`rawPolicyItems` 與 `profileSource`（候選人資料的出處，含 `snapshotNote`；`profile` 為 `null` 時也是 `null`），另有 `noPolicyText` 與 `candidateOrderNote`。政見的 `quotes[].source` 附出處的中文來源類型與 `snapshotUrl`（網站上的出處快照位置）。島嶼檢視與表格檢視都只讀檢視模型；島嶼檢視另用 `rows[].localElement`（議題區配對的元素）與 `decorativeTiles[]`（含 `localElement`）。島上標記的亮暗由 `islandLayout` 依格子有無政見決定，不呈現政見數量。`filterViewModel` 篩選後，沒有符合政見的格子 `status` 為 `no-matches`，沒有任何符合政見的議題區整列移除。

### 網址參數

網址參數（`app-state.js`）：`area` 議題區、`policy` 政見、`candidate` 候選人（開該候選人的候選人資料卡）、`q` 關鍵字、`district` 適用行政區、`view`（`island` 或 `table`）。不支援 WebGL 時一律用表格檢視。

### 開啟候選人資料卡

`main.js` 的 `openCandidateCard(candidateId)`，開啟對話框（手機為底部抽屜），三張卡片依排序規則並排，捲到並標示該候選人那張，網址寫入 `candidate`；候選人不存在時回傳 `false`。不要只放一張卡片，三人篇幅須相同（ADR 0001）。`main.js` 把它以 `onSelectCandidate` 傳給 `createIslandView`，點候選人人物或廣場名牌上的姓名時呼叫。進站時網址的優先順序是 `policy`、`area`、`candidate`，開其中一種卡片會清掉另外兩個參數。

## site/js：島嶼檢視

`island-view.js` 由 `main.js` 第一次進入島嶼檢視時動態載入。標「Node 可測」的是不碰 three.js 的配置模組，對應的 `-view.js` 才畫成 3D。

### 場景、鏡頭與畫質

```
js/island-view.js    島嶼檢視的 3D 場景；main.js 第一次進入島嶼檢視時才動態載入。控制介面含 setTimeOfDay、setPaused、addAnimation、stats、setCover（政見卡片遮住的範圍，main.js 依卡片大小呼叫）
js/island-layout.js  島嶼配置（不碰 three.js，Node 可測）：格子位置（格距含水道）、每格的主題場景位置 heroSlot 與在地感元素位置、候選人標記、構圖（可轉方位角）、鏡頭限制、畫面偏移（viewOffset）
js/island-camera.js  鏡頭（Node 可測）：飛行（1.15 秒、依經過時間、拖曳取消）、卡片遮住範圍的畫面偏移與平滑、預設視角（直式畫面較低俯角並轉方位角）
js/island-labels.js  名牌避讓（Node 可測，不 import 其他模組）：placeLabels 依畫面位置決定名牌完整、只留編號或隱藏，8px 遲滯，三位候選人人物名牌同組同進退；island-view.js 在鏡頭或介面變動後呼叫，避開 main.js 給的浮動元件矩形
js/island-selection.js 選取回饋：選中格子的六角外框（不受遮擋）、呼吸光環、滑過的淡色外框
js/island-quality.js 畫質三段、社群 App 內建瀏覽器低畫質、執行中 fps 自動降級（Node 可測）
js/island-clock.js   動畫迴圈時間：統一推進、暫停、減少動態停在固定畫格；後續動畫一律用它註冊（Node 可測）
js/island-daylight.js 晝夜：四個時段的關鍵影格（天空、太陽光暈、光照與補光、霧、淺水與深水、外圍陸地色調、夜間係數）、著色器混色比例、外圍陸地色調倍率 landShade、1.4 秒補間、自動時段 timeOfDayAt（台灣時間 05–08 清晨、08–16 白天、16–19 黃昏、其餘夜晚）（Node 可測，色碼受禁用色檢查）
js/island-environment.js 天空著色器（漸層、太陽光暈、夜晚星星）、太陽、半球光與補光、霧、水面著色器（深淺漂移、遠處加深、閃光，waterMaterial 可給其他物件共用）、夜間發光材質
```

### 島體、標記與人物

```
js/island-body.js    島體配置（Node 可測，不 import 其他模組）：島半徑與水道寬、拱橋（每對相鄰島一座，接步道環邊中點）、步道環行人路網、外圈環線（outerLoop）、每島六盞路燈、島上位置 TILE_SLOTS
js/island-body-view.js 島體的 3D：頂面（程序地面貼圖）、側壁（水面材質）、頂緣圖案帶、步道環、路緣、淺水環與泡沫環、拱橋；paint 與 setLift 給選取用
js/island-models.js  在地感元素、標記（markerSign 小立牌，牌面由 batchMarkerFaces 合批成每種形狀亮灰各一個 InstancedMesh）與人物模型，以及 3D 材質色碼（PALETTE，禁用色檢查會掃）
js/island-plaza.js   候選人廣場與人物配置（Node 可測，不 import 其他模組）：廣場格、三人同款的零件、尺寸、顏色、待機動畫；關卡「人物一致」直接載入網站目錄裡這一份
```

### 主題場景與靜態裝飾

```
js/island-heroes.js  主題場景（Node 可測）：20 個議題區各一座的零件資料（單位空間）、只依識別碼選場景、擺放（heroPlan，每島同倍率放進主題場景位置）、色碼
js/island-hero-view.js 主題場景畫成 3D：buildHeroScene(areaId, transform)
js/island-decor.js   靜態裝飾配置（Node 可測）：每格的主題場景擺放、路燈、大樹（樹種依格子位置，相鄰格不同）、花台、長椅、盆栽與踏石的位置，每種裝飾的高度與寬度上限、小物件的隱藏距離（LOD_DISTANCE）；不讀政見，受關卡「裝飾數量固定」檢查（關卡也要載入它 import 的 island-body、island-heroes、island-layout、island-motion、island-plaza）
js/island-decor-models.js 靜態裝飾的零件資料與色碼 DECOR_COLORS（Node 可測，格式同主題場景）
js/island-decor-view.js 靜態裝飾畫成 3D：主題場景、裝飾零件（之後合批，小物件另成幾桶依鏡頭距離隱藏）、夜間路燈光池
js/island-parts.js   零件分桶規則、投影規則 castsShadow（只有主題場景與大樹投影）與實例縮放微抖動（Node 可測）
js/island-kit.js     零件庫：共用單位幾何（含圓角盒、四坡屋頂、圓頂、環、稜柱、發光件），instancify 把靜態零件合批：非發光零件依材質、LOD、投影合併成一個網格（頂點色與議題區序號，選取抬高在著色器做，點選依議題區區段檢查），發光件依形體成 InstancedMesh（主題場景零件用黏土材質與縮放微抖動；祖先標 userData.lod 的零件另外分桶）
```

放主題場景：`island-heroes.js` 的 `heroPlan(layout)` 預設用 `heroSlotTransform` 把每座場景放進該議題區島的 `heroSlot`（每島相同，見 `island-body.js` 的 `TILE_SLOTS.hero`），每座同倍率，不擋鄰島標記由視線測試檢查。只依議題區識別碼決定，不讀政見。島嶼檢視經 `island-decor.js` 的 `decorPlan` 取主題場景與其他靜態裝飾，新增裝飾改那裡（每個議題區格子要相同）。

### 動態

```
js/island-motion.js  動態配置（Node 可測）：每格循環動畫題材、市民（Q 版零件比例與臉、角色配件三類每格同組成、繞自己島的步道環並走上一座橋到拱頂折返、拉遠放大倍率 citizenZoom）、環線（沿步道環與橋的外圈）與車輛，以及各自隨時間的姿勢；只讀格子，不讀政見，受關卡「動態數量固定」檢查（關卡也要載入它 import 的 island-body.js）
js/island-motion-view.js 把動態配置畫成 3D：循環道具、市民（零件、配件、假影子）、公車與火車，會動的零件每種一個 InstancedMesh
```

### 外圍地形

```
js/island-terrain.js 外圍地形的配置（Node 可測）：雜訊地形（西側海與浪花線、南北平原的田塊與河流、東側丘陵升高成山脈並做梯田）、地面色、各畫質的背景樹（針葉與闊葉，數千棵）、霧、聚落、雲、海上小島與帆船數量、樹群、聚落、霧團、雲、飛鳥、三圈遠山剪影與其顏色、小島燈塔帆船，與依動畫時間的位置與水面時間；高度不超過「離島距離 × 斜率」，不擋格子；只讀格子位置
js/island-outskirts.js 外圍地形的 3D 場景：地形網格（每面一色）、背景樹（不投影）與聚落（部分小屋亮窗燈）InstancedMesh、受光材質每幀乘上時段的陸地色調、霧團、雲與雲影、飛鳥、遠山剪影、小島燈塔帆船；用 addAnimation 的時間移動，水面時間也從這裡交給環境
```

## site/js：背景音樂

```
js/bgm-score.js      背景音樂的樂曲（Node 可測）：固定種子產生的 32 小節循環，G 宮五聲音階，鼓組、貝斯、和弦、撥弦與拉弦旋律都是純資料
js/bgm-schedule.js   背景音樂的前瞻排程（每格時間由起點與格數算出，不漂移，Node 可測）
js/bgm-synth.js      背景音樂的音色：Web Audio 即時合成，不用音檔（關卡「不載入音檔」）
js/bgm-player.js     背景音樂的播放：第一次開啟才建立 AudioContext；renderBars 用離線音訊環境渲染前幾小節供試聽
js/bgm-control.js    工具列的音樂開關與音量滑桿（文字在 ui-text.js 的 MUSIC_TEXT）：預設靜音，只有按開關才播放（進站一律不出聲，減少動態時亦同），分頁隱藏暫停，音量記在 localStorage
```

## site/js：整理方法頁

```
js/repo-documents.js 引用 repo 文件清單 REPO_DOCUMENTS（整理方法頁照原文公開的檔案）
js/markdown.js       repo 文件的 Markdown 解析（只支援 repo 用到的寫法）
js/method-content.js 整理方法頁由資料產生的內容
js/method.js         整理方法頁的進站流程
```
