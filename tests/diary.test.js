import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODS,
  groupDiariesByDate,
  moodOf,
  normalizeDiaryInput,
  sortDiaries,
  validateDiary
} from '../src/lib/diary.js';

test('MOODS 覆盖五种心情且 key 唯一', () => {
  assert.equal(MOODS.length, 5);
  assert.equal(new Set(MOODS.map((m) => m.key)).size, 5);
  assert.ok(MOODS.every((m) => m.emoji && m.label));
});

test('moodOf 找不到时返回 null', () => {
  assert.equal(moodOf('happy').label, '开心');
  assert.equal(moodOf('nope'), null);
  assert.equal(moodOf(''), null);
});

test('normalizeDiaryInput 截断文本并丢弃非法字段', () => {
  const value = normalizeDiaryInput({
    date: '2026-11-19',
    text: '  今天很好  ',
    mood: 'weird',
    photo: 'https://example.com/x.jpg',
    eventId: 'ev_1'
  });
  assert.equal(value.text, '今天很好');
  assert.equal(value.mood, '');
  assert.equal(value.photo, '');
  assert.equal(value.eventId, 'ev_1');
});

test('normalizeDiaryInput 保留 data URL 配图', () => {
  const photo = `data:image/jpeg;base64,${'A'.repeat(64)}`;
  assert.equal(normalizeDiaryInput({ text: 'x', photo }).photo, photo);
});

test('normalizeDiaryInput 超长正文截断到 4000', () => {
  const value = normalizeDiaryInput({ text: '字'.repeat(6000) });
  assert.equal(value.text.length, 4000);
});

test('validateDiary 要求有文字或图片', () => {
  assert.equal(validateDiary({ date: '2026-11-19' }).ok, false);
  assert.equal(validateDiary({ date: '2026-11-19', text: '   ' }).ok, false);
  assert.equal(validateDiary({ date: '2026-11-19', text: '写了' }).ok, true);
  assert.equal(
    validateDiary({ date: '2026-11-19', photo: 'data:image/jpeg;base64,AAA' }).ok,
    true
  );
});

test('validateDiary 拒绝非法日期', () => {
  assert.equal(validateDiary({ date: '2026-02-30', text: 'x' }).ok, false);
  assert.equal(validateDiary({ date: 'nope', text: 'x' }).ok, false);
});

test('validateDiary 缺省日期用今天', () => {
  const result = validateDiary({ text: 'x' });
  assert.equal(result.ok, true);
  assert.match(result.value.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('sortDiaries 日期倒序，同日按创建时间倒序', () => {
  const list = [
    { id: 'a', date: '2026-11-18', createdAt: 1 },
    { id: 'b', date: '2026-11-19', createdAt: 2 },
    { id: 'c', date: '2026-11-19', createdAt: 9 }
  ];
  assert.deepEqual(sortDiaries(list).map((item) => item.id), ['c', 'b', 'a']);
});

test('sortDiaries 不改动原数组', () => {
  const list = [
    { id: 'a', date: '2026-11-18', createdAt: 1 },
    { id: 'b', date: '2026-11-19', createdAt: 2 }
  ];
  const copy = [...list];
  sortDiaries(list);
  assert.deepEqual(list, copy);
});

test('groupDiariesByDate 按日分组，日期倒序', () => {
  const list = [
    { id: 'a', date: '2026-11-18', createdAt: 1 },
    { id: 'b', date: '2026-11-19', createdAt: 2 },
    { id: 'c', date: '2026-11-19', createdAt: 3 }
  ];
  const groups = groupDiariesByDate(list);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-11-19');
  assert.deepEqual(groups[0].items.map((i) => i.id), ['c', 'b']);
  assert.equal(groups[1].date, '2026-11-18');
});

test('groupDiariesByDate 空列表返回空数组', () => {
  assert.deepEqual(groupDiariesByDate([]), []);
});
