import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODS,
  countDiariesByEvent,
  diariesForEvent,
  groupDiariesByDate,
  moodOf,
  normalizeDiaryInput,
  sortDiaries,
  validateDiary,
  deriveTitle,
  titleInBody,
  diaryExcerpt
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

test('diariesForEvent 只取关联到该日子的，且时间倒序', () => {
  const list = [
    { id: 'a', date: '2026-11-18', createdAt: 1, eventId: 'ev_1' },
    { id: 'b', date: '2026-11-19', createdAt: 2, eventId: 'ev_2' },
    { id: 'c', date: '2026-11-19', createdAt: 9, eventId: 'ev_1' },
    { id: 'd', date: '2026-11-20', createdAt: 3 }
  ];
  assert.deepEqual(diariesForEvent(list, 'ev_1').map((item) => item.id), ['c', 'a']);
  assert.deepEqual(diariesForEvent(list, ''), []);
  assert.deepEqual(diariesForEvent(list, 'ev_none'), []);
});

test('countDiariesByEvent 只统计有效关联', () => {
  const list = [
    { id: 'a', eventId: 'ev_1' },
    { id: 'b', eventId: 'ev_1' },
    { id: 'c', eventId: 'ev_2' },
    { id: 'd' },
    { id: 'e', eventId: '' }
  ];
  assert.deepEqual(countDiariesByEvent(list), { ev_1: 2, ev_2: 1 });
  assert.deepEqual(countDiariesByEvent([]), {});
});

test('deriveTitle 取正文第一行并去掉 Markdown 符号', () => {
  assert.equal(deriveTitle('**秋天的第一杯**\n正文'), '秋天的第一杯');
  assert.equal(deriveTitle('\n\n# 标题\n正文'), '标题');
  assert.equal(deriveTitle('~~删掉~~ 剩下的'), '删掉 剩下的');
  assert.equal(deriveTitle(''), '');
  assert.equal(deriveTitle('   '), '');
});

test('deriveTitle 超过 60 字截断', () => {
  assert.equal(deriveTitle('字'.repeat(100)).length, 60);
});

test('titleInBody 判断旧标题是否已在正文首行', () => {
  assert.equal(titleInBody('秋天', '**秋天**\n正文'), true);
  assert.equal(titleInBody('秋天', '别的标题\n正文'), false);
  assert.equal(titleInBody('', '正文'), true);
  assert.equal(titleInBody('秋天', ''), false);
});

test('normalizeDiaryInput 没有显式标题时从正文派生', () => {
  const value = normalizeDiaryInput({ date: '2026-11-19', body: '**第一行标题**\n内容' });
  assert.equal(value.title, '第一行标题');
  assert.equal(value.body, '**第一行标题**\n内容');
});

test('diaryExcerpt 标题是正文第一行时剥掉首行', () => {
  const body = '今天下雨了\n\n出门没带伞，挺贵的。';
  assert.equal(diaryExcerpt(body, '今天下雨了'), '出门没带伞，挺贵的。');
});

test('diaryExcerpt 标题带 Markdown 修饰也能剥掉首行', () => {
  assert.equal(diaryExcerpt('**今天下雨了**\n正文', '今天下雨了'), '正文');
});

test('diaryExcerpt 标题不在正文里时保留全文（老数据）', () => {
  const body = '第一行\n第二行';
  assert.equal(diaryExcerpt(body, '老标题'), '第一行\n第二行');
});

test('diaryExcerpt 只有一行（就是标题）时返回空', () => {
  assert.equal(diaryExcerpt('今天下雨了', '今天下雨了'), '');
  assert.equal(diaryExcerpt('今天下雨了\n\n\n', '今天下雨了'), '');
});

test('diaryExcerpt 空正文/无标题时安全返回', () => {
  assert.equal(diaryExcerpt('', '标题'), '');
  assert.equal(diaryExcerpt('', ''), '');
  assert.equal(diaryExcerpt(undefined, undefined), '');
  assert.equal(diaryExcerpt('没有标题的正文', ''), '没有标题的正文');
});

test('diaryExcerpt 剥掉首行后保留剩余段落', () => {
  const body = '标题\n\n第一段\n\n第二段';
  assert.equal(diaryExcerpt(body, '标题'), '第一段\n\n第二段');
});
