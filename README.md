# 台中政見島（Taichung Policy Island）

由 AI 依公開資料自動整理的 2026 台中市長候選人政見對照網站。本站與任何候選人或政黨無關，未經人工逐筆審查。每條政見都附原文引述與一手來源，並通過兩層核對才會公開。

## 本機執行

需要 Node 24 以上，不需要安裝任何套件。

```sh
node --test                # 測試
node scripts/build.js      # 原始資料 data/raw/ → 公開資料集 site/data/dataset.json
node scripts/gates.js      # 上線關卡，任一項失敗即以非零結束碼退出
node scripts/preview.js    # 本機預覽 http://localhost:8000/
```

`npm run check` 依序跑測試、建置與關卡；`npm run preview` 會先建置再開預覽。

## 授權

整理內容採 CC BY 4.0，程式碼採 MIT，原文引述的著作權屬於各候選人。
