import assert from 'node:assert/strict';

// Q 版人物的臉看得到：髮殼只蓋頭頂與後腦，前額的髮際線高過眼睛；眼睛、腮紅、微笑線貼在頭的正面。
// parts 是人物或市民的零件清單；forward 是臉朝的座標軸（0 是 +x、2 是 +z）。
// 髮殼是蓋住頭頂 cover × 180 度的半球殼，往後腦傾斜 tilt 弧度，前緣離頭頂 (cover × 180 度 − tilt)。
export function assertFaceVisible(parts, { forward }) {
  const head = parts.find((p) => p.part === 'head');
  const hair = parts.find((p) => p.part === 'hair');
  const face = parts.filter((p) => ['eye', 'cheek', 'mouth'].includes(p.part));
  const local = (p) => p.at.map((v, i) => v - head.at[i]);

  assert.equal(face.filter((p) => p.part === 'eye').length, 2);
  assert.equal(face.filter((p) => p.part === 'cheek').length, 2);
  assert.equal(face.filter((p) => p.part === 'mouth').length, 1);
  // 只蓋頭頂與後腦：前緣在頭頂往前 60 度以內，後緣往下超過水平線。
  const front = Math.PI * hair.cover - hair.tilt;
  assert.ok(front > 0 && front <= Math.PI / 3, `前額髮際線離頭頂 ${(front * 180 / Math.PI).toFixed(0)} 度`);
  assert.ok(Math.PI * hair.cover + hair.tilt > Math.PI / 2, '後腦沒蓋到');
  const hairline = hair.radius * Math.cos(front);
  for (const p of face) {
    const [x, y, z] = local(p);
    // 在頭的正面、貼著表面，整個零件在髮際線下方。
    assert.ok([x, y, z][forward] > head.radius * 0.7, `${p.part} 不在臉的正面`);
    assert.ok(Math.abs(Math.hypot(x, y, z) - head.radius) < head.radius * 0.12, `${p.part} 沒貼在頭上`);
    assert.ok(y + p.radius < hairline, `${p.part} 被髮殼蓋到`);
  }
  // 眼睛在上、腮紅在眼睛下方兩側、微笑線在正中最下面。
  const [eyeY, cheekY, mouthY] = ['eye', 'cheek', 'mouth'].map((name) => Math.max(...face.filter((p) => p.part === name).map((p) => local(p)[1])));
  assert.ok(eyeY > cheekY && cheekY >= mouthY);
  const side = forward === 0 ? 2 : 0;
  const mouth = face.find((p) => p.part === 'mouth');
  assert.equal(local(mouth)[side], 0);
}
