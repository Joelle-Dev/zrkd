import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATE_UNITS,
  isDateUnit,
  shiftDateKey,
  countWeekdays,
  describeSpan
} from '../src/lib/datetool.js';

test('isDateUnit 只认四种单位', () => {
  assert.equal(DATE_UNITS.length, 4);
  assert.equal(isDateUnit('day'), true);
  assert.equal(isDateUnit('week'), true);
  assert.equal(isDateUnit('month'), true);
  assert.equal(isDateUnit('year'), true);
  assert.equal(isDateUnit('hour'), false);
});

test('shiftDateKey 按天、按周推，跨月跨年也对', () => {
  assert.equal(shiftDateKey('2026-11-18', 13, 'day'), '2026-12-01');
  assert.equal(shiftDateKey('2026-12-31', 1, 'day'), '2027-01-01');
  assert.equal(shiftDateKey('2026-11-18', -18, 'day'), '2026-10-31');
  assert.equal(shiftDateKey('2026-11-18', 2, 'week'), '2026-12-02');
  assert.equal(shiftDateKey('2026-11-18', -3, 'week'), '2026-10-28');
});

test('shiftDateKey 按月在月底往回收', () => {
  assert.equal(shiftDateKey('2026-01-31', 1, 'month'), '2026-02-28');
  assert.equal(shiftDateKey('2024-01-31', 1, 'month'), '2024-02-29');
  assert.equal(shiftDateKey('2026-03-31', -1, 'month'), '2026-02-28');
  assert.equal(shiftDateKey('2026-12-15', 1, 'month'), '2027-01-15');
  assert.equal(shiftDateKey('2026-01-15', -1, 'month'), '2025-12-15');
});

test('shiftDateKey 按年推，2 月 29 日落在平年', () => {
  assert.equal(shiftDateKey('2024-02-29', 1, 'year'), '2025-02-28');
  assert.equal(shiftDateKey('2024-02-29', 4, 'year'), '2028-02-29');
  assert.equal(shiftDateKey('2026-11-18', -1, 'year'), '2025-11-18');
});

test('shiftDateKey 对坏日期 / 坏数量 / 坏单位返回 null', () => {
  assert.equal(shiftDateKey('2026-02-30', 1, 'day'), null);
  assert.equal(shiftDateKey('bad', 1, 'day'), null);
  assert.equal(shiftDateKey('2026-11-18', Number.NaN, 'day'), null);
  assert.equal(shiftDateKey('2026-11-18', 1, 'hour'), null);
});

test('countWeekdays 只数周一到周五', () => {
  // 2026-11-16 是周一，到下周一（不含）刚好 5 个工作日
  assert.equal(countWeekdays('2026-11-16', '2026-11-23'), 5);
  // 周六到周日
  assert.equal(countWeekdays('2026-11-21', '2026-11-22'), 0);
  // 同一天
  assert.equal(countWeekdays('2026-11-18', '2026-11-18'), 0);
  // 反过来给也一样
  assert.equal(countWeekdays('2026-11-23', '2026-11-16'), 5);
  assert.equal(countWeekdays('bad', '2026-11-18'), null);
});

test('describeSpan 给出正负、周数和工作日', () => {
  const span = describeSpan('2026-11-01', '2026-11-18');
  assert.equal(span.signed, 17);
  assert.equal(span.days, 17);
  assert.equal(span.weeks, 2);
  assert.equal(span.rest, 3);
  assert.equal(span.weekdays, 12);
  assert.equal(span.kind, 'after');

  const before = describeSpan('2026-11-18', '2026-11-01');
  assert.equal(before.signed, -17);
  assert.equal(before.days, 17);
  assert.equal(before.kind, 'before');

  const same = describeSpan('2026-11-18', '2026-11-18');
  assert.equal(same.signed, 0);
  assert.equal(same.kind, 'same');
  assert.equal(describeSpan('bad', '2026-11-18'), null);
});
