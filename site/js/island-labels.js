// 名牌避讓（Node 可測，不 import 其他模組）：每次鏡頭或介面變動後，依畫面上的位置決定每個名牌的顯示方式。
// 與介面面板或先放好的名牌重疊時先只留編號，再不行就隱藏；8px 遲滯，三位候選人人物名牌同組同進退。
// island-view.js 呼叫 placeLabels，避開 main.js 給的浮動元件矩形。

// 名牌顯示方式，由好到差。
export const LABEL_MODES = ['full', 'number', 'hidden'];

// 遲滯：換到比上一次更好的顯示方式（第一次出現也算）要與其他矩形空出這麼多像素；維持或變差只要不重疊。
// 名牌在邊界附近時才不會每幀來回切換，而且畫面上永遠不重疊。
export const LABEL_HYSTERESIS = 8;

const rectOf = ({ x, y }, { width, height }, inset = 0) => ({
  left: x - width / 2 + inset,
  top: y - height / 2 + inset,
  right: x + width / 2 - inset,
  bottom: y + height / 2 - inset,
});

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// labels 依優先順序排列，每個是 { id, x, y, full: { width, height }, number, group? }：x、y 是名牌中心的畫面座標，
// full、number 是完整與只留編號時的尺寸（null 表示沒有這種顯示方式）。同一 group 的名牌一起決定，
// 全部採用其中最差的顯示方式（三位候選人人物的名牌呈現相同）。
// obstacles 是介面面板的畫面矩形 { left, top, right, bottom }；selectedId 的名牌最先放；previous 是上一次的結果（遲滯用）。
// 回傳 Map：id → 'full'、'number' 或 'hidden'。
export function placeLabels(labels, { obstacles = [], selectedId = null, previous = new Map() } = {}) {
  const placed = [];
  const modes = new Map();
  const blocked = (rect) => obstacles.some((o) => overlaps(rect, o)) || placed.some((p) => overlaps(rect, p));
  // 單一名牌能用的最好顯示方式。上一次沒出現過的名牌當作上一次隱藏。
  const bestMode = (label) => {
    const before = LABEL_MODES.indexOf(previous.get(label.id) ?? 'hidden');
    return LABEL_MODES.find((mode, index) => {
      if (mode === 'hidden') return true;
      const size = label[mode];
      const upgrade = index < before;
      return size && !blocked(rectOf(label, size, upgrade ? -LABEL_HYSTERESIS : 0));
    });
  };
  const place = (label, mode) => {
    modes.set(label.id, mode);
    if (mode !== 'hidden') placed.push(rectOf(label, label[mode]));
  };

  const ordered = [...labels.filter((l) => l.id === selectedId), ...labels.filter((l) => l.id !== selectedId)];
  for (const label of ordered) {
    if (modes.has(label.id)) continue;
    if (!label.group) {
      place(label, bestMode(label));
      continue;
    }
    // 同組依序試放（組員彼此也不能重疊），再全部改成最差的那一種。
    const members = ordered.filter((l) => l.group === label.group);
    const start = placed.length;
    const worst = Math.max(...members.map((member) => {
      const index = LABEL_MODES.indexOf(bestMode(member));
      if (index < LABEL_MODES.length - 1) placed.push(rectOf(member, member[LABEL_MODES[index]]));
      return index;
    }));
    placed.length = start;
    // 組員都沒有的顯示方式就往下找（例如沒有只留編號的名牌改成隱藏）。
    for (const member of members) {
      const mode = LABEL_MODES.slice(worst).find((m) => m === 'hidden' || member[m]);
      place(member, mode);
    }
  }
  return modes;
}
