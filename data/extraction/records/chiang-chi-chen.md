# 抽取紀錄：江啟臣

- 候選人識別碼：`chiang-chi-chen`
- 抽取指示：`data/extraction/instructions.md` 版本 3
- 擷取日期：2026-10-23
- 結果：政見 149 筆（`data/raw/policies/chiang-chi-chen.json`），全部未核對；引用出處 76 個（`data/raw/sources/chiang-chi-chen.json`，快照在 `data/snapshots/`）
- 原始政見條目總數：117，依據出處 `chiang-main`（官網政見頁「五大面向・百大新政」，01 交通公安 22 項、02 產業就業 25 項、03 健康養護 19 項、04 文教社福 32 項、05 韌性永續 19 項）。十大亮點與新聞稿不計入。

## 檢視範圍

候選人官網 https://taichungway.tw/ 的全部頁面，共 141 篇：

- 主要政見頁 `/future`：十大亮點與 117 項條目。
- 十大亮點連出的政見子頁與多元城市子頁：31 篇。
- 新聞稿：92 篇。新聞稿列表頁 `/press-release` 擷取當天回應 HTTP 500，篇目改依官網 `sitemap.xml` 列出的全部新聞稿，並與首頁及各頁連結比對，沒有 sitemap 以外的文章。
- 人物故事 15 篇、「臺中做事」經歷頁 `/way`、「臺中味道」頁 `/taste`。
- 「臺中現場」頁 `/live` 只連到媒體報導（二手來源），不收。

官方臉書沒有使用：官網已涵蓋全部條目，依指示第 2 條不另取其他來源。

## 判斷原則

照抽取指示版本 3，另依管理者統一的做法：

- 新聞稿只重述已收錄的政見、沒有新數字或新細節時，不加引述與出處，記為「重述，併入 <政見 id>」。有新數字、新細節，或提出某區專屬的具體項目時才加引述與出處。
- 只寫「研議」「評估」「評估規劃」「研究」「研擬」「檢討」「盼」「構想」「構思」，或寫的是已在進行的事（「已經開始」「已積極爭取」）的，不收。
- 陪同的立委、議員或與會學者轉述的內容不收。
- 地方場次套用全市政見、沒有提出該區專屬具體項目的，視為重述，不加適用行政區。
- 一個條目內含多件事時，只有跨不同議題區才拆成多筆（江-02-21、江-05-13）。
- 摘要避開品牌用語；「加速器」是設施名稱，沒有中性的替代說法，照用。
- 需要向中央爭取的事項依抽取指示第 12 條按政策內容歸區，例如國道四號延伸進港區、提高捷運補助比例歸交通。
- 條目編號「江-面向-序號」是本紀錄為主要政見頁 117 項編的號碼，面向 01 至 05 照官網順序，序號照面向內的列出順序；同一條目跨議題區拆開時加 a、b。

## 適用行政區

區域稱呼依市議員選區（台中市議會議員一覽表）展開：

| 原文稱呼 | 展開 |
|---|---|
| 海線 | 第 1 至第 3 選區：大甲區、大安區、外埔區、清水區、梧棲區、沙鹿區、龍井區、大肚區、烏日區 |
| 甲安埔 | 第 1 選區：大甲區、大安區、外埔區 |
| 山城 | 第 14 選區：東勢區、石岡區、新社區、和平區 |
| 中西區 | 第 10 選區：中區、西區 |

地名指向單一行政區時填該區：大坑（北屯區）、鰲峰山（清水區）、梨山與谷關、福壽山、武陵農場（和平區）、舊台中縣議會與舊縣府（豐原區）。

## 出處存檔

76 個出處全部有 Wayback Machine 存檔網址。抽取時只有 10 個取得存檔網址，其餘遇到 Wayback Machine 限流（回應 HTTP 429 或拒絕連線），照實記錄 `archiveError`、不重試。2026-10-23 核對階段以單一流程依序補送這 66 個出處（每筆間隔 20 秒，失敗時退避 60、120、240、480 秒重試），全部取得存檔網址，`archiveError` 已清為空。chiang-page-04 與 chiang-page-30 送出時 Wayback Machine 回傳的是 2026-10-18 已有的存檔。

出處識別碼用中性編號：主要政見頁 `chiang-main`，政見子頁 `chiang-page-NN`，新聞稿 `chiang-pr-NN`，依網址排序。快照檔名會出現在網站上，所以不沿用官網網址中品牌用語的英譯。

| 出處識別碼 | 網址 | 存檔 |
|---|---|---|
| chiang-main | https://taichungway.tw/future | https://web.archive.org/web/20261023095728/https://taichungway.tw/future |
| chiang-page-01 | https://taichungway.tw/central-taiwan-airport-gateway | https://web.archive.org/web/20261023100741/https://taichungway.tw/central-taiwan-airport-gateway |
| chiang-page-02 | https://taichungway.tw/city-safety-first-responders | https://web.archive.org/web/20261023100805/https://taichungway.tw/city-safety-first-responders |
| chiang-page-03 | https://taichungway.tw/city-safety-smart-safety-net | https://web.archive.org/web/20261023100831/https://taichungway.tw/city-safety-smart-safety-net |
| chiang-page-04 | https://taichungway.tw/city-safety-tech-enforcement | https://web.archive.org/web/20261018103547/https://taichungway.tw/city-safety-tech-enforcement |
| chiang-page-05 | https://taichungway.tw/exhibition-economy-city-pavilion | https://web.archive.org/web/20261023103943/https://taichungway.tw/exhibition-economy-city-pavilion |
| chiang-page-06 | https://taichungway.tw/exhibition-economy-mice-tourism | https://web.archive.org/web/20261023104023/https://taichungway.tw/exhibition-economy-mice-tourism |
| chiang-page-07 | https://taichungway.tw/exhibition-economy-startup-accelerator | https://web.archive.org/web/20261023104109/https://taichungway.tw/exhibition-economy-startup-accelerator |
| chiang-page-08 | https://taichungway.tw/exhibition-economy-taichung-hub | https://web.archive.org/web/20261023104307/https://taichungway.tw/exhibition-economy-taichung-hub |
| chiang-page-09 | https://taichungway.tw/multicultural-city-hakka-heritage | https://web.archive.org/web/20261023104445/https://taichungway.tw/multicultural-city-hakka-heritage |
| chiang-page-10 | https://taichungway.tw/multicultural-city-indigenous-support | https://web.archive.org/web/20261023104624/https://taichungway.tw/multicultural-city-indigenous-support |
| chiang-page-11 | https://taichungway.tw/multicultural-city-new-immigrants | https://web.archive.org/web/20261023104705/https://taichungway.tw/multicultural-city-new-immigrants |
| chiang-page-12 | https://taichungway.tw/old-town-revival-community-arts | https://web.archive.org/web/20261023104746/https://taichungway.tw/old-town-revival-community-arts |
| chiang-page-13 | https://taichungway.tw/old-town-revival-culture-investment | https://web.archive.org/web/20261023104825/https://taichungway.tw/old-town-revival-culture-investment |
| chiang-page-14 | https://taichungway.tw/old-town-revival-night-economy | https://web.archive.org/web/20261023104904/https://taichungway.tw/old-town-revival-night-economy |
| chiang-page-15 | https://taichungway.tw/parenting-friendly-city-childcare-support | https://web.archive.org/web/20261023105027/https://taichungway.tw/parenting-friendly-city-childcare-support |
| chiang-page-16 | https://taichungway.tw/parenting-friendly-city-maternal-care | https://web.archive.org/web/20261023105106/https://taichungway.tw/parenting-friendly-city-maternal-care |
| chiang-page-17 | https://taichungway.tw/parenting-friendly-city-parental-leave | https://web.archive.org/web/20261023105145/https://taichungway.tw/parenting-friendly-city-parental-leave |
| chiang-page-18 | https://taichungway.tw/robot-manufacturing-city-ai-industry | https://web.archive.org/web/20261023105224/https://taichungway.tw/robot-manufacturing-city-ai-industry |
| chiang-page-19 | https://taichungway.tw/robot-manufacturing-city-steam-education | https://web.archive.org/web/20261023105304/https://taichungway.tw/robot-manufacturing-city-steam-education |
| chiang-page-20 | https://taichungway.tw/robot-manufacturing-city-tech-education | https://web.archive.org/web/20261023105348/https://taichungway.tw/robot-manufacturing-city-tech-education |
| chiang-page-21 | https://taichungway.tw/robot-manufacturing-city-vocational-training | https://web.archive.org/web/20261023105506/https://taichungway.tw/robot-manufacturing-city-vocational-training |
| chiang-page-22 | https://taichungway.tw/senior-care-age-friendly-housing | https://web.archive.org/web/20261023101127/https://taichungway.tw/senior-care-age-friendly-housing |
| chiang-page-23 | https://taichungway.tw/senior-care-community-hubs | https://web.archive.org/web/20261023101151/https://taichungway.tw/senior-care-community-hubs |
| chiang-page-24 | https://taichungway.tw/senior-care-long-term-care-office | https://web.archive.org/web/20261023101214/https://taichungway.tw/senior-care-long-term-care-office |
| chiang-page-25 | https://taichungway.tw/smart-agriculture-brand-upgrade | https://web.archive.org/web/20261023101239/https://taichungway.tw/smart-agriculture-brand-upgrade |
| chiang-page-26 | https://taichungway.tw/smart-agriculture-disaster-alert | https://web.archive.org/web/20261023105549/https://taichungway.tw/smart-agriculture-disaster-alert |
| chiang-page-27 | https://taichungway.tw/smart-agriculture-university-partnership | https://web.archive.org/web/20261023105629/https://taichungway.tw/smart-agriculture-university-partnership |
| chiang-page-28 | https://taichungway.tw/smart-transport-public-transit | https://web.archive.org/web/20261023105708/https://taichungway.tw/smart-transport-public-transit |
| chiang-page-29 | https://taichungway.tw/smart-transport-smart-roads | https://web.archive.org/web/20261023105748/https://taichungway.tw/smart-transport-smart-roads |
| chiang-page-30 | https://taichungway.tw/smart-transport-walkable-streets | https://web.archive.org/web/20261018102455/https://taichungway.tw/smart-transport-walkable-streets |
| chiang-page-31 | https://taichungway.tw/taichung-20-minute-city | https://web.archive.org/web/20261023105907/https://taichungway.tw/taichung-20-minute-city |
| chiang-pr-01 | https://taichungway.tw/press-release-20-minute-city-gis-policy | https://web.archive.org/web/20261023110005/https://taichungway.tw/press-release-20-minute-city-gis-policy |
| chiang-pr-02 | https://taichungway.tw/press-release-agriculture-5-policies | https://web.archive.org/web/20261023110121/https://taichungway.tw/press-release-agriculture-5-policies |
| chiang-pr-03 | https://taichungway.tw/press-release-aidc-trainer-aircraft-ai | https://web.archive.org/web/20261023110256/https://taichungway.tw/press-release-aidc-trainer-aircraft-ai |
| chiang-pr-04 | https://taichungway.tw/press-release-amcham-taichung-dinner | https://web.archive.org/web/20261023110342/https://taichungway.tw/press-release-amcham-taichung-dinner |
| chiang-pr-05 | https://taichungway.tw/press-release-beiqu-briefing-lu-chen-zheng-xian | https://web.archive.org/web/20261023110421/https://taichungway.tw/press-release-beiqu-briefing-lu-chen-zheng-xian |
| chiang-pr-06 | https://taichungway.tw/press-release-beitun-hq-openings | https://web.archive.org/web/20261023110518/https://taichungway.tw/press-release-beitun-hq-openings |
| chiang-pr-07 | https://taichungway.tw/press-release-beitun-shen-youlian-joint-briefing | https://web.archive.org/web/20261023110605/https://taichungway.tw/press-release-beitun-shen-youlian-joint-briefing |
| chiang-pr-08 | https://taichungway.tw/press-release-beitun-waipu-briefings | https://web.archive.org/web/20261023101511/https://taichungway.tw/press-release-beitun-waipu-briefings |
| chiang-pr-09 | https://taichungway.tw/press-release-central-west-district-briefing | https://web.archive.org/web/20261023101630/https://taichungway.tw/press-release-central-west-district-briefing |
| chiang-pr-10 | https://taichungway.tw/press-release-coastal-daan-dajia-briefings | https://web.archive.org/web/20261023110648/https://taichungway.tw/press-release-coastal-daan-dajia-briefings |
| chiang-pr-11 | https://taichungway.tw/press-release-culture-flagship-15-policies | https://web.archive.org/web/20261023110731/https://taichungway.tw/press-release-culture-flagship-15-policies |
| chiang-pr-12 | https://taichungway.tw/press-release-dadu-longjing-canvass | https://web.archive.org/web/20261023110810/https://taichungway.tw/press-release-dadu-longjing-canvass |
| chiang-pr-13 | https://taichungway.tw/press-release-dakeng-hiking-tourism | https://web.archive.org/web/20261023110851/https://taichungway.tw/press-release-dakeng-hiking-tourism |
| chiang-pr-14 | https://taichungway.tw/press-release-dongfeng-expressway-third-section | https://web.archive.org/web/20261023110930/https://taichungway.tw/press-release-dongfeng-expressway-third-section |
| chiang-pr-15 | https://taichungway.tw/press-release-education-6-priority-policies | https://web.archive.org/web/20261023111009/https://taichungway.tw/press-release-education-6-priority-policies |
| chiang-pr-16 | https://taichungway.tw/press-release-fengyuan-policy-briefing | https://web.archive.org/web/20261023111127/https://taichungway.tw/press-release-fengyuan-policy-briefing |
| chiang-pr-17 | https://taichungway.tw/press-release-fire-phoenix-tech-rescue | https://web.archive.org/web/20261023111243/https://taichungway.tw/press-release-fire-phoenix-tech-rescue |
| chiang-pr-18 | https://taichungway.tw/press-release-four-hq-openings-xitun-nanqu-dali | https://web.archive.org/web/20261023111409/https://taichungway.tw/press-release-four-hq-openings-xitun-nanqu-dali |
| chiang-pr-19 | https://taichungway.tw/press-release-haixian-zhang-qing-zhao | https://web.archive.org/web/20261023111449/https://taichungway.tw/press-release-haixian-zhang-qing-zhao |
| chiang-pr-20 | https://taichungway.tw/press-release-hanxi-nightmarket-3-arrows | https://web.archive.org/web/20261023111529/https://taichungway.tw/press-release-hanxi-nightmarket-3-arrows |
| chiang-pr-21 | https://taichungway.tw/press-release-indigenous-5-policies | https://web.archive.org/web/20261023111609/https://taichungway.tw/press-release-indigenous-5-policies |
| chiang-pr-22 | https://taichungway.tw/press-release-jiaanpu-20-minute-city | https://web.archive.org/web/20261023111649/https://taichungway.tw/press-release-jiaanpu-20-minute-city |
| chiang-pr-23 | https://taichungway.tw/press-release-jianguo-market-10th-anniversary | https://web.archive.org/web/20261023111729/https://taichungway.tw/press-release-jianguo-market-10th-anniversary |
| chiang-pr-24 | https://taichungway.tw/press-release-lien-chiachen-hq | https://web.archive.org/web/20261023111813/https://taichungway.tw/press-release-lien-chiachen-hq |
| chiang-pr-25 | https://taichungway.tw/press-release-lishan-smart-agriculture | https://web.archive.org/web/20261023111948/https://taichungway.tw/press-release-lishan-smart-agriculture |
| chiang-pr-26 | https://taichungway.tw/press-release-longjing-senior-card-briefings | https://web.archive.org/web/20261023112029/https://taichungway.tw/press-release-longjing-senior-card-briefings |
| chiang-pr-27 | https://taichungway.tw/press-release-medical-longterm-care-support-launch | https://web.archive.org/web/20261023112108/https://taichungway.tw/press-release-medical-longterm-care-support-launch |
| chiang-pr-28 | https://taichungway.tw/press-release-mice-economy-168 | https://web.archive.org/web/20261023112236/https://taichungway.tw/press-release-mice-economy-168 |
| chiang-pr-29 | https://taichungway.tw/press-release-mrt-blue-line-groundbreaking | https://web.archive.org/web/20261023112411/https://taichungway.tw/press-release-mrt-blue-line-groundbreaking |
| chiang-pr-30 | https://taichungway.tw/press-release-nantun-briefing-20-minute-city | https://web.archive.org/web/20261023112546/https://taichungway.tw/press-release-nantun-briefing-20-minute-city |
| chiang-pr-31 | https://taichungway.tw/press-release-new-residents-4-policies | https://web.archive.org/web/20261023112625/https://taichungway.tw/press-release-new-residents-4-policies |
| chiang-pr-32 | https://taichungway.tw/press-release-parenting-13-policies | https://web.archive.org/web/20261023112717/https://taichungway.tw/press-release-parenting-13-policies |
| chiang-pr-33 | https://taichungway.tw/press-release-pharmacist-support-group | https://web.archive.org/web/20261023112757/https://taichungway.tw/press-release-pharmacist-support-group |
| chiang-pr-34 | https://taichungway.tw/press-release-robot-policy-launch | https://web.archive.org/web/20261023112951/https://taichungway.tw/press-release-robot-policy-launch |
| chiang-pr-35 | https://taichungway.tw/press-release-shalu-coastal-transport | https://web.archive.org/web/20261023113037/https://taichungway.tw/press-release-shalu-coastal-transport |
| chiang-pr-36 | https://taichungway.tw/press-release-smart-city-safety-net-launch | https://web.archive.org/web/20261023113117/https://taichungway.tw/press-release-smart-city-safety-net-launch |
| chiang-pr-37 | https://taichungway.tw/press-release-south-nantun-briefings | https://web.archive.org/web/20261023113158/https://taichungway.tw/press-release-south-nantun-briefings |
| chiang-pr-38 | https://taichungway.tw/press-release-taichung-airport-expansion | https://web.archive.org/web/20261023113338/https://taichungway.tw/press-release-taichung-airport-expansion |
| chiang-pr-39 | https://taichungway.tw/press-release-traffic-smart-era-policy-launch | https://web.archive.org/web/20261023113416/https://taichungway.tw/press-release-traffic-smart-era-policy-launch |
| chiang-pr-40 | https://taichungway.tw/press-release-tucheng-taiping-market-canvass | https://web.archive.org/web/20261023113456/https://taichungway.tw/press-release-tucheng-taiping-market-canvass |
| chiang-pr-41 | https://taichungway.tw/press-release-tunqu-transport-blueprint | https://web.archive.org/web/20261023113536/https://taichungway.tw/press-release-tunqu-transport-blueprint |
| chiang-pr-42 | https://taichungway.tw/press-release-women-support-association-launch | https://web.archive.org/web/20261023113617/https://taichungway.tw/press-release-women-support-association-launch |
| chiang-pr-43 | https://taichungway.tw/press-release-wuqi-briefing-sea-air-ports | https://web.archive.org/web/20261023113657/https://taichungway.tw/press-release-wuqi-briefing-sea-air-ports |
| chiang-pr-44 | https://taichungway.tw/press-release-zhongxiao-nantun-market-canvass | https://web.archive.org/web/20261023113736/https://taichungway.tw/press-release-zhongxiao-nantun-market-canvass |

