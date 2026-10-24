// 上線關卡：公開資料集的每一筆政見都通過兩層核對（ADR 0002）。

import { isVerified } from '../../site/js/dataset.js';

export default {
  id: 'verified-policies',
  name: '公開資料每一筆政見都通過兩層核對',
  check(site) {
    return site.dataset().policies.flatMap((policy) => {
      const { layer1, layer2 } = policy.verification ?? {};
      if (!layer1 || !layer2) return [`政見 ${policy.id} 缺少核對紀錄`];
      if (isVerified(policy)) return [];
      return [`政見 ${policy.id} 未通過核對（第一層 ${layer1.status}，第二層 ${layer2.status}）`];
    });
  },
};
