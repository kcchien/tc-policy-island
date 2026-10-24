// 候選人正式肖像：核對中選會公報或立法院委員頁、姓名對應、原圖與成品、各站授權，建置與關卡共用。
// Node 專用；不依臉部推斷身分，姓名欄與影像物件的對應由抽取者目視核對並記錄。
import { createHash } from 'node:crypto';

export const PORTRAIT_DIR = 'portraits';
export const PORTRAIT_MANIFEST = 'manifest.json';
export const PORTRAIT_SIZE = { width: 240, height: 320 };
export const PORTRAIT_DECLARATION = 'https://web.cec.gov.tw/central/article/21322';
export const LY_PORTRAIT_DECLARATION = 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=10772';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const cec = (value) => typeof value === 'string' && /^https:\/\/([a-z0-9-]+\.)*cec\.gov\.tw\//.test(value);

// readImage(file) 回傳 Buffer 或 null。檔名先核對，非法路徑不交給讀檔函式。
export function portraitProblems(dataset, manifest, readImage) {
  const problems = [];
  const items = manifest?.items;
  if (dataset.candidates.length !== 3 || !Array.isArray(items) || items.length !== 3) return ['肖像須有三位候選人的完整紀錄'];
  const ids = new Set(items.map((item) => item?.candidateId));
  if (ids.size !== 3) problems.push('肖像的候選人重複');
  const sources = new Map(dataset.sources.map((s) => [s.id, s]));
  for (const candidate of dataset.candidates) {
    const item = items.find((i) => i?.candidateId === candidate.id);
    if (!item) { problems.push(`${candidate.id}：沒有肖像紀錄`); continue; }
    const fail = (message) => problems.push(`${candidate.id}：${message}`);
    const source = sources.get(item.sourceId);
    if (item.candidateName !== candidate.name) fail('姓名不符');
    const rights = item.rights;
    if (item.sourceKind === 'cec-bulletin') {
      if (!candidate.profile || candidate.profile.sourceId !== item.sourceId || candidate.profile.electionYear !== item.electionYear
        || !source || source.candidateId !== candidate.id || source.sourceType !== 'election-bulletin'
        || !cec(source.url) || source.url !== item.sourceUrl
        || item.sourceLabel !== `中選會 ${item.electionYear} 年選舉公報`) fail('肖像與候選人資料的中選會公報出處不符');
      if (!Number.isInteger(item.page) || item.page < 1 || !text(item.imageObject)
        || !sha(item.pdfSha256) || item.extractedSha256 !== item.originalSha256) fail('公報抽取紀錄不完整');
      if (rights?.declarationUrl !== PORTRAIT_DECLARATION || rights?.licenseUrl !== 'https://data.gov.tw/license') fail('中選會授權依據不符');
    } else if (item.sourceKind === 'ly-legislator') {
      if (!/^https:\/\/www\.ly\.gov\.tw\/Pages\/List\.aspx\?nodeid=\d+$/.test(item.sourceUrl)
        || !/^https:\/\/www\.ly\.gov\.tw\/Images\/Legislators\/11\d{4}\.jpg$/.test(item.imageUrl)
        || item.sourceUrl === LY_PORTRAIT_DECLARATION || item.legislature !== 11
        || item.imageAlt !== `${candidate.name}委員照片` || item.sourceCredit !== '委員研究室提供'
        || item.sourceLabel !== '立法院第11屆委員（委員研究室提供）' || item.sourceId !== undefined) fail('立法院委員頁、原圖、姓名對應或來源署名不符');
      if (rights?.declarationUrl !== LY_PORTRAIT_DECLARATION || rights?.licenseUrl !== null) fail('立法院授權依據不符');
    } else fail('不支援的肖像來源');
    if (!date(item.retrievedAt) || !date(item.identityCheckedAt) || !text(item.position) || !text(item.extraction)
      || !(item.photographer === null || text(item.photographer))) fail('抽取或姓名位置核對紀錄不完整');
    if (rights?.status !== 'cleared' || rights.specialExclusion !== false || !date(rights.checkedAt)
      || !text(rights.evidence) || !text(rights.limitations)) fail('授權依據未確認或有特別排除');
    if (item.width !== PORTRAIT_SIZE.width || item.height !== PORTRAIT_SIZE.height) fail('肖像尺寸不一致');
    if (!/^[a-z0-9-]+$/.test(candidate.id) || item.file !== `${candidate.id}.png`) { fail('肖像檔名不符'); continue; }
    const originalExtension = item.sourceKind === 'ly-legislator' ? 'jpg' : 'png';
    if (item.originalFile !== `${candidate.id}-original.${originalExtension}`) fail('原圖檔名不符');
    else {
      const original = readImage(item.originalFile);
      if (!original || !sha(item.originalSha256) || hash(original) !== item.originalSha256) fail('原圖缺檔或雜湊不符');
    }
    const bytes = readImage(item.file);
    if (!bytes) { fail('缺少肖像檔案'); continue; }
    if (!sha(item.fileSha256) || hash(bytes) !== item.fileSha256) fail('肖像檔案雜湊不符');
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.toString('ascii', 12, 16) !== 'IHDR'
      || bytes.readUInt32BE(16) !== PORTRAIT_SIZE.width || bytes.readUInt32BE(20) !== PORTRAIT_SIZE.height) fail('肖像不是指定尺寸的 PNG');
  }
  return problems;
}

// 只在 portraitProblems 全通過後呼叫；公開欄位最小化，完整證據留在肖像清單與抽取紀錄。
export function attachPortraits(dataset, manifest) {
  for (const candidate of dataset.candidates) {
    const item = manifest.items.find((i) => i.candidateId === candidate.id);
    candidate.portrait = { url: `data/${PORTRAIT_DIR}/${item.file}`, sourceKind: item.sourceKind,
      sourceUrl: item.sourceUrl, sourceLabel: item.sourceLabel, retrievedAt: item.retrievedAt };
  }
}
