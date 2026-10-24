# 用一個 Pages Function 統計頁面瀏覽與出處點擊，不記任何可識別讀者的資料

選前改造的成功指標只有一個：讀者找到跟自己有關的政見，並點進出處（#35）。要知道改動有沒有用，就得量到「出處連結被點了幾次」。純靜態網站量不到這件事，所以本站在 repo 根目錄的 `functions/api/hit.js` 加一個 Cloudflare Pages Function，這是本站唯一的後端程式。

前端 `site/js/hits.js` 在兩種情況各送一筆：資料載入後送一次頁面瀏覽，政見卡片或候選人資料卡的出處連結（出處、原文存檔、網頁備份）被點擊時送一次出處點擊。內容只有三個欄位：種類（`pageview` 或 `source`）、出處識別碼（頁面瀏覽為空）、當時的檢視（島嶼、表格或整理方法頁）。端點檢查格式後寫進 Workers Analytics Engine 的資料集 `tc_policy_island_hits`，綁定在 `wrangler.toml`。

## 不記任何可識別讀者的資料

- 端點不讀請求標頭與連線資訊：不讀 IP、User-Agent、Referer、cookie，也不讀 Cloudflare 附在請求上的地區資訊。資料點只有上面三個欄位與一個計數。
- 不設 cookie，不在瀏覽器存任何識別碼，不把同一位讀者的多次瀏覽串在一起。
- 瀏覽器開啟「不要追蹤」（`navigator.doNotTrack === '1'`）或全域隱私控制（`navigator.globalPrivacyControl`）時，前端完全不送。
- 送出用 `navigator.sendBeacon`，失敗就放棄；點擊統計只旁聽事件，不攔截、不改連結，連結照常開啟。
- 整理方法頁的揭露聲明用白話寫出收集什麼、不收集什麼。

理由：本站要讀者相信整理過程中立，自己卻追蹤讀者，可信度會受損。量「幾次」就足以判斷改動有沒有用，不需要知道「是誰」。

## 只統計次數，不依讀者行為改變內容

統計結果只給維護者判斷改動有沒有用。不依點擊量排序議題區或候選人、不推薦政見，也不在畫面顯示點擊數（ADR 0001：不依政見數量或讀者行為呈現差異）。

## Considered Options

- Cloudflare Web Analytics：免 cookie，但不支援自訂事件，量不到出處點擊；部署用的 API 權杖也沒有 Web Analytics 權限。只量頁面瀏覽不夠回答成功指標，兩套機制並存也沒有必要，所以不接。
- Cloudflare Zaraz 事件追蹤：要網站掛在 Cloudflare 自有網域，且等於引入第三方追蹤腳本的管理介面，揭露範圍更難說清楚。放棄。
- 不量：成功指標就無從驗證，選前的改動也無法判斷要不要留。放棄。

## Consequences

- 本站不再是「只有靜態檔」：`functions/` 只放這一個統計端點，不得放其他後端邏輯（`AGENTS.md`「技術限制」）。`test/repo.test.js` 檢查 `functions/` 只有這一個檔案。
- 部署指令在 repo 根目錄執行 `wrangler pages deploy site`，會一併上傳 `functions/`。
- 寫入靠綁定，不需要權杖。讀取統計要用 Analytics Engine SQL API 與帶「Account Analytics 讀取」權限的權杖，由維護者另行處理。
- 本機預覽（`scripts/preview.js`）沒有這個端點，送出會失敗並被忽略，不影響畫面。