## 十大亮點

| 編號 | 亮點 | 結果 |
|---|---|---|
| 01 | 推動會展經濟168（Taichung IMPACT） | 與江-02-2 同一件事，併入 chiang-chi-chen-035；子頁四則故事分別併入 chiang-chi-chen-035、chiang-chi-chen-036、chiang-chi-chen-044、chiang-chi-chen-037 |
| 02 | 打造臺灣機器人製造城市（TRMC） | 與江-02-1 同一件事，併入 chiang-chi-chen-033；子頁另三則故事併入 chiang-chi-chen-095、chiang-chi-chen-097、chiang-chi-chen-099 |
| 03 | 育兒友善城市再升級 | 統稱，不另立政見；子頁內容分屬 chiang-chi-chen-066、chiang-chi-chen-068、chiang-chi-chen-086、chiang-chi-chen-065、chiang-chi-chen-089、chiang-chi-chen-085、chiang-chi-chen-088、chiang-chi-chen-090、chiang-chi-chen-067、chiang-chi-chen-092 |
| 04 | 推行銀髮照護安心老 | 統稱，不另立政見；子頁內容分屬 chiang-chi-chen-029、chiang-chi-chen-032、chiang-chi-chen-072、chiang-chi-chen-070、chiang-chi-chen-069、chiang-chi-chen-075 |
| 05 | 推動「星光計畫」點亮舊城區 | 與江-02-18 同一件事，併入 chiang-chi-chen-052；子頁另兩則故事併入 chiang-chi-chen-114、chiang-chi-chen-116、chiang-chi-chen-115、chiang-chi-chen-112 |
| 06 | 建立臺中智慧農業再造「領鮮品牌」 | 統稱，不另立政見；子頁內容分屬 chiang-chi-chen-060、chiang-chi-chen-059、chiang-chi-chen-058、chiang-chi-chen-057 |
| 07 | 擴大「臺中進臺中出」效應推動臺灣新國門計畫 | 與江-01-3 同一件事，併入 chiang-chi-chen-012 |
| 08 | 加速大臺中交通建設與智慧治理 | 統稱，不另立政見；子頁內容分屬 chiang-chi-chen-001、chiang-chi-chen-017、chiang-chi-chen-016、chiang-chi-chen-019、chiang-chi-chen-022、chiang-chi-chen-024、chiang-chi-chen-130、chiang-chi-chen-023、chiang-chi-chen-015、chiang-chi-chen-021、chiang-chi-chen-134 |
| 09 | 軟硬體升級完善「臺中城市安全網」 | 統稱，不另立政見；子頁內容分屬 chiang-chi-chen-028、chiang-chi-chen-026、chiang-chi-chen-129 |
| 10 | 打造「20分鐘生活圈」均衡地方發展 | 與江-05-16 同一件事，併入 chiang-chi-chen-144；子頁其餘內容分屬 chiang-chi-chen-074、chiang-chi-chen-053、chiang-chi-chen-071、chiang-chi-chen-137 |

## 主要政見頁條目（117 項）

| 編號 | 條目原文 | 政見 |
|---|---|---|
| 江-01-1 | 捷運多線齊發，力拚藍線完工 | chiang-chi-chen-001 |
| 江-01-2 | 四環一線，完善交通幹線 | chiang-chi-chen-006 |
| 江-01-3 | 推動「臺中進臺中出」國門升級計畫 | chiang-chi-chen-012 |
| 江-01-4 | 加速推動鐵路高架雙軌化 | chiang-chi-chen-013 |
| 江-01-5 | 增闢高鐵站區聯外道路 | chiang-chi-chen-014 |
| 江-01-6 | 打造全齡友善人本道路 | chiang-chi-chen-015 |
| 江-01-7 | 市民公車免費，培養公共運輸習慣 | chiang-chi-chen-016 |
| 江-01-8 | 建立重大節點的高效快捷公車 | chiang-chi-chen-017 |
| 江-01-9 | 完善公車路網，補足駕駛人力 | chiang-chi-chen-019 |
| 江-01-10 | 打造「四線兩環一城」單車路網 | chiang-chi-chen-020 |
| 江-01-11 | 增設「袋鼠車」，擴充Youbike E電輔車 | chiang-chi-chen-021 |
| 江-01-12 | 試辦無人公車與偏鄉無人計程車（Robotaxi） | chiang-chi-chen-022 |
| 江-01-13 | 務實增加停車空間，科技協助好停車 | chiang-chi-chen-023 |
| 江-01-14 | 升級道路燙平計畫 | chiang-chi-chen-024 |
| 江-01-15 | 打通道路瓶頸，用路安全又順暢 | chiang-chi-chen-025 |
| 江-01-16 | 毒駕酒駕零容忍，建構科技稽查網 | chiang-chi-chen-026 |
| 江-01-17 | 詐騙追到底，公私協力強化聯防 | chiang-chi-chen-027 |
| 江-01-18 | 強化警消執勤安全，提高福利待遇 | chiang-chi-chen-028 |
| 江-01-19 | 擴大老屋健檢與延壽計畫 | chiang-chi-chen-029 |
| 江-01-20 | 試辦老屋通用設計專案 | chiang-chi-chen-030 |
| 江-01-21 | 補助升級住宅安全防護 | chiang-chi-chen-031 |
| 江-01-22 | 鼓勵取得銀髮住宅標章 | chiang-chi-chen-032 |
| 江-02-1 | 打造TRMC臺灣機器人製造城市 | chiang-chi-chen-033 |
| 江-02-2 | 創造臺中會展經濟168，發揮「前店後廠」優勢 | chiang-chi-chen-035 |
| 江-02-3 | 組織「臺中館」協助產業海外參展 | chiang-chi-chen-036 |
| 江-02-4 | 公私串聯，推廣會展旅遊路線 | chiang-chi-chen-037 |
| 江-02-5 | 推動主題式觀光接駁專車 | chiang-chi-chen-038 |
| 江-02-6 | 協助觀旅業者取得「國際永續認證」 | chiang-chi-chen-039 |
| 江-02-7 | 成立「勞工諮詢委員會」 | chiang-chi-chen-040 |
| 江-02-8 | 擴大挹注勞工權益基金 | chiang-chi-chen-041 |
| 江-02-9 | 成立AI賦能學院，加值勞工競爭力 | chiang-chi-chen-042 |
| 江-02-10 | 強化銀髮職場續航力 | chiang-chi-chen-043 |
| 江-02-11 | 引入國際資源，升級青創、新創加速器 | chiang-chi-chen-044 |
| 江-02-12 | 舊縣議會變身新創基地 | chiang-chi-chen-045 |
| 江-02-13 | 擴大市政空間導入AI智慧沙盒 | chiang-chi-chen-046 |
| 江-02-14 | 啟動「新住民二代國際領航計劃」 | chiang-chi-chen-047 |
| 江-02-15 | 新住民微型創業貸款利息補貼 | chiang-chi-chen-048 |
| 江-02-16 | 升級原住民職業培力與探索 | chiang-chi-chen-050 |
| 江-02-17 | 擴大加碼原住民「微型保險」 | chiang-chi-chen-051 |
| 江-02-18 | 推動星光計畫，點亮活化舊城區 | chiang-chi-chen-052 |
| 江-02-19 | 公有市場裝冷氣，打造特色市場 | chiang-chi-chen-053 |
| 江-02-20 | 購物節再升級，商圈文創更在地 | chiang-chi-chen-054 |
| 江-02-21 | 復興臺中木業，活化文資老屋 | 跨議題區拆成 2 筆：chiang-chi-chen-055、chiang-chi-chen-056 |
| 江-02-22 | 臺中領鮮Re Branding | chiang-chi-chen-057 |
| 江-02-23 | 產學合作打造「智慧農業臺中隊」 | chiang-chi-chen-058 |
| 江-02-24 | 升級「臺中農易通APP」 | chiang-chi-chen-059 |
| 江-02-25 | 建置精準即時農業災害預警細胞簡訊 | chiang-chi-chen-060 |
| 江-03-1 | 補助卵巢AMH 健康檢測 | chiang-chi-chen-063 |
| 江-03-2 | 擴大醫療凍卵補助 | chiang-chi-chen-064 |
| 江-03-3 | 升級補助產後父母心理諮商 | chiang-chi-chen-065 |
| 江-03-4 | 補助臺中孕婦施打RSV疫苗 | chiang-chi-chen-066 |
| 江-03-5 | 擴大補助嬰幼兒疫苗接種 | chiang-chi-chen-067 |
| 江-03-6 | 提高產後到宅月嫂補助 | chiang-chi-chen-068 |
| 江-03-7 | 升級愛心敬老卡，擴大範圍更好用 | chiang-chi-chen-069 |
| 江-03-8 | 補助弱勢族群接種帶狀皰疹疫苗 | chiang-chi-chen-070 |
| 江-03-9 | 增設、升級國民運動中心 | chiang-chi-chen-071 |
| 江-03-10 | 衛生局下新設「長照處」 | chiang-chi-chen-072 |
| 江-03-11 | 打造智慧衛生所 | chiang-chi-chen-073 |
| 江-03-12 | 打造豐原中興健康園區 | chiang-chi-chen-074 |
| 江-03-13 | 從樹下到樓下，發展社區特色長照C據點 | chiang-chi-chen-075 |
| 江-03-14 | 推動全齡專班課程，助長輩圓夢 | chiang-chi-chen-076 |
| 江-03-15 | 推動銀髮好肌力計畫，避免肌少症 | chiang-chi-chen-077 |
| 江-03-16 | 推動AI主動遠距監測，居家即醫院 | chiang-chi-chen-078 |
| 江-03-17 | 擴大3K危勞產業勞工健康檢查補助 | chiang-chi-chen-079 |
| 江-03-18 | 升級新住民母語、法律與心理諮詢 | chiang-chi-chen-080 |
| 江-03-19 | 打造原住民族行動長照車與健康站 | chiang-chi-chen-081 |
| 江-04-1 | 成立「婦幼發展委員會」 | chiang-chi-chen-085 |
| 江-04-2 | 加碼好孕專車延長使用至產後一年 | chiang-chi-chen-086 |
| 江-04-3 | 推動親子友善停車措施 | chiang-chi-chen-087 |
| 江-04-4 | 加碼補助準公共托嬰、育兒津貼加碼千元 | chiang-chi-chen-088 |
| 江-04-5 | 友善再升級，育嬰留停給付目標100% | chiang-chi-chen-089 |
| 江-04-6 | 推出臨托預約APP、鼓勵企業辦理共托 | chiang-chi-chen-090 |
| 江-04-7 | 全面推行育兒友善廁所 | chiang-chi-chen-092 |
| 江-04-8 | 推行AI減壓教師行政庶務 | chiang-chi-chen-093 |
| 江-04-9 | 國中小導入AI智慧助教系統 | chiang-chi-chen-094 |
| 江-04-10 | 成立「科技教育發展中心」 | chiang-chi-chen-095 |
| 江-04-11 | 增設「職業探索中心」 | chiang-chi-chen-096 |
| 江-04-12 | 擴大STEAM示範學校和據點 | chiang-chi-chen-097 |
| 江-04-13 | 校園大翻新，建置有溫度的安全校園 | chiang-chi-chen-098 |
| 江-04-14 | 成立技職教育專責單位 | chiang-chi-chen-099 |
| 江-04-15 | 雙語教學Plus，校校有外師Plus | chiang-chi-chen-100 |
| 江-04-16 | 營養午餐免費再升級，吃飽更要吃健康 | chiang-chi-chen-101 |
| 江-04-17 | 營養加分，減低校園營養師與學生比 | chiang-chi-chen-102 |
| 江-04-18 | 爭取臺灣設計展，蛻變「生活美學城市」 | chiang-chi-chen-108 |
| 江-04-19 | 轉型臺中文化建設基金會為「臺中設計中心」 | chiang-chi-chen-109 |
| 江-04-20 | 全年藝文不間斷，「週週有主題、月月有節日」 | chiang-chi-chen-110 |
| 江-04-21 | 臺中車站出發啟動「臺中文化門戶計畫」 | chiang-chi-chen-111 |
| 江-04-22 | 推動巷弄文化小蜜蜂 | chiang-chi-chen-112 |
| 江-04-23 | 擴大臺中與國際藝文品牌交流 | chiang-chi-chen-113 |
| 江-04-24 | 架構「文化產業投資平台」 | chiang-chi-chen-114 |
| 江-04-25 | 鼓勵「企業認養文化場域」 | chiang-chi-chen-115 |
| 江-04-26 | 建構「跨域文化人才庫」 | chiang-chi-chen-116 |
| 江-04-27 | 升級「東勢客家文化園區」，再現山城客家之美 | chiang-chi-chen-118 |
| 江-04-28 | 升級「巧聖仙師文化祭」，打造國際亮點節慶 | chiang-chi-chen-119 |
| 江-04-29 | 扎根客語教育與「大埔腔」AI 數位保存 | chiang-chi-chen-120 |
| 江-04-30 | 創辦「Hakka Sound音樂祭」 | chiang-chi-chen-121 |
| 江-04-31 | 創辦（和平）梨山、谷關「山和谷音樂祭」 | chiang-chi-chen-122 |
| 江-04-32 | 建構原住民族全適齡語文與祭儀智慧庫 | chiang-chi-chen-125 |
| 江-05-1 | 成立「智慧城市發展委員會」 | chiang-chi-chen-126 |
| 江-05-2 | 成立「國際合作發展委員會」 | chiang-chi-chen-127 |
| 江-05-3 | 建置「臺中市主權AI與數據中心」 | chiang-chi-chen-128 |
| 江-05-4 | 建構「臺中智慧安全網」 | chiang-chi-chen-129 |
| 江-05-5 | 建立即時AI輔助交通系統、全域智慧巡檢 | chiang-chi-chen-130 |
| 江-05-6 | 擴大AI水情治理系統 | chiang-chi-chen-131 |
| 江-05-7 | 構築智慧滅鼠系統 | chiang-chi-chen-132 |
| 江-05-8 | 推動智慧噪音監測系統 | chiang-chi-chen-133 |
| 江-05-9 | 推動「減碳存摺」控污管煤 | chiang-chi-chen-134 |
| 江-05-10 | 應對極端氣候，升級城市災防韌性 | chiang-chi-chen-135 |
| 江-05-11 | 推動多元廚餘去化模式 | chiang-chi-chen-136 |
| 江-05-12 | 推動美樂地plus，升級「共融療癒全齡公園」 | chiang-chi-chen-137 |
| 江-05-13 | 「臺中溯源」，設置筏子溪自行車道、大甲溪高灘地水岸親水公園 | 跨議題區拆成 2 筆：chiang-chi-chen-138、chiang-chi-chen-139 |
| 江-05-14 | 「親海啟航」，建設大安親海自然步道、濱海樂園增設濱海運動區 | chiang-chi-chen-140 |
| 江-05-15 | 落實居住正義，推動臺中多元社會住宅 | chiang-chi-chen-143 |
| 江-05-16 | 打造「20分鐘生活圈」均衡地方發展 | chiang-chi-chen-144 |
| 江-05-17 | 升級毛小孩公園 | chiang-chi-chen-147 |
| 江-05-18 | 動物之家升級，收容教育再回家 | chiang-chi-chen-148 |
| 江-05-19 | 開辦寵物產業認證 | chiang-chi-chen-149 |

## 文章檢視結果

每篇列出頁面標題、網址與結果。有政見內容的文章列出每則摘錄的去處。

### 陳總的長途接機與「捨近求遠的國門」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/central-taiwan-airport-gateway

結果：收錄，出處識別碼 chiang-page-01。

| 摘錄 | 結果 |
|---|---|
| 市府將全力向中央爭取擴大臺中國際機場航廈與既有設施的實質擴建，同時大幅「提升大運量通關與國際航線停泊量能」。爭取更多直飛航班 | 收錄為引述，chiang-chi-chen-012 |
| 由市府主導周邊土地的系統化整合與多元活化使用，透過都市計畫變更全面翻轉機場周邊市容。 | 收錄為引述，chiang-chi-chen-012 |

### 阿豪的汗水與「看得見的防護罩」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/city-safety-first-responders

結果：收錄，出處識別碼 chiang-page-02。

| 摘錄 | 結果 |
|---|---|
| 放寬並提高健康檢查補助，40 歲以上每年補助 4,500 元，未滿 40 歲提高至每年 3,500 元。 | 收錄為引述，chiang-chi-chen-028 |
| 成立專責的消防「職業安全衛生室」，編制專人推動風險評估與心理輔導 | 收錄為引述，chiang-chi-chen-028 |
| 加速汰換並購置符合第一線需求的「輕量化高防護消防衣」；並增購高防護科技執勤裝備，例如為出勤警消配戴「生命體徵監控手錶」 | 收錄為引述，chiang-chi-chen-028 |

### 佩琪的報表與「會預警的安全網」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/city-safety-smart-safety-net

結果：收錄，出處識別碼 chiang-page-03。

| 摘錄 | 結果 |
|---|---|
| 將現行家福、兒少、性平、治安、心衛、長照、食藥、就業等八個獨立的安全通報網資訊進行匯流整合。 | 收錄為引述，chiang-chi-chen-129 |
| 在符合個資法的前提下，建置跨局處的智慧預警平台 | 收錄為引述，chiang-chi-chen-129 |
| 利用大數據與 AI 交叉比對高風險家庭、校園安全與精神衛生等邊緣信號 | 收錄為引述，chiang-chi-chen-129 |

### 志平的攔檢點與「零死角的科技法眼」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/city-safety-tech-enforcement

結果：收錄，出處識別碼 chiang-page-04。

