# 參考網站技術分析：taiwan-no.one/lumama（台中恐怖島）

- 分析日期：2026-10-23
- 對象：https://taiwan-no.one/lumama/ ，頁面標題「TERROR ISLAND 恐怖島｜台中事件地圖」
- 用途：使用者希望本站介面「更像」這個網站與 puma.taipei/heart-island。heart-island 的分析在 `reference-site.md`，本檔只寫 lumama 和它不同或更細的地方。
- 方法：用 curl 下載 HTML、`engine/` 下 14 支 JS、`ui.css`、`data.json`，逐檔閱讀（只讀不執行）；用無頭 Chrome（SwiftShader WebGL）拍桌面 1440×900 與手機 390×844 截圖。程式碼行號以下載當時的版本為準（`app.js?v=100`、`ui.css?v=44`、`models.js?v=22`）。
- 標記：「確認」是讀到原始碼或截圖看到；「推測」是依結構判斷、沒有直接證據。

## 0. 先講結論

- lumama 沒有用任何後處理（沒有 bloom、SSAO、景深），也沒有 glTF 模型或圖片貼圖。它的「動感」與「精緻度」幾乎全部來自三件事：每座島都有自己的循環小動畫、大量程式拼出的小零件（靠 InstancedMesh 壓低成本）、晝夜關鍵影格驅動的整體光色。（確認）
- 這些做法都能在本站現有的「純靜態 + importmap + three.js r160」架構下照做，不需要加 npm 套件。
- 網站性質要先分清楚：lumama 是批評台中市政的反諷作品（「恐怖島」「詛咒連線」「DLC 尚未解鎖」），預設深夜、暗色、陰森配樂與恐怖氣氛效果都是為這個主題服務。本站是中立的候選人政見對照，應借技術與版面，不借語氣和恐怖視覺。

## 1. 網站性質與來源

- 主機：GitHub Pages（回應標頭 `server: GitHub.com`、`x-github-request-id`）。（確認）
- 引擎共用：HTML 用 `<base href="../engine/">`，`<main id="app" data-src="../lumama/data.json">` 指向該城市的資料檔，同一套 `engine/` 可以換資料做別的城市（`app.js` 第 76~77 行註解寫明）。（確認）
- 跟 heart-island 的關係：工具列按鈕、`seg` 時段切換、右側「THE ... INDEX」清單、引導框「WELCOME, TAICHUNG / 01」對「HELLO, TAIPEI / 01」、CSS 類名 `heart-buttons`、`term-buttons` 都與 heart-island 同構。推測是以 heart-island 為範本重寫或改寫。（推測）
- 授權：下載的 JS 與 CSS 裡沒有找到授權聲明（`grep -i license|copyright|github` 無結果）。只能參考做法，不能搬程式碼。（確認）

## 2. 技術棧（確認）

- 框架：無。原生 ES module，`<script type="module" src="./app.js?v=100">` 啟動，DOM 用自訂 `$`／`$$` 加 `innerHTML` 模板字串。
- 打包：無。破快取只靠每支模組的查詢字串（`./models.js?v=22` 等），模組之間互相 import 也帶版本號。
- three.js：r160（`vendor/three/build/three.module.min.js` 開頭 `const t="160"`），放自己的主機，importmap 對應 `three` 與 `three/addons/`。
- 用到的 addon 只有四個：`OrbitControls`、`CSS2DRenderer`、`RoundedBoxGeometry`、`SimplexNoise`。沒有 `EffectComposer`、`GLTFLoader`、`OutlinePass`。
- 模組拆分（行數）：`app.js` 1334（主流程、UI、鏡頭、迴圈）、`models.js` 1768（零件庫與 19 座島的場景）、`environment.js` 447（天空、地形、海、樹、霧、晝夜）、`world.js` 190（六角格配置、道路、路燈）、`people.js` 208（流動光點、幽靈、烏鴉）、`lumama.js` 213（主角人物）、`memes.js` 477（公車、塞車高架、鼠群等彩蛋）、`music.js`／`sfx.js`（Web Audio 程序化聲音）、其他彩蛋模組。
- CSS：一支手寫 `ui.css`，506 行，`:root` 變數管理顏色與圓角，沒有框架。
- 網頁字型：Google Fonts 載入 `Noto Sans TC`（400/500/700/900）與 `Noto Serif TC`（700/900）。這點與 heart-island 不同（heart-island 筆記記載它沒載網頁字型）。
- 統計：GoatCounter（`gc.zgo.at/count.js`），不是 GA。

