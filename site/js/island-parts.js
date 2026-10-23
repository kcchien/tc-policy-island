// 零件庫的分桶：同種形體、同種材質的靜態零件收進同一桶，每桶在場景裡是一個 InstancedMesh，
// 只花一次繪製呼叫；每個實例各自上色與變換。只做計算，瀏覽器與 Node 共用；建 three.js 物件在 island-kit.js。

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
