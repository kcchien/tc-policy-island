// 零件庫的分桶：同種形體、同種材質的靜態零件收進同一桶，每桶在場景裡是一個 InstancedMesh，
// 只花一次繪製呼叫；每個實例各自上色與變換。只做計算，瀏覽器與 Node 共用；建 three.js 物件在 island-kit.js。

// 實例縮放微抖動：每個實例的縮放乘 1 ± SCALE_JITTER，貼在一起或共面的零件（地台、牆面、窗）錯開一點，
// 不會 z-fighting（深度相同時畫面閃爍）。用實例序號做雜湊，每次載入都一樣。
export const SCALE_JITTER = 0.0072;
export function scaleJitter(index) {
  let h = Math.imul(index + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  const unit = (h >>> 0) / 0xffffffff;
  return 1 + SCALE_JITTER * (unit * 2 - 1);
}

// part：{ shape, material, transform, color }。shape 是共用幾何的代號（例如 'box'、'cone6'），
// material 是材質種類（例如 'standard'、'glow'）。回傳的桶依第一次出現的順序排列。
export function partBuckets(parts) {
  const buckets = new Map();
  for (const part of parts) {
    const key = `${part.shape}|${part.material}`;
    if (!buckets.has(key)) buckets.set(key, { key, shape: part.shape, material: part.material, items: [] });
    buckets.get(key).items.push(part);
  }
  return [...buckets.values()];
}