| 摘錄 | 結果 |
|---|---|
| 導入更高精準度的「毒品快篩」與夜間科技執法儀器，提升攔查效率與員警安全。 | 收錄為引述，chiang-chi-chen-026 |
| 建立由警政、衛生、社會局共同編織的防治通報網，針對高風險個案進行源頭列管 | 收錄為引述，chiang-chi-chen-026 |
| 落實「校園毒品零容忍」 | 不收：只有口號，沒有具體做法 |
| 利用大數據分析出易肇事與毒酒駕熱點，展開常態性的跨局處聯合稽查 | 收錄為引述，chiang-chi-chen-026 |

### 帶臺中隱形冠軍組團出海：我們是一家人｜臺中市長候選人江啟臣

網址：https://taichungway.tw/exhibition-economy-city-pavilion

結果：收錄，出處識別碼 chiang-page-05。

| 摘錄 | 結果 |
|---|---|
| 捨棄過去個別企業單打獨鬥的定額補助模式，轉為「報隊組團」的國際競爭戰略。 | 收錄為引述，chiang-chi-chen-036 |
| 由市府單位主導，在國際指標型大展中組織專屬的「臺中館」或「Taichung IMPACT（臺灣影響力）主題館」。 | 收錄為引述，chiang-chi-chen-036 |
| 透過統一的城市美學包裝進行整合招商，倍增參展能見度並分攤基層中小企業的行銷成本 | 收錄為引述，chiang-chi-chen-036 |

### 把商務客留在街巷裡：走進巷弄的西裝客｜臺中市長候選人江啟臣

網址：https://taichungway.tw/exhibition-economy-mice-tourism

結果：收錄，出處識別碼 chiang-page-06。

| 摘錄 | 結果 |
|---|---|
| 整合觀旅局資源，串聯在地觀光旅宿、旅行社與商圈，將商務客的停留時間轉化為觀光消費。 | 收錄為引述，chiang-chi-chen-037 |
| 專為國際買家量身打造「臺中味商圈散策與城市走讀」套裝路線 | 收錄為引述，chiang-chi-chen-037 |
| 透過與既有的國內外旅遊平台合作，主動推送臺中會展旅遊方案給適合的商務消費者。 | 收錄為引述，chiang-chi-chen-037 |

### 把資金與導師帶進臺中：留下來的底氣｜臺中市長候選人江啟臣

網址：https://taichungway.tw/exhibition-economy-startup-accelerator

結果：收錄，出處識別碼 chiang-page-07。

| 摘錄 | 結果 |
|---|---|
| 市府將主動協助，引進具備全球市場能力的指標性加速器進駐臺中。 | 收錄為引述，chiang-chi-chen-044 |
| 辦理青創、新創嘉年華，由國際導師一對一帶路，實質媒合海外資金。 | 收錄為引述，chiang-chi-chen-044 |
| 將「舊臺中縣議會」改造成新創孵化基地 | 收錄為引述，chiang-chi-chen-045 |

### 把國際主場拉回臺中：一小時的距離｜臺中市長候選人江啟臣

網址：https://taichungway.tw/exhibition-economy-taichung-hub

結果：收錄，出處識別碼 chiang-page-08。

| 摘錄 | 結果 |
|---|---|
| 成立跨局處一站式的「臺中市會展經濟推動辦公室」，專責推廣城市品牌並協助會展籌辦。 | 收錄為引述，chiang-chi-chen-035 |
| 系統性建置會展活動招商、供應鏈媒合、城市接待配套、成效追蹤、會展城市交流、產學合作等六大平台。 | 收錄為引述，chiang-chi-chen-035 |
| 推出誘因提供機制、公協會與會議大使計畫、建置全場館與供應鏈資料庫、城市接待方案等八項具體工具 | 收錄為引述，chiang-chi-chen-035 |

### 東勢阿公的擔憂與「重新混音的大埔腔」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/multicultural-city-hakka-heritage

結果：收錄，出處識別碼 chiang-page-09。

| 摘錄 | 結果 |
|---|---|
| 釋出國中小正式「客語專任教師」職缺 | 收錄為引述，chiang-chi-chen-107 |
| 聯手產學研發起「大埔腔 AI 數位保存計畫」，採集地方耆老的原生語音，建立資料庫與 AI 模型留住文化根基。 | 收錄為引述，chiang-chi-chen-120 |
| 將客家傳統山歌與搖滾、嘻哈、電子等現代流行樂交會共振，推動客語流行音樂（Hakkapop） | 收錄為引述，chiang-chi-chen-121 |
| 啟動「東勢客家文化園區」升級，興建實驗劇場並導入親子沈浸式 DIY 體驗 | 收錄為引述，chiang-chi-chen-118 |
| 將代表匠人精神的「巧聖仙師文化祭」重新包裝為國際亮點節慶 | 重述，併入 chiang-chi-chen-119 |

### 阿將的鷹架與「開進部落的醫療車」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/multicultural-city-indigenous-support

結果：收錄，出處識別碼 chiang-page-10。

| 摘錄 | 結果 |
|---|---|
| 針對設籍臺中市 15 至 64 歲的原住民族人，市府全額補助微型保險 | 收錄為引述，chiang-chi-chen-051 |
| 升級職業培力，開辦高階精緻製造業培訓與青少年職涯探索。 | 收錄為引述，chiang-chi-chen-050 |
| 派遣配備行動檢測與物理治療設備的「原民行動長照車」深入山城部落 | 收錄為引述，chiang-chi-chen-081 |
| 重新檢討「文化健康站」的資源配置，把長照據點真正搬進部落裡。 | 收錄為引述，chiang-chi-chen-081 |
| 建構「大臺中原住民族語與祭儀智慧庫」，採集部落耆老記憶，在都會社區與校園導入「情境式、沉浸式」實作工坊 | 收錄為引述，chiang-chi-chen-125 |

### 阿阮的家鄉味與「走向國際的新二代」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/multicultural-city-new-immigrants

結果：收錄，出處識別碼 chiang-page-11。

| 摘錄 | 結果 |
|---|---|
| 針對設籍臺中並獲中央微型創業鳳凰貸款等的新住民創業者，給予延長利息補貼 | 收錄為引述，chiang-chi-chen-048 |
| 設置具備越南語、印尼語、泰語等多語系的專業律師與心理諮商服務 | 收錄為引述，chiang-chi-chen-080 |
| 針對高中與大專院校的新二代青年開設培力活動，讓他們帶著臺灣深入東協、擔任城市親善大使。 | 收錄為引述，chiang-chi-chen-047 |

### 忠伯的涼椅與「走進家門口的劇場」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/old-town-revival-community-arts

結果：收錄，出處識別碼 chiang-page-12。

| 摘錄 | 結果 |
|---|---|
| 主動將藝文資源化作小蜜蜂，定期交互飛進大臺中各里。 | 重述，併入 chiang-chi-chen-112 |
| 整合在地劇團、獨立樂團與街頭藝術家等豐沛的藝文能量，為他們創造更多演出機會 | 重述，併入 chiang-chi-chen-112 |
| 把舞台直接搬到阿公阿嬤熟悉的廟口、社區活動中心與公園樹下 | 收錄為引述，chiang-chi-chen-112 |

### 小婷的企劃書與「懂藝術的天使投資」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/old-town-revival-culture-investment

結果：收錄，出處識別碼 chiang-page-13。

| 摘錄 | 結果 |
|---|---|
| 聯合數位局、經發局與民間創投機構，打造全臺首創的文化創投媒合中心。 | 收錄為引述，chiang-chi-chen-114 |
| 為文創團隊提供低利融資、版權媒合與海外市場拓銷。 | 收錄為引述，chiang-chi-chen-114 |
| 運用「臺中設計中心」與「舊縣議會新創基地」建立藝文創業孵化器（Arts Incubator），為數位設計、流行音樂等跨域人才提供低障礙的共同工作室與啟動資源。 | 收錄為引述，chiang-chi-chen-116 |
| 舉凡企業實質出資認養古蹟或是贊助藝文演出，市府將給予相應獎勵、稅費減免與城市榮譽表揚 | 收錄為引述，chiang-chi-chen-115 |

### 阿凱的吉他與「不打烊的舊城區」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/old-town-revival-night-economy

結果：收錄，出處識別碼 chiang-page-14。

| 摘錄 | 結果 |
|---|---|
| 以臺中火車站為中心，串聯「新民街倉庫群」至干城、台糖生態園，打造兼具歷史美感與前瞻性的全新文創聚落與 Live House 展演空間。 | 收錄為引述，chiang-chi-chen-052 |
| 讓水湳「流行影音中心」成為流行產業鏈孵化基地，並深化與日、韓、泰等國際音樂祭的交流 | 收錄為引述，chiang-chi-chen-052 |
| 主動與國際指標性藝術節簽署合作，引進全球頂尖藝文展演，並帶著臺中的獨立樂團與新銳藝術家走向國際舞台。 | 收錄為引述，chiang-chi-chen-113 |

### 欣儀的連環 call 與「不慌張的城市」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/parenting-friendly-city-childcare-support

結果：收錄，出處識別碼 chiang-page-15。

| 摘錄 | 結果 |
|---|---|
| 準公共托嬰補助加碼，從每月 1,400 元提高到 3,000 元，並逐步朝向第二胎以上零月費 | 收錄為引述，chiang-chi-chen-088 |
| 針對未送托家庭的育兒津貼，每個月再加碼 1,000 元。 | 收錄為引述，chiang-chi-chen-088 |
| 推出全臺首創的「臨托預約 APP」，讓家長能一鍵預約周邊空閒臨托量能 | 收錄為引述，chiang-chi-chen-090 |
| 鼓勵在地企業辦理共托，把托育據點搬到上班的樓下。 | 收錄為引述，chiang-chi-chen-090 |
| 6 歲以下免費施打幼兒腸病毒疫苗 | 收錄為引述，chiang-chi-chen-067 |
| 於市內全面推行育兒友善廁所，在公廁增設配備安全座椅、尿布台的專屬親子廁間。 | 收錄為引述，chiang-chi-chen-092 |

### 佳穎的產檢路與「不孤單的孕期」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/parenting-friendly-city-maternal-care

結果：收錄，出處識別碼 chiang-page-16。

| 摘錄 | 結果 |
|---|---|
| 推出設籍臺中孕婦施打 RSV（呼吸道融合病毒）疫苗補助，在懷孕後期減免自費施打費用 | 收錄為引述，chiang-chi-chen-066 |
| 提升產後到宅月嫂補助時數至 40 小時 | 收錄為引述，chiang-chi-chen-068 |
| 將「健康好孕專車」的使用期限貼心延長至「產後一年」 | 收錄為引述，chiang-chi-chen-086 |

### 建良的黑眼圈與「留下來陪你的底氣」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/parenting-friendly-city-parental-leave

結果：收錄，出處識別碼 chiang-page-17。

| 摘錄 | 結果 |
|---|---|
| 補足勞保給付餘下的 20% 平均月投保薪資差額，讓勞工在育嬰留停期間領滿 100% 薪資 | 收錄為引述，chiang-chi-chen-089 |
| 升級產後父母心理諮商補助至「父母各 3 次」的額度，打破只有媽媽能申請的限制 | 收錄為引述，chiang-chi-chen-065 |
| 成立「臺中市婦幼發展委員會」，由府級親自召集，將少子化對策、婦女權益、幼兒托育與孕產婦照顧等散落的業務一權統籌 | 收錄為引述，chiang-chi-chen-085 |

### 江啟臣拋臺中「20分鐘生活圈」願景 結合GIS空間數據推「均衡、永續、韌性城市」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-20-minute-city-gis-policy

結果：收錄，出處識別碼 chiang-pr-01。

| 摘錄 | 結果 |
|---|---|
| 讓市民在20分鐘通勤範圍內，滿足就醫、就學與就業等日常需求 | 收錄為引述，chiang-chi-chen-144 |
| 規劃以各大生活圈轉運中心為樞紐，區內以高頻次循環公車串聯住宅、醫療與學校，跨區則由高快速公路公車快速對接 | 收錄為引述，chiang-chi-chen-019 |
| 並承諾在捷運路網完工前推動市民公車免費 | 收錄為引述，chiang-chi-chen-016 |
| 他也規劃盤點閒置公有空間改建為青年創業孵化器與加速器，積極引進國際創投資源與產業導師 | 收錄為引述，chiang-chi-chen-044 |

### 八二三精神接棒臺中！盧秀燕牽手交棒江啟臣 江：使命必達、只許成功｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-823-anniversary-handover

結果：不收。活動報導：出席紀念大會致詞與交棒儀式，無具體政見

### 江啟臣五大農政再加碼三承諾 農業用水優先、設領鮮市集、獲獎重賞｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-agriculture-5-policies

結果：收錄，出處識別碼 chiang-pr-02。

| 摘錄 | 結果 |
|---|---|
| 江啟臣主張再造「臺中領鮮」品牌，結合在地青年及設計團隊，從品牌識別、包裝到故事行銷全面升級，並串聯電商平台、實體零售與星級餐廳 | 收錄為引述，chiang-chi-chen-057 |
| 他也將結合「臺中會展168」及海內外展覽，把臺中農產打造為會展限定伴手禮、宴會料理及城市品牌 | 收錄為引述，chiang-chi-chen-057 |
| 未來將透過農會與農民契作，建立「臺中在地食材優先」機制，把新鮮蔬果送進校園廚房 | 收錄為引述，chiang-chi-chen-101 |
| 江啟臣將成立「智慧農業臺中隊」，串聯中興大學、農業研究機構、農會與農民，結合臺中的精密機械、AI及機器人產業能量，發展病蟲害預測、智慧溫室環控及自動化採收設備 | 收錄為引述，chiang-chi-chen-058 |
| 江啟臣也提出升級「臺中農易通APP」，整合氣象預警、即時菜價及線上補助申請等功能，並導入AI作物病蟲害辨識 | 重述，併入 chiang-chi-chen-059 |
| 江啟臣將建置精準即時的農業災害預警細胞簡訊，針對特定產區及特定農作物 | 重述，併入 chiang-chi-chen-060 |
| 承諾未來將評估適合場域，規劃固定式或活動式「臺中領鮮農業市集」，提供在地農民常態展售舞臺 | 不收：原文是「評估適合場域，規劃」，視同研議 |
| 糧食及農產品生產所需的農業用水，必須列為第一優先保障 | 收錄為引述，chiang-chi-chen-061 |
| 只要代表臺中獲得優秀名次，市府就應提高獎勵、加碼頒發獎勵金 | 收錄為引述，chiang-chi-chen-062 |

### 實體AI時代來臨！江啟臣：你想得到的，臺中幾乎都做得到｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-ai-smart-manufacturing-expo

結果：不收。活動報導：出席展覽與頒獎典禮致詞；會展中心二期為已發包的現行工程，無新政見

### 挺國機國造！江啟臣：初教機留臺灣、實體AI落臺中、產業升級要加薪｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-aidc-trainer-aircraft-ai

結果：收錄，出處識別碼 chiang-pr-03。

| 摘錄 | 結果 |
|---|---|
| 未來應該整合產學研資源與國際合作，打造「臺中無人載具及實體AI產業生態系」，推動傳統精密機械升級智慧製造 | 收錄為引述，chiang-chi-chen-034 |
| 江啟臣主張成立「AI賦能學院」，由政府結合企業、大專院校及研究機構，提供在職員工AI應用與智慧製造訓練，建立技能認證及企業加薪輔導機制 | 收錄為引述，chiang-chi-chen-042 |

### 江啟臣全英文對話美國商會 展現國際力、拋三大委員會｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-amcham-taichung-dinner

結果：收錄，出處識別碼 chiang-pr-04。

| 摘錄 | 結果 |
|---|---|
| 有條件透過TRMC機器人製造園區，讓AI從大腦走向身體，並加速檢測驗證與國際標準接軌 | 收錄為引述，chiang-chi-chen-033 |
| 與米蘭、斯圖加特、鳳凰城等產業城市建立展會互惠、企業媒合及市場合作 | 收錄為引述，chiang-chi-chen-036 |
| 更可透過「臺中館」整隊出海，帶領中小企業參與國際展覽 | 重述，併入 chiang-chi-chen-036 |
| 未來將在市長層級設置「國際合作與發展委員會」，作為企業與國際社群對接市府的單一窗口 | 收錄為引述，chiang-chi-chen-127 |
| 並成立智慧城市及兒少與婦女照顧兩大委員會 | 重述，併入 chiang-chi-chen-126 |
| 並成立智慧城市及兒少與婦女照顧兩大委員會 | 重述，併入 chiang-chi-chen-085 |
| 江啟臣主張持續增加社會住宅，研究結合TOD及民間力量擴大供給 | 不收：增加社會住宅的部分是重述江-05-15；結合 TOD 只寫「研究」，視同研議 |
| 更務實的方向是加速捷運路網串聯市區與豐原 | 重述，併入 chiang-chi-chen-003 |

### 盧秀燕、黃健豪連袂助陣！江啟臣力挺陳政顯高票連任 共創北區新榮景｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-beiqu-briefing-lu-chen-zheng-xian

結果：收錄，出處識別碼 chiang-pr-05。

| 摘錄 | 結果 |
|---|---|
| 江啟臣提出敬老愛心卡升級 | 重述，併入 chiang-chi-chen-069 |
| 提高準公共托嬰補助及優化托育、學前教育環境 | 重述，併入 chiang-chi-chen-088 |
| 他也規劃增設親子廁所 | 重述，併入 chiang-chi-chen-092 |
| 與業者協調試辦附設兒童安全座椅的親子YouBike「袋鼠車」 | 重述，併入 chiang-chi-chen-021 |
| 將加速推動機場捷運橘線及崇德豐原線（紅線） | 重述，併入 chiang-chi-chen-003 |
| 並優化公車路網與轉乘服務，逐步落實「20分鐘生活圈」 | 重述，併入 chiang-chi-chen-019 |
| 他也主張增設寵物公園 | 收錄為引述，chiang-chi-chen-147 |
| 並提出在臺中舉辦全國寵物節的構想 | 不收：原文是「構想」，沒有承諾 |
| 包括敬老愛心卡點數當年度內累積使用，以及依規劃額度擴大至農漁會等用途 | 不收：是立委轉述，不是候選人本人的說法（內容與江-03-7 相同） |

### 敬老卡搭小黃擬加碼200元！江啟臣啟動鐵人輔選 幽默力挺許育璿、沈佑蓮拚北屯大贏｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-beitun-hq-openings

結果：收錄，出處識別碼 chiang-pr-06。

