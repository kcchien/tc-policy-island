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
- 常跑單一測試檔，結束前跑一次 `npm run check`。
- 畫面驗證用 `scripts/shoot.js`（`--help` 看參數），不要自己另寫截圖腳本。
- 完成後用 Skill 工具呼叫 `mattpocock-skills:code-review` 審自己的變更（基準點是 `integration` 分支），修掉發現的問題。
- 網站文案用台灣中文，放在 `site/js/ui-text.js`。給市民看的文字用白話，不出現檔案路徑、工具名、字型名、模型代號、程式欄位名。島上的在地特色稱「在地感」。
- 改檔與試參數用 Edit 工具，跑完還原。

## 分支與權限

- 你在自己的 git worktree 裡，分支已建好，只在這個分支 commit。commit 訊息結尾加：
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 開工前 `git merge integration`；完成回報前再 merge 一次並解衝突、跑 `npm run check`。
- push、合併到 integration、關票、在 GitHub 留言、部署、改 repo 可見度，一律留給管理者，除非派工訊息明確授權。

## 無人值守

- 不停下來問。需要人判斷的事選最保守、最中立的做法，記到進度檔繼續做。真的做不下去才停並寫明原因。
- 平行抽取資料時遇到抽取指示沒涵蓋的判斷題，照 `data/extraction/instructions.md`「判準的裁決」一節寫進 `data/extraction/judgement-log.md`。

## 進度檔

- 一行一條、附時間（`date '+%H:%M'`），追加到派工訊息指定的進度檔。
- 做完在同一檔寫 `## 最終報告`：結果與證據（測試輸出摘要、截圖路徑）、commit 清單、自行拍板的決定、沒做到的部分。
