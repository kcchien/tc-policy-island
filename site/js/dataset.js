// 政見資料集：原始資料 → 驗證結構 → 排除未通過核對的政見 → 排列候選人 → 公開資料集。
// 瀏覽器與 Node 共用，不得引用 node: 模組。欄位的唯一定義是 SCHEMAS，說明見 AGENTS.md「資料結構」。

export const SOURCE_TYPES = {
  'official-website': '官網',
  'official-facebook': '官方臉書',
  'policy-presentation': '政見發表會',
  'election-bulletin': '選舉公報',
};

// 台中市 29 區正式名稱，順序依台中市政府「二十九區行政區」頁面。
export const TAICHUNG_DISTRICTS = [
  '中區', '東區', '西區', '南區', '北區', '西屯區', '南屯區', '北屯區',
  '豐原區', '大里區', '太平區', '清水區', '沙鹿區', '大甲區', '東勢區',
  '梧棲區', '烏日區', '后里區', '神岡區', '大雅區', '潭子區', '龍井區',
  '外埔區', '大安區', '新社區', '石岡區', '和平區', '大肚區', '霧峰區',
];

// 在地感元素只收這三類，見 ADR 0001 與 docs/rules/local-elements.md。
export const LOCAL_ELEMENT_CATEGORIES = ['自然景觀', '小吃', '老建築'];

// 核對狀態：pending 未核對、pass 通過、fail 不通過（第二層稱退回）。
export const VERIFICATION_STATUSES = ['pending', 'pass', 'fail'];

// 候選人排序規則。key 是排序依據的欄位，note 是頁面上的排序規則說明。
export const CANDIDATE_ORDER_RULES = {
  'name-strokes': { key: 'nameStrokes', keyName: '姓名筆畫', note: '候選人排列依姓名筆畫由少到多（號次抽籤前）' },
  'ballot-number': { key: 'ballotNumber', keyName: '號次', note: '候選人排列依選委會抽籤號次' },
};

// 全部候選人都有號次才依號次；沒有候選人或尚未抽籤都依筆畫。
export function candidateOrderOf(candidates) {
  const byBallot = candidates.length > 0 && candidates.every((c) => c.ballotNumber !== null);
  return byBallot ? 'ballot-number' : 'name-strokes';
}