| 摘錄 | 結果 |
|---|---|
| 他提出構建「20分鐘生活圈」，將食衣住行、就學就醫及休閒機能緊密串接 | 重述，併入 chiang-chi-chen-144 |
| 承諾未來將敬老愛心卡計程車單趟補貼由現行100元加碼提高至200元起跳 | 收錄為引述，chiang-chi-chen-069 |
| 並推動市府全額或定額補助65歲以上長輩施打帶狀疱疹（皮蛇）疫苗 | 重述，併入 chiang-chi-chen-070 |

### 國慶夜訪總站夜市！江啟臣合體北屯團隊 擘劃交通、育兒與敬老升級｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-beitun-night-market-national-day

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來將推動「會展經濟168」，透過專案辦公室、六大平台及八項措施，整合場館、產業與觀光資源 | 重述，併入 chiang-chi-chen-035 |
| 未來將持續爭取加速推動，並以「捷運多線齊發」完善路網 | 重述，併入 chiang-chi-chen-003 |
| 在捷運路網成形前，則透過公車路網優化、加密班次與改善轉乘 | 重述，併入 chiang-chi-chen-019 |
| 並結合AI及地理資訊系統盤點生活機能，朝「20分鐘生活圈」目標推進 | 重述，併入 chiang-chi-chen-144 |
| 主張將市府加碼的準公共托嬰補助提高至每月3,000元 | 重述，併入 chiang-chi-chen-088 |
| 好孕專車補助使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 並規劃「臺中臨托預約APP」、鼓勵企業設置托育中心 | 重述，併入 chiang-chi-chen-090 |
| 江啟臣主張定額補助重症弱勢及65歲以上長輩接種帶狀疱疹（俗稱皮蛇）疫苗 | 重述，併入 chiang-chi-chen-070 |
| 並升級敬老卡、擴大特約藥局與農漁會等使用範圍 | 重述，併入 chiang-chi-chen-069 |

### 因應北屯人口成長！江啟臣攜手沈佑蓮、黃健豪 加速捷運、打造20分鐘生活圈｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-beitun-shen-youlian-joint-briefing

結果：收錄，出處識別碼 chiang-pr-07。

| 摘錄 | 結果 |
|---|---|
| 將加速推動捷運紅線及綠線延伸大坑，持續爭取中央支持 | 收錄為引述，chiang-chi-chen-004 |
| 未來將運用AI輔助交通治理，動態調控號誌、改善壅塞 | 重述，併入 chiang-chi-chen-130 |
| 並盤點公有土地、結合民間資源，增加立體、共享等多元停車空間 | 收錄為引述，chiang-chi-chen-023 |
| 同時推動公車路網改革，串聯學校、醫療院所及社區設施 | 重述，併入 chiang-chi-chen-019 |
| 打造滿足就學、就業、就醫、就養等日常需求的20分鐘生活圈 | 重述，併入 chiang-chi-chen-144 |
| 包括維持每月1,000點、點數當年度內不歸零、計程車單趟最高折抵200點，並開放每月限額500點於在地農漁會與特約藥局使用 | 不收：是立委轉述，不是候選人本人的說法（內容與江-03-7 相同） |

### 跨世代民代齊聚力挺！江啟臣宣示破除城鄉差距、帶動大臺中均衡發展｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-beitun-waipu-briefings

結果：收錄，出處識別碼 chiang-pr-08。

| 摘錄 | 結果 |
|---|---|
| 他具體主張打造「20分鐘生活圈」，讓就醫、就學、就業與育樂都能就近解決 | 重述，併入 chiang-chi-chen-144 |
| 敬老愛心卡研議擴大折抵掛號費、運動場館與農會特產 | 不收：原文是「研議」（內容與江-03-7 相近） |
| 研議由市府補助65歲以上弱勢或高風險長輩施打帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 不再僅以人口數作為資源分配依據，而是依各區需求進行檢討與建設 | 收錄為引述，chiang-chi-chen-145 |
| 包含加速國道延伸與快速道路建設 | 重述，併入 chiang-chi-chen-006 |
| 增設海線轉運站 | 收錄為引述，chiang-chi-chen-018 |
| 並優化公車系統與推廣Ubike親子車 | 重述，併入 chiang-chi-chen-021 |
| 他承諾若當選，教育經費將維持最高比例 | 收錄為引述，chiang-chi-chen-106 |

### 嚴選在地設計師！江啟臣競總推「臺中味」小物 王育敏大推的是這項｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-campaign-merch-launch

結果：不收。活動報導：競選募款小物發表，無政見

### 吹響啟程號角！江啟臣發布首支競選影片 匯聚15年歷練誓言打造「國際旗艦城」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-campaign-video-launch

結果：不收。活動報導：競選影片發表，只有願景與藍圖名稱，無具體政見

### 江啟臣攜羅廷瑋、張彥彤談中西區願景 文化活城、敬老福利再升級｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-central-west-district-briefing

結果：收錄，出處識別碼 chiang-pr-09。

| 摘錄 | 結果 |
|---|---|
| 中西區擁有臺中州廳、刑務所演武場、國漫館與第二市場等地標，將透過「臺中文化門戶計畫」串聯周邊古蹟，打造城市博物館群 | 收錄為引述，chiang-chi-chen-111 |
| 並推動「星光計畫」，將新民街倉庫群轉型為現場音樂展演空間（Live House） | 重述，併入 chiang-chi-chen-052 |
| 他也提出「會展經濟168」策略，盼將國際商務旅客帶進舊城，結合臺中購物節與在地商圈 | 不收：原文是「盼」，且內容重述江-02-2 |
| 他也承諾推動人行道全面翻新、擴大假日行人徒步區 | 收錄為引述，chiang-chi-chen-015 |
| 江啟臣主張補助長者施打帶狀疱疹（皮蛇）疫苗 | 重述，併入 chiang-chi-chen-070 |
| 包括點數當年度不歸零、每趟計程車折抵提高至200點，以及開放於特約藥局購買保健品 | 重述，併入 chiang-chi-chen-069 |

### 立院、選舉皆兼顧！江啟臣「視訊同框」相挺陳文政競總成立｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-chen-wen-cheng-hq-video-call

結果：不收。活動報導：視訊為議員競選總部致詞，無政見

### 臺中市政加速器揭牌啟動 江啟臣誓言接棒盧秀燕打造國際旗艦城｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-city-hall-accelerator-launch

結果：不收。活動報導：競選工作站揭牌與團隊成軍，內容為政績回顧與口號

### 「長輩要顧、孩子要顧、年輕人要加薪！」江啟臣擘劃海線發展願景｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-coastal-daan-dajia-briefings

結果：收錄，出處識別碼 chiang-pr-10。

| 摘錄 | 結果 |
|---|---|
| 未來將依各區幅員、道路條件與實際需要配置資源，加碼基層建設 | 重述，併入 chiang-chi-chen-145 |
| 提出「親海賞蟹大道」構想，盼結合潮間帶生態與地景藝術，在保護環境的前提下，串聯大安媽祖園區、沙灘排球活動、生態公園與賞蟹步道 | 不收：原文是「構想」，沒有承諾 |
| 應結合會展中心拓展國際市場，推動機器人、無人載具等產業發展 | 重述，併入 chiang-chi-chen-033 |
| 他也主張推動智慧農業、再造「臺中領鮮」品牌，加強大安飛天豬、大甲芋頭等農產行銷 | 重述，併入 chiang-chi-chen-057 |
| 江啟臣承諾延續長者健保補助 | 重述，併入 chiang-chi-chen-083 |
| 推動敬老愛心卡點數每月不歸零、改採年度結算，計程車每趟補助朝200元邁進，擴大就醫、指定藥局等使用範圍，並規劃一定額度可於農漁會消費 | 收錄為引述，chiang-chi-chen-069 |
| 將針對65歲以上、經醫師建議接種的長者推動帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |

### 江啟臣推「文化旗艦」15項政見 五大面向打造臺中城市博物館｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-culture-flagship-15-policies

結果：收錄，出處識別碼 chiang-pr-11。

| 摘錄 | 結果 |
|---|---|
| 將以臺中車站為核心啟動「文化門戶計畫」，串聯臺中公園、臺中州廳、市役所、第二市場及臺中文學館等歷史空間 | 收錄為引述，chiang-chi-chen-111 |
| 另推動「星光計劃」，活化新民街倉庫群設置Live House、籌辦「鐵支路開唱」 | 收錄為引述，chiang-chi-chen-052 |
| 江啟臣承諾爭取臺灣設計展重返臺中 | 收錄為引述，chiang-chi-chen-108 |
| 成立臺中設計中心，讓專業設計參與捷運站、公有市場及全齡公園規劃 | 收錄為引述，chiang-chi-chen-109 |
| 他並提出「週週有主題、月月有節日」 | 重述，併入 chiang-chi-chen-110 |
| 擴大「巷弄文化小蜜蜂」，將藝文帶進29個行政區的廟口、公園與社區 | 收錄為引述，chiang-chi-chen-112 |
| 江啟臣將成立「臺中文化產業投資平台」，提供補助、低利資金、版權媒合及市場拓銷 | 收錄為引述，chiang-chi-chen-114 |
| 並鼓勵企業認養文化場域 | 重述，併入 chiang-chi-chen-115 |
| 他也將推動文化社會處方箋，結合藝文與醫療照護 | 收錄為引述，chiang-chi-chen-117 |
| 並運用AI保存、活化大埔腔客語 | 重述，併入 chiang-chi-chen-120 |
| 並運用AI保存、活化大埔腔客語及原住民族語等 | 重述，併入 chiang-chi-chen-120 |

### 江啟臣勤跑大肚龍井懇託 承諾海線交通列優先施政｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-dadu-longjing-canvass

結果：收錄，出處識別碼 chiang-pr-12。

| 摘錄 | 結果 |
|---|---|
| 他承諾未來將全力推動「生活圈四號」打通，串聯龍井至烏日段 | 收錄為引述，chiang-chi-chen-007 |
| 此外，華南路的拓寬工程也會加速推進 | 不收：描述既有拓寬工程的進度，沒有新的任內承諾 |
| 未來定會全力將周邊配套道路做好 | 不收：內容不具體，沒有指出要做哪些道路 |

### 從採買環境到鄉親心聲 江啟臣深入大甲第二市場、攜手議員爭取空調｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-dajia-market-2nd-canvass

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 他與在地議員共同為大甲第二市場爭取空調 | 不收：原文是與議員正在爭取，不是任內承諾的句式 |

### 大坑步道湧週末人潮！江啟臣率「臺中隊」一啟爬山 勾勒觀光升級願景打造臺中後花園｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-dakeng-hiking-tourism

結果：收錄，出處識別碼 chiang-pr-13。

| 摘錄 | 結果 |
|---|---|
| 江啟臣承諾，未來將全面推動大坑風景區的硬體升級，除了爭取預算對現有步道進行總體檢、增設友善長輩與親子的無障礙平緩步道，並導入智慧導覽與生態教育外 | 收錄為引述，chiang-chi-chen-124 |
| 更要結合大坑特有的溫泉資源，發展「白天爬山、晚上泡湯」的旗艦級休閒品牌 | 收錄為引述，chiang-chi-chen-124 |
| 未來市府將妥善規劃假日觀光接駁車班次 | 重述，併入 chiang-chi-chen-038 |
| 同時增設更多共享運具節點以串接捷運與台鐵，並引進共享電輔車 | 重述，併入 chiang-chi-chen-021 |
| 並串聯市區文化場域與海線自然生態，構築完整的「山海屯都」多日遊觀光廊帶 | 不收：只有方向，沒有具體做法 |

### 江啟臣：爭取逾110億中央補助 推進東豐快建設｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-dongfeng-expressway-2nd-section

結果：不收。活動報導與政績回顧：出席開工典禮，談爭取中央補助的過程，無新政見

### 等了20年山城生命線！東豐快第三標合龍 江啟臣爭取延伸新社極大化效益｜臺中市長候選人江啟臣

網址：https://taichungway.tw/press-release-dongfeng-expressway-third-section

結果：收錄，出處識別碼 chiang-pr-14。

| 摘錄 | 結果 |
|---|---|
| 未來更將推動延伸至新社，讓山城交通效益最大化 | 收錄為引述，chiang-chi-chen-011 |

### 江啟臣合體陳政顯、陳文政掃街東興市場 承諾延續中央市場好宅、打造北區「20分鐘生活圈」

網址：https://taichungway.tw/press-release-donghsing-market-canvass

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 延續日前剛開工的「北區中央市場好宅」等社會住宅建設與複合式轉型，結合公托、日照與商業空間 | 重述，併入 chiang-chi-chen-143 |
| 針對北區高密度的就學、就醫、採買與托育需求，強化公共運輸與微循環接駁，補足社區生活機能 | 重述，併入 chiang-chi-chen-144 |
| 推動敬老愛心卡多功能升級與擴大使用範疇 | 重述，併入 chiang-chi-chen-069 |

### 爭取擴大山城支持度 江啟臣前進東勢本街市場掃街掀旋風

網址：https://taichungway.tw/press-release-dongshi-market-canvass

結果：不收。活動報導；交通、農業、觀光只有方向性口號，東豐快速道路為立委任內爭取的政績回顧

### 江啟臣爭七千萬重現東勢舊火車站風貌！ 攜手中央地方打造大埔客家新亮點

網址：https://taichungway.tw/press-release-dongshi-old-station-restoration

結果：不收。立委身分會勘既有工程（客委會與市府已核定經費），屬活動報導與爭取經費成果，非任內承諾

### 江啟臣提教育藍圖！承諾年編10億翻新校舍、推行政AI助教師減壓

網址：https://taichungway.tw/press-release-education-6-priority-policies

結果：收錄，出處識別碼 chiang-pr-15。

| 摘錄 | 結果 |
|---|---|
| 承諾市府每年主動編列至少10億元專款，加速老舊校舍、廁所、跑道重建及防墜設施工程 | 收錄為引述，chiang-chi-chen-098 |
| 充實特教助理員、彈性調降普通生人數 | 收錄為引述，chiang-chi-chen-103 |
| 建立具體管教標準與教師心理諮商機制 | 收錄為引述，chiang-chi-chen-104 |
| 將由市長親自召集成立「臺中市婦幼發展委員會」，統籌托育與幼教政策 | 重述，併入 chiang-chi-chen-085 |
| 開發校園行政專屬「AI智慧系統」，自動彙整報表與評鑑資料 | 收錄為引述，chiang-chi-chen-093 |
| 逐年調降生師比、降低代理教師比例並落實全年聘期 | 收錄為引述，chiang-chi-chen-105 |
| 在學生端則引入AI助教，精準定位學習盲點以實踐因材施教 | 收錄為引述，chiang-chi-chen-094 |
| 在教育局成立技職專責單位 | 重述，併入 chiang-chi-chen-099 |
| 成立技職專責單位與「職業探索中心」，深化產學無縫對接 | 重述，併入 chiang-chi-chen-096 |
| 整合資源成立「科學教育發展中心」，推動「生生玩AI機器人」 | 重述，併入 chiang-chi-chen-095 |
| 於山、海、屯、城及高鐵門戶五大生活圈建置跨學門STEAM示範據點 | 收錄為引述，chiang-chi-chen-097 |
| 推動「雙語教學Plus」逐步邁向「校校有外師」 | 收錄為引述，chiang-chi-chen-100 |
| 結合在地食材推展低碳食農教育 | 收錄為引述，chiang-chi-chen-101 |
| 深化客語AI數位保存 | 重述，併入 chiang-chi-chen-120 |
| 新住民二代領航計畫 | 重述，併入 chiang-chi-chen-047 |

### 體育跟運動都應該從教育紮根！江啟臣力挺小學籃球聯賽 盼陪伴孩子成長

網址：https://taichungway.tw/press-release-elementary-basketball-league

結果：不收。以賽事會長身分出席開幕的活動報導，無任內承諾

### 江啟臣豐原第一市場拜票 鄉親熱情相挺、沿途高喊凍蒜

網址：https://taichungway.tw/press-release-fengyuan-market-canvass

結果：不收。掃街拜票的活動報導，只有願景口號

### 豐原鄉親力挺！江啟臣提全齡照護與空間活化願景 誓言讓大臺中接軌國際

網址：https://taichungway.tw/press-release-fengyuan-policy-briefing

結果：收錄，出處識別碼 chiang-pr-16。

| 摘錄 | 結果 |
|---|---|
| 將舊縣府周邊整建為具備綠地與停車場的「中興健康園區」 | 重述，併入 chiang-chi-chen-074 |
| 舊縣議會則轉型為青年創新創業育成基地與加速器，接軌國際導師與產業資源 | 收錄為引述，chiang-chi-chen-045 |
| 全力推動捷運紅線加速審議、串聯一中至豐原等重要商圈 | 收錄為引述，chiang-chi-chen-003 |
| 推動國道一號后里至大雅段拓寬 | 收錄為引述，chiang-chi-chen-009 |
| 全面提升公車準點率 | 重述，併入 chiang-chi-chen-019 |
| 智慧停車規劃 | 重述，併入 chiang-chi-chen-023 |
| 建構北臺中20分鐘宜居生活圈 | 重述，併入 chiang-chi-chen-144 |
| 提高準公托補助至最高每月1萬6千元 | 收錄為引述，chiang-chi-chen-088 |
| 加碼好孕專車並延長使用期至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 提供新手爸媽各3小時心理諮商 | 收錄為引述，chiang-chi-chen-065 |
| 40小時月嫂補助 | 重述，併入 chiang-chi-chen-068 |
| 開發AI即時臨託預約系統 | 重述，併入 chiang-chi-chen-090 |
| 推動合格親子Ubike | 重述，併入 chiang-chi-chen-021 |
| 親子車位前4小時免費 | 重述，併入 chiang-chi-chen-087 |
| 擴大敬老愛心卡折抵掛號費、運動中心及Ubike | 重述，併入 chiang-chi-chen-069 |
| 研議弱勢與高風險族群公費疫苗補助 | 不收：原文是「研議」，且未寫疫苗種類 |
| 成立勞工「AI學院」提供免費培訓 | 收錄為引述，chiang-chi-chen-042 |
| 全力打造「AI機器人製造城市」 | 重述，併入 chiang-chi-chen-033 |
| 善用臺中國際會展中心發揮會展經濟效益 | 重述，併入 chiang-chi-chen-035 |

### 受邀出席火鳳凰後援會活動 江啟臣：科技救災、守護第一線

網址：https://taichungway.tw/press-release-fire-phoenix-tech-rescue