## 3. 3D 場景：動感與精緻度怎麼做出來

### 3.1 渲染設定（`app.js` 140~168 行）

- `WebGLRenderer({ antialias: quality !== "low", powerPreference: "high-performance" })`。
- `outputColorSpace = SRGBColorSpace`、`toneMapping = ACESFilmicToneMapping`、曝光 1.0，夜間加到 1.15（`environment.js` 398 行 `1.0 + night * 0.15`）。
- 陰影：`PCFSoftShadowMap`（low 用 `PCFShadowMap`），單一平行光投影，陰影相機範圍 ±22 × ±16，`bias -0.0006`、`normalBias 0.02`，貼圖 2048／1024／768 依畫質。
- 鏡頭：`PerspectiveCamera(34°)`。`OrbitControls` 開阻尼 `dampingFactor 0.08`，距離 5~70，俯角 0.08~1.22 rad，`change` 事件把 target 夾在城市邊界外 6 單位內（不讓使用者拖丟地圖）。
- 沒有後處理。所謂「發光」全靠 `MeshBasicMaterial({ toneMapped: false })` 加顏色倍率（見 3.4）。

### 3.2 世界配置（`world.js`）

- 19 個尖頂六角形平台，半徑 `R = 2.0`，配置半徑 `S = 2.2`。兩者的差 0.2 就是平台之間的「街道」。用 odd-row offset 座標 `[col, row]`。
- 平台是略帶外擴的六角柱 `CylinderGeometry(R, R + 0.07, 0.32, 6)`，側面與頂面分材質（頂面用該島的 `ground` 色，側面用 `side` 色），另加一圈 0.05 高的邊條 `lip`。
- 道路層：每格一個略大的深色六角餅（InstancedMesh），平台間的縫隙自然變成路網；每條共用邊放 3 段米色虛線（InstancedMesh）當車道線；每個六角頂點（去重）放路燈柱與燈泡（各一個 InstancedMesh）。
- 外圍另有不可點的「野地」平台（較高、深綠），只用來補齊城市輪廓。
- 點選用的是每格一根看不見的高柱 `CylinderGeometry(R, R, 2.6, 6)`，比點平台本體容易命中。
- 選取外框：每格一條 `THREE.Line` 六角線，`depthTest: false`、`renderOrder 5`，選中時紅色不透明，滑過時淡色 0.55，平常 0。
- 地面光環：`RingGeometry(R+0.12, R+0.42, 6)` 平放在路面，`opacity = 0.32 + sin(t·2.4)·0.14` 呼吸。

### 3.3 環境（`environment.js`）

- 天空：半徑 400 的球體，`BackSide` 自訂 shader，用頂點 y 在 `horizon` 與 `top` 兩色之間 `mix(horizon, top, pow(h, 0.7))`。
- 星星：900 個 `Points`，`sizeAttenuation: false`，透明度跟夜間係數連動。月亮：CanvasTexture 放射漸層的 Sprite。
- 晝夜關鍵影格 `KEYS`（26~37 行）：10 個時間點，每點 13 個值（天頂色、地平線色、平行光色與強度、半球光天空色／地面色／強度、夜間係數、霧色、霧近、霧遠、水色）。`setTime(minute)` 找前後兩格，用 smoothstep 內插全部數值。太陽方向依時間從東到西，夜間把光源方向內插到固定的月亮方向。這是整體氛圍最大的來源。
- 時段切換：四顆按鈕（06:00、12:00、18:00、21:00），切換時用 1.4 秒 cubic ease 補間分鐘數（`app.js` 470 行附近），所以天色是「流過去」不是跳過去。
- 地形：170×170 的 `PlaneGeometry`，切 200／130／96 段（依畫質），用 `SimplexNoise` 算高度：城市附近平坦，東側與北側隆起山脈（`ridge = 1 - |noise|` 平方後乘 9 做出稜線），西側是海岸線（也用 noise 讓海岸不直）。每個頂點依高度著色（沙、乾草、草、森林、岩石），再乘 0.92~1.0 的 noise 明暗，`vertexColors` 加 `flatShading: true`，形成低多邊形的面片感。
- 海：一片 `MeshStandardMaterial`（roughness 0.25、透明 0.92），顏色隨時段變。海岸邊放兩排消波塊（4 支圓錐腳合併成一個幾何，InstancedMesh，每 0.16 單位一顆並隨機旋轉）。港口有一艘程式拼的貨櫃船與海巡艇，用 `sin(t·0.8 + i·1.7)·0.02` 上下浮動。
- 樹：高畫質 1700 棵、中 850、低 520，分松樹（圓錐）、圓樹（二十面體）、枯樹（4 段圓柱合併），每類一個 InstancedMesh，隨機縮放 0.55~1.15 與旋轉。
- 霧氣：CanvasTexture 放射漸層的 Sprite，城市上空 26 片（中低畫質 14 片），各自以不同速度做 `sin/cos` 小幅漂移，透明度 `(0.12 + night·0.32)`，顏色跟霧色混合。

