# 台中政見島（Taichung Policy Island）

正式網址：<https://tc-policy-island.pages.dev>

把 2026 台中市長候選人的政見依公共議題分區並排，讓台中市民在同一個議題底下比較每位候選人說了什麼。每條政見都附原文引述與一手來源（候選人官網、官方臉書、政見發表會、選舉公報），點進去就能自己查證。網站有兩種檢視：島嶼檢視（每個議題區是島上的一塊）與表格檢視（議題區 × 候選人）。

## 揭露聲明

本站由 AI 依公開資料自動整理，與任何候選人或政黨無關，未經人工逐筆審查。每條政見都要通過兩層核對才會公開：原文引述須逐字出現在出處快照中，再由一個未參與抽取的 AI 依公開的檢核表判定摘要忠於原文、沒有評價字眼與品牌用語。分類規則、檢核表、提示詞與核對報告全文公開在網站的[整理方法頁](https://tc-policy-island.pages.dev/method.html)，中立規則見 [ADR 0001](docs/adr/0001-neutrality-rules.md)，改用 AI 核對的理由見 [ADR 0002](docs/adr/0002-ai-verification-instead-of-human-review.md)。

## 回報更正

發現錯誤請到本 repo 的 [GitHub Issues](https://github.com/kcchien/tc-policy-island/issues) 回報，附上政見卡片上的政見連結，以及你認為有誤的地方。處理過程公開在 Issues 上，修正後的政見一樣要重新通過兩層核對才會公開。

## 本機執行

需要 Node 24 以上，不需要安裝任何套件。

```sh
node --test                # 測試
node scripts/build.js      # 原始資料 data/raw/ → 公開資料集 site/data/dataset.json
node scripts/gates.js      # 上線關卡，任一項失敗即以非零結束碼退出
node scripts/preview.js    # 本機預覽 http://localhost:8000/
```

`npm run check` 依序跑測試、建置與關卡；`npm run preview` 會先建置再開預覽。

## 部署

由維護者在本機執行，CI 只做檢查、不部署。本專案不裝 npm 套件，wrangler 要另外全域安裝（`npm install -g wrangler`），並先以 `wrangler login` 登入 Cloudflare。

```sh
npm run deploy               # 測試 → 建置 → 上線關卡 → 部署到 Cloudflare Pages 專案 tc-policy-island 的正式環境（main）
npm run deploy -- --dry-run  # 跑完全部檢查，只列出建立專案與部署的 wrangler 指令、不執行
```

任一步失敗就以結束碼 1 退出，不部署。Cloudflare Pages 專案不存在時會先建立。

## 授權

整理內容（摘要、議題區、分類與資料結構）採 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，引用時請註明「台中政見島」並附本站網址。程式碼採 MIT（見 [LICENSE](LICENSE)）。原文引述與出處快照的著作權屬於各候選人，本站以引用方式呈現，供查證與比較。完整說明見[整理方法頁](https://tc-policy-island.pages.dev/method.html#license)。