結果：收錄，出處識別碼 chiang-pr-17。

| 摘錄 | 結果 |
|---|---|
| 未來將全面導入AI、無人機及無人載具等科技，協助第一線救災人員在進入現場前，即時掌握火勢、地形及受困者位置 | 收錄為引述，chiang-chi-chen-028 |
| 持續升級救災裝備、通訊系統與訓練環境，降低救援風險 | 重述，併入 chiang-chi-chen-028 |

### 好孕專車延至產後一年、敬老卡升級 江啟臣四場輔選端幸福願景

網址：https://taichungway.tw/press-release-four-hq-openings-xitun-nanqu-dali

結果：收錄，出處識別碼 chiang-pr-18。

| 摘錄 | 結果 |
|---|---|
| 將把好孕專車使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 敬老愛心卡點數當年度內不歸零、計程車每趟最高扣抵200點，並擴大使用範圍 | 重述，併入 chiang-chi-chen-069 |
| 推動帶狀疱疹疫苗定額補助 | 重述，併入 chiang-chi-chen-070 |
| 打造「旗艦級購物節」，結合會展中心、商圈與零售業，將參展廠商及國際買家的消費導入購物節 | 收錄為引述，chiang-chi-chen-054 |
| 結合AI、機器人及無人載具，朝「機器人製造之都」邁進 | 重述，併入 chiang-chi-chen-033 |

### 百名退役海龍蛙兵大集結挺江啟臣 誓言發揮「水鬼精神」拚勝選

網址：https://taichungway.tw/press-release-frogmen-support-group

結果：不收。後援會成立大會的活動報導，無政見

### 江啟臣合體楊瓊瓔、黃健豪及議員掃果菜市場 再赴大雅展姐弟情

網址：https://taichungway.tw/press-release-fruit-market-daya-market

結果：不收。掃街拜票的活動報導，無政見

### 江啟臣接棒盧秀燕 攜手張清照誓言打造國際新臺中

網址：https://taichungway.tw/press-release-haixian-zhang-qing-zhao

結果：收錄，出處識別碼 chiang-pr-19。

| 摘錄 | 結果 |
|---|---|
| 他承諾全力推動捷運藍線加速推進 | 重述，併入 chiang-chi-chen-001 |
| 讓橘線延伸至清水並與藍線相連 | 收錄為引述，chiang-chi-chen-002 |
| 積極爭取海線鐵路雙軌高架化 | 重述，併入 chiang-chi-chen-013 |
| 國道四號延伸連通臺中港區 | 重述，併入 chiang-chi-chen-008 |
| 規劃將鰲峰山打造成綜合休閒園區 | 收錄為引述，chiang-chi-chen-141 |
| 推動興建符合250公尺國際標準的室內自由車場館 | 收錄為引述，chiang-chi-chen-142 |

### 江啟臣中秋迺旱溪夜市 拋「庶民經濟三箭」拚百業齊發

網址：https://taichungway.tw/press-release-hanxi-nightmarket-3-arrows

結果：收錄，出處識別碼 chiang-pr-20。

| 摘錄 | 結果 |
|---|---|
| 市府應主動協助攤商導入多元支付與數位點數系統，並結合「臺中購物節」等大型城市行銷活動 | 重述，併入 chiang-chi-chen-049 |
| 將編列專案預算，針對全市傳統市場的公共衛生、停車空間與動線規劃進行全面改善 | 收錄為引述，chiang-chi-chen-053 |
| 未來將檢討並提供合理的規費與租金輔導機制 | 收錄為引述，chiang-chi-chen-049 |
| 引入微型創業貸款利息補貼，鼓勵更多青年留在臺中打拚 | 收錄為引述，chiang-chi-chen-049 |

### 神力女超人助陣、四大天王加持！江啟臣競總成立 藍白大團結氣勢沸騰

網址：https://taichungway.tw/press-release-hq-opening-former-magistrates

結果：不收。競總成立大會的活動報導，內容為他人致詞，候選人無政見

### 江啟臣宣示「接棒準備好了！」三子團抱相挺 線上線下狂吸逾3萬人擠爆臺中

網址：https://taichungway.tw/press-release-hq-opening-three-hug

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 具體提出「20分鐘生活圈、5大生活區域」的藍圖，承諾在 20 分鐘內全面滿足市民食衣住行、育樂就醫、就學就養及就業等各項需求 | 重述，併入 chiang-chi-chen-144 |

### 端原民政策牛肉！江啟臣允全額補助微型保險、推行動長照車

網址：https://taichungway.tw/press-release-indigenous-5-policies

結果：收錄，出處識別碼 chiang-pr-21。

| 摘錄 | 結果 |
|---|---|
| 包含「升級職業培力」，強化就業競爭力 | 重述，併入 chiang-chi-chen-050 |
| 由市府全額負擔15至64歲原住民的微型保險 | 重述，併入 chiang-chi-chen-051 |
| 並「打造行動長照車」，結合醫療檢測深入部落服務長者 | 重述，併入 chiang-chi-chen-081 |
| 「獎勵於原鄉外設置原住民族據點」，提供展演與青年創業交流空間 | 收錄為引述，chiang-chi-chen-082 |
| 「建構原民語言與祭儀智慧庫以傳承文化」 | 重述，併入 chiang-chi-chen-125 |

### 甲埔大道延伸、鐵路高架雙軌化 江啟臣拚「甲安埔20分鐘生活圈」 讓海線不再遙遠

網址：https://taichungway.tw/press-release-jiaanpu-20-minute-city

結果：收錄，出處識別碼 chiang-pr-22。

| 摘錄 | 結果 |
|---|---|
| 未來他將依各區面積、道路現況與實際需求分配預算，加碼基層建設 | 收錄為引述，chiang-chi-chen-145 |
| 他將推動「甲埔大道延伸案」 | 收錄為引述，chiang-chi-chen-010 |
| 打造「甲安埔20分鐘生活圈」 | 重述，併入 chiang-chi-chen-144 |
| 加速推動鐵路高架雙軌化，縮短海線與市區的距離 | 重述，併入 chiang-chi-chen-013 |
| 建立臺中智慧農業「領鮮品牌」 | 重述，併入 chiang-chi-chen-057 |
| 擴大智慧農業產學合作 | 重述，併入 chiang-chi-chen-058 |
| 升級「臺中農易通APP」 | 重述，併入 chiang-chi-chen-059 |
| 以細胞簡訊即時發布農業災害預警 | 重述，併入 chiang-chi-chen-060 |
| 以「親海賞蟹大道」結合大安親海自然步道、濱海運動區 | 重述，併入 chiang-chi-chen-140 |
| 將升級愛心敬老卡，計程車每趟可抵用額度提高至200元，並擴大用於就醫掛號、運動及農會消費 | 重述，併入 chiang-chi-chen-069 |
| 帶狀皰疹疫苗兩劑自費約16,000元，秉持「預防重於治療」，將補助弱勢族群接種，並研議擴大照顧65歲以上長輩 | 不收：補助弱勢族群的部分是重述江-03-8；對 65 歲以上長輩只寫「研議擴大照顧」，研議部分不收 |
| 教育經費比例將維持最高 | 收錄為引述，chiang-chi-chen-106 |
| 建置有溫度的安全校園，優先改善廁所、教室與跑道 | 重述，併入 chiang-chi-chen-098 |
| 加碼補助準公共托嬰、育兒津貼加碼1,000元 | 重述，併入 chiang-chi-chen-088 |
| 全面推行育兒友善廁所 | 重述，併入 chiang-chi-chen-092 |
| 親子停車位免費停車4小時 | 重述，併入 chiang-chi-chen-087 |
| 增設YouBike「袋鼠車」 | 重述，併入 chiang-chi-chen-021 |

### 建國市場遷建十週年 江啟臣主張市場升級、擦亮「臺中味」城市品牌

網址：https://taichungway.tw/press-release-jianguo-market-10th-anniversary

結果：收錄，出處識別碼 chiang-pr-23。

| 摘錄 | 結果 |
|---|---|
| 應持續改善採光、通風、空調及環境衛生，並優化採買動線與周邊停車交通 | 收錄為引述，chiang-chi-chen-053 |
| 江啟臣主張結合數位支付、物流配送與網路行銷，協助攤商拓展客源，同時鼓勵青年進駐創業 | 收錄為引述，chiang-chi-chen-049 |

### 攤商巧思送鳳梨、茭白筍祝福 誓言升級公有市場顧好庶民經濟

網址：https://taichungway.tw/press-release-jianguo-market-mid-autumn

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 持續優化公有市場軟硬體環境與周邊配套動線，打造更舒適好逛、吸引年輕世代的現代化市場 | 重述，併入 chiang-chi-chen-053 |

### 從教育婦幼到北區建設！江啟臣跨區合體藍營戰將 喊話打造「臺中旗艦城」

網址：https://taichungway.tw/press-release-joint-campaign-hq-launches

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來臺中市政府將成立跨局處的「婦幼發展委員會」 | 重述，併入 chiang-chi-chen-085 |

### 每年至少10億元更新校園！江啟臣攜手李中 教育優先、教師減壓

網址：https://taichungway.tw/press-release-lai-li-joint-hq-school-renewal

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 打造「機器人製造之都」，並透過「AI機器人智慧園區」 | 重述，併入 chiang-chi-chen-033 |
| 「AI賦能學院」，促進智慧製造轉型、培育人才 | 重述，併入 chiang-chi-chen-042 |
| 依各地需求盤點並補足就學、就醫、採買等生活機能 | 重述，併入 chiang-chi-chen-144 |
| 改革公車路網、加密生活圈內班次，強化轉乘接駁 | 重述，併入 chiang-chi-chen-019 |
| 點數可於當年度累積使用，計程車單趟最高折抵200點 | 重述，併入 chiang-chi-chen-069 |
| 推動重症弱勢族群及65歲以上長輩接種帶狀疱疹疫苗的定額補助 | 重述，併入 chiang-chi-chen-070 |
| 產後父母各3次心理諮商補助 | 重述，併入 chiang-chi-chen-065 |
| 好孕專車使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 到宅月嫂補助時數增加至40小時 | 重述，併入 chiang-chi-chen-068 |
| 每年至少編列10億元專款，加速更新老舊校舍、廁所及跑道，完善校園安全設施 | 重述，併入 chiang-chi-chen-098 |
| 透過校園行政專屬「AI智慧系統」、簡併評鑑與行政減量，減輕基層教師負擔 | 重述，併入 chiang-chi-chen-093 |

### 「掃地機差點被叫啟臣！」江啟臣樂成宮談AI逗樂全場 承諾福利大加碼、翻轉技職造「旗艦臺中」

網址：https://taichungway.tw/press-release-lecheng-temple-briefing

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 敬老愛心卡計程車單趟補助提高至200元、點數年底結算不歸零並可採買農漁會商品 | 重述，併入 chiang-chi-chen-069 |
| 孕產婦搭計程車補助延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 月嫂補助增至40小時 | 重述，併入 chiang-chi-chen-068 |
| 提高準公托補助 | 重述，併入 chiang-chi-chen-088 |
| 落實親子車位前4小時免費 | 重述，併入 chiang-chi-chen-087 |
| 增設親子YouBike | 重述，併入 chiang-chi-chen-021 |
| 增設親子YouBike與親子廁所 | 重述，併入 chiang-chi-chen-092 |
| 他承諾維持教育經費最高比例 | 重述，併入 chiang-chi-chen-106 |

### 活化舊縣府、打造青年創業基地 江啟臣擘劃豐原升級藍圖

網址：https://taichungway.tw/press-release-lien-chiachen-hq

結果：收錄，出處識別碼 chiang-pr-24。

| 摘錄 | 結果 |
|---|---|
| 未來將活化舊縣府周邊空間，整建為結合健康照護、公共服務、綠地與停車功能的「中興健康園區」 | 收錄為引述，chiang-chi-chen-074 |
| 原縣議會空間則轉型為青年創新創業育成基地與加速器 | 重述，併入 chiang-chi-chen-045 |

### 力挺大梨山地區農民！江啟臣推智慧農業 結合會展升級產銷

網址：https://taichungway.tw/press-release-lishan-smart-agriculture

結果：收錄，出處識別碼 chiang-pr-25。

| 摘錄 | 結果 |
|---|---|
| 東豐快速道路（豐原至東勢段）也力拚118年全線通車 | 收錄為引述，chiang-chi-chen-011 |
| 成立「AI賦能學院」協助農民掌握數位工具 | 收錄為引述，chiang-chi-chen-042 |
| 他規畫升級農業局專屬App，讓農民只需手機拍照上傳，即可快速辨識病蟲害 | 重述，併入 chiang-chi-chen-059 |
| 同時將透過細胞簡訊精準發布區域性天災預警，及早防災 | 重述，併入 chiang-chi-chen-060 |
| 他承諾，未來將結合臺中市會展產業，大力行銷梨山的優質農特產品 | 重述，併入 chiang-chi-chen-057 |
| 未來將結合福壽山、武陵農場與在地原民文化，推廣「步道觀光」 | 收錄為引述，chiang-chi-chen-123 |
| 並籌辦串聯梨山、和平、谷關的「山和谷音樂祭」 | 收錄為引述，chiang-chi-chen-122 |
| 他提出推動「智慧衛生所」，藉由網路視訊看診 | 收錄為引述，chiang-chi-chen-073 |
| 並構思利用無人機24小時運送緊急藥品上山 | 不收：原文是「構思」，沒有承諾 |
| 上任後將延續65歲以上長者免繳健保費政策 | 收錄為引述，chiang-chi-chen-083 |
| 並放寬敬老愛心卡每月1000點使用限制，開放一定額度至農漁會消費，且點數可累積至年底再歸零 | 重述，併入 chiang-chi-chen-069 |
| 針對高風險弱勢長輩，市府也將提供帶狀皰疹（皮蛇）疫苗施打補助 | 重述，併入 chiang-chi-chen-070 |

### 敬老卡計程車補助翻倍！江啟臣龍井連跑兩場 長輩福利一次加碼

網址：https://taichungway.tw/press-release-longjing-senior-card-briefings

結果：收錄，出處識別碼 chiang-pr-26。

| 摘錄 | 結果 |
|---|---|
| 將優先推動生活圈四號道路，補齊大肚、龍井等地外環路網，並改善港區交通安全 | 收錄為引述，chiang-chi-chen-007 |
| 盤點各生活圈欠缺的醫療、教育與社福設施，逐步補齊 | 重述，併入 chiang-chi-chen-144 |
| 他承諾推動點數改為年底結算、每趟計程車補助提高至200元，並擴大至指定藥局、運動中心及農漁會消費 | 重述，併入 chiang-chi-chen-069 |
| 另研議補助65歲以上、經醫師評估有需要的高風險長輩接種帶狀疱疹疫苗 | 不收：原文是「研議」（內容與江-03-8 相近） |

### 「一定會投給你！」民眾拉手力挺 江啟臣從早市走到夜市搏感情

網址：https://taichungway.tw/press-release-markets-night-market-sweep

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來將推動市場環境升級，改善通風與採買品質 | 重述，併入 chiang-chi-chen-053 |
| 江啟臣主張提升傳統市場環境與特色，結合青年創意、商圈行銷及臺中購物節 | 重述，併入 chiang-chi-chen-054 |
| 推動65歲以上長輩接種帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 擴大敬老愛心卡使用範圍 | 重述，併入 chiang-chi-chen-069 |

### 醫療長照界近千人挺江啟臣 提五大原則、設長照處守護市民

網址：https://taichungway.tw/press-release-medical-longterm-care-support-launch

結果：收錄，出處識別碼 chiang-pr-27。

| 摘錄 | 結果 |
|---|---|
| 承諾在衛生局下設立「長照處」 | 重述，併入 chiang-chi-chen-072 |
| 未來重大健康、公衛、醫療、長照與藥事政策，將讓專業人員實質參與 | 收錄為引述，chiang-chi-chen-084 |
| 並提出孕婦RSV疫苗補助 | 重述，併入 chiang-chi-chen-066 |
| 以及65歲以上長輩、重症弱勢的帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 江啟臣規劃成立「智慧城市發展委員會」、「婦幼發展委員會」及「國際合作發展委員會」 | 重述，併入 chiang-chi-chen-126 |
| 江啟臣規劃成立「智慧城市發展委員會」、「婦幼發展委員會」及「國際合作發展委員會」 | 重述，併入 chiang-chi-chen-085 |
| 江啟臣規劃成立「智慧城市發展委員會」、「婦幼發展委員會」及「國際合作發展委員會」 | 重述，併入 chiang-chi-chen-127 |
| 他主張將AI導入公衛、防災及救護，升級救護車設備 | 收錄為引述，chiang-chi-chen-028 |

### 讓世界走進臺中！江啟臣提「會展經濟168」串聯製造、觀光與商圈

網址：https://taichungway.tw/press-release-mice-economy-168

結果：收錄，出處識別碼 chiang-pr-28。

| 摘錄 | 結果 |
|---|---|
| 提出由市長親自領導的會展專案辦公室，串聯六大平臺、推動八項具體政策 | 收錄為引述，chiang-chi-chen-035 |
| 也透過「臺中館」協助在地產業赴海外參展 | 重述，併入 chiang-chi-chen-036 |
| 將依臺中優勢產業爭取並舉辦特色展會，包括國際自行車展、國際工具機展、自動化工業大展及運動器材展 | 收錄為引述，chiang-chi-chen-035 |
| 江啟臣提出「會展經濟168 Plus」，串聯臺中購物節、各大商圈、觀光旅遊與演藝活動 | 收錄為引述，chiang-chi-chen-054 |

### 臺中捷運藍線路線段動工！江啟臣全力爭取中央資源 攜手推動「七線齊發」

網址：https://taichungway.tw/press-release-mrt-blue-line-groundbreaking

結果：收錄，出處識別碼 chiang-pr-29。

| 摘錄 | 結果 |
|---|---|
| 江啟臣承諾會全力協助爭取交通部及行政院合理提高補助比例 | 收錄為引述，chiang-chi-chen-146 |
| 他堅定主張「捷運多線齊發，力拚藍線完工、其他線動工」 | 重述，併入 chiang-chi-chen-001 |
| 未來將結合「即時AI輔助交通系統」管理幹線流量 | 重述，併入 chiang-chi-chen-130 |
| 並建立重大節點的高效快捷公車與 YouBike 網絡，串接捷運站點「最後一哩路」 | 重述，併入 chiang-chi-chen-017 |