### 3.4 島上模型與動畫（`models.js`）

- 全部程式產生，沒有 glTF。零件庫只有 11 種幾何：`box`、`rbox`（`RoundedBoxGeometry(1,1,1,2,0.12)`）、`cyl`、`cyl6`、`cone`、`pyr`（四角錐）、`sphere`、`ico`、`dome`、`torus`、`gable`（三角柱屋頂）。每次呼叫只給位置、縮放、顏色、旋轉。
- 靜態零件「分桶合批」：同一種幾何、同一種是否發光的零件，全城收進同一個 `InstancedMesh`，每個實例用 `setColorAt` 上色。整座城的靜態模型只花幾十個 draw call（檔頭註解明寫）。
- 動態零件：用 `p.dyn(x, y, z)` 建一個小 `Group`，裡面是一般 Mesh，再用 `p.anim((t, dt, env) => ...)` 註冊每幀函式。全檔 38 處 `anim(`。
- 篩選褪色：`setActive()` 對不符合的島把實例色 lerp 到灰色 0.72，發光件乘 0.12，不重建幾何。
- 發光：發光件用一個共用 `MeshBasicMaterial({ toneMapped: false })`，每幀 `color.setScalar(0.28 + night·1.5)`。白天幾乎不亮，夜裡超過 1.0，看起來像自發光。個別需要閃爍的件用自己的材質，`userData.flick` 控制倍率。窗戶在建造時以 `rng() < 0.3` 隨機決定亮不亮。
- 動畫參數範例（可直接參考數值）：
  - 火焰：`scale.y = 0.75 + sin(t·9 + ph)·0.25 + sin(t·23 + ph)·0.1`，亮度 `flick = 0.8 + sin(t·13 + ph)·0.2`。兩個不同頻率的正弦相加，避免看起來規律。
  - 煙：8~10 顆深色球，`k = (t·0.18 + ph) % 1`，位置往上 `k·2.2`、往側邊飄，`scale = 0.4 + k·1.3`。輸送帶式循環，不用粒子系統。
  - 爆炸：每 4 秒一次，前 30% 火球放大 `0.6 + sqrt(burst)·1.6`，碎片用拋物線 `y = vy·k - 2.2·k²`，60% 後隱藏。
  - 直升機：繞山 `angle = t·0.35`，高度加 `sin(t·1.3)·0.05`，旋翼 `rotation.y = t·30`，飛過火線時才顯示灑水柱。
  - 警示燈：`sin(t·8) > 0 ? 1 : 0.1` 方波閃爍。
- 島與島之間的關聯線（`app.js` 197~234 行）：`CatmullRomCurve3` 拱形曲線（中點抬高 1.5）做 `TubeGeometry(curve, 96, 0.03, 6)`，`ShaderMaterial` 用 `fract(vUv.x·26 - time·0.9)` 做流動虛線，`discard` 切出實線、虛線、點線三種樣式，另有一段 `step(0.9, fract(vUv.x·4 - time·0.35))` 的亮帶沿線跑。兩端 `smoothstep` 淡出。

### 3.5 會動的生物與車輛

