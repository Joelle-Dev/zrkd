// 数据备份：把这台设备上的「日子」和「日记」导出成一个 JSON 文件，
// 换设备、清缓存、重装之前存一份，再导入回来。
//
// 只导出用户记录，不导出历史缓存（按月拉的百科数据，随时能重新拉）。
// 导入按 id 合并：同 id 覆盖，缺的补上，绝不动本地已有但备份里没有的记录。

import { getAll, putRecord } from './db.js';
import { uid } from './id.js';
import { validateEvent } from './events.js';
import { validateDiary } from './diary.js';

export const BACKUP_KIND = 'zhirikede-backup';
export const BACKUP_VERSION = 1;

export async function exportBackup() {
  const [events, diaries] = await Promise.all([getAll('events'), getAll('diary')]);
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    events,
    diaries
  };
}

export function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

/** 备份文件名：zhirikede-backup-20261119.json */
export function backupFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `zhirikede-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`;
}

function cleanRecord(raw, validate, prefix) {
  if (!raw || typeof raw !== 'object') return null;
  const { ok, value } = validate(raw);
  if (!ok) return null;
  const now = Date.now();
  return {
    ...value,
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : uid(prefix),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now
  };
}

/**
 * 解析备份文本。不碰数据库，只做形状与内容校验，
 * 坏掉的记录直接丢弃而不是让整个导入失败。
 * 返回 { ok, error?, value?: { events, diaries } }。
 */
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(String(text || ''));
  } catch (err) {
    return { ok: false, error: '这不是一个备份文件' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: '这不是一个备份文件' };
  if (raw.kind !== BACKUP_KIND) return { ok: false, error: '不是「指日可待」的备份文件' };
  if (Number(raw.version) > BACKUP_VERSION) {
    return { ok: false, error: '备份来自更新的版本，先把 App 升级再导入' };
  }

  const events = (Array.isArray(raw.events) ? raw.events : [])
    .map((item) => cleanRecord(item, validateEvent, 'ev'))
    .filter(Boolean);
  const diaries = (Array.isArray(raw.diaries) ? raw.diaries : [])
    .map((item) => cleanRecord(item, validateDiary, 'dy'))
    .filter(Boolean);

  return { ok: true, value: { events, diaries } };
}

/**
 * 导入备份（按 id 合并）。返回写入条数 { events, diaries }。
 * 文件不对直接抛错，导入过程中已有数据不会被删除。
 */
export async function importBackup(text) {
  const parsed = parseBackup(text);
  if (!parsed.ok) throw new Error(parsed.error);

  const { events, diaries } = parsed.value;
  await Promise.all([
    ...events.map((record) => putRecord('events', record)),
    ...diaries.map((record) => putRecord('diary', record))
  ]);

  return { events: events.length, diaries: diaries.length };
}
