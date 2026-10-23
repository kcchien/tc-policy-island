// 正式規則資料（data/rules/、data/raw/ 的議題區與元素清單、docs/rules/ 對照表）的一致性檢查。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublicDataset } from '../site/js/dataset.js';
import { loadRawData } from '../scripts/lib/raw-data.js';
import { createScanner, loadBrandTerms } from '../scripts/lib/brand-terms.js';
import { openSite } from '../scripts/gates/site.js';
import { PROJECT_NAME } from '../scripts/lib/deploy.js';
import brandTermsGate from '../scripts/gates/brand-terms.js';
import forbiddenColorsGate from '../scripts/gates/forbidden-colors.js';
import { extractColors, forbiddenRangesOf, loadForbiddenColors, rgbToHsl } from '../scripts/lib/colors.js';
import {
  blendLighting, COLOR_KEYS, glowLevel, KEYFRAMES, SKY_HALO, STAR_COLOR, WATER_SPARKLE, WATER_STARS,
} from '../site/js/island-daylight.js';
import { RIDGE_RINGS, silhouetteColor, terrainColor } from '../site/js/island-terrain.js';

const repoPath = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const raw = loadRawData(repoPath('data/raw'));

// 對照表每一列：| 編號 | 政見 | 議題區 | 依據 |
function mappingRows() {
  const text = readFileSync(repoPath('docs/rules/policy-area-mapping.md'), 'utf8');
  return text.split('\n')
    .filter((line) => /^\| (江|何|洪)-/.test(line))
    .map((line) => {
      const [id, policy, area] = line.split('|').slice(1).map((cell) => cell.trim());
      return { id, policy, area };
    });
}

test('對照表每條政見恰好對到一個存在的議題區，編號不重複', () => {
  const names = new Set(raw.issueAreas.map((a) => a.name));
  const rows = mappingRows();
  const unknown = rows.filter((row) => !names.has(row.area)).map((row) => `${row.id}→${row.area}`);
  const ids = rows.map((row) => row.id);

  assert.deepEqual(unknown, []);
  assert.equal(new Set(ids).size, ids.length);
});

