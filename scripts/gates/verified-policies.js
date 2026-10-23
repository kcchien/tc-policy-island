import { isVerified } from '../../site/js/dataset.js';

export default {
  id: 'verified-policies',
  name: '公開資料每一筆政見都通過兩層核對',
  check(site) {
    return site
      .dataset()
      .policies.filter((policy) => !isVerified(policy))
      .map((policy) => {
        const { layer1, layer2 } = policy.verification;
        return `政見 ${policy.id} 未通過核對（第一層 ${layer1.status}，第二層 ${layer2.status}）`;
      });
  },
};
