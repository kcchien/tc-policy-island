// 指令腳本的 --help：判斷是否要說明、排版說明文字（用法、參數表、注意事項），以及印出後直接結束。
// 參數與注意事項只寫在各腳本的說明裡，AGENTS.md 指令表只寫用途。
import { writeSync } from 'node:fs';

// 全形字（中文、全形標點）在終端機佔兩格，對齊要用顯示寬度而不是字串長度。
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u;

export const displayWidth = (text) => [...text].reduce((sum, char) => sum + (WIDE.test(char) ? 2 : 1), 0);

export const wantsHelp = (argv) => argv.includes('--help') || argv.includes('-h');

// rows 是 [左欄, 說明?]；說明從左欄寬 column 處開始，column 省略時取有說明的左欄最大寬度加 2。
function formatRows(rows, column) {
  const described = rows.filter(([, text]) => text);
  const width = column ?? Math.max(0, ...described.map(([left]) => displayWidth(left))) + 2;
  return rows.map(([left, text]) => {
    if (!text) return `  ${left}`;
    const gap = Math.max(width - displayWidth(left), 1);
    return `  ${left}${' '.repeat(gap)}${text}`;
  });
}

// summary：一句話說明；usage：[[指令, 說明]]；sections：[{ title, rows }]；notes：腳本不會自白的注意事項。
// usageColumn、optionColumn 指定用法與參數兩種表的說明起始欄，省略時各表自動取寬。
export function formatUsage({ summary, usage, sections = [], notes = [], usageColumn, optionColumn }) {
  const blocks = [[summary], ['用法：', ...formatRows(usage, usageColumn)]];
  for (const { title, rows } of sections) blocks.push([`${title}：`, ...formatRows(rows, optionColumn)]);
  if (notes.length > 0) blocks.push(['注意事項：', ...notes.map((note) => `  - ${note}`)]);
  return `${blocks.map((lines) => lines.join('\n')).join('\n\n')}\n`;
}

// 同步寫出再結束，在任何讀檔、建置或子程序之前呼叫，--help 不留副作用。
// 不用 process.stdout.write：macOS 上標準輸出接管線時是非同步的，緊接著 process.exit 會截斷輸出。
export function exitWithUsage(text) {
  writeSync(1, text);
  process.exit(0);
}