- 主角人物 Lumama（`lumama.js`）：見第 5 節。
- 關聯線上的光點（`people.js`）：每條關聯線兩顆小光球，沿貝茲曲線來回，`y = 0.35 + sin(t·3)·0.05` 浮動。程式也保留 Q 版搬運小人（`RoundedBox` 身體、球頭、帽子、腿），腿擺 `sin(t·11)·0.6`、身體彈跳 `|sin(t·11)|·0.02`，到端點前後各留 4% 停頓。
- 幽靈：16 隻，`LatheGeometry` 旋轉出鐘形身體，半透明自發光，繞某座島轉圈並上下飄；透明度 `max(0, night - 0.15)·0.85`，白天消失。
- 烏鴉：9 隻，箱形身體加兩片翅膀，高空繞圈，翅膀 `sin(t·9)·0.6` 拍動。
- 車輛（`memes.js`）：城市三面圍一條高架道路，兩線道車子塞滿（車身與車廂各一個 InstancedMesh，6 種顏色隨機），每隔一陣子 `pow(max(0, sin(t·0.6)), 6)` 爬幾公分又停住；一台半透明「幽靈公車」沿路網隨機行駛並閃爍；鼠群定時沿路衝刺；捷運隧道鑽掘機停在工地。
- 水：只有海面顏色隨時段變，沒有波浪 shader。動感來自船的浮動。（確認）
- 雲：沒有雲，只有低空霧氣 Sprite。（確認）

### 3.6 鏡頭與轉場

- `flyTo(target, pos, dur = 1.15)`：鏡頭位置與 target 同時用 cubic ease-in-out 內插。用「牆鐘時間（上限 0.25 秒）」推進，慢裝置也會準時飛到。使用者一拖曳就取消飛行。
- 全景：依畫面寬高與 FOV 算出能塞下整座城的距離；手機直式改用較低的俯角 1.0、轉 -0.35 rad，讓城市的對角線填滿窄螢幕。
- 單島：距離 9.5（手機 12）、俯角 0.92、方位 0.18。
- 卡片遮住畫面時不移鏡頭，而是用 `camera.setViewOffset()` 把投影中心移到剩下的可見區（桌面往左移卡片寬度一半，手機往上移抽屜高度一半），以 `1 - exp(-dt·6)` 平滑跟上（`app.js` 1170~1191 行）。選中的島永遠在可見區正中。
- 自動導覽：`data.json` 的 `tour.cues` 時間軸（約 64 秒），每段指定目標島、要顯示的關聯線、時段和字幕。

### 3.7 效能策略（確認）

- 三段畫質 `high／medium／low`：桌機 high；寬度 800 以下或行動裝置 medium；Threads、Instagram、Facebook、LINE 內建瀏覽器（UA 判斷）直接 low。可用 `?quality=` 覆寫。
- 各段差異：像素比上限 1.75／1.35／1；陰影貼圖 2048／1024／768；地形段數 200／130／96；樹 1700／850／520；霧 26／14 片；low 關抗鋸齒、陰影每 6 幀才更新一次。
- 執行中自動降級（`adapt()`，`app.js` 1240~1262 行）：前 3 秒不算；之後每 2 秒取平均，低於 28 fps（刻意不是 30，避開省電模式鎖 30 的手機）就把像素比降 0.25，同時加 `lowfx` class 關掉所有 `backdrop-filter`，陰影改成每 6 幀更新。
- 大量物件一律 InstancedMesh：道路、車道線、路燈、樹、消波塊、塞車車輛、島上靜態零件。
- 沒有 LOD。
- `prefers-reduced-motion`：預設凍結動畫、鏡頭飛行改瞬移、CSS 動畫全關。工具列另有「暫停」鈕。

## 4. 介面版面

### 4.1 配置（桌面，見截圖）

- 左上：品牌框，紅色 serif「TERROR / ISLAND.」加城市標題，米白毛玻璃圓角卡。
- 上方中間：兩組膠囊按鈕列，左組四個時段圖示（選中的變黑底圓鈕），右組是圖層開關（關聯、時間軸、暫停、鳥瞰、音樂、總覽），圖示在上、11px 文字在下。
- 右上直排：導覽、全景、清單、作者、說明，每顆 44px 高的米白圓角鈕。
- 右側固定欄 340px：eyebrow「THE EVENT INDEX」、serif 大標「這座城，發生過什麼。」、計數、搜尋框、兩個分頁、島嶼清單。清單每列是「斜體 serif 紅色序號 + 粗體島名 + 深色小標籤 + 右側數量 ↗」。
- 左側浮在 3D 上：超大紅色 serif 數字「19」加兩行 serif 標語（`hero-note`），選中島後淡出；1280px 以下隱藏。
- 右下：數字小方鈕組成的「快速前往」dock（9 欄格線），上方一個黑色膠囊狀態列，左邊是小臉圖示，滑過島時顯示「島名 · 區名」，平時顯示提示語。
- 3D 名牌（CSS2DRenderer）：米白膠囊，`<b>` 用 monospace 紅色序號，選中時整顆變紅底白字。CSS 註解特別寫「不要 transition transform」，因為 CSS2DRenderer 每幀改 transform。
- 詳細卡片：選中島時從右側欄左邊出現，`cardIn` 0.3 秒（從下方 10px 淡入）。內容：eyebrow「LEGEND 18」、serif 26px 標題、導言、分類標籤與危險度圖示、灰底說明框、事件清單（白底圓角 12px 卡片，標題粗體、日期、兩行摘要截斷）、上一處／下一處按鈕。

