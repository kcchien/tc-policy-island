// 上線關卡：正式肖像僅候選人資料卡使用，三人全有或全無，來源授權清單與本機檔一致。
// Node 專用，重用建置時的核對，防止建置之後檔案或候選人對應被改動。
import { PORTRAIT_DIR, PORTRAIT_MANIFEST, portraitProblems } from '../lib/portraits.js';
import { THIRD_PARTY } from './site.js';
const prefix = `data/${PORTRAIT_DIR}/`;
export default {
  id: 'candidate-portraits',
  name: '正式肖像只在候選人資料卡，三人齊全且各自來源與授權完整',
  check(site) {
    const dataset = site.dataset(), files = site.files();
    const failures = [];
    for (const path of files) {
      if (!/\.(js|html|css)$/.test(path) || path.startsWith('data/') || THIRD_PARTY.test(path)) continue;
      if (['js/candidate-card.js', 'js/candidate-portraits.js', 'js/dataset.js'].includes(path)) continue;
      // portrait 也用於直式鏡頭設定，只擋肖像資料的具體欄位讀取與影像路徑。
      if (/data\/portraits\/|(?:\.portrait\??\.|\[['"]portrait['"]\]\??\.)(?:url|sourceKind|sourceUrl|sourceLabel|retrievedAt)\b/.test(site.readText(path))) failures.push(`${path}：正式肖像只能由候選人資料卡引用`);
    }
    const photoFiles = files.filter(p => p.startsWith(prefix));
    const withPortrait = dataset.candidates.filter(c => c.portrait !== undefined);
    if (!withPortrait.length) return [...failures, ...(photoFiles.length ? ['正式肖像沒有公開欄位，卻留下影像或授權清單'] : [])];
    if (withPortrait.length !== 3) failures.push('正式肖像必須三人全有或全無');
    const manifestPath = `${prefix}${PORTRAIT_MANIFEST}`;
    if (!files.includes(manifestPath)) return [...failures, '正式肖像缺少來源授權清單'];
    const manifest = JSON.parse(site.readText(manifestPath));
    failures.push(...portraitProblems(dataset, manifest, file => files.includes(`${prefix}${file}`) ? site.readBytes(`${prefix}${file}`) : null)
      .map(message => `正式肖像：${message}`));
    const expected = new Set([manifestPath]);
    for (const c of withPortrait) {
      const item = manifest.items?.find(i => i.candidateId === c.id);
      const url = `${prefix}${c.id}.png`;
      expected.add(url);
      if (item) expected.add(`${prefix}${item.originalFile}`);
      if (!item || c.portrait.url !== url || ['sourceKind', 'sourceUrl', 'sourceLabel', 'retrievedAt'].some(key => c.portrait[key] !== item[key])) failures.push(`${c.id}：正式肖像的公開欄位與清單不符`);
    }
    for (const path of photoFiles) if (!expected.has(path)) failures.push(`${path}：正式肖像未登記`);
    return failures;
  },
};
