import { CANDIDATE_ORDER_RULES, orderCandidates } from '../../site/js/dataset.js';
import { buildViewModel } from '../../site/js/view-model.js';

export const EXPECTED_CANDIDATE_COUNT = 3;

export default {
  id: 'candidate-columns',
  name: '三位候選人欄位齊全且依排序規則排列',
  check(site) {
    const dataset = site.dataset();
    const failures = [];
    const actual = dataset.candidates.map((c) => c.id);
    if (actual.length !== EXPECTED_CANDIDATE_COUNT) {
      failures.push(`候選人應有 ${EXPECTED_CANDIDATE_COUNT} 位，實際 ${actual.length} 位`);
    }
    const { candidateOrder, candidates } = orderCandidates(dataset.candidates);
    const expected = candidates.map((c) => c.id);
    if (expected.join() !== actual.join()) {
      failures.push(`候選人順序應為 ${expected.join('、')}（依${CANDIDATE_ORDER_RULES[candidateOrder].keyName}），實際為 ${actual.join('、')}`);
    }
    if (dataset.meta.candidateOrder !== candidateOrder) {
      failures.push(`meta.candidateOrder 應為 ${candidateOrder}，實際為 ${dataset.meta.candidateOrder}`);
    }
    for (const row of buildViewModel(dataset).rows) {
      const cellIds = row.cells.map((cell) => cell.candidateId);
      if (cellIds.join() !== actual.join()) {
        failures.push(`議題區 ${row.issueArea.id} 的候選人欄位為 ${cellIds.join('、')}，與候選人順序不一致`);
      }
    }
    return failures;
  },
};
