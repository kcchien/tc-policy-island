# 架構：目錄與模組

repo 的目錄、`site/js/` 與 `scripts/` 模組的分組，以及跨模組的流程。改 `site/js/`、`scripts/` 或資料結構前先讀這份，找出要改的模組與會一起受影響的關卡與測試。專案慣例與指令在 `AGENTS.md`，欄位定義在 `AGENTS.md`「資料結構」與 `site/js/dataset.js` 的 `SCHEMAS`。

各模組職責見檔頭註解。本檔只列每組的檔名；新增、改名或刪除模組時同步更新分組清單，職責改變時改檔頭註解。

## 頂層目錄

```
site/                  部署根目錄（Cloudflare Pages 的靜態檔只上傳這裡）
functions/api/hit.js   統計端點（Pages Function，本站唯一的後端程式，ADR 0003）；部署時跟著上傳
wrangler.toml          Pages 專案設定與統計資料集綁定 HITS
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
js/dataset.js  js/view-model.js  js/filter.js  js/app-state.js  js/main.js  js/random-area.js
js/tour.js  js/tour-view.js  js/table-view.js  js/policy-card.js  js/candidate-card.js  js/sheet.js
js/island-list.js  js/ui-text.js  js/dom.js  js/hits.js
```

### 檢視模型

檢視模型（`buildViewModel`）輸出 `rows[].cells[]` 與議題區編號 `rows[].number`（依資料順序的 `01`、`02`⋯，篩選不重編），每格 `status` 為 `has-policies` 或 `no-policies`，候選人附 `policyCount`、`rawPolicyItems` 與 `profileSource`（候選人資料的出處，含 `snapshotNote`；`profile` 為 `null` 時也是 `null`），另有 `noPolicyText` 與 `candidateOrderNote`。政見的 `quotes[].source` 附出處的中文來源類型與 `snapshotUrl`（網站上的出處快照位置）。島嶼檢視與表格檢視都只讀檢視模型；島嶼檢視另用 `rows[].localElement`（議題區配對的元素）與 `decorativeTiles[]`（含 `localElement`）。島上標記的亮暗由 `islandLayout` 依格子有無政見決定，不呈現政見數量。`filterViewModel` 篩選後，沒有符合政見的格子 `status` 為 `no-matches`，沒有任何符合政見的議題區整列移除。

### 網址參數

網址參數（`app-state.js`）：`area` 議題區、`policy` 政見、`candidate` 候選人（開該候選人的候選人資料卡）、`q` 關鍵字、`district` 適用行政區、`view`（`island` 或 `table`）。不支援 WebGL 時一律用表格檢視。

### 開啟候選人資料卡

`main.js` 的 `openCandidateCard(candidateId)`，開啟對話框（手機為底部抽屜），三張卡片依排序規則並排，捲到並標示該候選人那張，網址寫入 `candidate`；候選人不存在時回傳 `false`。不要只放一張卡片，三人篇幅須相同（ADR 0001）。`main.js` 把它以 `onSelectCandidate` 傳給 `createIslandView`，點候選人人物或廣場名牌上的姓名時呼叫。進站時網址的優先順序是 `policy`、`area`、`candidate`，開其中一種卡片會清掉另外兩個參數。

### 隨機一題

`main.js` 的 `openRandomArea()`，`startApp` 內的函式（`main.js` 是入口，沒有 export），頁首按鈕呼叫，其他流程在 `startApp` 內直接呼叫或以回呼傳入：以 `random-area.js` 的 `pickRandomArea(vm.rows, random, previousId)` 從未篩選的全部議題區均勻選一個（排除目前選中的議題區），再走 `openCard(areaId, null, { unfiltered: true })`，卡片不帶入全站篩選。表格檢視先捲到該列；島嶼檢視等載入完成、飛到該區再開卡。

### 上手導覽

步驟狀態機與框線位置的純函式在 `tour.js`，覆蓋層在 `tour-view.js`，由 `main.js` 的 `startApp` 接上。島嶼檢視載入完成後自動檢查要不要出現（沒看過、WebGL 可用、網址沒指定要開的卡片）；看過或跳過寫入 localStorage 的 `policy-island:intro-seen`，頁首「怎麼看」重開。覆蓋層是 `showModal` 的對話框，才能疊在政見卡片之上，說明框計入 `stageObstacles`，名牌會避開它。第一步框議題區名牌、第二步框同一格的三個標記，位置由島嶼檢視的 `areaScreenRects(areaId)`（名牌 DOM 與鏡頭投影，不加 3D 物件）每幀提供，框哪一格只看畫面位置（`pickTourArea`）；第三步呼叫 `openRandomArea()`，卡片在鏡頭飛到後開啟，覆蓋層再回到最上層並框住卡片。

