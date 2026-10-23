# 候選人資料抽取方法

候選人資料的欄位固定為姓名、政黨、出生年、學歷、經歷，三位候選人相同（ADR 0001）。來源只用中選會。姓名與政黨沿用候選人本身的欄位，本檔說明出生年、學歷與經歷怎麼取得。每位候選人的抽取結果與目視比對紀錄寫在 `data/extraction/records/<候選人識別碼>.md` 的「候選人資料」一節。

## 來源

- 學歷與經歷：中選會選舉公報。2026 年選舉公報公布前，用三人最近一次參選、都有公報的 2024 年第11屆立法委員選舉（區域）臺中市各選舉區公報，網址在 `bulletin.cec.gov.tw`。每份公報 PDF 第 1 頁是候選人個人資料與政見，第 2 頁是投開票所一覽表。
- 出生年：同一份公報的「出生年月日」（民國年，加 1911 換算成西元年）。另與中選會選舉資料庫（`db.cec.gov.tw`）同一場選舉的候選人資料 `cand_birthday` 比對，兩者須相同。2024 年區域立委的候選人資料在 `https://db.cec.gov.tw/static/elections/data/candidates/ELC/L0/L1/9c96a2080bfc199c590ec54f3a2bda7b/C/00_000_00_000_0000.json`。
- 中選會選舉資料庫的學歷欄位只有最高學歷等級（例如「博士」），沒有經歷，所以學歷與經歷不取自資料庫。

## 步驟

1. 下載公報 PDF。
2. 用抓取指令擷取第 1 頁，存出處快照並送 Wayback Machine 存檔：

   ```
   node scripts/fetch-source.js --candidate <候選人識別碼> --id <出處識別碼> --url <公報網址> \
     --type election-bulletin --title <公報標題> --pdf <下載的 PDF> [--glyph-map <字型對照檔>]
   ```

   指令以 poppler 的 pdftotext（閱讀順序模式）轉出文字，出處紀錄的 `snapshotNote` 自動寫明轉換方法。
3. 檢查快照中候選人的學歷與經歷有沒有「�」（U+FFFD）。有的話，表示 PDF 的 ToUnicode 對照表把那些字形對到替代字元，依下一節還原，再重跑第 2 步。
4. 把 PDF 第 1 頁轉成圖片（`pdftoppm -r 300`），逐字比對圖片與快照中的學歷、經歷、出生年月日，結果寫進抽取紀錄。
5. 依下列規則把學歷與經歷逐字寫進 `data/raw/candidates.json` 的 `profile`，`verification.layer1.status` 先填 `pending`。
6. 跑 `node scripts/verify.js --profiles-only`，逐字比對通過才會公開。

## 逐字複製的規則

- 公報上一個項目符號（•）一項，項目符號本身不抄。沒有項目符號的區塊整段一項，不自行斷句。
- 一項因欄寬換行時接回同一行，不加任何字。
- pdftotext 依字距在字與字之間插入的空白不抄（例如「《 時代 》」寫成「《時代》」、「8 7年」寫成「87年」）。其餘文字、標點、全形半形與用字（台、臺）一律照公報，不改寫、不補字、不刪字。

## 抽不出的字形：PDF 字型對照還原

有些公報 PDF 的字型子集把數字等字形在 ToUnicode 對照表中對到 U+FFFD，pdftotext 轉出「�」。還原步驟：

1. 從 PDF 的字型物件找出對到 U+FFFD 的代碼，與字型的 CID 系統資訊。字型若是 Adobe-CNS1，用 poppler 附的 Adobe-CNS1 CID→Unicode 對照表即可；若是 Adobe-Identity（代碼沒有公開的對照），改用字型本身的寬度表與字形順序推定。
2. 把推定結果寫成字型對照檔 `data/extraction/glyph-maps/<名稱>.json`（`fonts[].baseFont` 與 `fonts[].codes`，代碼 → 文字），`description` 寫明推定依據。
3. 抓取指令加 `--glyph-map`，以 PDF 增量更新改寫該字型的 ToUnicode 對照表後再轉文字（`scripts/lib/pdf-text.js`）。原 PDF 不變，出處快照存還原後的文字，`snapshotNote` 註明「文字由 PDF 字型對照還原」與對照檔。
4. 還原結果另用 OCR（macOS Vision，繁體中文）辨識同一頁的圖片交叉比對，並逐字目視比對。三者一致才採用。不一致時不採用，該候選人資料不寫入、不公開，在抽取紀錄寫明哪裡不一致，改找其他還原方法。
