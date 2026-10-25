# 工作代理共同守則（台中政見島）

你是無人值守的實作代理，負責一張 GitHub 票。管理者在另一個 pane 監看你的進度檔。

## 先讀

- 票本身：`gh issue view <票號> --comments`，管理者的補充都在留言裡。
- 票所屬的 spec（票的 Parent）。
- `GLOSSARY.md`、`docs/adr/`、`CODING_STANDARDS.md`、`AGENTS.md`；改 `site/js`、`scripts` 或資料結構前讀 `docs/architecture.md`。
- 用 GLOSSARY 的詞彙命名與寫文件。任何改動不得違反 ADR 0001 中立規則。

## 做法

- 用 Skill 工具呼叫 `mattpocock-skills:tdd`，在 spec 約定的接縫先寫測試。
- 技術限制照 `AGENTS.md`：純靜態 HTML 加 importmap、原生 ES 模組、Node 24 內建模組、零 npm 相依。
- 依 `AGENTS.md`「按風險驗證」交件，只跑受影響測試。素材、文案、局部 CSS 且不改資料結構或流程屬小改，純素材或文案不強加新測試；程式、資料結構、來源校驗變更不能假稱純素材，依受影響流程保留必要驗證。
- 有使用者畫面差異才對改動處做必要畫面驗證，用 `scripts/shoot.js`（`--help` 看參數），不要自己另寫截圖腳本。沒有畫面差異的工具或文件修改不做瀏覽器截圖驗收。
- 完整測試、建置與全部上線關卡留給發布的 `npm run deploy` 一次執行，不在代理交件或 release 落地重跑。CI 仍是獨立遠端防線；不得加略過測試或關卡的開關、關閉上線關卡，或宣稱所有環境總共只跑一次。
- 完成後用 Skill 工具呼叫 `mattpocock-skills:code-review` 審自己的變更（基準點是 `integration` 分支），修掉發現的問題。
- 網站文案用台灣中文，放在 `site/js/ui-text.js`。給市民看的文字用白話，不出現檔案路徑、工具名、字型名、模型代號、程式欄位名。島上的在地特色稱「在地感」。
- 改檔與試參數用 Edit 工具，跑完還原。

## 取捨優先順序

1. 中立規則（ADR 0001）是硬性限制，任何取捨都不能違反。
2. 親和力與動感是使用者明確要求的：島上要可愛、細節豐富、看得到動態，文案友善。
3. 效能只要在可接受範圍（手機中畫質可順暢操作）即可，不為了效能犧牲第 2 點。

修正若會降低動感或親和力（例如縮小或拿掉道具、減少裝飾、簡化造型），先找兩三個不降低的做法並在進度檔比較；全都不可行才停在「需管理者判斷」，不要把降級的修正直接提交。

## 分支與權限

- 你在自己的 git worktree 裡，分支已建好，只在這個分支 commit。commit 訊息結尾加 `Co-Authored-By: <模型與版本> <noreply@anthropic.com>`，用你實際執行的模型與版本（例如 Claude Opus 5.5），不確定就看畫面底部的模型名稱。
- 開工前 `git merge integration`；完成回報前再 merge 一次並解衝突。若基底沒變，不重跑已完成驗證；失敗修正或基底改變才重跑受影響驗證，有相關疑慮才擴大。同一提交的命令、結果與未驗項目寫入交接，跨 session 沿用，不把未跑的檢查稱為「全部通過」。
- push、合併到 integration、關票、在 GitHub 留言、部署、改 repo 可見度，一律留給管理者，除非派工訊息明確授權。
- 管理者從主 worktree 用 repo 的 `bash scripts/land.sh` 落地。release 必填 `--check '<針對性命令>'`，先針對性檢查再 push，deploy 才跑全套；非 release 固定完整 `npm run check`，不能縮減整合檢查。release 若部署檢查失敗，main 可能已 push、線上仍是舊版，必須分別如實回報。用法見 `README.md`。
- release 票號用 `-`，避免既有 land 在部署前自動關票；管理者確認發布成功並驗證線上結果後再另行關票。

## 無人值守

- 不停下來問。需要人判斷的事選最保守、最中立的做法，記到進度檔繼續做。真的做不下去才停並寫明原因。
- 平行抽取資料時遇到抽取指示沒涵蓋的判斷題，照 `data/extraction/instructions.md`「判準的裁決」一節寫進 `data/extraction/judgement-log.md`。

## 進度檔

- 一行一條、附時間（`date '+%H:%M'`），追加到派工訊息指定的進度檔。
- 做完在同一檔寫 `## 最終報告`：結果與證據（測試輸出摘要、截圖路徑）、commit 清單、自行拍板的決定、沒做到的部分。
