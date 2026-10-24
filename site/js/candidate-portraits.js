// 候選人資料卡的正式肖像：Node 可測，不碰 three.js，不在其他檢視畫照片。
// 每組三張全部解碼後才一起顯示；任一組失敗，已開啟的各組與後續重畫都一致回退。
export function portraitSet(candidates) {
  if (candidates.length !== 3 || new Set(candidates.map(c => c.id)).size !== 3) return [];
  if (!candidates.every(c => c.profile && c.portrait
    && /^[a-z0-9-]+$/.test(c.id) && c.portrait.url === `data/portraits/${c.id}.png`
    && typeof c.portrait.sourceLabel === 'string' && c.portrait.sourceLabel.trim()
    && ((c.portrait.sourceKind === 'cec-bulletin' && /^https:\/\/([a-z0-9-]+\.)*cec\.gov\.tw\//.test(c.portrait.sourceUrl))
      || (c.portrait.sourceKind === 'ly-legislator' && /^https:\/\/www\.ly\.gov\.tw\/Pages\/List\.aspx\?nodeid=\d+$/.test(c.portrait.sourceUrl))))) return [];
  return candidates.map(c => c.portrait);
}

export function createPortraitBatch() {
  let failed = false;
  const groups = new Set();
  const fail = () => { failed = true; for (const hide of groups) hide(); };
  return {
    fail,
    reveal(images, { show, hide }) {
      groups.add(hide);
      let disposed = false;
      hide();
      const ready = failed ? Promise.resolve() : Promise.all(images.map(image => image.decode()))
        .then(() => {
          if (images.length !== 3 || images.some(image => image.naturalWidth !== 240 || image.naturalHeight !== 320)) { fail(); return; }
          if (!failed && !disposed) show();
        }).catch(fail);
      return { ready, dispose() { disposed = true; groups.delete(hide); } };
    },
  };
}
