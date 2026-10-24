// 畫面文案：給市民看、由程式產生的文字都集中在這裡。瀏覽器與 Node 共用，不得引用其他模組。
// 其他畫面模組不寫中文字串，test/ui-text.test.js 檢查。
// 上線關卡「受眾文案」掃這個檔案的每個字串：不得外漏檔案路徑、副檔名、工具名、字型名、模型代號、程式欄位名、
// 內部版本識別碼與內部流程術語。GLOSSARY 的術語是內部用語，畫面用白話，例如出處快照寫成「原文存檔」、
// 存檔網址寫成「網頁備份」。頁面骨架的固定文字寫在 HTML，同一關卡掃描。
// 關卡把樣板字串的運算式當空白，運算式裡不要再寫樣板字串。

// 核對結果。
const STATUS = { pending: '未核對', pass: '通過', fail: '不通過' };
const withDate = (text, date) => (date ? text + '（' + date + '）' : text);
const statusWithDate = ({ status, checkedAt }) => withDate(STATUS[status], checkedAt);

const LAYER1_NAME = '原文逐字比對';
const LAYER2_NAME = 'AI 依公開檢核表檢查';

// 政見的核對紀錄。兩道都通過時只寫一行與第二道的日期；模型與檢核表版本留在公開資料集，畫面不列。
export function verificationText({ layer1, layer2 }) {
  if (layer1.status === 'pass' && layer2.status === 'pass') {
    return `已通過核對：${LAYER1_NAME}、${LAYER2_NAME}（${layer2.checkedAt ?? layer1.checkedAt}）`;
  }
  return `${LAYER1_NAME}：${statusWithDate(layer1)}；${LAYER2_NAME}：${statusWithDate(layer2)}`;
}

// 候選人資料只有逐字比對一道核對。
export function profileVerificationText({ layer1 }) {
  const name = '學歷與經歷逐字比對原文';
  return layer1.status === 'pass' ? `已通過核對：${name}（${layer1.checkedAt}）` : `${name}：${statusWithDate(layer1)}`;
}

// 原文存檔的說明。抓取指令寫的轉換紀錄是給維護者的，畫面只在有字形還原時用白話說明，細節留在抽取紀錄。
// 抓取指令有字形還原時，轉換紀錄含 GLYPH_RESTORED_MARK（抓取指令引用同一個常數）。
export const GLYPH_RESTORED_MARK = '對照還原';
export const GLYPH_RESTORED_TEXT = '部分文字因原始檔案的字型無法直接轉成文字，已比對公報影像逐字還原。';
export const snapshotNoteText = (note) => (note && note.includes(GLYPH_RESTORED_MARK) ? GLYPH_RESTORED_TEXT : null);

export const rawPolicyItemsText = ({ total }) => (total === null ? '原始政見條目尚未統計' : `原始政見條目共 ${total} 項`);
export const candidateCountText = (areaPolicyCount, rawPolicyItems) =>
  `此議題區 ${areaPolicyCount} 筆政見，${rawPolicyItemsText(rawPolicyItems)}`;

// 沒有政見與篩選結果。
export const NO_POLICY_LABEL = '未提出相關政見';
export const noPolicyText = (cutoffDate) => `${NO_POLICY_LABEL}（截至 ${cutoffDate}）`;
export const NO_MATCH_TEXT = '沒有符合篩選條件的政見';
export function resultStatusText(filtered) {
  if (!filtered.filter.active) return '';
  const { matchCount } = filtered.filter;
  if (matchCount === 0) return `${NO_MATCH_TEXT}。`;
  return `符合篩選條件的政見共 ${matchCount} 筆，分布在 ${filtered.rows.length} 個議題區。`;
}

// 出處的連結文字，政見卡片與候選人資料卡共用。
export const SOURCE_TEXT = {
  link: '出處',
  snapshot: '原文存檔',
  archive: '網頁備份',
  titleWithDate: (title, date) => `${title}（${date} 擷取）`,
};

// 對話框共用（政見卡片與候選人資料卡；手機為底部抽屜）。
export const DIALOG_TEXT = {
  close: '關閉',
  handle: '切換卡片高度',
};

