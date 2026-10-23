import { validateRawData } from '../../site/js/dataset.js';

// 公開資料集是原始資料的子集，必須同樣通過結構驗證。
export default {
  id: 'dataset-structure',
  name: '公開資料集結構合法',
  check(site) {
    return validateRawData(site.dataset());
  },
};