### 統計

`hits.js` 送頁面瀏覽與出處點擊到 `functions/api/hit.js`（ADR 0003），內容只有 `{ kind, id, view }`。`main.js` 在資料載入後送一次頁面瀏覽（`view` 為當時的檢視），並在 `document` 上用事件委派旁聽 `.source-links` 裡的連結點擊；出處識別碼由同一組連結中原文存檔的網址對照檢視模型的 `snapshotUrl` 取得，所以政見卡片與候選人資料卡的連結不必改。`method.js` 進頁時送一次 `view: 'method'` 的頁面瀏覽，並填入 `ui-text.js` 的揭露文字。瀏覽器開啟「不要追蹤」或全域隱私控制時都不送。

## site/js：島嶼檢視

`island-view.js` 由 `main.js` 第一次進入島嶼檢視時動態載入。檔頭註明「Node 可測」或「不碰 three.js」的是配置模組，對應的 `-view.js` 才畫成 3D。

### 場景、鏡頭與畫質

```
js/island-view.js  js/island-layout.js  js/island-camera.js  js/island-labels.js
js/island-selection.js  js/island-quality.js  js/island-clock.js
js/island-daylight.js  js/island-environment.js
```

### 島體、標記與人物

```
js/island-body.js  js/island-body-view.js  js/island-models.js  js/island-plaza.js
```

走到同一格（ADR 0001）：`island-view.js` 的 `select(areaId)`（經 `focusArea`）讓三位候選人人物從目前位置同時出發，與鏡頭飛行同時進行；`main.js` 在政見卡片關閉時呼叫 `returnFigures()`，三人同時走回候選人廣場，換議題區時直接走去下一格；切回島嶼檢視時只有卡片開著才出發。目的地與路徑是 `island-plaza.js` 的純函式 `figureDestinations`、`walkPlan`、`walkPose`（規則見檔頭註解），上線關卡「人物一致」載入它們，對每個議題區檢查三人的目的地、出發與抵達時間、途中姿勢相同，且目的地不隨政見資料改變。減少動態或暫停動畫時直接出現在目的地。

### 主題場景與靜態裝飾

```
js/island-heroes.js  js/island-hero-view.js  js/island-decor.js  js/island-decor-models.js
js/island-decor-view.js  js/island-parts.js  js/island-kit.js
```

放主題場景：`island-heroes.js` 的 `heroPlan(layout)` 預設用 `heroSlotTransform` 把每座場景放進該議題區島的 `heroSlot`（每島相同，見 `island-body.js` 的 `TILE_SLOTS.hero`），每座同倍率，不擋鄰島標記由視線測試檢查。只依議題區識別碼決定，不讀政見。島嶼檢視經 `island-decor.js` 的 `decorPlan` 取主題場景與其他靜態裝飾，新增裝飾改那裡（每個議題區格子要相同）。

### 動態

```
js/island-motion.js  js/island-motion-view.js
```

### 外圍地形

```
js/island-terrain.js  js/island-outskirts.js
```

### 關卡直接載入的配置模組

上線關卡「裝飾數量固定」「動態數量固定」「人物一致」在 Node 直接載入網站目錄裡的 `island-decor.js`、`island-motion.js`、`island-plaza.js`，連同它們 import 的模組（看各檔開頭的 import）。這些模組只能 import 同樣不碰 three.js 的模組，新增 import 前先確認對方也是配置模組。

## site/js：背景音樂

```
js/bgm-score.js  js/bgm-schedule.js  js/bgm-synth.js  js/bgm-player.js  js/bgm-control.js
```

## site/js：整理方法頁

```
js/repo-documents.js  js/markdown.js  js/method-content.js  js/method.js
```

## scripts

```
build.js  deploy.js  fetch-source.js  gates.js  preview.js  shoot.js  verify.js   指令入口，參數看各腳本的 --help
lib/      archive-queue.js  audience-text.js  brand-terms.js  cdp.js  colors.js  deploy.js
          pdf-text.js  policy-variants.js  raw-data.js  shoot.js  source-capture.js  usage.js  verification.js
gates/    index.js（關卡清單 GATES）  site.js（讀取網站目錄的入口）
          audience-text.js  brand-terms.js  candidate-columns.js  candidate-profiles.js  dataset-structure.js
          figure-consistency.js  fixed-decor.js  fixed-motion.js  forbidden-colors.js  no-audio-files.js
          repo-documents.js  verified-policies.js   每項關卡一個模組
```