// 政見卡片。
export const POLICY_CARD_TEXT = {
  areaLink: '這個議題區的連結',
  policyLink: '這筆政見的連結',
  areaDescription: (description, departments) => `${description}（對應局處：${departments.join('、')}）`,
  conflict: '出處說法不一：',
  conflictFlag: '出處說法不一',
  districts: '適用行政區',
  districtsLine: (names) => `適用行政區：${names}`,
  noDistricts: '未指定',
  verification: '核對紀錄',
  eyebrow: '議題區',
  tabsLabel: '候選人',
  enlarge: '放大卡片',
  shrink: '縮小卡片',
  expandAll: '全部展開',
  collapseAll: '全部收合',
  // 卡片內的篩選，三欄一起套用。
  filtersLabel: '在這個議題區篩選政見',
  searchLabel: '在這個議題區找政見的關鍵字',
  searchPlaceholder: '在這個議題區找關鍵字',
  allDistricts: '全部行政區',
  // 篩選時欄頭的第二行，三欄同一句型。
  columnMatch: (matchCount) => `符合篩選條件 ${matchCount} 筆`,
  filterStatus({ active, matchCount }) {
    if (!active) return '';
    if (matchCount === 0) return '這個議題區沒有符合篩選條件的政見。';
    return `這個議題區符合篩選條件的政見共 ${matchCount} 筆。`;
  },
};

// 候選人資料卡。
export const PROFILE_TEXT = {
  title: '候選人資料',
  note: '中選會公開資料，逐字呈現。',
  empty: '尚未收錄候選人資料',
  fields: { birthYear: '出生年', education: '學歷', experience: '經歷' },
  sourceLabel: '資料來源：',
  origin: (sourceTypeName, year, electionName) => `中選會${sourceTypeName}，${year} 年${electionName}`,
  snapshotNoteLabel: '原文存檔說明：',
  markerTitle: '島上標記',
  cardLink: '這張候選人資料卡的連結',
};

// 表格檢視。
export const TABLE_TEXT = {
  caption: '各議題區候選人政見對照表',
  areaHead: '議題區',
  openCard: '看政見卡片',
  openProfile: '看候選人資料',
  ballotNumber: (n) => `${n} 號`,
  policyCount: (n) => `公開政見 ${n} 筆`,
  districts: (names) => `適用行政區：${names.join('、')}`,
};

// 索引面板的標記。
export const MARKER_TEXT = {
  lit: '有政見',
  legendNote: '亮起表示有政見，灰色表示沒有；標記不表示政見多寡。',
  state: (name, state) => `${name}：${state}`,
  // 螢幕閱讀器念的版本，接在標記符號之後。
  spoken: (name, state) => `${name}${state}`,
};

// 島嶼檢視與工具列。
// auto 是「自動」：依台灣時間選時段。
export const TIME_NAMES = { auto: '自動', dawn: '清晨', day: '白天', dusk: '黃昏', night: '夜晚' };
export const ISLAND_TEXT = {
  plaza: '候選人廣場',
  timeCycle: (name) => `切換時段，目前${name}`,
  timeCycleAuto: (name) => `切換時段，目前自動（${name}）`,
  pause: '暫停',
  play: '播放',
  loadFailed: '島嶼檢視載入失敗，已改用表格檢視。',
  noWebgl: '此裝置無法顯示島嶼檢視，已改用表格檢視。',
};

// 頁首的隨機一題按鈕：只以議題區為單位，不提任何候選人。
export const RANDOM_AREA_TEXT = {
  button: '隨機看一題',
  hint: '隨機選一個議題區，三位候選人的政見並排',
};

