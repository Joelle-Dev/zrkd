// 倒数日的纯日期逻辑。
//
// 约定：事件只保存「日历日」字符串 YYYY-MM-DD，从不保存时间戳。
// 天数差全部走 Date.UTC(y, m - 1, d)，因此不受时区与夏令时影响；
// 「今天」才用本地时间取年月日。这是整个 App 日期正确性的地基。

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
 * 把一个事件解释成可展示的状态。
 * 返回 { signed, days, kind, label, mode }：
 *   signed > 0  未来（还有 N 天）
 *   signed = 0  就是今天
 *   signed < 0  过去（已过 N 天）
 * days 永远是绝对值。
 */
export function describeEvent(event, todayKey = dateKeyOf()) {
  const targetKey = event?.targetDate;
  const signed = diffDays(todayKey, targetKey);
  if (signed === null) {
    return { signed: null, days: 0, kind: 'invalid', label: '日期无效', mode: event?.mode || 'auto', targetKey };
  }

  const mode = event?.mode === 'countdown' || event?.mode === 'anniversary'
    ? event.mode
    : 'auto';

  if (signed === 0) {
    return { signed, days: 0, kind: 'today', label: '就是今天', mode, targetKey };
  }

  if (signed > 0) {
    const label = mode === 'anniversary' ? '距离' : '还有';
    return { signed, days: signed, kind: 'countdown', label, mode, targetKey };
  }

  return { signed, days: -signed, kind: 'anniversary', label: '已经', mode, targetKey };
}

/** 主数字下面的辅助文案 */
export function subLabelFor(desc) {
  if (desc.kind === 'today') return '今天';
  return desc.kind === 'countdown' || desc.kind === 'anniversary' ? '天' : '';
}

export function formatDateCN(key) {
  const parts = parseDateKey(key);
  if (!parts) return '';
  return `${parts.year}年${parts.month}月${parts.day}日`;
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

export function targetYear(event) {
  return parseDateKey(event?.targetDate)?.year ?? null;
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
