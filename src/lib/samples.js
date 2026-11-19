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

function ratio(value, total) {
  if (!Number.isFinite(value) || !total) return 0;
  return Math.min(1, Math.max(0, value / total));
}

export function builtInCountdowns(todayKey) {
  const parts = parseDateKey(todayKey);
  if (!parts) return [];
  const items = [];

  const newYear = daysToNewYear(todayKey);
  if (newYear) {
    // 今年已经走过的比例；元旦当天当作满格，和「就是今天」对得上
    const total = diffDays(`${parts.year}-01-01`, `${parts.year + 1}-01-01`);
    const elapsed = diffDays(`${parts.year}-01-01`, todayKey);
    items.push({
      key: 'new-year',
      label: '距离新年',
      ...newYear,
      progress: newYear.days === 0 ? 1 : ratio(elapsed, total)
    });
  }

  const weekend = daysToWeekend(todayKey);
  if (weekend) {
    // 周一到周六是一周里往周末走的路，走到就已经满格
    items.push({
      key: 'weekend',
      label: '距离周末',
      ...weekend,
      progress: weekend.days === 0 ? 1 : ratio(6 - weekend.days, 6)
    });
  }

  return items;
}
