// 日期计算器的纯日期逻辑。
//
// 全部走 Date.UTC(y, m - 1, d)，和 countdown.js 一样与时区、夏令时无关。
// 月份/年份推算遇到月底会往回收（1 月 31 日 + 1 个月 = 2 月最后一天），
// 2 月 29 日 + 1 年 = 次年 2 月 28 日。

import { dateKeyFromParts, diffDays, parseDateKey, utcDayNumber } from './countdown.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATE_UNITS = Object.freeze([
  { key: 'day', label: '天' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' }
]);

export function isDateUnit(value) {
  return DATE_UNITS.some((item) => item.key === value);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function keyOf(year, month, day) {
  if (year < 1 || year > 9999) return null;
  return dateKeyFromParts(year, month, Math.min(day, daysInMonth(year, month)));
}

/**
 * 从一个日期往后（amount 为正）或往前（amount 为负）推。
 * unit: day | week | month | year。日期或数量非法时返回 null。
 */
export function shiftDateKey(key, amount, unit = 'day') {
  const parts = parseDateKey(key);
  const value = Math.trunc(Number(amount));
  if (!parts || !Number.isFinite(value) || !isDateUnit(unit)) return null;

  const { year, month, day } = parts;

  if (unit === 'day' || unit === 'week') {
    const date = new Date(Date.UTC(year, month - 1, day + value * (unit === 'week' ? 7 : 1)));
    return keyOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  if (unit === 'month') {
    const total = year * 12 + (month - 1) + value;
    const nextYear = Math.floor(total / 12);
    const nextMonth = ((total % 12) + 12) % 12 + 1;
    return keyOf(nextYear, nextMonth, day);
  }

  return keyOf(year + value, month, day);
}

/**
 * 两个日期之间的工作日（周一至周五）数量。
 * 区间按「较早那天（含）到较晚那天（不含）」算，所以周一到下周一刚好 5 天。
 * 只排除周末，不认法定节假日。
 */
export function countWeekdays(a, b) {
  const from = utcDayNumber(a);
  const to = utcDayNumber(b);
  if (from === null || to === null) return null;

  const start = Math.min(from, to);
  const total = Math.abs(to - from);
  if (total === 0) return 0;

  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  const rest = total % 7;
  const startDow = new Date(start * DAY_MS).getUTCDay();
  for (let index = 0; index < rest; index += 1) {
    const dow = (startDow + index) % 7;
    if (dow >= 1 && dow <= 5) count += 1;
  }
  return count;
}

/**
 * 两个日期的差值摘要。
 * 返回 { signed, days, weeks, rest, weekdays, kind }：
 *   signed 为 end - start（可为负），days 是绝对值
 *   weeks/rest 是「N 周 M 天」的拆法
 *   weekdays 是区间内的工作日数
 *   kind: same | after | before
 */
export function describeSpan(startKey, endKey) {
  const signed = diffDays(startKey, endKey);
  if (signed === null) return null;

  const days = Math.abs(signed);
  return {
    signed,
    days,
    weeks: Math.floor(days / 7),
    rest: days % 7,
    weekdays: countWeekdays(startKey, endKey),
    kind: signed === 0 ? 'same' : (signed > 0 ? 'after' : 'before')
  };
}