export class DatasetValidationError extends Error {
  constructor(errors) {
    super(`原始資料有 ${errors.length} 處錯誤：\n${errors.join('\n')}`);
    this.name = 'DatasetValidationError';
    this.errors = errors;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

// 欄位型別。型別名稱結尾加 ? 表示可為 null；SCHEMAS 的欄位名結尾加 ? 表示可以沒有這個欄位（建置時才加的欄位）。
const TYPES = {
  string: { desc: '非空字串', ok: (v) => typeof v === 'string' && v.trim() !== '' },
  int: { desc: '正整數', ok: (v) => Number.isInteger(v) && v > 0 },
  count: { desc: '非負整數', ok: (v) => Number.isInteger(v) && v >= 0 },
  date: { desc: 'YYYY-MM-DD 日期', ok: (v) => typeof v === 'string' && DATE.test(v) },
  url: { desc: 'http(s) 網址', ok: (v) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v) },
  sha256: { desc: '64 位小寫十六進位雜湊', ok: (v) => typeof v === 'string' && SHA256.test(v) },
  strings: { desc: '字串陣列', ok: (v) => Array.isArray(v) && v.every((s) => TYPES.string.ok(s)) },
  axial: { desc: '[q, r] 整數座標', ok: (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger) },
  sourceType: { desc: `其中之一：${Object.keys(SOURCE_TYPES).join('、')}`, ok: (v) => typeof v === 'string' && Object.hasOwn(SOURCE_TYPES, v) },
  status: { desc: `其中之一：${VERIFICATION_STATUSES.join('、')}`, ok: (v) => VERIFICATION_STATUSES.includes(v) },
  elementCategory: { desc: `其中之一：${LOCAL_ELEMENT_CATEGORIES.join('、')}`, ok: (v) => LOCAL_ELEMENT_CATEGORIES.includes(v) },
  array: { desc: '陣列', ok: Array.isArray },
  object: { desc: '物件', ok: (v) => v !== null && typeof v === 'object' && !Array.isArray(v) },
};

const SCHEMAS = {
  meta: {
    dataCutoffDate: 'date',
    checklistVersion: 'string?',
    // 選舉時程（原始資料放 election-schedule.json，建置時併進 meta），null 表示沒有資料，畫面不顯示。
    electionSchedule: 'object?',
    'electionSchedule.votingDate': 'date',
    'electionSchedule.events': 'array',
  },
  // 選舉時程的一個事件。日期只取中選會或選舉委員會的公告，sourceUrl 是公告網址；endDate 是期間的最後一天。
  electionEvent: {
    id: 'string',
    name: 'string',
    date: 'date',
    endDate: 'date?',
    sourceUrl: 'url',
    sourceTitle: 'string',
  },
  candidate: {
    id: 'string',
    name: 'string',
    party: 'string',
    ballotNumber: 'int?',
    nameStrokes: 'int',
    rawPolicyItems: 'object',
    'rawPolicyItems.total': 'count?',
    'rawPolicyItems.sourceIds': 'strings',
    dataStatus: 'string?',
    // 僅建置時加入；正式肖像的完整來源與授權證據在肖像清單，三人全有或全無。
    'portrait?': 'object',
    'portrait.url': 'string',
    'portrait.sourceId': 'string',
    'portrait.electionYear': 'int',
    'portrait.retrievedAt': 'date',
    // 候選人資料（中選會登記資料），null 表示尚未收錄。學歷與經歷逐字照出處，逐字比對通過才公開。
    profile: 'object?',
    'profile.birthYear': 'int',
    'profile.education': 'strings',
    'profile.experience': 'strings',
    'profile.sourceId': 'string',
    'profile.electionYear': 'int',
    'profile.electionName': 'string',
    'profile.verification': 'object',
    'profile.verification.layer1': 'object',
    'profile.verification.layer1.status': 'status',
    'profile.verification.layer1.checkedAt': 'date?',
  },
  issueArea: {
    id: 'string',
    name: 'string',
    departments: 'strings',
    description: 'string',
    axial: 'axial',
    localElementId: 'string?',
  },
  localElement: {
    id: 'string',
    name: 'string',
    category: 'elementCategory',
    place: 'string',
    reason: 'string',
  },
  // 島上沒有議題區的格子，只為了讓島排出台中市輪廓。
  decorativeTile: {
    id: 'string',
    axial: 'axial',
    localElementId: 'string?',
  },
  source: {
    id: 'string',
    candidateId: 'string',
    url: 'url',
    archiveUrl: 'url?',
    archiveError: 'string?',
    snapshotPath: 'string',
    snapshotSha256: 'sha256',
    // 出處快照的產生方式說明，例如 PDF 轉文字的工具與還原方法；直接取自網頁可見文字時為 null。
    snapshotNote: 'string?',
    sourceType: 'sourceType',
    title: 'string',
    retrievedAt: 'date',
  },
  policy: {
    id: 'string',
    candidateId: 'string',
    issueAreaId: 'string',
    summary: 'string',
    quotes: 'array',
    districts: 'strings',
    conflictNote: 'string?',
    // 政見音檔相對網站根目錄的位置。只在公開資料集，建置時每條公開政見都有相符音檔才全部加上，否則全部沒有（全有或全無）。
    'audioUrl?': 'string?',
    verification: 'object',
    'verification.layer1': 'object',
    'verification.layer1.status': 'status',
    'verification.layer1.checkedAt': 'date?',
    'verification.layer2': 'object',
    'verification.layer2.status': 'status',
    'verification.layer2.reason': 'string?',
    'verification.layer2.checklistVersion': 'string?',
    'verification.layer2.model': 'string?',
    'verification.layer2.checkedAt': 'date?',
  },
  quote: {
    text: 'string',
    sourceId: 'string',
  },
};

const LABELS = { meta: '中繼資料', electionEvent: '選舉時程事件', candidate: '候選人', issueArea: '議題區', localElement: '元素', decorativeTile: '裝飾格', source: '出處', policy: '政見' };

function lookup(record, path) {
  let value = record;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || !(key in value)) return { missing: true };
    value = value[key];
  }
  return { missing: false, value };
}