### 從親子友善到20分鐘生活圈！江啟臣南屯說明會擘畫旗艦臺中

網址：https://taichungway.tw/press-release-nantun-briefing-20-minute-city

結果：收錄，出處識別碼 chiang-pr-30。

| 摘錄 | 結果 |
|---|---|
| 他提出加碼準公共托育補助 | 重述，併入 chiang-chi-chen-088 |
| 將好孕專車使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 並提供新手爸媽各3次心理諮商補助 | 重述，併入 chiang-chi-chen-065 |
| 到宅月嫂服務補助加碼至40小時 | 重述，併入 chiang-chi-chen-068 |
| 搭配建立臨托預約APP | 重述，併入 chiang-chi-chen-090 |
| 江啟臣主張推動親子友善停車措施，提供前4小時免費優惠 | 重述，併入 chiang-chi-chen-087 |
| 增設方便嬰幼兒盥洗的「親子小白宮」 | 重述，併入 chiang-chi-chen-092 |
| 並推動可搭載幼兒的「袋鼠車」公共自行車 | 重述，併入 chiang-chi-chen-021 |
| 計程車每趟補助提高至200元，當月未用完點數可累積至年底結算，並擴大至指定藥局、運動中心及農漁會一定額度採買等用途 | 重述，併入 chiang-chi-chen-069 |
| 另規劃補助65歲以上長者及高風險族群接種帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 他提出山城、海線、屯區、市區及高鐵門戶特區五大生活圈，以「20分鐘生活圈」為目標 | 收錄為引述，chiang-chi-chen-144 |

### 胡志強力挺「最值得信賴」！江啟臣攜朱暖英端出臺中升級藍圖

網址：https://taichungway.tw/press-release-nantun-briefing-hu-chih-chiang

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 每年至少編列10億元專款，加速改善老舊校舍、廁所及跑道 | 重述，併入 chiang-chi-chen-098 |

### 江啟臣提新住民四大政策 讓近13萬新住民及子女在臺中扎根圓夢

網址：https://taichungway.tw/press-release-new-residents-4-policies

結果：收錄，出處識別碼 chiang-pr-31。

| 摘錄 | 結果 |
|---|---|
| 首先成立「國際合作發展委員會」，納入新住民及其二代參與 | 收錄為引述，chiang-chi-chen-127 |
| 其次啟動「新住民二代國際領航計畫」，針對高中、大專新二代青年提供培力、實務活動與國際交流 | 收錄為引述，chiang-chi-chen-047 |
| 推動「新住民微型創業貸款利息補貼」，在既有培力課程基礎上減輕創業負擔 | 重述，併入 chiang-chi-chen-048 |
| 第四，升級母語、法律與心理諮詢，結合既有一站式服務，強化多語專業協助 | 重述，併入 chiang-chi-chen-080 |

### 讓老城長出新未來 江啟臣：臺中文化復興從中西區啟動

網址：https://taichungway.tw/press-release-old-town-cultural-revival

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 「打皮蛇」是針對65歲以上長者，並優先照顧重症、弱勢等高風險族群，經醫師評估後提供帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 每月1,000點不但不會減少，還要變得更實用，包括計程車每趟最高折抵200點、折抵醫療掛號費及指定藥局費用，也能用於YouBike、國民運動中心，並規劃一定額度可至農漁會採買 | 重述，併入 chiang-chi-chen-069 |
| 當月未使用完的點數也可累積，到年底歸零 | 重述，併入 chiang-chi-chen-069 |
| 並推動臺中車站周邊新民街倉庫群活化，規劃Live House及多元展演空間 | 重述，併入 chiang-chi-chen-052 |
| 包括第二市場、第五市場等具歷史的傳統市場，都應改善照明、通風、空調及整體購物環境 | 重述，併入 chiang-chi-chen-053 |
| 下一步應進一步串聯西區在地商圈及臺中國際會展中心 | 重述，併入 chiang-chi-chen-054 |
| 包括研議腸病毒及孕婦所需疫苗補助 | 不收：原文是「研議」（腸病毒與孕婦疫苗） |
| 包括研議腸病毒及孕婦所需疫苗補助 | 不收：原文是「研議」（腸病毒與孕婦疫苗） |
| 親子停車優惠 | 重述，併入 chiang-chi-chen-087 |
| 增加親子廁所 | 重述，併入 chiang-chi-chen-092 |
| 並導入可合法搭載幼童的親子YouBike「袋鼠車」 | 重述，併入 chiang-chi-chen-021 |

### 挺年輕人安心成家！江啟臣推13項育兒新政 喊出「育兒友善再升級、幸福生育向前行」

網址：https://taichungway.tw/press-release-parenting-13-policies

結果：收錄，出處識別碼 chiang-pr-32。

| 摘錄 | 結果 |
|---|---|
| 江啟臣規劃成立由市長召集跨局處整合的「婦幼發展委員會」 | 重述，併入 chiang-chi-chen-085 |
| 逐步補足育嬰留職停薪剩餘兩成薪資差額達到全額給付 | 重述，併入 chiang-chi-chen-089 |
| 準公共託育補助提高至每月3,000元並朝第二胎以上零月費邁進，未送託家庭亦能獲得每月1,000元加碼補助 | 重述，併入 chiang-chi-chen-088 |
| 開發「臺中臨託預約 APP」實現一鍵快速預約周邊臨託，並鼓勵企業設立托育設施 | 重述，併入 chiang-chi-chen-090 |
| 新政提供「父母各3次」心理諮商補助 | 重述，併入 chiang-chi-chen-065 |
| 到宅月嫂補助提升至40小時 | 重述，併入 chiang-chi-chen-068 |
| 並補助28至36週孕婦施打 RSV 疫苗 | 收錄為引述，chiang-chi-chen-066 |
| 擴大腸病毒疫苗補助 | 重述，併入 chiang-chi-chen-067 |
| 提供 AMH 檢測補助 | 重述，併入 chiang-chi-chen-063 |
| 擴大凍卵補助 | 重述，併入 chiang-chi-chen-064 |
| 江啟臣規劃親子車位免費停車4小時 | 收錄為引述，chiang-chi-chen-087 |
| 好運專車延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 並以文心森林公園親子廁所為範本推動「親子小白宮」 | 收錄為引述，chiang-chi-chen-092 |
| 記者會現場更率先曝光「袋鼠車」複合功能型共享單車 | 重述，併入 chiang-chi-chen-021 |

### 江啟臣拋育兒外出四升級 親子YouBike「袋鼠車」也入列

網址：https://taichungway.tw/press-release-parenting-outing-upgrades

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 包括親子車位免費停車4小時 | 重述，併入 chiang-chi-chen-087 |
| 好孕專車乘車補助延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 試辦附設兒童安全座椅的親子YouBike「袋鼠車」 | 重述，併入 chiang-chi-chen-021 |
| 普及「親子小白宮」等親子廁所 | 重述，併入 chiang-chi-chen-092 |

### 江啟臣臺中藥界後援會成立 拋「長照處、婦幼委員會」政策 號召藥界齊打造旗艦城

網址：https://taichungway.tw/press-release-pharmacist-support-group

結果：收錄，出處識別碼 chiang-pr-33。

| 摘錄 | 結果 |
|---|---|
| 將成立「婦幼發展委員會」與專責的「長照處」 | 重述，併入 chiang-chi-chen-085 |
| 他更要在市府衛生局下成立專責的「長照處」 | 重述，併入 chiang-chi-chen-072 |
| 同時邀請藥師代表參與AI智慧城市與健康治理等核心決策 | 收錄為引述，chiang-chi-chen-084 |
| 未來將把精密機械園區重塑為機器人製造園區 | 重述，併入 chiang-chi-chen-033 |
| 加碼準公托補助 | 重述，併入 chiang-chi-chen-088 |
| 優化孕產婦與幼兒疫苗津貼 | 重述，併入 chiang-chi-chen-066 |
| 透過擴大敬老愛心卡折抵用途 | 重述，併入 chiang-chi-chen-069 |
| 補貼高風險族群疫苗 | 重述，併入 chiang-chi-chen-070 |
| 推動智慧衛生所 | 重述，併入 chiang-chi-chen-073 |

### 百年州廳風華再現！江啟臣感性表示：文化是城市的靈魂

網址：https://taichungway.tw/press-release-prefectural-hall-reopening

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來盼串聯臺中火車站、市役所、綠川、柳川及中央書局等30多處老建築與重要景點，打造「最有臺中味道的文化觀光廊帶」 | 不收：原文是「盼」，承諾程度與研議相同 |

### 江啟臣拜票市民搶摸鼻沾福氣 承諾加速海線軌道、港區高架道路建設

網址：https://taichungway.tw/press-release-qingshui-first-market-canvass

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 他承諾全力推動捷運藍線加速推進 | 重述，併入 chiang-chi-chen-001 |
| 並讓橘線延伸至清水並與藍線相連 | 重述，併入 chiang-chi-chen-002 |
| 積極爭取海線鐵路雙軌高架化 | 重述，併入 chiang-chi-chen-013 |
| 將國道四號直接高架延伸進港區、優化聯外幹道 | 重述，併入 chiang-chi-chen-008 |
| 更要積極規劃將鰲峰山打造成綜合休閒園區 | 重述，併入 chiang-chi-chen-141 |
| 並興建符合250公尺國際標準的室內自由車場館 | 重述，併入 chiang-chi-chen-142 |

### 從保衛國家到守護臺中 江啟臣：做「臺中市民的海龍蛙兵」

網址：https://taichungway.tw/press-release-registration-day-sea-dragon

結果：不收。參選登記活動報導；施政藍圖只有口號與方向（會展、生活圈、智慧治理），無具體事項

### 學界看好、業界期待！江啟臣整合機器人供應鏈 拚產業升級、勞工加薪

網址：https://taichungway.tw/press-release-robot-policy-launch

結果：收錄，出處識別碼 chiang-pr-34。

| 摘錄 | 結果 |
|---|---|
| 市政府要把精密機械、半導體、AI、光學與資通訊廠商串起來，建立軟硬體整合平台，幫中小企業跨過升級門檻 | 收錄為引述，chiang-chi-chen-033 |
| 同時推動「AI機器人智慧製造園區」，盤點中科、精密機械園區及潭雅神等產業聚落，協助既有園區升級與必要的新開發 | 收錄為引述，chiang-chi-chen-033 |
| 市府就提供單一窗口，協助從研發、測試走到量產 | 收錄為引述，chiang-chi-chen-033 |
| 未來將建立國際級戰略合作平台，幫廠商找到國際品牌、研發團隊與市場 | 收錄為引述，chiang-chi-chen-033 |
| 擴大測試驗證能量，打造無人載具系統整合與高階製造中心 | 收錄為引述，chiang-chi-chen-034 |
| 並推動「低空經濟」示範區 | 收錄為引述，chiang-chi-chen-034 |
| 要讓孩子從國中小、高中職接觸AI、機器人與無人載具，再結合大專院校、技職教育與企業 | 重述，併入 chiang-chi-chen-095 |

### 導入AI照護與預防醫學 江啟臣推十大銀髮政策打造全齡友善臺中

網址：https://taichungway.tw/press-release-senior-care-10-policies

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 鼓勵長輩多多走出門、吃健康、樂活學、折抵市立醫療院所掛號費，讓點數用得完也更好用 | 重述，併入 chiang-chi-chen-069 |
| 衛生局下增設長照處 | 重述，併入 chiang-chi-chen-072 |
| 推動特色長照C據點 | 重述，併入 chiang-chi-chen-075 |
| 全齡專班與好肌力計畫延緩失能 | 重述，併入 chiang-chi-chen-076 |
| 全齡專班與好肌力計畫延緩失能 | 重述，併入 chiang-chi-chen-077 |
| 打造原民行動長照車與文健站 | 重述，併入 chiang-chi-chen-081 |

### 江啟臣擘劃海線交通願景 促捷運串聯雙港與道路立體化

網址：https://taichungway.tw/press-release-shalu-coastal-transport

結果：收錄，出處識別碼 chiang-pr-35。

| 摘錄 | 結果 |
|---|---|
| 規劃補助65歲以上長者及弱勢族群接種帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 擴大敬老愛心卡每月一千點的效益，規劃計程車每趟補助200元，並結合就醫、運動及農漁會限額消費等多元用途 | 重述，併入 chiang-chi-chen-069 |
| 要規劃機場捷運橘線延伸至清水，並繼續連結藍線 | 重述，併入 chiang-chi-chen-002 |
| 大臺中「四環一線」快速道路系統中，龍井、烏日路段也將加速銜接 | 重述，併入 chiang-chi-chen-007 |
| 江啟臣提出臺中港聯外道路立體化訴求 | 收錄為引述，chiang-chi-chen-008 |

### 從東豐快到文化觀光 江啟臣擘劃山城願景：把建設做到底

網址：https://taichungway.tw/press-release-shancheng-joint-briefing

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 將持續推進東勢客家文化園區建設 | 重述，併入 chiang-chi-chen-118 |
| 推動「山和谷音樂祭」，串聯東豐、后豐鐵馬道人潮與農特產品行銷 | 重述，併入 chiang-chi-chen-122 |

### 爭取近3千萬中央補助！江啟臣見證石岡圖書館重生 期許打造山城知識交流樞紐

網址：https://taichungway.tw/press-release-shigang-library-reopening

結果：不收。圖書館開館活動報導與爭取補助的政績回顧，無新政見

### 斥資逾60億！臺中水湳會展中心二期簽約 江啟臣：打造「前店後廠自由港」

網址：https://taichungway.tw/press-release-shuinan-mice-phase2-signing

結果：不收。會展中心二期簽約活動報導；「前店、後廠、自由港」「會展經濟 Plus」只有名稱與願景，無具體事項

### 讓科技走在危險前面！江啟臣發表「智慧臺中城市安全網」

網址：https://taichungway.tw/press-release-smart-city-safety-net-launch

結果：收錄，出處識別碼 chiang-pr-36。

| 摘錄 | 結果 |
|---|---|
| 未來將深化「智慧城市發展委員會」的跨局處整合功能 | 重述，併入 chiang-chi-chen-126 |
| 並建置「臺中市主權AI與大數據中心」 | 重述，併入 chiang-chi-chen-128 |
| 也能協助相關單位提前發現問題、主動提供服務，建立跨局處協同預警機制 | 重述，併入 chiang-chi-chen-129 |
| 江啟臣主張，強化警消執勤安全、提高福利待遇、升級裝備 | 重述，併入 chiang-chi-chen-028 |
| 並結合公私協力，將詐騙追查到底 | 重述，併入 chiang-chi-chen-027 |
| 擴大社工、護理等第一線人員參與決策，尊重專業、補足人力、照顧權益 | 重述，併入 chiang-chi-chen-084 |
| 透過中臺灣區域治理平臺強化防救災合作 | 收錄為引述，chiang-chi-chen-135 |
| 並擴大AI水情治理系統 | 重述，併入 chiang-chi-chen-131 |
| 另推動智慧噪音監測，結合聲音照相與車牌辨識，強化噪音防制 | 收錄為引述，chiang-chi-chen-133 |

### 江啟臣一晚連趕南區、南屯 柳采葳連挺兩場、廖偉翔三口號炒熱全場

網址：https://taichungway.tw/press-release-south-nantun-briefings

結果：收錄，出處識別碼 chiang-pr-37。

| 摘錄 | 結果 |
|---|---|
| 未來將針對弱勢及高風險長輩提供帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 檢討幼兒、孕婦所需疫苗的補助方案 | 不收：原文是「檢討」補助方案，未說明要做什麼，視同研議 |
| 每年至少編列十億元改善校園老舊廁所 | 重述，併入 chiang-chi-chen-098 |
| 打造智慧衛生所 | 重述，併入 chiang-chi-chen-073 |
| 特色長照據點 | 重述，併入 chiang-chi-chen-075 |
| 敬老愛心卡每月一千點則維持不變，當年度不再按月歸零，使用範圍也將擴大至運動中心、藥局、診所及農會等場域 | 重述，併入 chiang-chi-chen-069 |
| 未來將重新盤點公車路線與班次，導入AI提高準點率 | 收錄為引述，chiang-chi-chen-019 |
| 推動市民免費搭公車 | 重述，併入 chiang-chi-chen-016 |
| 捷運路網也要全面加速 | 重述，併入 chiang-chi-chen-001 |
| 未來將結合精密機械與AI技術，布局機器人、無人載具等新興產業 | 重述，併入 chiang-chi-chen-033 |

### 中部旅客就近出國！江啟臣籲加速臺中機場擴建 分擔桃機旅運需求

網址：https://taichungway.tw/press-release-taichung-airport-expansion

結果：收錄，出處識別碼 chiang-pr-38。

| 摘錄 | 結果 |
|---|---|
| 以年旅運量千萬人次為目標，升級臺中國際機場 | 收錄為引述，chiang-chi-chen-012 |
| 他主張加速臺中國際機場第三航廈規劃建設，並整體評估跑道設施擴充與航空城發展 | 收錄為引述，chiang-chi-chen-012 |
| 江啟臣提出推動高速公路直通機場的交通規劃 | 收錄為引述，chiang-chi-chen-012 |
| 加速機場捷運橘線後續規劃建設 | 收錄為引述，chiang-chi-chen-002 |
| 完善臺中機場往返高鐵及中部各大轉運中心的快速公車聯營 | 收錄為引述，chiang-chi-chen-017 |

### 陪同盧秀燕視察中火 江啟臣：減煤不能有空窗、拆煤承諾不能做半套

網址：https://taichungway.tw/press-release-taichung-power-plant-inspection

結果：不收。視察活動報導，內容是要求行政院與臺電交代減煤時程，沒有候選人任內要做的具體事項

### 敬老卡升級、捷運路網再推進 江啟臣：讓太平、大里生活更方便

網址：https://taichungway.tw/press-release-taiping-dali-briefings

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 要讓食衣住行育樂及就醫、就學、就業、就養，盡可能在20分鐘內解決 | 重述，併入 chiang-chi-chen-144 |
| 點數改採一年結算、計程車單趟折抵提高至200元，並擴大至醫療、藥局及農漁會使用 | 重述，併入 chiang-chi-chen-069 |
| 另將依醫師建議補助65歲以上市民施打帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 推動捷運藍線延伸太平、屯區捷運環狀線（紫線） | 重述，併入 chiang-chi-chen-005 |
| 以AI改善臺74線交通 | 重述，併入 chiang-chi-chen-130 |
| 捷運完成前先優化公車路網、班次與準點率 | 重述，併入 chiang-chi-chen-019 |
| 再推動市民免費搭乘 | 重述，併入 chiang-chi-chen-016 |
| 將結合實體AI、機器人及無人載具，協助太平、大里製造業升級 | 重述，併入 chiang-chi-chen-033 |

