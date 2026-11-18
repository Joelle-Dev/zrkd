// 「历史上的今天」：联网抓百度百科的静态 JSON，按月缓存。
//
// 接口不是官方文档化的，随时可能失效，所以：
//   1. 完全可选，失败静默，绝不影响主流程；
//   2. 抓到的当月数据存进 IndexedDB，离线/失效时用缓存；
//   3. 只保留少量字段，切掉 HTML 与超长描述，减小存储。

import { getSetting, setSetting } from './db.js';
import { parseDateKey } from './countdown.js';

const SOURCE_BASE = 'https://baike.baidu.com/cms/home/eventsOnHistory';
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_EVENTS = 6;

const TYPE_LABELS = Object.freeze({
  event: '事件',
  birth: '出生',
  death: '逝世'
});

function cacheKeyOf(month) {
  return `history:${String(month).padStart(2, '0')}`;
}

export function stripHtml(input) {
  return String(input || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** 把接口里的一条记录整理成只含必要字段的形状 */
export function normalizeEvent(raw) {
  if (!raw) return null;
  const title = stripHtml(raw.title);
  if (!title) return null;
  const desc = stripHtml(raw.desc);
  return {
    year: String(raw.year || '').trim(),
    title,
    type: TYPE_LABELS[raw.type] ? raw.type : 'event',
    typeLabel: TYPE_LABELS[raw.type] || '事件',
    festival: stripHtml(raw.festival),
    desc,
    recommend: Boolean(raw.recommend),
    link: typeof raw.link === 'string' && /^https?:\/\//.test(raw.link) ? raw.link : ''
  };
}

/** 从整月数据里取出某一天（MMDD），排序：推荐优先，其次事件优先 */
export function pickDayEvents(monthPayload, month, day, { max = MAX_EVENTS } = {}) {
  const monthKey = String(month).padStart(2, '0');
  const dayKey = `${monthKey}${String(day).padStart(2, '0')}`;
  const rows = monthPayload?.[monthKey]?.[dayKey];
  if (!Array.isArray(rows)) return [];

  const seen = new Set();
  const normalized = [];
  for (const row of rows) {
    const item = normalizeEvent(row);
    if (!item) continue;
    const dedupe = `${item.year}|${item.title}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    normalized.push(item);
  }

  const rank = (item) => (item.recommend ? 0 : 2) + (item.type === 'event' ? 0 : 1);
  return normalized
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .slice(0, max)
    .map((entry) => entry.item);
}

async function fetchMonthPayload(month) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${SOURCE_BASE}/${String(month).padStart(2, '0')}.json`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function isFresh(cache) {
  return Boolean(cache?.fetchedAt) && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

/**
 * 取某一天的历史事件。
 * 返回 { events, source: 'network' | 'cache' | 'none', stale }。
 * 永不抛错。
 */
export async function loadHistory(todayKey, { online = true, force = false } = {}) {
  const parts = parseDateKey(todayKey);
  if (!parts) return { events: [], source: 'none', stale: false };

  const key = cacheKeyOf(parts.month);
  let cached = null;
  try {
    cached = await getSetting(key, null);
  } catch (err) {
    cached = null;
  }

  const fromCache = () => ({
    events: pickDayEvents(cached?.payload, parts.month, parts.day),
    source: 'cache',
    stale: !isFresh(cached)
  });

  if (!online) {
    return cached ? fromCache() : { events: [], source: 'none', stale: false };
  }
  if (cached && isFresh(cached) && !force) {
    const result = fromCache();
    return result.events.length ? result : { events: [], source: 'none', stale: false };
  }

  try {
    const payload = await fetchMonthPayload(parts.month);
    const events = pickDayEvents(payload, parts.month, parts.day);
    if (!events.length) {
      return cached ? fromCache() : { events: [], source: 'none', stale: false };
    }
    setSetting(key, { fetchedAt: Date.now(), payload }).catch(() => {});
    return { events, source: 'network', stale: false };
  } catch (err) {
    return cached ? fromCache() : { events: [], source: 'none', stale: false };
  }
}

export async function clearHistoryCache() {
  const keys = Array.from({ length: 12 }, (_, i) => cacheKeyOf(i + 1));
  const { deleteRecord } = await import('./db.js');
  await Promise.all(keys.map((key) => deleteRecord('settings', key).catch(() => {})));
}