// 依欄位表檢查一筆資料；父欄位缺漏、型別錯誤或為 null 時不再檢查其子欄位。
function checkFields(record, schema, where, errors) {
  const broken = [];
  const empty = [];
  for (const [key, spec] of Object.entries(schema)) {
    const omittable = key.endsWith('?');
    const path = omittable ? key.slice(0, -1) : key;
    if ([...broken, ...empty].some((parent) => path.startsWith(`${parent}.`))) continue;
    const { missing, value } = lookup(record, path);
    if (missing && omittable) {
      empty.push(path);
      continue;
    }
    if (missing) {
      errors.push(`${where}：缺少欄位 ${path}`);
      broken.push(path);
      continue;
    }
    const nullable = spec.endsWith('?');
    const type = TYPES[spec.replace('?', '')];
    if (nullable && value === null) {
      empty.push(path);
      continue;
    }
    if (!type.ok(value)) {
      errors.push(`${where}：欄位 ${path} 應為${type.desc}${nullable ? '或 null' : ''}，實際為 ${JSON.stringify(value)}`);
      broken.push(path);
    }
  }
  return broken.length === 0;
}

// 回傳欄位全部合法的資料，以及所有帶識別碼的資料（供參照檢查，避免一處欄位錯誤連帶產生參照錯誤）。
function checkList(raw, key, kind, errors) {
  const list = raw?.[key];
  if (!Array.isArray(list)) {
    errors.push(`原始資料：${key} 應為陣列`);
    return { valid: [], byId: new Map() };
  }
  const byId = new Map();
  const valid = [];
  list.forEach((record, index) => {
    const id = record?.id;
    const hasId = TYPES.string.ok(id);
    const where = `${LABELS[kind]} ${hasId ? id : `#${index}`}`;
    if (!TYPES.object.ok(record)) {
      errors.push(`${where}：應為物件`);
      return;
    }
    if (hasId && byId.has(id)) errors.push(`${where}：識別碼重複`);
    if (hasId) byId.set(id, record);
    if (checkFields(record, SCHEMAS[kind], where, errors)) valid.push(record);
  });
  return { valid, byId };
}

function checkCandidates(candidates, sourcesById, errors) {
  const withBallot = candidates.filter((c) => c.ballotNumber !== null);
  if (withBallot.length > 0 && withBallot.length < candidates.length) {
    errors.push('候選人：號次只有部分填寫，須全部填寫（抽籤後）或全部為 null（抽籤前）');
  }
  const rule = CANDIDATE_ORDER_RULES[candidateOrderOf(candidates)];
  const seen = new Map();
  for (const c of candidates) {
    if (seen.has(c[rule.key])) {
      errors.push(`候選人 ${c.id}：${rule.keyName}與 ${seen.get(c[rule.key])} 相同，無法決定排序`);
    }
    seen.set(c[rule.key], c.id);
    const refs = c.rawPolicyItems.sourceIds.map((sourceId) => ({ field: 'rawPolicyItems.sourceIds', sourceId }));
    if (c.profile !== null) refs.push({ field: 'profile.sourceId', sourceId: c.profile.sourceId });
    for (const { field, sourceId } of refs) {
      const source = sourcesById.get(sourceId);
      if (!source) errors.push(`候選人 ${c.id}：${field} 指向不存在的出處 ${sourceId}`);
      else if (source.candidateId !== c.id) errors.push(`候選人 ${c.id}：${field} 的出處 ${sourceId} 屬於候選人 ${source.candidateId}`);
    }
    if (c.profile !== null && c.profile.verification.layer1.status !== 'pending' && c.profile.verification.layer1.checkedAt === null) {
      errors.push(`候選人 ${c.id}：候選人資料逐字比對已有結果，profile.verification.layer1.checkedAt 不得為 null`);
    }
  }
}

