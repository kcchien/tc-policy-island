// 選取回饋：選中格子的六角外框（不受模型遮擋）與格子外圈的呼吸光環，滑過格子時的淡色外框。
// 只標示「目前看哪一格」，與政見資料無關，每一格都一樣（ADR 0001）。

import * as THREE from 'three';
import { PALETTE, TILE_SURFACE } from './island-models.js';

// 外框沿格子頂面的邊；光環平放在選中格子（抬高）外圈、相鄰格子的頂面上。
const OUTLINE_WIDTH = 0.07;
const RING_INNER = 0.98;
const RING_OUTER = 1.3;
const RING_Y = TILE_SURFACE + 0.006;
// 呼吸：透明度在 0.24~0.60 之間，約 2.6 秒一個循環。
const breath = (t) => 0.42 + Math.sin(t * 2.4) * 0.18;
const HOVER_OPACITY = 0.55;
// 選中的格子抬高的高度（island-view.js 的 paintTile 也用這個值）。
export const SELECTED_LIFT = 0.12;

// 尖頂六角環：RingGeometry 的六等分從 30 度開始，轉平後頂點與格子對齊。
function hexRing(inner, outer) {
  const geometry = new THREE.RingGeometry(inner, outer, 6, 1, Math.PI / 6);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// 畫在所有東西上面：關掉深度測試，排在最後畫。
function overlay(geometry, color, renderOrder) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  mesh.visible = false;
  return mesh;
}

// addAnimation 是島嶼檢視的動畫註冊（island-clock.js），暫停與減少動態時呼吸停在固定畫格。
export function createSelection(scene, { hexSize, addAnimation }) {
  const outlineGeometry = hexRing(hexSize * 0.97 - OUTLINE_WIDTH, hexSize * 0.97);
  const selected = overlay(outlineGeometry, PALETTE.landSide, 20);
  selected.material.opacity = 1;
  const hovered = overlay(outlineGeometry, PALETTE.landSide, 19);
  hovered.material.opacity = HOVER_OPACITY;
  // 光環在水面上，要被格子擋住，不關深度測試。
  const ring = new THREE.Mesh(
    hexRing(hexSize * RING_INNER, hexSize * RING_OUTER),
    new THREE.MeshBasicMaterial({ color: PALETTE.laterite, transparent: true, depthWrite: false, toneMapped: false }),
  );
  ring.visible = false;
  scene.add(selected, hovered, ring);

  let removeBreath = null;
  let selectedAt = null;
  const place = (mesh, position, y) => {
    mesh.visible = Boolean(position);
    if (position) mesh.position.set(position.x, y, position.z);
  };

  return {
    // position 是選中格子的格心 { x, z }，null 表示沒有選中。
    select(position) {
      selectedAt = position;
      place(selected, position, TILE_SURFACE + SELECTED_LIFT + 0.01);
      place(ring, position, RING_Y);
      if (position && !removeBreath) {
        removeBreath = addAnimation((t) => {
          ring.material.opacity = breath(t);
        });
      } else if (!position && removeBreath) {
        removeBreath();
        removeBreath = null;
      }
    },
    // 滑過的格子；與選中的是同一格時只顯示選中的外框。
    hover(position) {
      const same = position && selectedAt && position.x === selectedAt.x && position.z === selectedAt.z;
      place(hovered, same ? null : position, TILE_SURFACE + 0.01);
    },
  };
}