### 4.2 字體與配色（確認，`ui.css` 1~16 行）

- 標題：`Noto Serif TC` 900。內文：`Noto Sans TC`。eyebrow、序號、計數：`ui-monospace` 11px、字距 0.18em、大寫。
- 色票：紙色 `#f5f0e8`、紙色二 `#ece4d8`、墨色 `#1b1517`、次要字 `#6f6461`、線 `#d9cfc3`、主色暗紅 `#a8201a`、副色 `#d2452f`、毛玻璃 `rgba(245,240,232,0.92)`、頁面底 `#120f16`。
- 陰影：`0 10px 30px rgba(20,10,12,.18), 0 2px 6px rgba(20,10,12,.12)` 兩層。圓角變數 16px，引導框 20px。

### 4.3 動效

- 卡片、日誌列、引導框：同一支 `cardIn` keyframe。
- 有活動的名牌：右側小紅點 `pulse` 擴散光圈 1.6 秒循環。
- 狀態列小臉：`float` 上下 3px、3 秒循環。
- 載入畫面：深色全螢幕，紅色 serif 大字用不規則 `flicker` 閃爍，載入完 0.8 秒淡出。
- 側欄開關：`#stage` 的 `right` 與工具列位置 0.35 秒 ease 一起移動，3D 畫面跟著變寬。
- 彩蛋類：點主角噴金幣（14 枚圓柱，重力 9、旋轉）加 CSS 文字上浮放大；海岸點擊有暗角 vignette（`body::after` 放射漸層 1.2 秒淡入）與字幕閃爍模糊；拍照閃光。這些屬於主題趣味，本站不適用。
- 聲音：`music.js` 用 Web Audio 現場合成（低音 drone、走音音樂盒、風聲），`sfx.js` 每座島一種點擊音效。只在使用者按下後才發聲。

### 4.4 手機版（確認，`ui.css` 315~366 行與截圖）

- 斷點 800px。工具列改成右上直排，時段按鈕預設藏起來。
- 底部固定一條膠囊 HUD：關聯、時間軸、暫停、鳥瞰、音樂、總覽，圖示加文字，平均分配寬度。
- 清單變成高 82vh 的底部抽屜。詳細卡片是底部抽屜，預設 48vh；把手可拖：拖過 60% 變全螢幕、低於 25% 關閉、點一下切換。卡片關閉鈕用 `position: sticky` 釘在把手旁。
- 名牌縮到 9.5px。全景鏡頭用前述的手機專用角度。
- 有處理 `env(safe-area-inset-*)`、`100dvh`、內建瀏覽器吃掉橫向滑動（`touchmove` 呼叫 `preventDefault`）。

## 5. 人物

- 有一個 3D 主角「Lumama」，全部用基本幾何拼成，沒有模型檔或頭像圖片。（確認，`lumama.js`）
  - 身體：`RoundedBoxGeometry(0.42, 0.42, 0.3, 3, 0.1)` 白襯衫；腿、手臂各掛在 pivot `Group` 上，方便旋轉。
  - 頭：放大的球（0.48×0.55×0.44），頭髮用 6 顆壓扁、旋轉過的球疊出短髮與瀏海；眉眼用半個 `TorusGeometry`；大鼻子、張嘴大笑用球體嵌進臉裡。臉部材質帶 `emissive`，旁邊掛一盞 `PointLight(0xb8ff7a, 1.4, 2.4)` 照亮臉，強度 `0.9 + sin(t·2)·0.3` 呼吸。
  - 道具：胸前一面小鼓，雙手輪流拍（`-0.8 - max(0, sin(t·8))·0.5`）。
  - 整體放大 1.8 倍，頭上 CSS2D 名牌。
  - 走動：把每格六角形的 6 個頂點建成路網圖，在路口隨機選下一條（不走回頭路），速度 0.55，轉向用最短角差乘 `dt·6` 平滑；腳步 `sin(t·7)·0.5`，整體彈跳 `|sin(t·7)|·0.04`，頭左右晃 `sin(t·3.5)·0.08`。因為只走路網，永遠不會穿過島上模型。
  - 點擊：看不見的碰撞盒，觸發金幣粒子與上浮文字。
