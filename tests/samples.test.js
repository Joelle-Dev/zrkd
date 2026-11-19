import test from 'node:test';
import assert from 'node:assert/strict';
import { builtInCountdowns, daysToNewYear, daysToWeekend } from '../src/lib/samples.js';

test('daysToNewYear 指向下一个 1 月 1 日', () => {
  assert.deepEqual(daysToNewYear('2026-11-18'), { days: 44, targetDate: '2027-01-01' });
  assert.deepEqual(daysToNewYear('2026-12-31'), { days: 1, targetDate: '2027-01-01' });
});

test('daysToNewYear 元旦当天返回 0', () => {
  assert.deepEqual(daysToNewYear('2027-01-01'), { days: 0, targetDate: '2027-01-01' });
});

test('daysToNewYear 非法输入返回 null', () => {
  assert.equal(daysToNewYear('2026-02-30'), null);
  assert.equal(daysToNewYear('nope'), null);
});

test('daysToWeekend 从周三算到周六', () => {
  // 2026-11-18 是周三
  assert.deepEqual(daysToWeekend('2026-11-18'), { days: 3, targetDate: '2026-11-21' });
});

test('daysToWeekend 周六周日都算今天', () => {
  assert.deepEqual(daysToWeekend('2026-11-21'), { days: 0, targetDate: '2026-11-21' });
  assert.deepEqual(daysToWeekend('2026-11-22'), { days: 0, targetDate: '2026-11-22' });
});

test('daysToWeekend 跨月', () => {
  // 2026-11-30 是周一，最近的周六是 12-05
  assert.deepEqual(daysToWeekend('2026-11-30'), { days: 5, targetDate: '2026-12-05' });
});

test('builtInCountdowns 总是给出新年和周末两条', () => {
  const items = builtInCountdowns('2026-11-18');
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.key), ['new-year', 'weekend']);
  assert.equal(items[0].label, '距离新年');
  assert.equal(items[1].days, 3);
});
