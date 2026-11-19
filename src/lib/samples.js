// 首页的内置倒数：新年、周末。
// 纯本地计算，不写进用户数据，也不会出现在编辑页里。

import { diffDays, pad2, parseDateKey } from './countdown.js';

function weekdayIndex(todayKey) {
  const parts = parseDateKey(todayKey);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function keyOf(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** 距离下一个 1 月 1 日；当天就是元旦时返回 0 */
export function daysToNewYear(todayKey) {
  const parts = parseDateKey(todayKey);
  if (!parts) return null;
  if (parts.month === 1 && parts.day === 1) {
    return { days: 0, targetDate: todayKey };
  }
  const targetDate = `${parts.year + 1}-01-01`;
  return { days: diffDays(todayKey, targetDate), targetDate };
}

/** 距离周末（周六）。周六、周日当天都算「今天」 */
export function daysToWeekend(todayKey) {
  const index = weekdayIndex(todayKey);
  const parts = parseDateKey(todayKey);
  if (index === null || !parts) return null;
  if (index === 6 || index === 0) {
    return { days: 0, targetDate: todayKey };
  }
  const gap = 6 - index;
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + gap));
  return { days: gap, targetDate: keyOf(target) };
}

export function builtInCountdowns(todayKey) {
  const items = [];

  const newYear = daysToNewYear(todayKey);
  if (newYear) items.push({ key: 'new-year', label: '距离新年', ...newYear });

  const weekend = daysToWeekend(todayKey);
  if (weekend) items.push({ key: 'weekend', label: '距离周末', ...weekend });

  return items;
}