### 讓通勤時間還給家人！江啟臣推「20分鐘生活圈」 AI治理大臺中

網址：https://taichungway.tw/press-release-taiping-temple-20-minute-city

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 規劃五大生活圈，目標讓市民在20分鐘交通時間內，滿足食衣住行育樂，以及就學、就業、就醫、就養等需求 | 重述，併入 chiang-chi-chen-144 |
| 捷運路網規劃包括藍線延伸太平及環狀紫線 | 重述，併入 chiang-chi-chen-005 |
| 他主張重整公車路網，做到「跨域快、圈內密、轉乘方便」 | 重述，併入 chiang-chi-chen-019 |
| 串聯現有及興建中的轉運中心、高鐵、機場與火車站等重要節點，打造「六大轉運樞紐」 | 重述，併入 chiang-chi-chen-017 |
| 未來將協助中小企業智慧升級，對接半導體、機器人製造、無人載具等新興供應鏈 | 重述，併入 chiang-chi-chen-033 |
| 導入科技發展智慧農業 | 重述，併入 chiang-chi-chen-058 |
| 再造臺中領鮮品牌 | 重述，併入 chiang-chi-chen-057 |
| 持續擴充托育、托老據點 | 重述，併入 chiang-chi-chen-091 |
| 持續擴充托育、托老據點 | 重述，併入 chiang-chi-chen-075 |
| 規劃親子型YouBike | 重述，併入 chiang-chi-chen-021 |
| 公園親子廁所等友善設施 | 重述，併入 chiang-chi-chen-092 |

### 搶救臺中交通動脈！江啟臣攜手產學專家擘劃20大解方：市民公車免費、清泉崗升格千萬級國門

網址：https://taichungway.tw/press-release-traffic-smart-era-policy-launch

結果：收錄，出處識別碼 chiang-pr-39。

| 摘錄 | 結果 |
|---|---|
| 未來將鎖定學校、醫院與公共運輸節點優先推展人行友善步道 | 重述，併入 chiang-chi-chen-015 |
| 針對毒駕與酒駕採取零容忍，升級科技稽查精準篩檢 | 重述，併入 chiang-chi-chen-026 |
| 並強化道路燙平計畫，導入AI預警及循環材料 | 收錄為引述，chiang-chi-chen-024 |
| 江啟臣宣示將力拚捷運藍線早日完工、橘線及延伸線加速動工 | 收錄為引述，chiang-chi-chen-001 |
| 並推進鐵路海線雙軌與高架化 | 收錄為引述，chiang-chi-chen-013 |
| 同時推動公車司機待遇與服務品質雙升級 | 重述，併入 chiang-chi-chen-019 |
| 建構「20分鐘生活圈」密集接駁 | 重述，併入 chiang-chi-chen-144 |
| 未來更將推行「市民公車免費」以培養公共運輸習慣 | 重述，併入 chiang-chi-chen-016 |
| 將編列30億元打通單車路網斷點，串起「四線兩環一城」 | 收錄為引述，chiang-chi-chen-020 |
| 江啟臣主張整合臺74線、國道與生活圈路網形成「四環一線」 | 收錄為引述，chiang-chi-chen-006 |
| 並提出清泉崗機場擴建目標應直接上看1,000萬人次 | 收錄為引述，chiang-chi-chen-012 |
| 同時要求中央比照高雄港，將國道四號直接高架延伸進港區、優化聯外幹道 | 收錄為引述，chiang-chi-chen-008 |
| 針對高鐵特區也將規劃聯外專用匝道與拓寬平面道路 | 收錄為引述，chiang-chi-chen-014 |
| 江啟臣大膽提出「交通AI沙盒」與偏鄉無人公車、無人計程車 | 不收：是與會學者轉述，不是候選人本人的說法 |

### 帶著「臺中啟程」搶攻屯區！江啟臣市場掃街人氣旺 端銀髮社福政策顧長者

網址：https://taichungway.tw/press-release-tucheng-taiping-market-canvass

結果：收錄，出處識別碼 chiang-pr-40。

| 摘錄 | 結果 |
|---|---|
| 65歲以上健保免費絕對續行 | 收錄為引述，chiang-chi-chen-083 |
| 補助65歲以上市民施打帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 點數改採一年結算、計程車單趟折抵提高至200元，並擴大至醫療、藥局及農漁會使用 | 重述，併入 chiang-chi-chen-069 |
| 以AI改善臺74線交通 | 重述，併入 chiang-chi-chen-130 |
| 推動捷運藍線延伸太平、屯區捷運環狀線（紫線） | 重述，併入 chiang-chi-chen-005 |
| 捷運完成前先優化公車路網、班次與準點率 | 重述，併入 chiang-chi-chen-019 |
| 再推動市民免費搭乘 | 重述，併入 chiang-chi-chen-016 |
| 將結合實體AI、機器人及無人載具，協助太平、大里製造業升級 | 重述，併入 chiang-chi-chen-033 |

### 江啟臣提屯區交通藍圖 串聯捷運路網、打造20分鐘生活圈

網址：https://taichungway.tw/press-release-tunqu-transport-blueprint

結果：收錄，出處識別碼 chiang-pr-41。

| 摘錄 | 結果 |
|---|---|
| 將全力推動屯區環狀紫線，與捷運綠線串聯 | 收錄為引述，chiang-chi-chen-005 |
| 並推動藍線延伸太平、橘線通往大里及霧峰 | 收錄為引述，chiang-chi-chen-005 |
| 將依山、海、屯、城及高鐵等各區特色與需求，完善生活機能 | 重述，併入 chiang-chi-chen-144 |
| 布局STEAM教育據點 | 重述，併入 chiang-chi-chen-097 |
| 科學教育發展中心 | 重述，併入 chiang-chi-chen-095 |
| 結合新創、青創基地與國際導師資源，支持青年發展 | 重述，併入 chiang-chi-chen-044 |
| 同時持續興建社會住宅 | 收錄為引述，chiang-chi-chen-143 |
| 持續推動全齡友善交通 | 重述，併入 chiang-chi-chen-015 |
| 美樂地計畫 | 重述，併入 chiang-chi-chen-137 |

### 打造城市人文治理新篇章！江啟臣發布「臺中味」競選官網 匯聚市民故事擘畫未來藍圖

網址：https://taichungway.tw/press-release-website-launch

結果：不收。競選官網上線記者會的活動報導，介紹網站架構，沒有具體政見

### 敬老卡更好用、AI助加薪 江啟臣與婦團姊妹攜手打造幸福臺中

網址：https://taichungway.tw/press-release-women-support-association-launch

結果：收錄，出處識別碼 chiang-pr-42。

| 摘錄 | 結果 |
|---|---|
| 未來將成立由市長召集、跨局處的「婦幼發展委員會」 | 重述，併入 chiang-chi-chen-085 |
| 江啟臣主張將好孕專車使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 補助孕婦施打RSV疫苗 | 重述，併入 chiang-chi-chen-066 |
| 到宅月嫂服務補助時數提高至40小時 | 重述，併入 chiang-chi-chen-068 |
| 並研議人工生殖相關檢查補助 | 不收：原文是「研議」 |
| 江啟臣提出導入AI居家安全與防跌監測，優先關注獨居高齡女性 | 收錄為引述，chiang-chi-chen-078 |
| 並推動「好肌力計畫」，協助長輩維持肌力、保骨抗跌 | 重述，併入 chiang-chi-chen-077 |
| 同時推動帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 計程車單趟最高折抵200點，點數改為當年度內不歸零、年底結算，擴大掛號費折抵及農漁會、特約藥局限額採買保健品用途，並研議納入超商採買民生營養品 | 重述，併入 chiang-chi-chen-069 |
| 未來將成立「AI賦能學院」，協助婦女提升職場技能、增加薪資 | 收錄為引述，chiang-chi-chen-042 |
| 推動涵蓋就學、採買、就醫及長照的「20分鐘生活圈」，透過公車路網與班次加密 | 重述，併入 chiang-chi-chen-144 |

### 江啟臣迺夜市展現高人氣 提四大主軸造臺中國際雙港門戶

網址：https://taichungway.tw/press-release-wuchuan-nightmarket

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來將持續推動捷運橘線延伸並與藍線連線交會 | 重述，併入 chiang-chi-chen-002 |
| 透過捷運與高快速道路網，如生活圈四號道路等，串聯雙港與都會區 | 重述，併入 chiang-chi-chen-007 |
| 承諾將針對六十五歲以上弱勢族群評估補助包含「皮蛇」等疫苗費用 | 不收：原文是「評估補助」，視同研議（內容與江-03-8 相近） |
| 除了維持一千元額度及擴大搭乘計程車優惠外，未來可用於折抵特定診所掛號費、特定藥局拿藥、騎乘YouBike，並優先擴大至農漁會消費 | 重述，併入 chiang-chi-chen-069 |

### 江啟臣霧峰提「20分鐘生活圈」 串聯交通、就醫就學更便利

網址：https://taichungway.tw/press-release-wufeng-20-minute-city

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 未來要結合會展經濟，規劃文化深度旅遊，將參展人潮導入地方，串聯古蹟、農產與伴手禮 | 重述，併入 chiang-chi-chen-037 |
| 江啟臣主張推動捷運橘線服務霧峰 | 重述，併入 chiang-chi-chen-005 |
| 以「20分鐘生活圈」整合大里、太平、霧峰生活機能 | 重述，併入 chiang-chi-chen-144 |
| 當選後老人健保補助不會中斷 | 重述，併入 chiang-chi-chen-083 |
| 包括計程車每趟補助提高至200元、點數當月不歸零並於年底結算，擴大指定藥局、運動及農漁會一定額度採買等用途 | 重述，併入 chiang-chi-chen-069 |
| 補助65歲以上、經醫師評估適合接種的長輩施打帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 除推動免費營養午餐、提升餐食品質 | 重述，併入 chiang-chi-chen-101 |
| 也規劃每年至少由市府自籌10億元，改善校舍、廁所與跑道等設施 | 重述，併入 chiang-chi-chen-098 |

### 海空雙港帶動海線升級！江啟臣合體張清照、顏莉敏：迎風前進

網址：https://taichungway.tw/press-release-wuqi-briefing-sea-air-ports

結果：收錄，出處識別碼 chiang-pr-43。

| 摘錄 | 結果 |
|---|---|
| 江啟臣主張加速推動捷運藍線，強化與臺鐵海線的轉乘串聯 | 收錄為引述，chiang-chi-chen-001 |
| 推動國道四號清水端延伸及港區道路立體化，加速生活圈四號線延伸段，串聯烏日、大肚、龍井，補足「四環一線」路網 | 收錄為引述，chiang-chi-chen-007 |
| 他也將改革公車路線與班次，提升跨區運輸效率、加密生活圈內服務 | 重述，併入 chiang-chi-chen-019 |
| 結合就學、就業、就醫、就養機能，打造「20分鐘生活圈」 | 重述，併入 chiang-chi-chen-144 |
| 將結合AI、無人載具等技術推動升級，串聯中科及精密機械產業發展能量 | 重述，併入 chiang-chi-chen-033 |
| 計程車每趟最高扣抵200點、點數當年度內不歸零，並規劃擴大使用範圍至在地農漁會與特約藥局 | 重述，併入 chiang-chi-chen-069 |
| 他也主張推動65歲以上高風險長者帶狀疱疹疫苗補助 | 重述，併入 chiang-chi-chen-070 |
| 並擴大補助符合接種條件的嬰幼兒施打腸病毒A71型疫苗 | 收錄為引述，chiang-chi-chen-067 |
| 未來市府將每年至少編列10億元專款，加速更新老舊校舍、廁所、跑道及安全防墜設施 | 重述，併入 chiang-chi-chen-098 |

### 定位烏日「中臺灣第三大門戶」 江啟臣提交通解方、超前部署

網址：https://taichungway.tw/press-release-wuri-third-gateway

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 要加速推動鐵路高架化 | 重述，併入 chiang-chi-chen-013 |
| 烏日轉運中心 | 不收：只有設施名稱，沒有要做的事 |
| 完善公車路網與快速接駁系統 | 重述，併入 chiang-chi-chen-019 |
| 讓市民在20分鐘內滿足食衣住行育樂及就醫、就學需求 | 重述，併入 chiang-chi-chen-144 |
| 他與顏寬恒已積極向中央爭取國道一號及台74線增設匝道直通高鐵站 | 不收：原文是「已積極向中央爭取」，寫的是進行中的事 |

### 中秋前夕市場送暖！江啟臣拜票獲熱情相挺 承諾改善市場環境

網址：https://taichungway.tw/press-release-xiangshang-market-canvass

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 他將推動「傳統市場改造計畫」，從動線規劃、通風採光、環境衛生到周邊設施 | 重述，併入 chiang-chi-chen-053 |

### 江啟臣西屯談AI產業與會展經濟 力拚臺中躍升國際旗艦城

網址：https://taichungway.tw/press-release-xitun-briefing-ai-mice

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 並推進福林路、福順路、漢翔路、市政路延伸及特五號道路等建設 | 不收：描述進行中的道路建設，沒有新的任內承諾 |
| 以臺中精密機械、製造業基礎結合AI，打造「機器人製造之都」 | 重述，併入 chiang-chi-chen-033 |
| 並推動「會展經濟168」，發揮「前店後廠」優勢 | 重述，併入 chiang-chi-chen-035 |
| 以山城、海線、屯區、市區及高鐵門戶五大生活圈串聯大臺中，提升跨區公車效率、加密圈內班次 | 重述，併入 chiang-chi-chen-144 |
| 提供產後父母各3次心理諮商補助 | 重述，併入 chiang-chi-chen-065 |
| 將好孕專車使用期限延長至產後一年 | 重述，併入 chiang-chi-chen-086 |
| 推動親子車位免費停車4小時 | 重述，併入 chiang-chi-chen-087 |
| 並加速改善老舊校舍與廁所 | 重述，併入 chiang-chi-chen-098 |

### 江啟臣合體楊大鋐西屯懇託 承諾延續加碼盧秀燕政績「讓臺中超越臺中」

網址：https://taichungway.tw/press-release-xitun-dapeng-yang-dahong

結果：不收。拜票活動報導；文華公園撥用與共融公園是前議員楊正中說明的既有進度，候選人只講延續與加碼的口號

### 敬老卡計程車每趟最高抵200點！江啟臣西屯端長輩照護政見

網址：https://taichungway.tw/press-release-xitun-fushou-temple-briefing

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 江啟臣主張推動定額補助重症弱勢及65歲以上長輩接種帶狀疱疹疫苗 | 重述，併入 chiang-chi-chen-070 |
| 敬老愛心卡則維持每月1,000點，推動點數當年度內不歸零、計程車單趟最高折抵200點，並擴大農漁會及特約藥局限額使用 | 重述，併入 chiang-chi-chen-069 |
| 除持續爭取捷運藍線早日通車 | 重述，併入 chiang-chi-chen-001 |
| 盤點重整公車路網、加密生活圈內班次並優化轉乘 | 重述，併入 chiang-chi-chen-019 |

### 助攻西屯「會展經濟168」！江啟臣前進西屯市場拜票 提市場轉型升級兼顧在地生活

網址：https://taichungway.tw/press-release-xitun-market-canvass

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 提升市民採買與攤商營業的舒適度，推動傳統市場轉型升級 | 重述，併入 chiang-chi-chen-053 |

### 爭取專案補助特五號道路，終結西屯塞車惡夢

網址：https://taichungway.tw/press-release-xitun-special-5-road

結果：不收。會勘活動報導，內容是要求內政部與中科管理局分擔經費，沒有候選人任內要做的具體事項

### 增薪資、挺創業、減負擔 江啟臣攜青商夥伴打造臺中黃金十年

網址：https://taichungway.tw/press-release-youth-chamber-friends-launch

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 他主張擴大多元住宅供給，出續增社會住宅，也會研擬推出多元的可負擔住宅 | 不收：增加社會住宅的部分是重述江-05-15；可負擔住宅只寫「研擬」，視同研議 |
| 搭配托育服務與育兒補助升級 | 重述，併入 chiang-chi-chen-088 |
| 透過「20分鐘生活圈」補足各地生活機能 | 重述，併入 chiang-chi-chen-144 |
| 江啟臣提出打造「臺灣機器人製造城市（TRMC）」 | 重述，併入 chiang-chi-chen-033 |
| 並規劃成立「AI賦能學院」，協助勞工提升技能 | 重述，併入 chiang-chi-chen-042 |
| 他也主張將舊臺中縣議會轉型為旗艦級新創育成基地，連結國際導師、資金與市場 | 重述，併入 chiang-chi-chen-045 |
| 透過「會展經濟168」引進國際買家、拓展商機 | 重述，併入 chiang-chi-chen-035 |
| 成立「國際合作發展委員會」 | 重述，併入 chiang-chi-chen-127 |
| 「智慧城市發展委員會」 | 重述，併入 chiang-chi-chen-126 |
| 「婦幼發展委員會」 | 重述，併入 chiang-chi-chen-085 |

### 爭3.7億改建鋼便橋 江啟臣視察中橫便道 緊盯全線復建進度

網址：https://taichungway.tw/press-release-zhongheng-detour-bridge-inspection

結果：不收。以立委身分視察並回顧爭取經費的政績，對公路局與台電提出要求，沒有市長任內的具體承諾

### 掃街晚接早！江啟臣鐵人行程搏感情 跨年齡層搶合照

網址：https://taichungway.tw/press-release-zhongxiao-nantun-market-canvass

結果：收錄，出處識別碼 chiang-pr-44。

| 摘錄 | 結果 |
|---|---|
| 市府未來應全力推動友善採買與無障礙空間 | 重述，併入 chiang-chi-chen-053 |
| 實質協助夜市商圈與市場進行水電、衛生等硬體環境優化，並輔導攤商導入數位支付工具 | 重述，併入 chiang-chi-chen-049 |
| 他也計畫結合觀光行銷資源，精準導引外縣市與國際觀光客走入在地商圈 | 重述，併入 chiang-chi-chen-054 |
| 則將推動「環保永續夜市」概念，補助環保設備 | 收錄為引述，chiang-chi-chen-049 |
| 未來將著力於文化古蹟保存與街區文創活化 | 重述，併入 chiang-chi-chen-056 |
| 加速跨區交通瓶頸打通 | 重述，併入 chiang-chi-chen-025 |
| 公車路網優化 | 重述，併入 chiang-chi-chen-019 |
| 未來將在南屯及各新興人口移入區擴大公共托育、幼兒教保 | 收錄為引述，chiang-chi-chen-091 |
| 長照據點佈建 | 重述，併入 chiang-chi-chen-075 |
| 並全面升級敬老愛心卡多元功能 | 重述，併入 chiang-chi-chen-069 |

