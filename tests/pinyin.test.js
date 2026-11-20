import test from 'node:test';
import assert from 'node:assert/strict';
import { PinyinEngine } from '@startsi/pinyin-core';
import {
  T9_DIGITS,
  T9_LETTERS,
  QWERTY_ROWS,
  SYMBOL_KEYS,
  t9Hint,
  previousGraphemeIndex
} from '../src/lib/pinyin/layouts.js';

test('九宫格字母映射与按键表', () => {
  assert.equal(T9_DIGITS.length, 9);
  assert.equal(t9Hint('2'), 'abc');
  assert.equal(t9Hint('9'), 'wxyz');
  assert.equal(t9Hint('1'), '');
  assert.equal(T9_LETTERS[7], 'pqrs');
  assert.deepEqual(QWERTY_ROWS[0].slice(0, 3), ['q', 'w', 'e']);
  assert.ok(SYMBOL_KEYS.includes('，'));
});

test('退格按字素回退', () => {
  assert.equal(previousGraphemeIndex(''), 0);
  assert.equal(previousGraphemeIndex('abc'), 2);
  assert.equal(previousGraphemeIndex('你'), 0);
  assert.equal(previousGraphemeIndex('a👍'), 1);
});

test('全拼引擎：zhongguo -> 中国', () => {
  const engine = new PinyinEngine({ mode: 'pinyin', useLm: false, enableNames: false });
  for (const char of 'zhongguo') engine.press({ t: 'char', v: char });
  assert.equal(engine.inputMode, 'pinyin');
  assert.ok(engine.list().some((item) => item.w === '中国'));
  const result = engine.select(0);
  assert.equal(result.type, 'commit');
  assert.equal(result.text, '中国');
});

test('九宫格引擎：94664486 -> 中国，56 有音节候选', () => {
  const engine = new PinyinEngine({ mode: 't9', useLm: false, enableNames: false });
  for (const digit of '94664486') engine.press({ t: 'char', v: digit });
  assert.equal(engine.inputMode, 't9');
  assert.equal(engine.displayPreedit, 'zhongguo');
  assert.ok(engine.list().some((item) => item.w === '中国'));

  engine.reset();
  for (const digit of '56') engine.press({ t: 'char', v: digit });
  const syllables = engine.syllableOptions();
  assert.ok(syllables.includes('kong'));
  assert.ok(syllables.includes('lou'));
});

test('九宫格退格先删拼音，空了再交给宿主', () => {
  const engine = new PinyinEngine({ mode: 't9', useLm: false, enableNames: false });
  engine.press({ t: 'char', v: '9' });
  assert.equal(engine.preedit, '9');
  const result = engine.press({ t: 'back' });
  assert.equal(result.type, 'composing');
  assert.equal(engine.preedit, '');
  assert.equal(engine.press({ t: 'back' }).type, 'unhandled');
});
