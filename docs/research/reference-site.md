# 參考網站技術分析：puma.taipei/heart-island

- 分析日期：2026-10-23
- 對象：台北市長候選人沈伯洋的「政策島」頁面 https://puma.taipei/heart-island
- 用途：本站借用其概念與前端技術。只參考做法，程式碼全部重寫，不直接搬。

## 技術棧（確認）

- 沒有框架、沒有打包。`index.html` 是靜態 DOM，用 `<script type="module" src="./app.js?v=...">` 啟動。破快取只靠查詢字串。
- three.js r160 放在自己的主機上（`vendor/three/build/three.module.js`），用 `<script type="importmap">` 把 `three` 和 `three/addons/` 對到本地路徑。
- 用到的 three.js 附加模組：`OrbitControls`、`CSS2DRenderer`（3D 場景上的 HTML 名牌）、`RoundedBoxGeometry`、`BufferGeometryUtils.mergeGeometries`、`SimplexNoise`。
- 渲染：`WebGLRenderer`（antialias、alpha）、`PerspectiveCamera(32°)`、`PCFSoftShadowMap`、`ACESFilmicToneMapping`。大量用 `InstancedMesh` 與 `CanvasTexture`。所有模型由程式產生，沒有 glTF。
- 模組拆分：主程式約 2,200 行，另有島與橋、裝飾物、水面天空晝夜、走動小人、圖示（手寫 SVG）等模組。DOM 操作用自訂 `$`／`$$` 加 `innerHTML` 模板字串。
- CSS：一支手寫 CSS，約 1,540 行，`:root` CSS 變數管理顏色，沒有 Tailwind。
- 部署：前面是 Cloudflare 代理（`server: cloudflare`），來源主機推測是自架 nginx（未驗證）。

## 互動概念（確認）

- 14 個大小相同的尖頂六角形，一個政策主題占一格，用軸向座標 `[q, r]` 排成台北市輪廓。格上建築代表細項政見（共 94 項）。島與島之間用橋連接，四周是水面。透視投影，不是嚴格等角。
- 3D 操作：`OrbitControls` 可旋轉、縮放，不能平移，距離限制 3~70。點選用 `Raycaster`，`flyTo()` 讓鏡頭飛到指定的島。
- 右側清單：搜尋框加樹狀主題清單。選中島或建築時，詳細卡片顯示事實、推動階段、對象、來源連結。
- 原站另有協作線、搬運小人、一天時間軸、任期時間軸、分類篩選、自動導覽、中英切換、GA 事件。本站不做這些（見 spec 的 Out of Scope）。
- 首次進站 3 步說明，看過後用 `localStorage` 記住。
- 網址參數：`focus`、`island`、`quality` 等。

## 資料結構（確認，`policies.json` schemaVersion 3）

- 頂層：`meta, sources, islands, ports, flows, quotes, dayCycle, termTimeline, termRules, tour, renderPlan, ui`。
- island：`id, number, name, summary, sources[], axial[q,r], cells, buildings[]` 等。
- building：`id, name, facts[], phase, sources[], plain（白話說明）, who（受益對象）`。
- source：`id, url, title, checkedAt, status, confidence`。
- quote：`text, program, timecode, url, verification, readyToPublish`。
- 每筆資料都帶來源與信心程度，引述有 `readyToPublish` 旗標。本站「未通過核對不公開」是同一種設計。

## 視覺（確認）

- 低多邊形桌遊模型風：淺土色島、綠色樹叢、藍綠色水面、小人與小房子。
- 介面：毛玻璃（`backdrop-filter: blur`）米白圓角卡片，圓角 8~14px。小標與數字用 `ui-monospace`。
- 字體宣告 `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei"`，沒有載入網頁字型。
- 原站主色是珊瑚色 `#db6a41`。本站配色另訂（見 ADR 0001），不沿用。
- 動畫：小人走動、晝夜光線、鏡頭飛行。遵守 `prefers-reduced-motion`，另有暫停按鈕。

## 手機版（從 CSS 與 JS 確認，未在實機驗證）

- 斷點 800px。右側清單在手機上變成可拖拉的底部抽屜，詳細卡片也是底部抽屜（最高 48vh）。
- 搜尋框字級 16px，避免 iOS 自動放大。處理觸控點擊與拖曳的判斷。
- 寬度 800px 以下或行動裝置自動降為中畫質，像素比上限從 1.75 降到 1.4。