// 上手導覽：三步，每一步只以議題區為單位，不提任何候選人。頁首「怎麼看」按鈕可重開。
export const TOUR_TEXT = {
  open: '怎麼看',
  openHint: '再看一次網站的使用說明',
  skip: '跳過',
  next: '下一步',
  done: '開始逛',
  count: (n, total) => `${n} / ${total}`,
  steps: {
    area: {
      title: '每一格是一個議題區',
      body: '島上每一格是一個議題區，名牌上的編號和索引裡的編號相同。點一下格子，就會打開這個議題區的政見卡片。',
    },
    markers: {
      title: '三個標記：有沒有政見',
      body: '每一格都有 ○ △ □ 三個一樣大的標記，依排序代表三位候選人。亮起表示在這個議題區有政見，灰色表示沒有。標記只看有沒有，不代表政見多寡。',
    },
    random: {
      title: '同一個議題，三人對照',
      body: `這是隨機選出的一個議題區。同一張卡片裡有三位候選人的政見摘要，沒有政見的也照樣列出；每筆都附原文引述與出處，點出處可以看原文。之後按頁首的「${RANDOM_AREA_TEXT.button}」可以再換一題。`,
    },
  },
};

// 工具列的背景音樂開關（用按下與否表示開或關，名稱固定）與音量滑桿。
export const MUSIC_TEXT = {
  button: '背景音樂',
  volume: '音樂音量',
};

// 載入失敗。錯誤細節只寫進瀏覽器主控台，畫面不顯示。
export const LOAD_TEXT = {
  datasetFailed: '政見資料載入失敗，請稍後重新整理。',
  // 填在整理方法頁「資料截止日：…。」句中，句號由頁面提供。
  methodDatasetFailed: '資料載入失敗，請稍後重新整理',
  documentsFailed: '文件載入失敗，請稍後重新整理。',
  documentFailed: '這份文件載入失敗，可改到 GitHub 查看。',
};

// 整理方法頁。
export const METHOD_TEXT = {
  allHaveSources: '每位候選人都已有一手來源。',
  dataStatus: (name, status) => `${name}：${status}`,
  currentRule: '（目前採用）',
  documentLabel: '公開原文',
  originalFile: '原始檔案',
  viewOnGithub: '在 GitHub 查看',
  missing: '尚未產生',
  brandTermTiers: { brand: '品牌用語', frequent: '陣營高頻詞' },
  // 以下用在逐字公開的清單（檢核表、品牌用語清單）裡，版本是原檔欄位值，照原檔公開。
  listVersion: (version) => `版本 ${version}`,
  tierHeading: (label, count) => `${label}（${count} 個）`,
};

// 整理方法頁照原文公開的文件：白話標題與一句說明（以文件識別碼對應 repo-documents.js 的清單）。
export const REPO_DOCUMENT_TEXT = {
  'classification-rules': { title: '分類規則', description: '一條政見要歸入哪個議題區、議題區怎麼劃分的判斷準則。' },
  checklist: { title: '檢核表', description: 'AI 檢查每條政見摘要時逐項對照的項目。' },
  'layer2-prompt': { title: 'AI 核對指示', description: '每條政見交給 AI 檢查時使用的完整指示，三位候選人共用。' },
  'extraction-instructions': { title: '政見整理指示', description: 'AI 從候選人公開資料整理出政見、原文引述與摘要時依循的指示。' },
  'candidate-profiles': { title: '候選人資料整理方法', description: '從中選會選舉公報逐字摘錄學歷與經歷，以及核對文字的步驟。' },
  'verification-report': { title: '核對報告', description: '各候選人政見的核對通過率、退回次數與刪除筆數。' },
  'local-elements': { title: '元素清單說明', description: '島上在地感元素的選取原則與每項元素的理由。' },
  'brand-terms-rules': { title: '品牌用語清單說明', description: '哪些詞算候選人的品牌用語，以及本站怎麼避開。' },
  'brand-terms': { title: '品牌用語清單', description: '本站文字不得使用的品牌用語與陣營高頻詞。' },
  'forbidden-colors': { title: '禁用色範圍', description: '本站配色不得使用的政黨色與候選人識別色範圍。' },
  'adr-neutrality': { title: '中立規則（決策紀錄）', description: '本站中立規則的完整原文與理由。' },
  'adr-verification': { title: '以 AI 核對取代人工審查（決策紀錄）', description: '為什麼不靠人工逐筆審查，改用兩道核對與公開流程。' },
};
