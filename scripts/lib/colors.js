// 色碼抽取與 HSL 換算，給禁用色檢查用。
import { readJson } from './raw-data.js';

export const FORBIDDEN_COLORS_PATH = new URL('../../data/rules/forbidden-colors.json', import.meta.url);

export function loadForbiddenColors(path = FORBIDDEN_COLORS_PATH) {
  return readJson(path);
}

// CSS 具名顏色（CSS Color Module Level 4）。
const NAMED_COLORS = Object.fromEntries(`
aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4
black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0
chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff
darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9
darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000
darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f
darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969
dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc
ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080
honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa
lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff
lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1
lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899
lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000
mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371
mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585
midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080
oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa
palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f
pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f
royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee
sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa
springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0
violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32
`.trim().split(/\s+/).reduce((pairs, token, i, all) => (i % 2 === 0 ? [...pairs, [token, all[i + 1]]] : pairs), []));

const NAMED = Object.keys(NAMED_COLORS).join('|');

function hexToRgb(hex) {
  const digits = hex.length <= 4 ? [...hex].map((d) => d + d).join('') : hex;
  const [r, g, b, a = 255] = digits.match(/../g).map((pair) => parseInt(pair, 16));
  return { r, g, b, a: a / 255 };
}

function channel(token, max) {
  return token.endsWith('%') ? (parseFloat(token) / 100) * max : parseFloat(token);
}

function alphaOf(token) {
  if (token === undefined) return 1;
  return token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
}

// rgb()/hsl() 的參數：逗號或空白分隔，斜線後是透明度。
function args(body) {
  const [main, slashAlpha] = body.split('/');
  const parts = main.trim().split(/[\s,]+/);
  return { parts, alpha: alphaOf(slashAlpha?.trim() ?? parts[3]) };
}

export function rgbToHsl({ r, g, b }) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

// 一段顏色值（CSS 宣告值、屬性值、JS 字串）裡的色碼。var() 與 url() 的內容不是顏色，先拿掉。
function colorsInValue(value) {
  const text = value.replace(/\b(var|url)\([^)]*\)/gi, ' ');
  const found = [];
  const add = (raw, rgb, alpha = 1) => found.push({ raw, ...rgbToHsl(rgb), alpha });
  for (const m of text.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) {
    const rgb = hexToRgb(m[1]);
    add(m[0], rgb, rgb.a);
  }
  for (const m of text.matchAll(/\brgba?\(([^)]*)\)/gi)) {
    const { parts, alpha } = args(m[1]);
    add(m[0], { r: channel(parts[0], 255), g: channel(parts[1], 255), b: channel(parts[2], 255) }, alpha);
  }
  for (const m of text.matchAll(/\bhsla?\(([^)]*)\)/gi)) {
    const { parts, alpha } = args(m[1]);
    found.push({ raw: m[0], h: ((parseFloat(parts[0]) % 360) + 360) % 360, s: parseFloat(parts[1]) / 100, l: parseFloat(parts[2]) / 100, alpha });
  }
  for (const m of text.matchAll(new RegExp(`(?<![\\w-])(${NAMED})(?![\\w-])`, 'gi'))) {
    add(m[1], hexToRgb(NAMED_COLORS[m[1].toLowerCase()]));
  }
  return found;
}

// CSS 只看宣告值（大括號內「屬性: 值」的值），選擇器裡的 #id 與 :hover 不算。
function cssValues(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\{([^{}]*)\}/g)]
    .flatMap((block) => block[1].split(';'))
    .filter((declaration) => declaration.includes(':'))
    .map((declaration) => declaration.slice(declaration.indexOf(':') + 1));
}

// HTML 與 SVG 只看 <style>、style 屬性與顏色屬性（fill、stroke 等）的值。
function markupValues(markup) {
  const text = markup.replace(/<!--[\s\S]*?-->/g, '');
  return [
    ...[...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].flatMap((m) => cssValues(m[1])),
    ...[...text.matchAll(/\sstyle\s*=\s*(["'])(.*?)\1/gi)].flatMap((m) => cssValues(`{${m[2]}}`)),
    ...[...text.matchAll(/\s(?:fill|stroke|color|stop-color|flood-color|lighting-color|bgcolor)\s*=\s*(["'])(.*?)\1/gi)].map((m) => m[2]),
  ];
}

// JS 只看 three.js 材質常用的 0xrrggbb，以及整段就是一個顏色的字串（例如 '#8e4b32'、'skyblue'）。
// 註解先拿掉：區塊註解，以及行首或空白後的 //（網址的 :// 不受影響）。
function jsColors(source) {
  const js = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  return [
    ...[...js.matchAll(/(?<![\w$])0x([0-9a-fA-F]{6})\b/g)]
      .map((m) => ({ ...rgbToHsl(hexToRgb(m[1])), alpha: 1, raw: m[0] })),
    ...[...js.matchAll(/(['"`])([^'"`\n]{1,40})\1/g)]
      .flatMap((m) => colorsInValue(m[2]).filter((color) => color.raw === m[2].trim())),
  ];
}

// 從檔案文字抽出色碼，回傳 { raw, h, s, l, alpha }。kind 為副檔名（css、js、html、svg）。
export function extractColors(text, kind) {
  if (kind === 'js') return jsColors(text);
  return (kind === 'css' ? cssValues(text) : markupValues(text)).flatMap(colorsInValue);
}

function inRange(value, [from, to]) {
  return from <= to ? value >= from && value <= to : value >= from || value <= to;
}

// 回傳色碼落入的禁用色範圍。完全透明的顏色看不到，不算。
export function forbiddenRangesOf(color, ranges) {
  if (color.alpha === 0) return [];
  return ranges.filter((range) =>
    inRange(color.h, range.hue) && inRange(color.s, range.saturation) && inRange(color.l, range.lightness));
}
