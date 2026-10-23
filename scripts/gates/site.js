import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 網站目錄內公開資料集的位置。建置指令寫到這裡，關卡與瀏覽器從這裡讀。
export const DATASET_PATH = 'data/dataset.json';

// 關卡讀取建置後網站目錄的入口。讀檔失敗時丟出帶中文說明的錯誤，由 runGates 記為該關卡失敗。
export function openSite(dir) {
  let dataset;
  return {
    dir,
    dataset() {
      if (dataset === undefined) {
        const path = join(dir, DATASET_PATH);
        let text;
        try {
          text = readFileSync(path, 'utf8');
        } catch {
          throw new Error(`讀不到公開資料集 ${path}，請先執行建置指令`);
        }
        try {
          dataset = JSON.parse(text);
        } catch (error) {
          throw new Error(`公開資料集 ${path} 不是合法 JSON：${error.message}`);
        }
      }
      return dataset;
    },
  };
}