### 老張的無奈與「大腦加手腳」的實力｜臺中市長候選人江啟臣

網址：https://taichungway.tw/robot-manufacturing-city-ai-industry

結果：收錄，出處識別碼 chiang-page-18。

| 摘錄 | 結果 |
|---|---|
| 攜手「臺灣 AI 機器人產業大聯盟」，建立國際級戰略平台 | 收錄為引述，chiang-chi-chen-033 |
| 深化美國喬治亞理工學院與東海大學等校合作，在臺中打造專屬的機器人實驗示範園區。 | 收錄為引述，chiang-chi-chen-033 |
| 攜手 AIT 整合臺灣廠商與美國市場，吸引外商研發總部進駐 | 收錄為引述，chiang-chi-chen-033 |

### 雅婷媽媽的週末與「家門口的實驗室」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/robot-manufacturing-city-steam-education

結果：收錄，出處識別碼 chiang-page-19。

| 摘錄 | 結果 |
|---|---|
| 將跨學門的 STEAM（科學、科技、工程、藝術、數學）動手做教育，擴大推廣至幼兒到高中的各級示範學校。 | 收錄為引述，chiang-chi-chen-097 |
| 在山、海、屯、城各區廣泛布建社區科學探索據點 | 重述，併入 chiang-chi-chen-097 |
| 主動導入外部創意團隊與產學合作資源 | 重述，併入 chiang-chi-chen-097 |

### 陳老師的擔憂與「駕馭 AI 的底蘊」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/robot-manufacturing-city-tech-education

結果：收錄，出處識別碼 chiang-page-20。

| 摘錄 | 結果 |
|---|---|
| 正式成立專責的「科技教育發展中心」，統一調度全市的數位教育資源。 | 收錄為引述，chiang-chi-chen-095 |
| 由專責中心統一編組科技教材與師資 | 收錄為引述，chiang-chi-chen-095 |
| 把程式邏輯、微型機器人與生成式 AI 的基礎應用，用好玩、活潑的情境式體驗，深度融入從幼兒園到高中的課程裡 | 收錄為引述，chiang-chi-chen-095 |

### 阿順師的背影與「把手弄髒的驕傲」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/robot-manufacturing-city-vocational-training

結果：收錄，出處識別碼 chiang-page-21。

| 摘錄 | 結果 |
|---|---|
| 在教育局內大刀闊斧成立技職教育專責單位 | 收錄為引述，chiang-chi-chen-099 |
| 大幅增設「職業探索中心」，拉高學子參與職業探索的群科豐富度與頻率。 | 收錄為引述，chiang-chi-chen-096 |

### 建國哥的無電梯公寓與「不被遺忘的老屋」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/senior-care-age-friendly-housing

結果：收錄，出處識別碼 chiang-page-22。

| 摘錄 | 結果 |
|---|---|
| 市府將鎖定老舊住宅與人口密集社區，擴大推動老屋健檢 | 收錄為引述，chiang-chi-chen-029 |
| 針對高齡長輩進行屋內「機能延壽」的診斷與補助，從無障礙空間改善做起 | 收錄為引述，chiang-chi-chen-029 |
| 全面鼓勵並輔導民間住宅、公辦都更與社宅取得符合國內外標準的「銀髮住宅標章」 | 收錄為引述，chiang-chi-chen-032 |

### 陳阿公的嘆息與「不老氣的社區據點」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/senior-care-community-hubs

結果：收錄，出處識別碼 chiang-page-23。

| 摘錄 | 結果 |
|---|---|
| 承諾維持每月 1000 點不跳票，並首創點數當年度內不歸零（Card-control），沒用完的直接累積 | 收錄為引述，chiang-chi-chen-069 |
| 計程車單趟扣抵翻倍至 200 點、折抵 YouBike 2.0E 及長青學苑報名費 | 收錄為引述，chiang-chi-chen-069 |
| 每月可用部分點數至農會與特約藥局採買保健品，看病更是不限額折抵掛號費。 | 收錄為引述，chiang-chi-chen-069 |
| 依據長輩聚落的真實需求，打造如「銀髮文青沙龍」、「屋頂療癒農場」或「不老電競基地」等具備社區特色的長照 C 據點 | 收錄為引述，chiang-chi-chen-075 |

### 雅玲的醫院走廊與「不迷路的長照網」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/senior-care-long-term-care-office

結果：收錄，出處識別碼 chiang-page-24。

| 摘錄 | 結果 |
|---|---|
| 將衛生局的醫事照護與社會局的社福體系縫合，成立專責的「臺中市長照處」，統一調度全市資源。 | 收錄為引述，chiang-chi-chen-072 |
| 未來民眾只要一通電話或臨櫃，就能從失能評估、居家照顧到喘息服務一條龍搞定 | 收錄為引述，chiang-chi-chen-072 |
| 針對設籍臺中的重症弱勢族群與 65 歲以上長輩，在接受必要性的公衛檢查後，提供免預約、定額或全額的帶狀皰疹疫苗施打補助 | 收錄為引述，chiang-chi-chen-070 |

### 小涵的芋頭禮盒與「躍上國際的臺中味」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-agriculture-brand-upgrade

結果：收錄，出處識別碼 chiang-page-25。

| 摘錄 | 結果 |
|---|---|
| 市府將與在地頂尖設計師和青年創意團隊合作，翻新視覺識別，將大甲芋頭、外埔火龍果、新社香菇等在地驕傲，轉譯為精緻的故事內容。 | 收錄為引述，chiang-chi-chen-057 |
| 跨界聯名星級餐廳與風格餐飲，將臺中優質農產推向高端消費通路 | 收錄為引述，chiang-chi-chen-057 |
| 運用「臺中影響力主題館」帶著農民參與海內外大小展覽，並由新設立的「農漁牧加值平台」開拓新通路 | 收錄為引述，chiang-chi-chen-057 |

### 阿志的火龍果園與「口袋裡的農業專家」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-agriculture-disaster-alert

結果：收錄，出處識別碼 chiang-page-26。

| 摘錄 | 結果 |
|---|---|
| 首創針對特定產區、作物的「細胞簡訊」系統。一旦預測到天災，系統會精準鎖定該區農民手機主動發送指引 | 收錄為引述，chiang-chi-chen-060 |
| 升級現有網頁版系統，用最直覺、活潑的 APP 介面，將農民最關心的氣象預警、即時菜價與線上補助申請全面整合 | 收錄為引述，chiang-chi-chen-059 |
| 在 APP 內建「智慧專家線上診斷」，農民只要拍下作物生病的照片上傳，AI 就能即時辨識並給出建議 | 收錄為引述，chiang-chi-chen-059 |

### 林伯伯的腰酸與「走進田裡的實驗室」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-agriculture-university-partnership

結果：收錄，出處識別碼 chiang-page-27。

| 摘錄 | 結果 |
|---|---|
| 市府將大幅擴大智慧農業產學合作的專案補助，降低基層農民導入科技設備的財務門檻與風險。 | 收錄為引述，chiang-chi-chen-058 |
| 主動媒合中興大學等臺中在地的相關校系，將學術界的技術能量，直接帶進重要的農產區。 | 收錄為引述，chiang-chi-chen-058 |
| 都由學界與基層農會合作在耕地上實地驗證 | 收錄為引述，chiang-chi-chen-058 |

### 家豪的候車亭與「不再焦慮的通勤路」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-transport-public-transit

結果：收錄，出處識別碼 chiang-page-28。

| 摘錄 | 結果 |
|---|---|
| 加速捷運藍線通車與多線齊發。 | 重述，併入 chiang-chi-chen-001 |
| 結合豐原、水湳、臺中車站、烏日高鐵等四大轉運站，建立「四大節點高效快捷公車」，讓日常交通在 20 分鐘車程內搞定。 | 收錄為引述，chiang-chi-chen-017 |
| 將雙十公車升級為「臺中市民搭乘公車運輸全程免費」（含幹線、市區與捷運接駁）。 | 收錄為引述，chiang-chi-chen-016 |
| 由市府帶頭編列預算補貼，實質補足公車駕駛的薪資缺口，透過加薪解決駕駛荒 | 收錄為引述，chiang-chi-chen-019 |
| 試辦無人化公車並針對偏鄉導入無人計程車（Robotaxi）預約服務 | 收錄為引述，chiang-chi-chen-022 |

### 建佑的方向盤與「會思考的紅綠燈」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-transport-smart-roads

結果：收錄，出處識別碼 chiang-page-29。

| 摘錄 | 結果 |
|---|---|
| 針對各區展開覆蓋率更廣的「道路燙平計畫」。 | 收錄為引述，chiang-chi-chen-024 |
| 建置「全域智慧巡檢管理系統」，讓巡檢車上的 AI 即時自動辨識道路坑洞與標線磨損 | 收錄為引述，chiang-chi-chen-130 |
| 針對主要商圈與捷運樞紐，加速將低效率的平面停車場改建為高容納率的立體停車場，全面導入全自動智慧化停車服務 | 收錄為引述，chiang-chi-chen-023 |
| 逐步升級「全動態 AI 智慧號誌系統」，覆蓋主要交通瓶頸路口，依據即時車流無縫調節紅綠燈 | 收錄為引述，chiang-chi-chen-130 |

### 欣慧的推車與「最溫柔的最後一哩路」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/smart-transport-walkable-streets

結果：收錄，出處識別碼 chiang-page-30。

| 摘錄 | 結果 |
|---|---|
| 鎖定學校、醫院與大眾運輸樞紐周邊，展開人行道鋪面翻新與無障礙坡道優化，檢討行人庇護島 | 收錄為引述，chiang-chi-chen-015 |
| 加速擴充 iBike 2.0 E 電輔車數量，並率先全國試辦推動附設兒童安全座椅的「袋鼠車」（親子共享腳踏車） | 收錄為引述，chiang-chi-chen-021 |
| 市民搭乘免費公車後可累積綠色里程點數，點數可直接實質折抵 iBike 的騎乘費用 | 收錄為引述，chiang-chi-chen-134 |

### 阿明一家的週末與「不再匆忙的餘裕」｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taichung-20-minute-city

結果：收錄，出處識別碼 chiang-page-31。

| 摘錄 | 結果 |
|---|---|
| 讓市民在 20 分鐘內順暢移動。 | 重述，併入 chiang-chi-chen-144 |
| 將舊衛生局大樓改建升級為「豐原中興健康園區」。 | 收錄為引述，chiang-chi-chen-074 |
| 全面升級傳統市場為特色市場 | 重述，併入 chiang-chi-chen-053 |
| 在各區增設國民運動中心 | 重述，併入 chiang-chi-chen-071 |
| 在各區增設國民運動中心與「美樂地 Plus 共融療癒全齡公園」 | 重述，併入 chiang-chi-chen-137 |

### 臺中味道 Taichung Taste｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste

結果：不收。人物故事列表頁，只有各篇標題與引句，無政見

### 打開陳允寶泉五代傳承的時光寶盒：翁羿琦的百年餅藝｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-baoquan-bakery-weng-yi-qi

結果：不收。人物故事；按語只提到透過會展產業與國門計畫帶動烘焙業的期待，引用既有政見名稱（江-02-2、江-01-3），沒有新的具體內容

### 歲月沉澱的溫柔守護：最高齡議員「豐原媽祖婆」張瀞分的傳奇｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-councilor-zhang-jing-fen

結果：不收。人物故事；按語是對議員的致意，無政見

### 把善意做一萬次，陳淞屏的信仰與人生｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-fire-safety-chen-song-ping

結果：不收。人物故事；按語只有「用好的創業、勞動政策」吸引人才留在臺中的願景，無具體事項

### 從破產大亨到偏鄉暖爐：大坑「魚丸伯」吳明道的逆風人生｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-fishball-uncle-wu-ming-dao

結果：不收。人物故事；按語是個人感想，無政見

### 針線之間的時代溫度，利文雄、利士杰兩代職人的傳承與輝煌｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-great-taipei-tailor-li-family

結果：不收。人物故事；按語「透過產學合作，我們未來也要讓臺中技職教育復興」屬願景，沒有具體做法（主題與江-04-14 相近）

### 山城裡的書屋：張智清與東勢「哈佛書局」的文化使命｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-hafo-bookstore-zhang-zhi-qing

結果：不收。人物故事；按語「把文化當成投資」「讓文化走進巷弄」屬口號與願景，呼應江-04-24、江-04-22 的名稱但無具體內容

### 從臺中的山，到世界的茶：杜蒼林家族五代守住一杯茶的滋味｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-hgt-tea-du-cang-lin

結果：不收。人物故事；按語只說要讓在地企業有更好的環境成長，屬願景

### 山城裡的漆藝播種者：邱俊彰與「豐園漆資材行」的生活美學｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-lacquer-art-qiu-jun-zhang

結果：有政見內容，但都是重述或不收，不列為出處。

| 摘錄 | 結果 |
|---|---|
| 我也已經開始著手推動漆藝博物館活化振興，讓職人的工藝傳承，透過公部門的積極協助，再次振興豐原漆藝。 | 不收：原文是「已經開始著手推動」，寫的是進行中的事，沒有說任內要做什麼 |

### 雲端上的液態黃金：黃元政的極致茶葉職人精神！｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-lishan-tea-huang-yuan-zheng

結果：不收。人物故事；按語只談茶產業面臨的挑戰，無政見

### 不急著長大，只想把一件事做好：許立昇用時間釀出傳承的新滋味｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-miso-brewery-xu-li-sheng

結果：不收。人物故事；按語是對觀光工廠的評價，無政見

### 從袖珍藝術到揉麵美學：劉世欣推動「大呷麵本家」的品牌革命｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-noodle-brand-liu-shi-xin

結果：不收。人物故事；按語屬願景，無政見

### 一支球棒，讓世界看見臺中：陳致維的隱形冠軍之路｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-torpedo-bat-chen-zhi-wei

結果：不收。人物故事；按語「臺中AI智造」「守護臺中的產業」屬口號與品牌用語，無具體事項

### 從新加坡到臺中：因為愛，選擇留下來創造快樂｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-vender-bar-darren

結果：不收。人物故事；按語「讓更多的人願意來到臺中創業」「更友善的居住環境」屬願景，無具體事項

### 守護清水里，燃燒半世紀的熱情：陳安吉12屆的里長生涯｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-village-chief-chen-an-ji

結果：不收。人物故事；按語是對里長的致意，無政見

### 四十年，走在同一條街上：吳榮益守住的日常與人情｜臺中市長候選人江啟臣

網址：https://taichungway.tw/taste-story-village-chief-wu-rong-yi

結果：不收。人物故事；按語談治理理念與願景，無政見

### 臺中做事 Taichung Way｜臺中市長候選人江啟臣

網址：https://taichungway.tw/way

結果：不收。經歷與立委任內政績回顧（「爭取」經費、已完工建設）。少數帶未來時態的句子都是既有工程的進度或立委身分的持續爭取，例如「預計2026年年底東勢到石岡段通車」「持續爭取3.2億經費改善南區」「未來結合亞洲大學附設醫院，打造健康產業園區」（與江-03-12 相關）、「爭取捷運紅線到豐原」（與江-01-1 相關），都不是市長任內的新承諾

## 核對

2026-10-23 依 `docs/adr/0002-ai-verification-instead-of-human-review.md` 執行兩層核對。各輪結果與退回原因摘要見 `data/verification/report.md`。

- 第一層：149 筆全部通過，沒有修改引述。
- 第二層先以檢核表版本 1 跑：第 1 輪退回 54 筆，依理由改寫後第 2 輪全部通過。版本 1 的理由常寫出品牌用語與陣營高頻詞，理由會進公開資料集，上線關卡擋下，所以檢核表與提示詞升為版本 2（要求理由不寫出清單中的詞），全部重跑。
- 版本 2：第 1 輪退回 12 筆，第 2 輪退回 1 筆（chiang-chi-chen-045），第 3 輪全部通過。
- 同一筆累計退回（兩個版本合計）最多 2 次：chiang-chi-chen-006、chiang-chi-chen-045、chiang-chi-chen-077。沒有政見退回達三次，沒有刪除。
- 退回的摘要只依該筆自己的原文引述與退回理由修改，並符合抽取指示。修改由核對 session 撰寫，當時 repo 內只有江啟臣的政見資料，沒有其他候選人的資料可參考。修改後的摘要以 `data/raw/policies/chiang-chi-chen.json` 為準。

## 候選人資料

依 `data/extraction/candidate-profiles.md` 抽取，2026-10-23。

- 來源：第11屆立法委員選舉選舉公報（臺中市第8選舉區），出處 `chiang-bulletin-2024`。中選會選舉資料庫查得江啟臣參選 2024 年第11屆立法委員選舉（臺中市第08選區），用該次公報。
- PDF：2 頁，SHA-256 `824e329ad0cfa7997ceab43f6f0c73abfe79560e5b643516dc787abd1ca9b505`，取第 1 頁。
- 轉文字：pdftotext（poppler 26.10.0），沒有用字型對照還原。第 1 頁沒有「�」。
- 目視：PDF 第 1 頁以 `pdftoppm -r 300` 轉成圖片，逐字比對學歷 6 項、經歷 8 項與出生年月日，與快照相同。第 1 項學歷在公報上因欄寬分成「美國南卡羅萊納大學國際關係」「博士」兩行，接回一項。經歷第 8 項 pdftotext 轉出「《 時代 》」，空白是字距，依規則寫成「《時代》」。
- 姓名與政黨：公報號次 1「江啟臣」、推薦之政黨「中國國民黨」，中選會選舉資料庫同場選舉的 `cand_name`、`party_name` 相同，與候選人欄位的 `name`、`party` 一致。
- 出生年：公報「出生年月日：61 年 3 月 2 日」，換算為 1972。中選會選舉資料庫同場選舉的 `cand_birthday` 為 1972-03-02，相同。
- 存檔網址：Wayback Machine 回傳既有的存檔（2026-05-14）。
- 逐字比對：`node scripts/verify.js --profiles-only` 通過（2026-10-23）。
