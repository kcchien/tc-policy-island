// 零件庫的分桶：同種形體、同種材質的靜態零件收進同一桶，每桶在場景裡是一個 InstancedMesh，
// 只花一次繪製呼叫；每個實例各自上色與變換。只做計算，瀏覽器與 Node 共用；建 three.js 物件在 island-kit.js。
// 另含投影規則 castsShadow（只有主題場景與大樹投影）與實例縮放微抖動。

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

// 投影的零件來源：只有主題場景與大樹。其餘（小物件、路燈、島體、標記、人物、車輛、外圍地景）不投影，
// 陰影那一趟只畫這幾桶。
const SHADOW_CASTERS = new Set(['hero', 'tree']);
export const castsShadow = (source) => SHADOW_CASTERS.has(source);

// part：{ shape, material, transform, color, lod?, castShadow?, owner? }。shape 是共用幾何的代號（例如 'box'、'cone6'），
// material 是材質種類（例如 'standard'、'glow'），lod 是遠距離隱藏的分組（例如 'small'，整桶一起隱藏），沒有就是 null；
// owner 是零件所屬的議題區（點選與選取抬高用）。
// 非發光零件不分形體：同材質、同 lod、同投影的零件合併成一個網格（merged 為 true），每桶一次繪製呼叫。
// 桶內依議題區排序（依第一次出現的順序，區內維持原順序），每區的頂點連在一起，點選時只檢查打中的區段。
// 發光件共用的材質不讀頂點色，仍依形體分桶成 InstancedMesh。回傳的桶依第一次出現的順序排列。
export function partBuckets(parts) {
  const buckets = new Map();
  for (const part of parts) {
    const lod = part.lod ?? null;
    const castShadow = Boolean(part.castShadow);
    const merged = part.material !== 'glow';
    const key = merged ? `merged|${part.material}|${lod ?? ''}|${castShadow}` : `${part.shape}|${part.material}|${lod ?? ''}`;
    if (!buckets.has(key)) {
      buckets.set(key, { key, merged, shape: merged ? null : part.shape, material: part.material, lod, castShadow, items: [] });
    }
    const bucket = buckets.get(key);
    // 發光件不投影。
    if (!merged) bucket.castShadow = false;
    bucket.items.push(part);
  }
  for (const bucket of buckets.values()) {
    if (!bucket.merged) continue;
    const order = new Map();
    for (const part of bucket.items) if (!order.has(part.owner ?? null)) order.set(part.owner ?? null, order.size);
    bucket.items = bucket.items
      .map((part, i) => ({ part, i }))
      .sort((a, b) => order.get(a.part.owner ?? null) - order.get(b.part.owner ?? null) || a.i - b.i)
      .map(({ part }) => part);
  }
  return [...buckets.values()];
}
