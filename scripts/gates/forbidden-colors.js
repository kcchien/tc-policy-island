import { extractColors, forbiddenRangesOf, loadForbiddenColors } from '../lib/colors.js';
import { THIRD_PARTY } from './site.js';

// 檢查網站的 CSS、HTML、SVG 與 JS（3D 材質色碼寫在 JS）。three.js 等第三方程式碼不檢查。
const SCANNED = /\.(css|html|svg|js|mjs)$/;

export default {
  id: 'forbidden-colors',
  name: '配色不落在政黨色與候選人識別色範圍',
  check(site) {
    const { ranges } = loadForbiddenColors();
    const failures = [];
    for (const path of site.files()) {
      const ext = path.match(SCANNED)?.[1];
      if (!ext || THIRD_PARTY.test(path)) continue;
      const kind = ext === 'mjs' ? 'js' : ext;
      for (const color of extractColors(site.readText(path), kind)) {
        for (const range of forbiddenRangesOf(color, ranges)) {
          failures.push(`${path}：色碼 ${color.raw} 落在${range.group}「${range.name}」（色相 ${Math.round(color.h)} 度、飽和度 ${color.s.toFixed(2)}、亮度 ${color.l.toFixed(2)}）`);
        }
      }
    }
    return failures;
  },
};
