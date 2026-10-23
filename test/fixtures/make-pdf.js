// 測試用的最小 PDF：一個 Type0 字型 TestSerif-Light，ToUnicode 把 F356、F357 對到 U+FFFD（替代字元），
// 與公報 PDF 數字字形抽不出文字的情況相同。
import { deflateSync } from 'node:zlib';

export const TEST_FONT = 'TestSerif-Light';

export function makePdf({ compress = false } = {}) {
  const cmap = [
    '/CIDInit /ProcSet findresource begin',
    'begincmap',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    '3 beginbfchar',
    '<0001> <0020>',
    '<F356> <FFFD>',
    '<F357> <FFFD>',
    'endbfchar',
    'endcmap',
    'end',
  ].join('\n');
  const data = compress ? deflateSync(Buffer.from(cmap, 'latin1')) : Buffer.from(cmap, 'latin1');
  const filter = compress ? '/Filter/FlateDecode' : '';
  const body = Buffer.concat([
    Buffer.from('%PDF-1.6\n'),
    Buffer.from('1 0 obj\n<</Type/Catalog>>\nendobj\n'),
    Buffer.from(`2 0 obj\n<</BaseFont/ABCDEF+${TEST_FONT}/DescendantFonts 4 0 R/Encoding/Identity-H/Subtype/Type0/ToUnicode 3 0 R/Type/Font>>\nendobj\n`),
    Buffer.from(`3 0 obj\n<<${filter}/Length ${data.length}>>stream\n`),
    data,
    Buffer.from('\nendstream\nendobj\n'),
    Buffer.from('4 0 obj\n[]\nendobj\n'),
  ]);
  const trailer = `xref\n0 5\n0000000000 65535 f\r\n${'0000000009 00000 n\r\n'.repeat(4)}trailer\n<</Size 5/Root 1 0 R>>\nstartxref\n${body.length}\n%%EOF\n`;
  return Buffer.concat([body, Buffer.from(trailer)]);
}
