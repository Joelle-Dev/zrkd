import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { clearStores, getSetting, setSetting, getAll } from '../src/lib/db.js';
import { listEvents, getEvent, saveEvent, removeEvent, restoreEvent, duplicateEvent, validateEvent } from '../src/lib/events.js';

test.beforeEach(async () => {
  await clearStores();
});

test('settings 读写', async () => {
  assert.equal(await getSetting('missing', 'fallback'), 'fallback');
  await setSetting('history-online', true);
  assert.equal(await getSetting('history-online'), true);
});

test('saveEvent 写入并返回完整记录', async () => {
  const record = await saveEvent({
    title: '在一起',
    targetDate: '2024-05-20',
    mode: 'auto',
    accent: '#c2564a',
    note: '第一次见面'
  });
  assert.ok(record.id.startsWith('ev_'));
  assert.equal(record.title, '在一起');
  assert.equal(record.targetDate, '2024-05-20');
  assert.ok(record.createdAt > 0);
  assert.equal(record.updatedAt, record.createdAt);

  const all = await listEvents();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, record.id);
});

test('saveEvent 校验标题与日期', async () => {
  await assert.rejects(() => saveEvent({ title: '', targetDate: '2026-01-01' }), /名字/);
  await assert.rejects(() => saveEvent({ title: '测试', targetDate: '2026-02-30' }), /日期/);
  await assert.rejects(() => saveEvent({ title: '测试', targetDate: '1800-01-01' }), /年份/);
});

test('validateEvent 规范化输入', () => {
  const badAccent = validateEvent({ title: ' x ', targetDate: '2026-01-01', accent: 'nope' });
  assert.equal(badAccent.ok, true);
  assert.equal(badAccent.value.title, 'x');
  assert.equal(badAccent.value.accent, '#c2564a');

  const badMode = validateEvent({ title: 'y', targetDate: '2026-01-01', mode: 'weird' });
  assert.equal(badMode.value.mode, 'auto');
});

test('更新时保留 id 与 createdAt', async () => {
  const first = await saveEvent({ title: '旧名', targetDate: '2026-01-01' });
  await new Promise((resolve) => setTimeout(resolve, 6));
  const second = await saveEvent({ title: '新名', targetDate: '2026-02-02' }, first);
  assert.equal(second.id, first.id);
  assert.equal(second.createdAt, first.createdAt);
  assert.ok(second.updatedAt > first.updatedAt);
  assert.equal((await listEvents()).length, 1);
});

test('删除与恢复', async () => {
  const record = await saveEvent({ title: '要删的', targetDate: '2026-03-03' });
  await removeEvent(record.id);
  assert.equal(await getEvent(record.id), undefined);

  await restoreEvent(record);
  const back = await getEvent(record.id);
  assert.equal(back.title, '要删的');
});

test('duplicateEvent 复制标题', async () => {
  const record = await saveEvent({ title: '原件', targetDate: '2026-04-04' });
  const copy = await duplicateEvent(record.id);
  assert.notEqual(copy.id, record.id);
  assert.equal(copy.title, '原件 副本');
  assert.equal(copy.targetDate, '2026-04-04');
});

test('标题与备注长度被截断', async () => {
  const record = await saveEvent({
    title: 'x'.repeat(80),
    targetDate: '2026-05-05',
    note: 'n'.repeat(300)
  });
  assert.equal(record.title.length, 40);
  assert.equal(record.note.length, 120);
});

test('getAll 在没有数据时返回空数组', async () => {
  assert.deepEqual(await getAll('events'), []);
});
