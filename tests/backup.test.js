import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { clearStores, getAll } from '../src/lib/db.js';
import { saveEvent } from '../src/lib/events.js';
import { saveDiary } from '../src/lib/diary.js';
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  backupFilename,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup
} from '../src/lib/backup.js';

test.beforeEach(async () => {
  await clearStores();
});

test('导出包含全部记录与元信息', async () => {
  await saveEvent({ title: '在一起', targetDate: '2024-05-20' });
  await saveDiary({ date: '2026-11-18', title: '第一天', text: '写点什么' });

  const backup = await exportBackup();
  assert.equal(backup.kind, BACKUP_KIND);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.ok(backup.exportedAt);
  assert.equal(backup.events.length, 1);
  assert.equal(backup.diaries.length, 1);
  assert.equal(backup.events[0].title, '在一起');
  assert.equal(backup.diaries[0].title, '第一天');
});

test('导出再导入能完整还原', async () => {
  await saveEvent({ title: '在一起', targetDate: '2024-05-20', note: '第一次见面' });
  await saveDiary({ date: '2026-11-18', title: '第一天', text: '写点什么' });

  const text = serializeBackup(await exportBackup());
  await clearStores();

  const counts = await importBackup(text);
  assert.equal(counts.events, 1);
  assert.equal(counts.diaries, 1);

  const events = await getAll('events');
  const diaries = await getAll('diary');
  assert.equal(events[0].title, '在一起');
  assert.equal(events[0].note, '第一次见面');
  assert.equal(diaries[0].title, '第一天');
  assert.equal(diaries[0].text, '写点什么');
});

test('导入按 id 合并，不删本地已有记录', async () => {
  const kept = await saveEvent({ title: '本地独有', targetDate: '2026-01-01' });
  const text = serializeBackup({
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    events: [{ id: 'ev_import', title: '备份里来', targetDate: '2026-02-02', createdAt: 10, updatedAt: 10 }],
    diaries: []
  });

  await importBackup(text);

  const events = await getAll('events');
  assert.equal(events.length, 2);
  assert.ok(events.some((item) => item.id === kept.id));
  const imported = events.find((item) => item.id === 'ev_import');
  assert.equal(imported.title, '备份里来');
});

test('导入时同 id 覆盖', async () => {
  const record = await saveEvent({ title: '旧标题', targetDate: '2026-01-01' });
  const text = serializeBackup({
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    events: [{ id: record.id, title: '新标题', targetDate: '2026-01-01' }],
    diaries: []
  });

  await importBackup(text);

  const events = await getAll('events');
  assert.equal(events.length, 1);
  assert.equal(events[0].title, '新标题');
});

test('parseBackup 拒绝坏文件', () => {
  assert.equal(parseBackup('不是 JSON').ok, false);
  assert.equal(parseBackup('null').ok, false);
  assert.equal(parseBackup(JSON.stringify({ hello: 'world' })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ kind: 'other-app', version: 1 })).ok, false);

  const future = parseBackup(JSON.stringify({ kind: BACKUP_KIND, version: 999, events: [], diaries: [] }));
  assert.equal(future.ok, false);
  assert.match(future.error, /升级/);
});

test('parseBackup 丢弃坏记录，保留好的', () => {
  const parsed = parseBackup(JSON.stringify({
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    events: [
      { id: 'ev_ok', title: '好记录', targetDate: '2026-01-01' },
      { id: 'ev_bad', title: '', targetDate: '2026-01-01' },
      { id: 'ev_bad_date', title: '坏日期', targetDate: '2026-02-30' },
      null,
      '串'
    ],
    diaries: [
      { id: 'dy_ok', date: '2026-11-18', title: '', text: '有正文就行' }
    ]
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.events.length, 1);
  assert.equal(parsed.value.events[0].id, 'ev_ok');
  assert.equal(parsed.value.diaries.length, 1);
});

test('parseBackup 给缺 id 的记录补一个', () => {
  const parsed = parseBackup(JSON.stringify({
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    events: [{ title: '没 id', targetDate: '2026-01-01' }],
    diaries: []
  }));

  assert.equal(parsed.ok, true);
  assert.match(parsed.value.events[0].id, /^ev_/);
});

test('backupFilename 形如 zhirikede-backup-YYYYMMDD.json', () => {
  assert.equal(backupFilename(new Date(2026, 10, 19)), 'zhirikede-backup-20261119.json');
});
