// 日历网格的纯计算：给定年月，排出 6 行 × 7 列。
//
// 抽出来单独放，是为了能脱离 DOM 做单元测试——
// 前后补位、闰年 2 月、跨年翻月这些地方最容易错。

import { dateKeyFromParts, parseDateKey } from './countdown.js';

export const WEEKDAY_NAMES = Object.freeze(['日', '一', '二', '三', '四', '五', '六']);

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2999;

/** 某年某月有多少天 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 某年某月 1 号是周几（0 = 周日） */
export function firstWeekdayOf(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** 年 + 月 偏移，自动处理进位与借位 */
export function shiftMonthRef({ year, month }, delta) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * 排出一个月的 42 个格子（6 行 × 7 列）。
 * 前后会用相邻月份的日期补满，inMonth 标记是否属于当前月。
 */
export function buildMonthCells(year, month, todayKey = '') {
  const lead = firstWeekdayOf(year, month);
  const total = daysInMonth(year, month);

  const prev = shiftMonthRef({ year, month }, -1);
  const next = shiftMonthRef({ year, month }, 1);
  const prevTotal = daysInMonth(prev.year, prev.month);

  const cells = [];

  for (let index = lead - 1; index >= 0; index -= 1) {
    const day = prevTotal - index;
    cells.push(makeCell(prev.year, prev.month, day, false, todayKey));
  }

  for (let day = 1; day <= total; day += 1) {
    cells.push(makeCell(year, month, day, true, todayKey));
  }

  let day = 1;
  while (cells.length < 42) {
    cells.push(makeCell(next.year, next.month, day, false, todayKey));
    day += 1;
  }

  return cells;
}

function makeCell(year, month, day, inMonth, todayKey) {
  const key = dateKeyFromParts(year, month, day);
  return {
    key,
    year,
    month,
    day,
    inMonth,
    isToday: Boolean(todayKey) && key === todayKey
  };
}

/** 把日期夹进 [min, max]，非法输入返回 null */
export function clampDateKey(key, min, max) {
  const parts = parseDateKey(key);
  if (!parts) return null;
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}

/** 以某个日期为基准偏移若干天 */
export function shiftDateKey(baseKey, days) {
  const parts = parseDateKey(baseKey);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateKeyFromParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}
