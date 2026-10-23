import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLayer1 } from '../scripts/lib/verification.js';

const SNAPSHOT = '範例甲的範例政見頁\n\n一、在範例區增設 3 條範例公車路線，每15分鐘一班。\n\n二、範例區增設兩座範例公園。';

function layer1(quoteText, snapshot = SNAPSHOT) {
  const policy = { id: 'p-1', quotes: [{ text: quoteText, sourceId: 'src-1' }] };
  return checkLayer1(policy, new Map([['src-1', snapshot]]));
}

test('第一層：全形與半形的數字、英文視為相同', () => {
  assert.equal(layer1('在範例區增設３條範例公車路線，每１５分鐘一班').status, 'pass');
});

test('第一層：空白與換行差異視為相同', () => {
  assert.equal(layer1('範例政見頁 一、在範例區增設3條\n範例公車路線').status, 'pass');
});

test('第一層：標點差異視為相同（全形半形、不同標點、多或少標點）', () => {
  assert.equal(layer1('每15分鐘一班.').status, 'pass');
  assert.equal(layer1('範例公車路線;每15分鐘一班').status, 'pass');
  assert.equal(layer1('範例公車路線每15分鐘一班').status, 'pass');
  assert.equal(layer1('「每15分鐘」一班').status, 'pass');
});

test('第一層：增加、刪除或替換字詞視為不同', () => {
  assert.equal(layer1('在範例區增設3條範例公車新路線').status, 'fail');
  assert.equal(layer1('在範例區增設3條公車路線').status, 'fail');
  assert.equal(layer1('在範例區增設4條範例公車路線').status, 'fail');
  assert.equal(layer1('範例區增設兩座範例綠地').status, 'fail');
});

test('第一層：數字之間的標點不會被移除，「1.5」與「15」視為不同', () => {
  assert.equal(layer1('每1.5分鐘一班').status, 'fail');
  assert.equal(layer1('票價1.5元', '票價15元').status, 'fail');
  assert.equal(layer1('票價1．5元', '票價1.5元').status, 'pass');
});

test('第一層：任一則引述不符就不通過，並指出是哪一則', () => {
  const policy = {
    id: 'p-1',
    quotes: [
      { text: '每15分鐘一班', sourceId: 'src-1' },
      { text: '範例區增設三座範例公園', sourceId: 'src-1' },
    ],
  };

  const result = checkLayer1(policy, new Map([['src-1', SNAPSHOT]]));

  assert.equal(result.status, 'fail');
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /quotes\[1\]/);
});

test('第一層：出處快照缺失時不通過', () => {
  const policy = { id: 'p-1', quotes: [{ text: '每15分鐘一班', sourceId: 'src-missing' }] };

  const result = checkLayer1(policy, new Map([['src-missing', null]]));

  assert.equal(result.status, 'fail');
  assert.match(result.problems[0], /src-missing.*快照/);
  assert.equal(checkLayer1(policy, new Map()).status, 'fail');
});

test('第一層：空白或只有標點的引述不通過', () => {
  assert.equal(layer1('，。 ').status, 'fail');
});
