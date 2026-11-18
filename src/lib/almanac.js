// 「今天是什么日子」：农历、节气、传统节日，全部本地计算，零请求。
// 用 lunar-javascript（MIT）。它依赖 CommonJS，Vite 会自动预打包。

import { Solar } from 'lunar-javascript';
import { dateKeyOf, diffDays, parseDateKey } from './countdown.js';

const JIEQI_LABELS = Object.freeze({
  立春: '春天开始了',
  雨水: '雨水渐多',
  惊蛰: '春雷始鸣',
  春分: '昼夜平分',
  清明: '天清地明',
  谷雨: '雨生百谷',
  立夏: '夏天开始了',
  小满: '麦粒渐满',
  芒种: '忙收忙种',
  夏至: '白昼最长',
  小暑: '暑气渐盛',
  大暑: '一年最热',
  立秋: '秋天开始了',
  处暑: '暑气止息',
  白露: '露凝而白',
  秋分: '昼夜平分',
  寒露: '露有寒意',
  霜降: '初霜降临',
  立冬: '冬天开始了',
  小雪: '初雪将至',
  大雪: '雪盛之时',
  冬至: '白昼最短',
  小寒: '寒气渐重',
  大寒: '一年最冷'
});

export const SOLAR_FESTIVALS = Object.freeze({
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '04-01': '愚人节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-24': '平安夜',
  '12-25': '圣诞节'
});

function safe(fn, fallback = '') {
  try {
    return fn() ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function normalizeFestivals(list) {
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

/**
 * 某一天的日历信息。date 可以是 Date 或 YYYY-MM-DD。
 * 返回值全部是字符串/数字，方便直接渲染和缓存。
 */
export function dayInfo(input = new Date()) {
  const key = typeof input === 'string' ? input : dateKeyOf(input);
  const parts = parseDateKey(key);
  if (!parts) return null;

  let solar = null;
  try {
    solar = Solar.fromYmd(parts.year, parts.month, parts.day);
  } catch (err) {
    return null;
  }
  const lunar = solar.getLunar();

  const lunarMonth = safe(() => lunar.getMonthInChinese());
  const lunarDay = safe(() => lunar.getDayInChinese());

  const jieqi = safe(() => lunar.getJieQi()) || safe(() => lunar.getCurrentJieQi()?.getName());

  let nextJieqi = null;
  try {
    const next = lunar.getNextJieQi(true);
    if (next) {
      const nextKey = safe(() => next.getSolar().toYmd());
      if (nextKey) {
        nextJieqi = {
          name: safe(() => next.getName()),
          date: nextKey,
          inDays: diffDays(key, nextKey)
        };
      }
    }
  } catch (err) {
    nextJieqi = null;
  }

  let prevJieqi = null;
  try {
    const prev = lunar.getPrevJieQi(true);
    if (prev) {
      const prevKey = safe(() => prev.getSolar().toYmd());
      if (prevKey) {
        prevJieqi = {
          name: safe(() => prev.getName()),
          date: prevKey,
          inDays: diffDays(prevKey, key)
        };
      }
    }
  } catch (err) {
    prevJieqi = null;
  }

  const lunarFestivals = normalizeFestivals(safe(() => lunar.getFestivals(), []));
  const solarFestivals = normalizeFestivals(safe(() => solar.getFestivals(), []));
  const otherFestivals = normalizeFestivals(safe(() => lunar.getOtherFestivals(), []));

  const solarKey = `${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const extra = SOLAR_FESTIVALS[solarKey] ? [SOLAR_FESTIVALS[solarKey]] : [];

  const festivals = Array.from(new Set([...lunarFestivals, ...solarFestivals, ...otherFestivals, ...extra]));

  let lunarYearGanZhi = '';
  let zodiac = '';
  try {
    lunarYearGanZhi = `${lunar.getYearInGanZhi()}年`;
    zodiac = safe(() => lunar.getYearShengXiao());
  } catch (err) {
    lunarYearGanZhi = '';
  }

  return {
    key,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: safe(() => `周${solar.getWeekInChinese()}`),
    lunarMonth: lunarMonth ? `${lunarMonth}月` : '',
    lunarDay,
    lunarText: lunarMonth ? `${lunarMonth}月${lunarDay}` : lunarDay,
    ganZhiYear: lunarYearGanZhi,
    zodiac,
    isLeapMonth: safe(() => lunar.getMonth() < 0, false),
    jieqi,
    jieqiHint: jieqi ? JIEQI_LABELS[jieqi] || '' : '',
    prevJieqi,
    nextJieqi,
    festivals
  };
}

/** 节气的自然提示，比如「距小雪还有 4 天」 */
export function jieqiLine(info) {
  if (!info) return '';
  if (info.jieqi) {
    return `${info.jieqi}${info.jieqiHint ? ` · ${info.jieqiHint}` : ''}`;
  }
  if (info.nextJieqi?.inDays > 0) {
    return `距${info.nextJieqi.name}还有 ${info.nextJieqi.inDays} 天`;
  }
  if (info.prevJieqi?.inDays > 0) {
    return `${info.prevJieqi.name}已过 ${info.prevJieqi.inDays} 天`;
  }
  return '';
}

/** 下一年的同一天，用于「距明年今天」这类小提示 */
export function nextYearSameDay(key) {
  const parts = parseDateKey(key);
  if (!parts) return null;
  const candidate = `${parts.year + 1}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return parseDateKey(candidate) ? candidate : `${parts.year + 1}-02-28`;
}