// 議題區與裝飾格共用島上的格子：座標不得重複，每個在地感元素只放一格。
function checkTiles(tiles, elementIds, errors) {
  const seen = new Map();
  const elementOwner = new Map();
  for (const { tile, label } of tiles) {
    const where = `${label} ${tile.id}`;
    const key = tile.axial.join(',');
    if (seen.has(key)) errors.push(`${where}：軸向座標 [${key}] 與 ${seen.get(key)} 重複`);
    seen.set(key, tile.id);
    const elementId = tile.localElementId;
    if (elementId === null) continue;
    if (!elementIds.has(elementId)) errors.push(`${where}：localElementId 指向不存在的元素 ${elementId}`);
    else if (elementOwner.has(elementId)) errors.push(`${where}：在地感元素 ${elementId} 已放在${elementOwner.get(elementId)}，每個在地感元素只放一格`);
    else elementOwner.set(elementId, where);
  }
}

function checkVerification(where, { layer1, layer2 }, errors) {
  if (layer1.status !== 'pending' && layer1.checkedAt === null) {
    errors.push(`${where}：第一層核對已有結果，verification.layer1.checkedAt 不得為 null`);
  }
  if (layer2.status !== 'pending') {
    for (const field of ['reason', 'checklistVersion', 'model', 'checkedAt']) {
      if (layer2[field] === null) errors.push(`${where}：第二層核對已有結果，verification.layer2.${field} 不得為 null`);
    }
  }
}

function checkPolicy(policy, refs, errors) {
  const where = `政見 ${policy.id}`;
  if (!refs.candidateIds.has(policy.candidateId)) errors.push(`${where}：candidateId 指向不存在的候選人 ${policy.candidateId}`);
  if (!refs.issueAreaIds.has(policy.issueAreaId)) errors.push(`${where}：issueAreaId 指向不存在的議題區 ${policy.issueAreaId}`);
  if (policy.quotes.length === 0) errors.push(`${where}：quotes 至少要有一則原文引述`);
  policy.quotes.forEach((quote, index) => {
    const quoteWhere = `${where} 的 quotes[${index}]`;
    if (!TYPES.object.ok(quote)) {
      errors.push(`${quoteWhere}：應為物件`);
      return;
    }
    if (!checkFields(quote, SCHEMAS.quote, quoteWhere, errors)) return;
    const source = refs.sourcesById.get(quote.sourceId);
    if (!source) errors.push(`${quoteWhere}：sourceId 指向不存在的出處 ${quote.sourceId}`);
    else if (source.candidateId !== policy.candidateId) errors.push(`${quoteWhere}：出處 ${quote.sourceId} 屬於候選人 ${source.candidateId}，不是 ${policy.candidateId}`);
  });
  const districts = new Set();
  for (const district of policy.districts) {
    if (!TAICHUNG_DISTRICTS.includes(district)) errors.push(`${where}：districts 含非台中市行政區正式名稱「${district}」`);
    if (districts.has(district)) errors.push(`${where}：districts 重複列出「${district}」`);
    districts.add(district);
  }
  checkVerification(where, policy.verification, errors);
}

// 中選會與各選舉委員會的網站都在 cec.gov.tw 底下（例如 web.cec.gov.tw/tcec 是臺中市選舉委員會）。
const ELECTION_AUTHORITY_URL = /^https:\/\/([a-z0-9-]+\.)*cec\.gov\.tw\//;

// 選舉時程只收中選會或選舉委員會的公告（ADR 0001）。
function checkElectionSchedule(schedule, errors) {
  const seen = new Set();
  schedule.events.forEach((event, index) => {
    const hasId = TYPES.string.ok(event?.id);
    const where = `${LABELS.electionEvent} ${hasId ? event.id : `#${index}`}`;
    if (!TYPES.object.ok(event)) {
      errors.push(`${where}：應為物件`);
      return;
    }
    if (hasId && seen.has(event.id)) errors.push(`${where}：識別碼重複`);
    if (hasId) seen.add(event.id);
    if (!checkFields(event, SCHEMAS.electionEvent, where, errors)) return;
    if (event.endDate !== null && event.endDate < event.date) errors.push(`${where}：endDate ${event.endDate} 早於 date ${event.date}`);
    if (!ELECTION_AUTHORITY_URL.test(event.sourceUrl)) errors.push(`${where}：sourceUrl 須是中選會或選舉委員會網站（cec.gov.tw）的公告，實際為 ${event.sourceUrl}`);
  });
}

