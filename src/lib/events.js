import { deleteRecord, getAll, getRecord, putRecord } from './db.js';
import { ACCENTS, DEFAULT_EVENT } from './constants.js';
import { isRepeatKey, isValidDateKey, parseDateKey } from './countdown.js';
import { uid } from './id.js';

function normalizeEventInput(input = {}) {
  const targetDate = String(input.targetDate || '').trim();
  const accent = ACCENTS.some((item) => item.value === input.accent)
    ? input.accent
    : DEFAULT_EVENT.accent;
  return {
    title: String(input.title || '').trim().slice(0, 40),
    targetDate,
    accent,
    note: String(input.note || '').trim().slice(0, 120),
    repeat: isRepeatKey(input.repeat) ? input.repeat : 'none'
  };
}

export function validateEvent(input) {
  const normalized = normalizeEventInput(input);
  if (!normalized.title) return { ok: false, error: '总得给它起个名字吧' };
  if (!isValidDateKey(normalized.targetDate)) return { ok: false, error: '日期有点离谱，检查下' };
  const parts = parseDateKey(normalized.targetDate);
  if (parts.year < 1900 || parts.year > 2999) return { ok: false, error: '年份跑太远了' };
  return { ok: true, value: normalized };
}

export async function listEvents() {
  return getAll('events');
}

export async function getEvent(id) {
  return getRecord('events', id);
}

export async function saveEvent(input, existing = null) {
  const { ok, error, value } = validateEvent(input);
  if (!ok) throw new Error(error);

  const now = Date.now();
  const record = {
    ...(existing || {}),
    ...value,
    id: existing?.id || input.id || uid('ev'),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  await putRecord('events', record);
  return record;
}

export async function removeEvent(id) {
  await deleteRecord('events', id);
}