- 島上的小人：`qdead`（Q 版、叉叉眼）與 `shadowman`（黑影人）兩種程式拼的小角色，用在各島場景。（確認，`models.js` 199~242 行）
- 介面頭像：狀態列與 favicon 用手寫內嵌 SVG 的小臉（藍色漸層、皺眉表情）。（確認，`index.html`）
- 這個人物是在諷刺現任市長。本站若要放人物，應做成中性的市民或導覽員，不可做成任何候選人的造型。

## 6. 跟 heart-island 相比，lumama 特有、值得借用的設計

下表「heart-island」欄依 `reference-site.md` 與本次截圖；筆記沒寫到的項目標「未比對」，不代表 heart-island 沒有。

| 項目 | lumama | heart-island | 值得借用 |
|---|---|---|---|
| 島的排列 | 19 格緊貼，縫隙就是道路，有車道線與路燈 | 14 格分開，四周是水，用橋連接 | 看本站要「城市感」還是「群島感」；緊貼版較好做出熱鬧的街道動態 |
| 外圍地形 | noise 高度地形：西海岸、東山脈、上千棵樹、消波塊、船 | 水面加外圍小島 | 是。外圍有地景，畫面邊緣不空 |
| 每島動畫 | 38 組循環動畫，火、煙、爆炸、直升機、閃燈 | 走動小人、晝夜（筆記記載） | 是，這是「動感」差距最大的一項 |
| 發光 | toneMapped:false 材質隨夜間係數變亮，窗戶隨機亮 | 未比對 | 是，不用 bloom 就有夜景 |
| 晝夜 | 10 組關鍵影格 × 13 個參數內插，切換有 1.4 秒補間 | 有晝夜（筆記記載） | 是，照 KEYS 表結構做 |
| 主角人物 | 1 個大型角色在路網遊走，帶點光源 | 搬運小人 | 可借「沿路網遊走」與「帽子、道具讓角色可辨認」 |
| 環境生物 | 幽靈、烏鴉、霧 | 未比對 | 可改成鳥群、雲影等中性元素 |
| 選取回饋 | 六角外框線（不受深度遮擋）+ 地面呼吸光環 + 名牌變色 | 未比對 | 是 |
| 卡片開啟 | `setViewOffset` 把投影中心移到可見區 | 未比對 | 是，桌面與手機都受益 |
| 效能 | 三段畫質 + 內建瀏覽器降級 + 執行中 fps 自動降級 | 兩段畫質（筆記記載） | 是，特別是 `adapt()` 與 `lowfx` 關毛玻璃 |
| 字體 | 載入 Noto Serif TC 做標題、序號用斜體 serif | 未載入網頁字型 | 是，serif 標題是「精緻感」的主要來源之一 |
| 手機卡片 | 可拖曳三段（48vh／全螢幕／關閉） | 底部抽屜最高 48vh | 是 |
| 底部 HUD | 手機版圖層開關集中在底部膠囊列 | 未比對 | 是 |
| 時間軸 | 事件依月份排在軸上，可播放、可累積 | 任期時間軸（筆記記載） | 可改成「政見依領域或時程」 |
| 聲音 | Web Audio 程序化配樂與音效 | 未比對 | 選配，預設關閉 |
| 恐怖效果、彩蛋、DLC 笑點 | 有 | 無 | 不借，與本站定位不合 |

## 7. 要做出同等動感與精緻度的建議

