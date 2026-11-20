// 倒数日的纯日期逻辑。
//
// 约定：事件只保存「日历日」字符串 YYYY-MM-DD，从不保存时间戳。
// 天数差全部走 Date.UTC(y, m - 1, d)，因此不受时区与夏令时影响；
// 「今天」才用本地时间取年月日。这是整个 App 日期正确性的地基。

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 日子的重复方式 */
export const REPEAT_OPTIONS = Object.freeze([
  { key: 'none', label: '只这一次' },
  { key: 'yearly', label: '每年' }
]);

export function isRepeatKey(value) {
  return REPEAT_OPTIONS.some((item) => item.key === value);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function dateKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 解析 YYYY-MM-DD；非法日期（如 2026-02-30）返回 null */
export function parseDateKey(key) {
  const match = DATE_KEY_RE.exec(String(key || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidDateKey(key) {
  return Boolean(parseDateKey(key));
}

export function dateKeyFromParts(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function utcDayNumber(key) {
  const parts = parseDateKey(key);
  if (!parts) return null;
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

/** to - from，单位天。任一非法返回 null */
export function diffDays(fromKey, toKey) {
  const from = utcDayNumber(fromKey);
  const to = utcDayNumber(toKey);
  if (from === null || to === null) return null;
  return to - from;
}

/**
 * 每年重复的日子：找到今天之后（含今天）最近的一次。
 * 原始日期本身还没到时就是它自己；2 月 29 日落在平年按 2 月 28 日算。
 * 返回 YYYY-MM-DD；日期非法返回 null。
 */
export function nextYearlyOccurrence(targetKey, todayKey = dateKeyOf()) {
  const parts = parseDateKey(targetKey);
  const today = parseDateKey(todayKey);
  if (!parts || !today) return null;

  const month = parts.month;
  // 2 月 29 日的生日：落在平年就按 2 月 28 日过
  const dayOf = (year) => (parts.day === 29 && month === 2 && !isLeapYear(year) ? 28 : parts.day);

  // 起点取「原始年份」和「今年」里更晚的那个，多给一年兜住跨年的情况
  const startYear = Math.max(parts.year, today.year);
  for (let year = startYear; year <= startYear + 1; year += 1) {
    const key = dateKeyFromParts(year, month, dayOf(year));
    if (key >= todayKey) return key;
  }
  return null;
}

/**
 * 把一个日子解释成可展示的状态。
 * 目标日在未来就倒数，在过去就正着数已经过了多少天。
 * 每年重复的日子始终指向「下一次」，所以永远在倒数，不会停在「已经 N 天」。
 *
 * 返回 { signed, days, kind, label, targetKey, occurrenceKey, yearsPassed, totalDays }：
 *   signed > 0  未来（还有 N 天）
 *   signed = 0  就是今天
 *   signed < 0  过去（已经 N 天）
 * days 永远是绝对值。
 * occurrenceKey 是这次真正在数的那一天（非重复时等于 targetKey）。
 * yearsPassed 是重复日子里这是第几周年（从原始年份算起）。
 * totalDays 是重复日子里从原始日期到今天一共走过多少天（当天为 0）。
 */
export function describeEvent(event, todayKey = dateKeyOf()) {
  const targetKey = event?.targetDate;
  const yearly = event?.repeat === 'yearly';
  const occurrenceKey = yearly ? nextYearlyOccurrence(targetKey, todayKey) : targetKey;

  if (!occurrenceKey) {
    return {
      signed: null, days: 0, kind: 'invalid', label: '日期无效',
      targetKey, occurrenceKey: null, yearsPassed: 0, totalDays: null
    };
  }

  const signed = diffDays(todayKey, occurrenceKey);
  const extras = {
    targetKey,
    occurrenceKey,
    yearsPassed: 0,
    totalDays: null
  };

  if (signed === null) {
    return { signed: null, days: 0, kind: 'invalid', label: '日期无效', ...extras };
  }

  if (yearly) {
    const original = parseDateKey(targetKey);
    const occurrence = parseDateKey(occurrenceKey);
    if (original && occurrence) extras.yearsPassed = occurrence.year - original.year;
    extras.totalDays = diffDays(targetKey, todayKey);
  }

  if (signed === 0) {
    return { signed, days: 0, kind: 'today', label: '就是今天', ...extras };
  }

  if (signed > 0) {
    return { signed, days: signed, kind: 'countdown', label: '还有', ...extras };
  }

  return { signed, days: -signed, kind: 'past', label: '已经', ...extras };
}

export function formatDateCN(key) {
  const parts = parseDateKey(key);
  if (!parts) return '';
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

/**
 * 同一年的日期省掉年份：2026年11月19日 → 11月19日。
 * 跨年才显示年份，列表里少一截噪音。
 */
export function formatDateShort(key, baseKey = dateKeyOf()) {
  const parts = parseDateKey(key);
  if (!parts) return '';
  const base = parseDateKey(baseKey);
  if (base && base.year === parts.year) return `${parts.month}月${parts.day}日`;
  return formatDateCN(key);
}

export function formatDateDot(key) {
  const parts = parseDateKey(key);
  if (!parts) return '';
  return `${parts.year}.${pad2(parts.month)}.${pad2(parts.day)}`;
}

export function weekdayCN(key) {
  const parts = parseDateKey(key);
  if (!parts) return '';
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return `周${names[date.getUTCDay()]}`;
}

/** 排序：今天最靠前，未来的按由近到远，过去的按由近到远排在后面 */
export function sortEventsByUrgency(events, todayKey = dateKeyOf()) {
  const urgency = (event) => {
    const desc = describeEvent(event, todayKey);
    if (desc.signed === null) return Number.MAX_SAFE_INTEGER;
    if (desc.kind === 'today') return -1;
    if (desc.kind === 'countdown') return desc.signed;
    return 1e6 + desc.days;
  };

  return [...events].sort((a, b) => {
    const diff = urgency(a) - urgency(b);
    if (diff !== 0) return diff;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}
