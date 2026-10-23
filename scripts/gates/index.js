import { openSite } from './site.js';
import datasetStructure from './dataset-structure.js';
import verifiedPolicies from './verified-policies.js';
import candidateColumns from './candidate-columns.js';
import candidateProfiles from './candidate-profiles.js';
import brandTerms from './brand-terms.js';
import forbiddenColors from './forbidden-colors.js';
import repoDocuments from './repo-documents.js';
import fixedMotion from './fixed-motion.js';
import figureConsistency from './figure-consistency.js';
import audienceText from './audience-text.js';
import noAudioFiles from './no-audio-files.js';

// 上線關卡清單。新增關卡：在本目錄寫一個 { id, name, check(site) → 失敗訊息陣列 } 模組，加進這裡。
export const GATES = [
  datasetStructure, verifiedPolicies, candidateColumns, candidateProfiles, brandTerms, forbiddenColors, repoDocuments, fixedMotion, figureConsistency, audienceText,
  noAudioFiles,
];

export function runGates(siteDir) {
  const site = openSite(siteDir);
  return GATES.map((gate) => {
    let failures;
    try {
      failures = gate.check(site);
    } catch (error) {
      failures = [error.message];
    }
    return { id: gate.id, name: gate.name, failures };
  });
}
