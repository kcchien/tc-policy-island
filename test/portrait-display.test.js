import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitSet, createPortraitBatch } from '../site/js/candidate-portraits.js';
const candidates = ['a','b','c'].map((id) => ({ id, profile: { sourceId: `src-${id}`, electionYear: 2024 },
  portrait: { url: `data/portraits/${id}.png`, sourceKind: 'cec-bulletin', sourceUrl: `https://bulletin.cec.gov.tw/${id}.pdf`,
    sourceLabel: '中選會 2024 年選舉公報', retrievedAt: '2026-10-24' } }));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const images = () => candidates.map(() => { const d=deferred(); return { ...d, decode: () => d.promise, naturalWidth:240, naturalHeight:320 }; });

test('指定許可肖像與官方照片一起呈現，錯誤候選人或其他新聞頁仍全退回', () => {
  const mixed = structuredClone(candidates);
  Object.assign(mixed[2], { id: 'hung-li-hua', name: '洪麗華', portrait: {
    url: 'data/portraits/hung-li-hua.png', sourceKind: 'ltn-permitted-portrait',
    sourceUrl: 'https://news.ltn.com.tw/news/politics/breakingnews/5599336',
    sourceLabel: '自由時報（記者張軒哲翻攝）', retrievedAt: '2026-10-25',
  } });
  assert.equal(portraitSet(mixed).length, 3);
  for (const change of [
    c => c[2].name = '候選人乙',
    c => { c[2].id = 'other'; c[2].portrait.url = 'data/portraits/other.png'; },
    c => c[2].portrait.sourceUrl = 'https://news.ltn.com.tw/news/politics/breakingnews/5599337',
    c => c[2].portrait.sourceLabel = '自由時報',
  ]) {
    const copy = structuredClone(mixed); change(copy);
    assert.deepEqual(portraitSet(copy), []);
  }
});

test('肖像只在三人具本機影像與獨立官方出處時可呈現，來源可混合', () => {
  assert.equal(portraitSet(candidates).length,3);
  const mixed = structuredClone(candidates);
  Object.assign(mixed[0].portrait, { sourceKind: 'ly-legislator', sourceUrl: 'https://www.ly.gov.tw/Pages/List.aspx?nodeid=46764',
    sourceLabel: '立法院第11屆委員（委員研究室提供）' });
  assert.equal(portraitSet(mixed).length, 3);
  for (const change of [c => delete c[0].portrait,c => c[0].portrait.sourceUrl='https://example.org/a',c=>c[0].portrait.url='https://example.org/a.png',c=>c[0].profile=null]) {
    const c=structuredClone(candidates); change(c); assert.deepEqual(portraitSet(c),[]);
  }
});

test('三張全部解碼完成才一起顯示，任一載入失敗使索引與對話框全退回，之後不再顯示', async () => {
  const batch = createPortraitBatch();
  const first=images(),second=images();
  const state={first:false,second:false};
  const a=batch.reveal(first,{show:()=>state.first=true,hide:()=>state.first=false});
  const b=batch.reveal(second,{show:()=>state.second=true,hide:()=>state.second=false});
  first[0].resolve(); first[1].resolve(); await Promise.resolve(); assert.equal(state.first,false);
  first[2].resolve(); await a.ready; assert.equal(state.first,true);
  second[0].reject(Error('載入失敗')); await b.ready;
  assert.deepEqual(state,{first:false,second:false});
  const third=images();third.forEach(i=>i.resolve());
  const c=batch.reveal(third,{show:()=>state.first=true,hide:()=>state.first=false});await c.ready;
  assert.equal(state.first,false);
});

test('解碼成功但尺寸不符仍全退回，移除的組不再收到通知', async () => {
  const batch=createPortraitBatch(),group=images(); let visible=false,hides=0;
  group[0].naturalWidth=1;
  const entry=batch.reveal(group,{show:()=>visible=true,hide:()=>{visible=false;hides++;}});
  group.forEach(i=>i.resolve());await entry.ready;assert.equal(visible,false);
  entry.dispose();const previous=hides;batch.fail();assert.equal(hides,previous);
});
