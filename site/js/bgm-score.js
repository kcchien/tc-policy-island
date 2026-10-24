// 背景音樂的樂曲：本站原創的 boom-bap 循環，全部是純資料與純函式（Node 可測）。
// 旋律、和弦進行與鼓組型態都是在這裡用固定種子產生，不取材任何既有歌曲，沒有人聲與歌詞。
// 32 小節循環，G 宮五聲音階，鼓組、貝斯、和弦、撥弦與拉弦旋律。
// 播放在 bgm-player.js，音色在 bgm-synth.js。

export const BGM_SEED = 20261128;
export const BPM = 88;
export const STEPS_PER_BAR = 16;
// 一輪 8 小節，四輪構成一個循環。
export const BARS_PER_ROUND = 8;
export const ROUNDS = 4;
// 奇數的十六分音符往後推的比例（佔一個十六分音符），做出 boom-bap 的搖擺感。
export const SWING = 0.16;

// G 宮五聲音階（G A B D E）。所有音高都只用這五個音，和弦也由這五個音疊成。
export const SCALE_ROOT = 55;
export const PENTATONIC = [0, 2, 4, 7, 9];

// 音階上的第幾個音（0 是 G3，往上 5 個音升一個八度）轉成 MIDI 音高。
export function degreeToMidi(degree) {
  const octave = Math.floor(degree / PENTATONIC.length);
  return SCALE_ROOT + 12 * octave + PENTATONIC[degree - octave * PENTATONIC.length];
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

// 8 小節的和弦進行，每小節一個和弦。degrees 是和弦音在音階上的位置。
const CHORDS = {
  Em7: { root: 4, degrees: [4, 5, 7, 8] },
  'Am7sus4': { root: 1, degrees: [6, 8, 9, 10] },
  'D6sus2': { root: 3, degrees: [3, 4, 6, 7] },
  'G6/B': { root: 2, degrees: [5, 7, 8, 9] },
};
const PROGRESSION = ['Em7', 'Em7', 'Am7sus4', 'D6sus2', 'Em7', 'G6/B', 'Am7sus4', 'D6sus2'];
const chordOf = (bar) => CHORDS[PROGRESSION[bar % BARS_PER_ROUND]];

// 第 4 輪最後兩小節是過門：BREAK_BAR 抽掉大鼓小鼓，下一小節用小鼓滾奏接回循環開頭。
const LOOP_BARS = BARS_PER_ROUND * ROUNDS;
const BREAK_BAR = LOOP_BARS - 2;
const FILL_BAR = LOOP_BARS - 1;

// 固定種子的亂數（mulberry32），每次載入得到相同的序列。
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

// 一串長度連成整個小節的格子；pitch 為 null 是休止。
function toSlots(lengths, pitches, velocity) {
  let step = 0;
  return lengths.map((length, i) => {
    const slot = { step, length, midi: pitches[i] == null ? null : degreeToMidi(pitches[i]), velocity };
    step += length;
    return slot;
  });
}

// 鼓組：大鼓、小鼓、閉合與開放 hi-hat、拍手、刷碟。
function drumBar(random, bar) {
  const round = Math.floor(bar / BARS_PER_ROUND);
  const inRound = bar % BARS_PER_ROUND;
  const hits = [];
  const hit = (step, voice, velocity) => hits.push({ step, voice, velocity });

  // 過門：先只留輕輕的 hi-hat，再用小鼓滾奏接回循環開頭。
  if (bar === BREAK_BAR) {
    for (let step = 0; step < STEPS_PER_BAR; step += 4) hit(step, 'hat', 0.25);
    return hits;
  }
  if (bar === FILL_BAR) {
    hit(0, 'kick', 0.9);
    for (const [step, velocity] of [[8, 0.35], [10, 0.45], [12, 0.55], [13, 0.6], [14, 0.7], [15, 0.85]]) hit(step, 'snare', velocity);
    hit(14, 'scratch', 0.5);
    return hits;
  }

  for (let step = 0; step < STEPS_PER_BAR; step += 2) {
    const open = step === 14 && (inRound === 3 || inRound === 7);
    hit(step, open ? 'openHat' : 'hat', step % 4 === 0 ? 0.55 : 0.35);
  }
  hit(0, 'kick', 1);
  hit(10, 'kick', 0.85);
  if (random() < 0.5) hit(7, 'kick', 0.6);
  if (random() < 0.3) hit(15, 'kick', 0.5);
  hit(4, 'snare', 0.9);
  hit(12, 'snare', 0.9);
  if (random() < 0.4) hit(pick(random, [9, 11]), 'snare', 0.2);
  // 拍手只在每 4 小節的最後一小節疊在第 4 拍的小鼓上。
  if (inRound % 4 === 3) hit(12, 'clap', 0.6);
  if (round === 1 && inRound === 7) hit(14, 'scratch', 0.45);
  return hits;
}

// 貝斯：每小節一個節奏型，根音、上方五度與接到下一小節根音的經過音。
const BASS_PATTERNS = [
  [[6, 'root'], [1, null], [3, 'root'], [2, null], [2, 'up'], [2, 'approach']],
  [[3, 'root'], [3, null], [4, 'root'], [2, 'up'], [2, null], [2, 'approach']],
  [[6, 'root'], [4, 'up'], [2, null], [2, 'root'], [2, 'approach']],
];

// 貝斯的根音放在 D2 到 B2 之間（音階位置 -7 到 -3）。
const bassDegree = (chord) => chord.root - (chord.root < 3 ? 5 : 10);

function bassBar(random, bar) {
  const root = bassDegree(chordOf(bar));
  const nextRoot = bassDegree(chordOf(bar + 1));
  const pattern = bar === BREAK_BAR ? [[8, 'root'], [8, null]] : pick(random, BASS_PATTERNS);
  const pitch = {
    root,
    up: root + 3,
    approach: nextRoot + (nextRoot > root ? -1 : 1),
  };
  return toSlots(pattern.map(([length]) => length), pattern.map(([, role]) => (role ? pitch[role] : null)), 0.8);
}

// 和弦鋪底：電鋼琴在第 1 拍與第 3 拍後半各按一次。
function keysBar(bar) {
  const notes = chordOf(bar).degrees.map(degreeToMidi);
  return [
    { step: 0, length: 7, notes, velocity: 0.5 },
    { step: 10, length: 5, notes, velocity: 0.35 },
  ];
}

// 旋律的節奏型，長度總和都是一小節（16）。
const PLUCK_RHYTHMS = [
  [4, 2, 2, 4, 4],
  [2, 2, 4, 2, 2, 4],
  [3, 3, 2, 4, 4],
  [6, 2, 4, 4],
  [2, 2, 2, 2, 8],
];
const BOWED_RHYTHMS = [
  [8, 4, 4],
  [12, 4],
  [6, 2, 8],
  [4, 4, 8],
];
const LEAD_LOW = 5;
const LEAD_HIGH = 12;

// 離 degree 最近的和弦音，讓每小節第一個音落在和弦上。
function nearestChordTone(degree, chord) {
  const tones = [];
  for (let d = LEAD_LOW; d <= LEAD_HIGH; d += 1) {
    if (chord.degrees.some((c) => (d - c) % PENTATONIC.length === 0)) tones.push(d);
  }
  return tones.reduce((best, d) => (Math.abs(d - degree) < Math.abs(best - degree) ? d : best));
}

// 8 小節的旋律：A（兩小節）、A'（同節奏、隨和弦移位）、B（新材料）、A''（收在主音）。
function melody(random, rhythms, restChance) {
  const phrase = (start, rhythmPair, bars) => {
    let degree = start;
    return bars.map((bar, i) => {
      const chord = chordOf(bar);
      const lengths = rhythmPair[i];
      const pitches = lengths.map((_, n) => {
        if (n === 0) degree = nearestChordTone(degree, chord);
        else degree = Math.min(LEAD_HIGH, Math.max(LEAD_LOW, degree + pick(random, [-2, -1, -1, 1, 1, 2, 0])));
        return n > 0 && random() < restChance ? null : degree;
      });
      return { lengths, pitches };
    });
  };
  const a = [pick(random, rhythms), pick(random, rhythms)];
  const b = [pick(random, rhythms), pick(random, rhythms)];
  const bars = [
    ...phrase(9, a, [0, 1]),
    ...phrase(8, a, [2, 3]),
    ...phrase(10, b, [4, 5]),
    ...phrase(9, a, [6, 7]),
  ];
  // 最後一個音收在 E（Em 的主音），回到循環開頭比較自然。
  const last = bars[7];
  last.pitches[last.pitches.length - 1] = 9;
  return bars;
}

const silentBar = () => [{ step: 0, length: STEPS_PER_BAR, midi: null, velocity: 0 }];

export function buildScore(seed = BGM_SEED) {
  const random = createRandom(seed);
  const pluck = melody(random, PLUCK_RHYTHMS, 0.15);
  const bowed = melody(random, BOWED_RHYTHMS, 0);
  const bars = [];
  for (let bar = 0; bar < LOOP_BARS; bar += 1) {
    const round = Math.floor(bar / BARS_PER_ROUND);
    const inRound = bar % BARS_PER_ROUND;
    // 第 1 輪只有鼓、貝斯、和弦；第 2 輪加撥弦旋律；第 3 輪換拉弦；第 4 輪兩者一起、拉弦較輕，
    // 過門時只留撥弦，最後一小節只剩小鼓滾奏。
    const pluckOn = round === 1 || (round === 3 && bar !== FILL_BAR);
    const bowedOn = round === 2 || (round === 3 && bar < BREAK_BAR);
    bars.push({
      index: bar,
      round,
      chord: PROGRESSION[inRound],
      drums: drumBar(random, bar),
      bass: bassBar(random, bar),
      keys: keysBar(bar),
      lead: pluckOn ? toSlots(pluck[inRound].lengths, pluck[inRound].pitches, bar === BREAK_BAR ? 0.6 : 0.7) : silentBar(),
      bowed: bowedOn ? toSlots(bowed[inRound].lengths, bowed[inRound].pitches, round === 3 ? 0.35 : 0.6) : silentBar(),
    });
  }
  return { seed, bpm: BPM, stepsPerBar: STEPS_PER_BAR, swing: SWING, bars };
}

// 循環總共幾個十六分音符。
export const loopSteps = (score) => score.bars.length * score.stepsPerBar;
