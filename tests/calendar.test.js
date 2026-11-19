import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthCells,
  clampDateKey,
  daysInMonth,
  firstWeekdayOf,
  shiftDateKey,
  shiftMonthRef,
  yearMonths,
  yearWindow
} from '../src/lib/calendar.js';

test('daysInMonth 处理大小月与闰年', () => {
  assert.equal(daysInMonth(2026, 1), 31);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 12), 31);
});

test('firstWeekdayOf 返回当月 1 号是周几', () => {
  // 2026-11-01 是周日
  assert.equal(firstWeekdayOf(2026, 11), 0);
  // 2026-11-19 是周四
  assert.equal(firstWeekdayOf(2026, 10), 4);
});

test('shiftMonthRef 正常翻月', () => {
  assert.deepEqual(shiftMonthRef({ year: 2026, month: 11 }, 1), { year: 2026, month: 12 });
  assert.deepEqual(shiftMonthRef({ year: 2026, month: 11 }, -1), { year: 2026, month: 10 });
});

test('shiftMonthRef 跨年进位与借位', () => {
  assert.deepEqual(shiftMonthRef({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonthRef({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonthRef({ year: 2026, month: 1 }, 25), { year: 2028, month: 2 });
});

test('buildMonthCells 总是 42 格，且当月天数完整', () => {
  const cells = buildMonthCells(2026, 11, '2026-11-19');
  assert.equal(cells.length, 42);
  const inMonth = cells.filter((cell) => cell.inMonth);
  assert.equal(inMonth.length, 30);
  assert.equal(inMonth[0].day, 1);
  assert.equal(inMonth[inMonth.length - 1].day, 30);
});

test('buildMonthCells 标记今天且唯一', () => {
  const cells = buildMonthCells(2026, 11, '2026-11-19');
  const today = cells.filter((cell) => cell.isToday);
  assert.equal(today.length, 1);
  assert.equal(today[0].key, '2026-11-19');
});

test('buildMonthCells 前后补位来自相邻月份', () => {
  // 2026-11-01 是周日，没有前补位
  const nov = buildMonthCells(2026, 11, '');
  assert.equal(nov[0].key, '2026-11-01');
  assert.equal(nov[0].inMonth, true);
  assert.equal(nov[41].month, 12);

  // 2026-10-01 是周四，需要补 4 天 9 月的尾巴
  const oct = buildMonthCells(2026, 10, '');
  assert.equal(oct[0].key, '2026-09-27');
  assert.equal(oct[0].inMonth, false);
  assert.equal(oct[4].key, '2026-10-01');
});

test('buildMonthCells 一月前补位落到上一年 12 月', () => {
  const cells = buildMonthCells(2026, 1, '');
  const firstInMonth = cells.findIndex((cell) => cell.inMonth);
  if (firstInMonth > 0) {
    assert.equal(cells[0].year, 2025);
    assert.equal(cells[0].month, 12);
  }
});

test('buildMonthCells 十二月后补位落到下一年 1 月', () => {
  const cells = buildMonthCells(2026, 12, '');
  const last = cells[cells.length - 1];
  assert.equal(last.year, 2027);
  assert.equal(last.month, 1);
});

test('buildMonthCells 闰年二月包含 29 号', () => {
  const cells = buildMonthCells(2024, 2, '2024-02-29');
  const inMonth = cells.filter((cell) => cell.inMonth);
  assert.equal(inMonth.length, 29);
  assert.ok(inMonth.some((cell) => cell.day === 29));
  assert.equal(cells.filter((cell) => cell.isToday).length, 1);
});

test('clampDateKey 夹进范围', () => {
  assert.equal(clampDateKey('2026-11-19', '2026-01-01', '2026-12-31'), '2026-11-19');
  assert.equal(clampDateKey('2025-06-01', '2026-01-01', '2026-12-31'), '2026-01-01');
  assert.equal(clampDateKey('2027-06-01', '2026-01-01', '2026-12-31'), '2026-12-31');
  assert.equal(clampDateKey('nope', '2026-01-01', '2026-12-31'), null);
});

test('shiftDateKey 跨月与跨年', () => {
  assert.equal(shiftDateKey('2026-11-19', 1), '2026-11-20');
  assert.equal(shiftDateKey('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDateKey('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftDateKey('nope', 1), null);
});

test('yearMonths 返回 12 个月且补零', () => {
  const list = yearMonths(2026);
  assert.equal(list.length, 12);
  assert.deepEqual(list[0], { year: 2026, month: 1, key: '2026-01' });
  assert.deepEqual(list[11], { year: 2026, month: 12, key: '2026-12' });
});

test('yearWindow 以 12 年为一段包住目标年', () => {
  assert.deepEqual(yearWindow(2026), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  const list = yearWindow(1999);
  assert.equal(list[0], 1992);
  assert.ok(list.includes(1999));
  assert.equal(list.length, 12);
});
