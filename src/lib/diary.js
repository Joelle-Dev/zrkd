// 日记的纯数据逻辑与 IndexedDB 读写。
//
// 一天可以写多条，按日期 + 创建时间倒序排。
// 配图以压缩后的 data URL 存进同一条记录，避免额外管理 blob 生命周期。

import { deleteRecord, getAll, getRecord, putRecord } from './db.js';
import { dateKeyOf, isValidDateKey } from './countdown.js';
import { uid } from './id.js';
import { htmlToText, sanitizeHtml, textToHtml } from './richtext.js';

export const MOODS = Object.freeze([
  { key: 'happy', emoji: '😊', label: '开心' },
  { key: 'calm', emoji: '🙂', label: '平静' },
  { key: 'tired', emoji: '😪', label: '累了' },
  { key: 'sad', emoji: '😔', label: '难过' },
  { key: 'angry', emoji: '😤', label: '生气' }
]);

const MOOD_KEYS = new Set(MOODS.map((mood) => mood.key));

const TITLE_MAX = 60;
const TEXT_MAX = 4000;
const PHOTO_MAX_CHARS = 900_000; // 约 660KB 二进制，压缩后够用

export function moodOf(key) {
  return MOODS.find((mood) => mood.key === key) || null;
}

export function normalizeDiaryInput(input = {}) {
  const date = String(input.date || '').trim() || dateKeyOf();
  const mood = MOOD_KEYS.has(input.mood) ? input.mood : '';
  const photo = typeof input.photo === 'string' && input.photo.startsWith('data:image/')
    ? input.photo.slice(0, PHOTO_MAX_CHARS)
    : '';

  // 兼容旧数据：没有 html 字段时，把纯文本按换行转成 HTML
  const rawHtml = typeof input.html === 'string' && input.html
    ? input.html
    : textToHtml(input.text);
  const html = sanitizeHtml(rawHtml).slice(0, TEXT_MAX * 8);
  const text = htmlToText(html).slice(0, TEXT_MAX);
  // 正文被截断时，html 也要跟着收敛，避免存下看不到的内容
  const safeHtml = text.length >= TEXT_MAX ? textToHtml(text) : html;

  return {
    date,
    title: String(input.title || '').trim().slice(0, TITLE_MAX),
    text,
    html: safeHtml,
    mood,
    photo,
    eventId: String(input.eventId || '').trim().slice(0, 60)
  };
}

export function validateDiary(input) {
  const value = normalizeDiaryInput(input);
  if (!value.text && !value.title && !value.photo) {
    return { ok: false, error: '写两句吧，或者扔张照片进来' };
  }
  if (!isValidDateKey(value.date)) return { ok: false, error: '日期有点离谱，检查下' };
  return { ok: true, value };
}

export async function listDiaries() {
  return getAll('diary');
}

export async function getDiary(id) {
  return getRecord('diary', id);
}

export async function saveDiary(input, existing = null) {
  const { ok, error, value } = validateDiary(input);
  if (!ok) throw new Error(error);

  const now = Date.now();
  const record = {
    ...(existing || {}),
    ...value,
    id: existing?.id || input.id || uid('dy'),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  await putRecord('diary', record);
  return record;
}

export async function removeDiary(id) {
  await deleteRecord('diary', id);
}

/** 按日期倒序、同一天内按创建时间倒序 */
export function sortDiaries(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/** 把日记按日期分组，返回 [{ date, items }]，日期倒序 */
export function groupDiariesByDate(list) {
  const sorted = sortDiaries(list);
  const groups = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}
