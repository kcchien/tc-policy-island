import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPolicyReader } from '../site/js/policy-card.js';

// 假的音檔與語音：記錄呼叫，事件由測試手動觸發。
function fakeAudio(log) {
  return (url) => {
    const listeners = {};
    const audio = {
      url,
      preload: null,
      paused: true,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      play() { audio.paused = false; log.push(['play', url]); return Promise.resolve(); },
      pause() { audio.paused = true; log.push(['pause', url]); },
      fire: (type) => listeners[type]?.(),
    };
    log.audios.push(audio);
    return audio;
  };
}

function fakeSpeech(log) {
  return {
    speak(utterance) { log.push(['speak', utterance.text]); log.utterances.push(utterance); },
    cancel() { log.push(['cancel']); },
  };
}

const fakeUtterance = (text) => {
  const listeners = {};
  return { text, addEventListener: (type, fn) => { listeners[type] = fn; }, fire: (type) => listeners[type]?.() };
};

function setup({ speech = true } = {}) {
  const log = [];
  log.audios = [];
  log.utterances = [];
  const changes = [];
  const reader = createPolicyReader({
    createAudio: fakeAudio(log),
    speech: speech ? fakeSpeech(log) : null,
    createUtterance: fakeUtterance,
    onChange: (id) => changes.push(id),
  });
  return { reader, log, changes };
}

const withAudio = { id: 'p-1', summary: '摘要一。', quotes: [{ text: '原文一' }], audioUrl: 'data/audio/aaa.mp3' };
const withoutAudio = { id: 'p-2', summary: '摘要二。', quotes: [{ text: '原文二' }] };

test('有音檔的政見播放音檔，音檔按需建立且不預先載入，不用瀏覽器語音', () => {
  const { reader, log, changes } = setup();
  reader.toggle(withAudio);
  assert.equal(log.audios.length, 1);
  assert.equal(log.audios[0].url, 'data/audio/aaa.mp3');
  assert.equal(log.audios[0].preload, 'none');
  assert.deepEqual(log.filter(([type]) => type === 'speak'), []);
  assert.equal(reader.playingId, 'p-1');
  assert.deepEqual(changes, ['p-1']);
});

test('沒有音檔的政見退回瀏覽器語音，唸摘要與原文引述', () => {
  const { reader, log } = setup();
  reader.toggle(withoutAudio);
  assert.equal(log.audios.length, 0);
  assert.deepEqual(log.filter(([type]) => type === 'speak'), [['speak', '摘要二。原文：原文二。']]);
  assert.equal(reader.playingId, 'p-2');
});

test('再按一次同一條停止播放', () => {
  const { reader, log, changes } = setup();
  reader.toggle(withAudio);
  reader.toggle(withAudio);
  assert.equal(log.audios[0].paused, true);
  assert.equal(reader.playingId, null);
  assert.deepEqual(changes, ['p-1', null]);
});

test('一次只播一條：開始另一條時先停掉前一條（音檔與語音都一樣）', () => {
  const { reader, log } = setup();
  reader.toggle(withAudio);
  reader.toggle(withoutAudio);
  assert.equal(log.audios[0].paused, true);
  assert.equal(reader.playingId, 'p-2');
  reader.toggle({ ...withAudio, id: 'p-3', audioUrl: 'data/audio/bbb.mp3' });
  assert.ok(log.some(([type]) => type === 'cancel'));
  assert.equal(reader.playingId, 'p-3');
  assert.equal(log.audios.filter((a) => !a.paused).length, 1);
});

test('播完自動回到未播放；前一條被停掉後才傳來的結束事件不影響正在播的那條', () => {
  const { reader, log, changes } = setup();
  reader.toggle(withAudio);
  log.audios[0].fire('ended');
  assert.equal(reader.playingId, null);
  reader.toggle(withAudio);
  reader.toggle(withoutAudio);
  log.audios[1].fire('ended');
  assert.equal(reader.playingId, 'p-2');
  log.utterances[0].fire('end');
  assert.equal(reader.playingId, null);
  assert.equal(changes.at(-1), null);
});

test('停止（關卡片、換議題區）時不論音檔或語音都停下', () => {
  const { reader, log } = setup();
  reader.toggle(withAudio);
  reader.stop();
  assert.equal(log.audios[0].paused, true);
  assert.equal(reader.playingId, null);
});

test('沒有語音功能時，有音檔的政見照樣能播；判斷能不能朗讀看音檔或語音', () => {
  const { reader, log } = setup({ speech: false });
  assert.equal(reader.canRead(withAudio), true);
  assert.equal(reader.canRead(withoutAudio), false);
  reader.toggle(withAudio);
  assert.equal(log.audios.length, 1);
  assert.equal(setup().reader.canRead(withoutAudio), true);
});
