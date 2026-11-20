import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKeyOf,
  parseDateKey,
  isValidDateKey,
  dateKeyFromParts,
  diffDays,
  describeEvent,
  nextYearlyOccurrence,
  formatDateCN,
  formatDateDot,
  formatDateShort,
  weekdayCN,
  sortEventsByUrgency
} from '../src/lib/countdown.js';

test('dateKeyOf 用本地年月日', () => {
  assert.equal(dateKeyOf(new Date(2026, 0, 2)), '2026-01-02');
  assert.equal(dateKeyOf(new Date(2026, 10, 18)), '2026-11-18');
});

test('parseDateKey 拒绝非法日期', () => {
  assert.equal(parseDateKey('2026-02-30'), null);
  assert.equal(parseDateKey('2026-13-01'), null);
  assert.equal(parseDateKey('2026-1-1'), null);
  assert.equal(parseDateKey('abc'), null);
  assert.equal(parseDateKey(''), null);
  assert.deepEqual(parseDateKey('2024-02-29'), { year: 2024, month: 2, day: 29 });
  assert.equal(isValidDateKey('2023-02-29'), false);
});

test('diffDays 不受时区与夏令时影响', () => {
  assert.equal(diffDays('2026-03-01', '2026-03-02'), 1);
  assert.equal(diffDays('2026-03-08', '2026-03-09'), 1);
  assert.equal(diffDays('2026-11-01', '2026-11-02'), 1);
  assert.equal(diffDays('2024-02-28', '2024-03-01'), 2);
  assert.equal(diffDays('2026-01-01', '2026-12-31'), 364);
  assert.equal(diffDays('2026-01-01', '2027-01-01'), 365);
  assert.equal(diffDays('bad', '2026-01-01'), null);
});

test('跨闰日与跨年', () => {
  assert.equal(diffDays('2024-02-28', '2024-02-29'), 1);
  assert.equal(diffDays('2024-12-31', '2025-01-01'), 1);
  assert.equal(diffDays('2026-06-15', '2025-06-15'), -365);
});

test('describeEvent 三种状态', () => {
  const today = '2026-11-18';

  const future = describeEvent({ targetDate: '2026-12-01' }, today);
  assert.equal(future.kind, 'countdown');
  assert.equal(future.days, 13);
  assert.equal(future.signed, 13);
  assert.equal(future.label, '还有');

  const same = describeEvent({ targetDate: today }, today);
  assert.equal(same.kind, 'today');
  assert.equal(same.days, 0);

  const past = describeEvent({ targetDate: '2026-11-01' }, today);
  assert.equal(past.kind, 'past');
  assert.equal(past.days, 17);
  assert.equal(past.signed, -17);
  assert.equal(past.label, '已经');
});

test('describeEvent 对非法日期给 invalid', () => {
  const desc = describeEvent({ targetDate: '2026-02-30' }, '2026-11-18');
  assert.equal(desc.kind, 'invalid');
  assert.equal(desc.signed, null);
  assert.equal(desc.days, 0);
});

test('describeEvent 不再看 mode，只看日期方向', () => {
  const future = describeEvent({ targetDate: '2026-12-01', mode: 'anniversary' }, '2026-11-18');
  assert.equal(future.kind, 'countdown');
  assert.equal(future.label, '还有');
  const past = describeEvent({ targetDate: '2026-11-01', mode: 'countdown' }, '2026-11-18');
  assert.equal(past.kind, 'past');
  assert.equal(past.label, '已经');
});

test('nextYearlyOccurrence：今年还没到就是今年，到了就看明年', () => {
  assert.equal(nextYearlyOccurrence('2015-12-01', '2026-11-18'), '2026-12-01');
  assert.equal(nextYearlyOccurrence('2015-11-01', '2026-11-18'), '2027-11-01');
  assert.equal(nextYearlyOccurrence('2015-11-18', '2026-11-18'), '2026-11-18');
  assert.equal(nextYearlyOccurrence('bad', '2026-11-18'), null);
});

test('nextYearlyOccurrence：2 月 29 日在平年落到 2 月 28 日', () => {
  assert.equal(nextYearlyOccurrence('2024-02-29', '2025-01-01'), '2025-02-28');
  assert.equal(nextYearlyOccurrence('2024-02-29', '2028-01-01'), '2028-02-29');
});

test('nextYearlyOccurrence：起始日还没到时就是它自己', () => {
  assert.equal(nextYearlyOccurrence('2030-03-05', '2026-11-18'), '2030-03-05');
});

test('describeEvent repeat=yearly 始终指向下一次', () => {
  const today = '2026-11-18';
  const birthday = describeEvent({ targetDate: '2015-12-01', repeat: 'yearly' }, today);
  assert.equal(birthday.kind, 'countdown');
  assert.equal(birthday.days, 13);
  assert.equal(birthday.label, '还有');
  assert.equal(birthday.occurrenceKey, '2026-12-01');
  assert.equal(birthday.yearsPassed, 11);
  assert.equal(birthday.totalDays, diffDays('2015-12-01', today));

  // 今年已经过了，就数到明年，而不是「已经 N 天」
  const passed = describeEvent({ targetDate: '2015-11-01', repeat: 'yearly' }, today);
  assert.equal(passed.kind, 'countdown');
  assert.equal(passed.occurrenceKey, '2027-11-01');
  assert.equal(passed.yearsPassed, 12);

  // 正日子当天
  const onDay = describeEvent({ targetDate: '2015-11-18', repeat: 'yearly' }, today);
  assert.equal(onDay.kind, 'today');
  assert.equal(onDay.occurrenceKey, today);
  assert.equal(onDay.yearsPassed, 11);
});

test('describeEvent repeat=none 时不计算 occurrenceKey 之外的新字段', () => {
  const desc = describeEvent({ targetDate: '2026-12-01' }, '2026-11-18');
  assert.equal(desc.occurrenceKey, '2026-12-01');
  assert.equal(desc.yearsPassed, 0);
  assert.equal(desc.totalDays, null);
});

test('格式化', () => {
  assert.equal(formatDateCN('2026-11-18'), '2026年11月18日');
  assert.equal(formatDateDot('2026-01-05'), '2026.01.05');
  assert.equal(weekdayCN('2026-11-18'), '周三');
  assert.equal(weekdayCN('2026-11-22'), '周日');
  assert.equal(formatDateCN('bad'), '');
});

test('formatDateShort 同年省年份，跨年带年份', () => {
  assert.equal(formatDateShort('2026-11-19', '2026-01-01'), '11月19日');
  assert.equal(formatDateShort('2027-01-01', '2026-12-31'), '2027年1月1日');
  assert.equal(formatDateShort('bad', '2026-01-01'), '');
});

test('dateKeyFromParts 补零', () => {
  assert.equal(dateKeyFromParts(2026, 1, 5), '2026-01-05');
  assert.equal(dateKeyFromParts(2026, 12, 31), '2026-12-31');
});

test('sortEventsByUrgency：未来的按由近到远，过去的排后面', () => {
  const today = '2026-11-18';
  const list = [
    { id: 'a', targetDate: '2027-01-01', createdAt: 1 },
    { id: 'b', targetDate: '2026-11-20', createdAt: 2 },
    { id: 'c', targetDate: '2026-01-01', createdAt: 3 },
    { id: 'd', targetDate: today, createdAt: 4 }
  ];
  const sorted = sortEventsByUrgency(list, today).map((item) => item.id);
  assert.equal(sorted[0], 'd');
  assert.equal(sorted[1], 'b');
  assert.equal(sorted[2], 'a');
  assert.equal(sorted[3], 'c');
});