test('對照表涵蓋研究筆記的全部條目：江啟臣十大亮點與百大新政 117 項、何欣純領域政見 52 條、洪麗華 8 條', () => {
  const ids = new Set(mappingRows().map((row) => row.id.replace(/[a-e]$/, '')));
  const expected = [
    ...Array.from({ length: 10 }, (_, i) => `江-亮點-${i + 1}`),
    ...[['01', 22], ['02', 25], ['03', 19], ['04', 32], ['05', 19]]
      .flatMap(([section, count]) => Array.from({ length: count }, (_, i) => `江-${section}-${i + 1}`)),
    ...Array.from({ length: 52 }, (_, i) => `何-領域-${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `洪-${i + 1}`),
  ];

  assert.deepEqual(expected.filter((id) => !ids.has(id)), []);
});

test('每個議題區都至少有一條已知政見（沒有政見的局處不設區）', () => {
  const used = new Set(mappingRows().map((row) => row.area));

  assert.deepEqual(raw.issueAreas.filter((a) => !used.has(a.name)).map((a) => a.name), []);
});

test('每個議題區配一個在地感元素，元素清單每項都放在島上', () => {
  const tiles = [...raw.issueAreas, ...raw.decorativeTiles];

  assert.deepEqual(raw.issueAreas.filter((a) => a.localElementId === null).map((a) => a.id), []);
  const placed = new Set(tiles.map((t) => t.localElementId));
  assert.deepEqual(raw.localElements.filter((e) => !placed.has(e.id)).map((e) => e.id), []);
});

test('議題區與裝飾格連成一座島', () => {
  const tiles = [...raw.issueAreas, ...raw.decorativeTiles].map((t) => t.axial.join(','));
  const all = new Set(tiles);
  const seen = new Set([tiles[0]]);
  const queue = [tiles[0]];
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  while (queue.length > 0) {
    const [q, r] = queue.pop().split(',').map(Number);
    for (const [dq, dr] of neighbors) {
      const key = `${q + dq},${r + dr}`;
      if (all.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(key);
      }
    }
  }

  assert.deepEqual(tiles.filter((t) => !seen.has(t)), []);
});

test('本 repo 的檔名、專案名稱（package.json 與 Cloudflare Pages 專案名）不含品牌用語與陣營高頻詞', () => {
  const scan = createScanner(loadBrandTerms());
  const pkg = JSON.parse(readFileSync(repoPath('package.json'), 'utf8'));
  // Cloudflare Pages 專案名依 spec 與 package.json 的 name 相同。
  const names = [pkg.name, ...execFileSync('git', ['ls-files'], { cwd: repoPath(''), encoding: 'utf8' }).split('\n').filter(Boolean)];

  assert.equal(pkg.name, 'tc-policy-island');
  assert.equal(PROJECT_NAME, pkg.name);
  assert.deepEqual(names.filter((name) => scan(name).length > 0), []);
});

test('島嶼檢視的 3D 材質、天空、光照與發光色碼全部被禁用色檢查掃到，且都不在禁用範圍內', () => {
  const { ranges } = loadForbiddenColors();
  const files = [
    'site/js/island-models.js', 'site/js/island-view.js', 'site/js/island-daylight.js', 'site/js/island-environment.js', 'site/js/island-kit.js',
    'site/js/island-selection.js', 'site/js/island-motion-view.js', 'site/js/island-terrain.js', 'site/js/island-outskirts.js',
  ];
  let scanned = 0;
  for (const file of files) {
    const text = readFileSync(repoPath(file), 'utf8');
    const colors = extractColors(text, 'js');
    // three.js 的色碼寫法是 0xrrggbb；每一個都要被抽到，沒有漏網的寫法。
    assert.equal(colors.length, (text.match(/0x[0-9a-f]{6}\b/gi) ?? []).length, file);
    for (const color of colors) assert.deepEqual(forbiddenRangesOf(color, ranges), [], `${file} 的 ${color.raw}`);
    scanned += colors.length;
  }
  assert.ok(scanned >= 40, `只掃到 ${scanned} 個色碼`);
});

test('外圍地形依高度內插的地面色，從海床到稜線每一段都不落在禁用範圍內', () => {
  const { ranges } = loadForbiddenColors();
  const hits = [];
  for (let h = -2; h <= 20; h += 0.05) {
    const hex = terrainColor(h);
    const color = { ...rgbToHsl({ r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff }), alpha: 1 };
    for (const range of forbiddenRangesOf(color, ranges)) hits.push(`${h.toFixed(2)} ${hex.toString(16)} ${range.name}`);
  }
  assert.deepEqual(hits, []);
});

test('晝夜切換途中的天空、霧、光照與水色，任兩個時段之間的補間色也不落在禁用範圍內', () => {
  const { ranges } = loadForbiddenColors();
  const ids = Object.keys(KEYFRAMES);
  const hits = [];
  for (const a of ids) {
    for (const b of ids) {
      for (let k = 0; k <= 1; k += 0.05) {
        const lighting = blendLighting(KEYFRAMES[a], KEYFRAMES[b], k);
        for (const key of COLOR_KEYS) {
          const hex = lighting[key];
          const color = { ...rgbToHsl({ r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff }), alpha: 1 };
          for (const range of forbiddenRangesOf(color, ranges)) hits.push(`${a}→${b} ${k.toFixed(2)} ${key} ${hex.toString(16)} ${range.name}`);
        }
      }
    }
  }
  assert.deepEqual(hits, []);
});

test('天空的太陽光暈與星星、水面的深淺漂移與閃光、遠山剪影，在任兩個時段的補間途中呈現的顏色都不落在禁用範圍內', () => {
  const { ranges } = loadForbiddenColors();
  // 著色器在線性空間混色（three.js 把 sRGB 色碼轉成線性），輸出再轉回 sRGB。
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const linear = (hex) => [16, 8, 0].map((shift) => toLinear(((hex >> shift) & 0xff) / 255));
  const mix = (a, b, k) => {
    const [la, lb] = [linear(a), linear(b)];
    const [r, g, bl] = la.map((v, i) => Math.round(toSrgb(v + (lb[i] - v) * k) * 255));
    return { r, g, b: bl };
  };
  const ids = Object.keys(KEYFRAMES);
  const hits = [];
  const check = (label, rgb) => {
    for (const range of forbiddenRangesOf({ ...rgbToHsl(rgb), alpha: 1 }, ranges)) hits.push(`${label} rgb(${rgb.r},${rgb.g},${rgb.b}) ${range.name}`);
  };
  for (const a of ids) {
    for (const b of ids) {
      for (let k = 0; k <= 1; k += 0.1) {
        const l = blendLighting(KEYFRAMES[a], KEYFRAMES[b], k);
        const at = `${a}→${b} ${k.toFixed(1)}`;
        for (let j = 0; j <= 1.0001; j += 0.1) {
          // 天空：天頂到地平線之間，再往太陽光暈色混到 SKY_HALO；星星往星色混，最多混滿。
          const sky = mix(l.skyHorizon, l.skyTop, j);
          const skyHex = (sky.r << 16) | (sky.g << 8) | sky.b;
          check(`${at} 天空 ${j.toFixed(1)}`, sky);
          check(`${at} 光暈 ${j.toFixed(1)}`, mix(skyHex, l.sunGlow, SKY_HALO * j));
          check(`${at} 星星 ${j.toFixed(1)}`, mix(skyHex, STAR_COLOR, j));
          // 水面：淺到深，再往閃光色（太陽光暈色）混到 WATER_SPARKLE。
          const water = mix(l.waterShallow, l.waterDeep, j);
          check(`${at} 水 ${j.toFixed(1)}`, water);
          const waterHex = (water.r << 16) | (water.g << 8) | water.b;
          check(`${at} 閃光 ${j.toFixed(1)}`, mix(waterHex, l.sunGlow, WATER_SPARKLE * j));
          check(`${at} 星光倒影 ${j.toFixed(1)}`, mix(waterHex, STAR_COLOR, WATER_STARS * j));
        }
        for (let ring = 0; ring < RIDGE_RINGS; ring++) {
          const hex = silhouetteColor(l, ring);
          check(`${at} 遠山第 ${ring + 1} 圈`, { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff });
        }
      }
    }
  }
  assert.deepEqual(hits.slice(0, 20), []);
});

test('發光件（窗、燈泡）在各時段實際呈現的顏色（色碼乘上發光倍率，超過 1 截掉）不落在禁用範圍內', () => {
  const { ranges } = loadForbiddenColors();
  // three.js 的色碼是 sRGB，倍率乘在線性空間，畫面輸出再轉回 sRGB。
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const rendered = (hex, level) => Object.fromEntries(['r', 'g', 'b'].map((ch, i) => {
    const c = ((hex >> (16 - i * 8)) & 0xff) / 255;
    return [ch, Math.round(toSrgb(Math.min(1, toLinear(c) * level)) * 255)];
  }));
  // island-models.js 引用 three.js，Node 載入不了，從原始碼讀 PALETTE 的發光色碼。
  const models = readFileSync(repoPath('site/js/island-models.js'), 'utf8');
  const glows = [...models.matchAll(/^\s+(\w+Glow): 0x([0-9a-f]{6}),/gm)].map(([, name, hex]) => [name, parseInt(hex, 16)]);
  assert.deepEqual(glows.map(([name]) => name), ['markerGlow', 'windowGlow', 'lampGlow']);
  const hits = [];
  for (const [name, hex] of glows.filter(([name]) => name !== 'markerGlow')) {
    for (const [time, lighting] of Object.entries(KEYFRAMES)) {
      const rgb = rendered(hex, glowLevel(lighting.night));
      for (const range of forbiddenRangesOf({ ...rgbToHsl(rgb), alpha: 1 }, ranges)) hits.push(`${name} ${time} rgb(${rgb.r},${rgb.g},${rgb.b}) ${range.name}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('本 repo 的網站文案與配色，以正式原始資料建置後通過品牌用語掃描與禁用色檢查', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repo-site-'));
  cpSync(repoPath('site'), dir, { recursive: true });
  // 上一次建置留下的 repo 文件副本可能已過期，不帶進來，免得結果取決於有沒有先建置
  rmSync(join(dir, 'data', 'repo-files'), { recursive: true, force: true });
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(join(dir, 'data', 'dataset.json'), JSON.stringify(buildPublicDataset(raw)));
  const site = openSite(dir);

  assert.deepEqual(brandTermsGate.check(site), []);
  assert.deepEqual(forbiddenColorsGate.check(site), []);
});