export function validateRawData(raw) {
  const errors = [];
  if (!TYPES.object.ok(raw?.meta)) errors.push('原始資料：缺少 meta');
  else if (checkFields(raw.meta, SCHEMAS.meta, LABELS.meta, errors) && raw.meta.electionSchedule !== null) {
    checkElectionSchedule(raw.meta.electionSchedule, errors);
  }
  const candidates = checkList(raw, 'candidates', 'candidate', errors);
  const issueAreas = checkList(raw, 'issueAreas', 'issueArea', errors);
  const localElements = checkList(raw, 'localElements', 'localElement', errors);
  const decorativeTiles = checkList(raw, 'decorativeTiles', 'decorativeTile', errors);
  const sources = checkList(raw, 'sources', 'source', errors);
  const policies = checkList(raw, 'policies', 'policy', errors);

  const refs = {
    candidateIds: new Set(candidates.byId.keys()),
    issueAreaIds: new Set(issueAreas.byId.keys()),
    sourcesById: sources.byId,
  };
  for (const source of sources.valid) {
    if (!refs.candidateIds.has(source.candidateId)) errors.push(`出處 ${source.id}：candidateId 指向不存在的候選人 ${source.candidateId}`);
  }
  if (Array.isArray(raw?.candidates) && raw.candidates.length === 0) errors.push('候選人：至少要有一位候選人');
  checkCandidates(candidates.valid, refs.sourcesById, errors);
  checkTiles([
    ...issueAreas.valid.map((tile) => ({ tile, label: LABELS.issueArea })),
    ...decorativeTiles.valid.map((tile) => ({ tile, label: LABELS.decorativeTile })),
  ], new Set(localElements.byId.keys()), errors);
  for (const policy of policies.valid) checkPolicy(policy, refs, errors);
  return errors;
}

export function isVerified(policy) {
  const { layer1, layer2 } = policy.verification;
  return layer1.status === 'pass' && layer2.status === 'pass';
}

// 有號次（已抽籤）照號次，否則照姓名筆畫。見 ADR 0001。
export function orderCandidates(candidates) {
  const candidateOrder = candidateOrderOf(candidates);
  const { key } = CANDIDATE_ORDER_RULES[candidateOrder];
  return {
    candidateOrder,
    candidates: [...candidates].sort((a, b) => a[key] - b[key]),
  };
}

// 候選人資料只有逐字比對通過才公開（沒有摘要，不做第二層）。見 ADR 0001。
export function isProfileVerified(profile) {
  return profile !== null && profile.verification.layer1.status === 'pass';
}

// 公開的出處：被公開政見引用、作為候選人原始政見條目總數的依據，或是公開候選人資料的出處。
function publicSourceIds(candidates, policies) {
  return new Set([
    ...candidates.flatMap((c) => c.rawPolicyItems.sourceIds),
    ...candidates.filter((c) => c.profile !== null).map((c) => c.profile.sourceId),
    ...policies.flatMap((p) => p.quotes.map((q) => q.sourceId)),
  ]);
}

// builtAt 由呼叫端傳入（ISO 8601 字串），讓本函式保持純函式。
export function buildPublicDataset(raw, { builtAt = null } = {}) {
  const errors = validateRawData(raw);
  if (errors.length > 0) throw new DatasetValidationError(errors);
  const copy = structuredClone(raw);
  const { candidateOrder, candidates } = orderCandidates(copy.candidates.map((c) => ({
    ...c,
    profile: isProfileVerified(c.profile) ? c.profile : null,
  })));
  // 原始資料不能自行帶出未經檔案與授權核對的肖像；只由建置指令加入。
  for (const candidate of candidates) delete candidate.portrait;
  const policies = copy.policies.filter(isVerified);
  const sourceIds = publicSourceIds(candidates, policies);
  return {
    meta: { ...copy.meta, candidateOrder, builtAt },
    candidates,
    issueAreas: copy.issueAreas,
    localElements: copy.localElements,
    decorativeTiles: copy.decorativeTiles,
    sources: copy.sources.filter((s) => sourceIds.has(s.id)),
    policies,
  };
}
