// 背景音樂的音色：全部用 Web Audio 的振盪器、濾波器與程式產生的雜訊即時合成，不用任何音檔。
// 可用於一般與離線（OfflineAudioContext）的音訊環境。樂曲在 bgm-score.js。

import { midiToFrequency } from './bgm-score.js';

// 程式產生的白雜訊（固定種子），鼓組的小鼓、hi-hat、拍手與刷碟都從這裡濾出來。
function noiseBuffer(context) {
  const length = Math.floor(context.sampleRate * 0.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
}

// 包絡：attack 秒內升到 peak，再以指數衰減到 decay 秒時幾乎無聲。
function envelope(param, time, peak, attack, decay) {
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(peak, time + attack);
  param.exponentialRampToValueAtTime(0.0001, time + decay);
}

export function createSynth(context, destination) {
  const noise = noiseBuffer(context);
  const bus = context.createGain();
  bus.gain.value = 0.7;
  bus.connect(destination);

  const gainNode = (value, to = bus) => {
    const node = context.createGain();
    node.gain.value = value;
    node.connect(to);
    return node;
  };
  const playNoise = (time, duration, filters, amp) => {
    const source = context.createBufferSource();
    source.buffer = noise;
    let node = source;
    for (const filter of filters) {
      node.connect(filter);
      node = filter;
    }
    node.connect(amp);
    source.start(time);
    source.stop(time + duration + 0.05);
  };
  const filter = (type, frequency, q = 0.7) => {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  // to 省略時不接輸出，例如只用來推動顫音的低頻振盪器。
  const osc = (type, frequency, time, duration, to) => {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(frequency, time);
    if (to) node.connect(to);
    node.start(time);
    node.stop(time + duration + 0.05);
    return node;
  };

  const drums = {
    kick(time, velocity) {
      const amp = gainNode(0);
      envelope(amp.gain, time, 0.9 * velocity, 0.003, 0.38);
      const body = osc('sine', 110, time, 0.4, amp);
      body.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    },
    snare(time, velocity) {
      const amp = gainNode(0);
      envelope(amp.gain, time, 0.45 * velocity, 0.002, 0.2);
      playNoise(time, 0.2, [filter('highpass', 1400), filter('lowpass', 7000)], amp);
      const tone = gainNode(0);
      envelope(tone.gain, time, 0.25 * velocity, 0.002, 0.1);
      osc('triangle', 185, time, 0.1, tone);
    },
    hat(time, velocity) {
      const amp = gainNode(0);
      envelope(amp.gain, time, 0.16 * velocity, 0.001, 0.05);
      playNoise(time, 0.05, [filter('highpass', 7500)], amp);
    },
    openHat(time, velocity) {
      const amp = gainNode(0);
      envelope(amp.gain, time, 0.14 * velocity, 0.002, 0.32);
      playNoise(time, 0.32, [filter('highpass', 6500)], amp);
    },
    clap(time, velocity) {
      const amp = gainNode(0);
      // 三下很快的拍擊疊成一聲拍手。
      amp.gain.setValueAtTime(0.0001, time);
      for (const offset of [0, 0.011, 0.022]) {
        amp.gain.setValueAtTime(0.32 * velocity, time + offset);
        amp.gain.exponentialRampToValueAtTime(0.05 * velocity, time + offset + 0.009);
      }
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      playNoise(time, 0.2, [filter('bandpass', 1300, 1.2)], amp);
    },
    // 刷碟：帶通雜訊的頻率前後推拉，模仿 DJ 來回刷唱盤的聲音。
    scratch(time, velocity) {
      const amp = gainNode(0);
      envelope(amp.gain, time, 0.22 * velocity, 0.01, 0.24);
      const band = filter('bandpass', 700, 5);
      band.frequency.setValueAtTime(700, time);
      band.frequency.exponentialRampToValueAtTime(2600, time + 0.09);
      band.frequency.exponentialRampToValueAtTime(900, time + 0.22);
      playNoise(time, 0.25, [band], amp);
    },
  };

  // 溫暖的貝斯：正弦波加一點三角波，低通濾掉刺耳的泛音。
  function bass(time, duration, midi, velocity) {
    const tone = filter('lowpass', 520);
    tone.connect(gainNode(0.5 * velocity));
    const amp = context.createGain();
    amp.connect(tone);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(1, time + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.6, time + 0.15);
    amp.gain.setValueAtTime(0.6, time + Math.max(0.16, duration - 0.04));
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.03);
    const frequency = midiToFrequency(midi);
    osc('sine', frequency, time, duration, amp);
    osc('triangle', frequency, time, duration, gainNode(0.35, amp));
  }

  // 電鋼琴和弦：正弦基音加一點很快消失的高八度泛音，聲音圓潤。
  function keys(time, duration, notes, velocity) {
    const tone = filter('lowpass', 2400);
    tone.connect(gainNode(0.11 * velocity));
    for (const midi of notes) {
      const frequency = midiToFrequency(midi);
      const amp = context.createGain();
      amp.connect(tone);
      envelope(amp.gain, time, 1, 0.006, duration + 0.4);
      osc('sine', frequency, time, duration + 0.4, amp);
      const tine = gainNode(0, amp);
      envelope(tine.gain, time, 0.3, 0.002, 0.25);
      osc('sine', frequency * 4, time, 0.25, tine);
    }
  }

  // 撥弦（月琴感）：三角波與鋸齒波，濾波器在撥下去後很快收起來。
  function pluck(time, duration, midi, velocity) {
    const tone = filter('lowpass', 3200, 2);
    tone.frequency.setValueAtTime(3200, time);
    tone.frequency.exponentialRampToValueAtTime(700, time + 0.25);
    const amp = context.createGain();
    tone.connect(amp);
    amp.connect(gainNode(0.2 * velocity));
    const length = Math.max(0.35, Math.min(0.9, duration + 0.2));
    envelope(amp.gain, time, 1, 0.003, length);
    const frequency = midiToFrequency(midi);
    osc('triangle', frequency, time, length, tone);
    osc('sawtooth', frequency * 1.003, time, length, gainNode(0.3, tone));
  }

  // 拉弦（二胡感）：鋸齒波從略低的音滑上來，慢慢起音，再加上顫音。
  function bowed(time, duration, midi, velocity) {
    const frequency = midiToFrequency(midi);
    const tone = filter('bandpass', 1500, 0.9);
    const soften = filter('lowpass', 3000);
    tone.connect(soften);
    const amp = context.createGain();
    soften.connect(amp);
    amp.connect(gainNode(0.18 * velocity));
    const end = time + duration;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(1, time + 0.09);
    amp.gain.setValueAtTime(1, Math.max(time + 0.1, end - 0.08));
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    const voice = osc('sawtooth', frequency * 0.985, time, duration + 0.12, tone);
    voice.frequency.exponentialRampToValueAtTime(frequency, time + 0.07);
    const vibrato = osc('sine', 5.5, time, duration + 0.12);
    const depth = context.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.linearRampToValueAtTime(frequency * 0.006, time + Math.min(0.35, duration));
    vibrato.connect(depth);
    depth.connect(voice.frequency);
  }

  // 播出排程器排好的一格（bgm-schedule.js planSteps 的一個元素）。
  function playStep(score, planned, stepDuration) {
    const bar = score.bars[planned.bar];
    const { stepInBar: step, time } = planned;
    for (const hit of bar.drums) if (hit.step === step) drums[hit.voice](time, hit.velocity);
    for (const chord of bar.keys) if (chord.step === step) keys(time, chord.length * stepDuration, chord.notes, chord.velocity);
    const voices = [['bass', bass], ['lead', pluck], ['bowed', bowed]];
    for (const [name, play] of voices) {
      for (const slot of bar[name]) {
        if (slot.step === step && slot.midi !== null) play(time, slot.length * stepDuration, slot.midi, slot.velocity);
      }
    }
  }

  return { playStep };
}