1. 晝夜改成關鍵影格表：照 `KEYS` 的結構，每個時間點存天頂色、地平線色、平行光色與強度、半球光三值、夜間係數、霧色與遠近、水色，`setTime()` 用 smoothstep 內插全部；切換時段用約 1.4 秒 ease 補間分鐘數。天空用 BackSide 球體加兩色漸層 shader。
2. 建零件庫加分桶 InstancedMesh：寫一個 `kit.zone(id)` 回傳 `box／rbox／cyl／cone／pyr／sphere／ico／dome／gable` 等放置函式；靜態件依幾何種類收進同一個 InstancedMesh 並 `setColorAt`，動態件放 `dyn` Group。這樣每座政見島可以放上百個小零件，draw call 仍在幾十個。
3. 每座政見島至少一組循環動畫：用 `p.anim((t) => ...)` 註冊。中性題材的對應例：施工吊臂擺動、公車沿路繞行、風車旋轉、噴泉水柱伸縮、旗子擺動、校園鐘塔、醫院直升機。數值可參考：主頻率加一個高頻小振幅（如 `0.75 + 0.25·sin(9t) + 0.1·sin(23t)`）、輸送帶式循環 `k = (t·速度 + 相位) % 1`。
4. 夜景發光不靠 bloom：發光件用 `MeshBasicMaterial({ toneMapped: false })`，每幀把顏色乘 `0.28 + night·1.5`；窗戶建造時約 30% 隨機亮；路口放路燈（柱與燈泡各一個 InstancedMesh）。
5. 外圍加地形與植被：大片 PlaneGeometry 用 SimplexNoise 算高度，依高度給頂點色，`flatShading: true`；台中可照實際地理做西側海岸、東側山脈；樹分 2~3 種，各一個 InstancedMesh，依畫質放 500~1700 棵；城市上空放十幾片漂移的霧 Sprite。
6. 加會走路的中性角色：Q 版小人（RoundedBox 身體、球頭、帽子、兩腿掛 pivot），腿擺 `sin(t·11)·0.6`、彈跳 `|sin|·0.02`；把六角格頂點建成路網圖，在路口隨機轉彎，轉向用最短角差乘 `dt·6` 平滑。可再加鳥群繞圈（翅膀 `sin(t·9)·0.6`）。
7. 選取回饋三件套：六角外框 `THREE.Line`（`depthTest: false`、高 renderOrder）、平台外圈路面上的六角光環做呼吸透明度、CSS2D 名牌換主色底。滑過時外框半透明，並在右下狀態列顯示島名。
8. 卡片開啟時用 `camera.setViewOffset()` 把投影中心移到卡片以外的可見區，再加指數平滑；鏡頭飛行用 cubic ease-in-out 約 1.15 秒，以牆鐘時間推進，使用者一拖曳就取消。
9. 島與島的關聯線用 TubeGeometry 加 ShaderMaterial：`fract(vUv.x·26 - time·0.9)` 做流動虛線，兩端 smoothstep 淡出，線上跑一顆小光球。比 `Line` 有厚度，也比較有「在流動」的感覺。
10. 畫質分三段並在執行中自動降級：依裝置與內建瀏覽器 UA 選初始畫質（像素比 1.75／1.35／1、陰影 2048／1024／768、地形段數、樹數）；執行 3 秒後每 2 秒量平均 fps，低於 28 就降像素比 0.25、關 `backdrop-filter`、陰影改每 6 幀更新。
11. 版面換成 lumama 的字體層次：載入 Noto Serif TC 900 做標題與大序號，eyebrow 用 monospace 11px、字距 0.18em；清單序號用斜體 serif；卡片與按鈕用紙色底、兩層陰影、16px 圓角；左側加超大數字標語（選中後淡出）。主色換成本站自己的配色（見 ADR 0001），不要用 lumama 的暗紅與深夜底。
12. 手機版補三件：底部膠囊 HUD 集中圖層開關；詳細卡片可拖曳成 48vh、全螢幕或關閉；直式全景改用較低俯角並轉一點方位角，讓城市對角線填滿螢幕。

## 8. 不建議借用

- 預設深夜、暗紅主色、陰森配樂、暗角與字幕閃爍、幽靈與黑影人：這是恐怖諷刺主題的一部分，用在政見對照會讓中立性受質疑。
- 以真實政治人物為原型的角色與彩蛋。
- 直接複製任何程式碼：原站沒有授權聲明。

## 附註：截圖

截圖存在本次 session 的暫存目錄，沒有放進 repo：lumama 桌面（深夜、白天、選中火燒山島）、lumama 手機（全景、選中氣爆火災島）、heart-island 桌面（略過引導後）。需要時可用無頭 Chrome 加 `?time=12:00`、`?zone=<id>` 參數重拍；略過引導要先在 localStorage 設 `ti-onboarded-lumama=1`。
