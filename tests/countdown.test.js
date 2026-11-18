import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKeyOf,
  parseDateKey,
  isValidDateKey,
  dateKeyFromParts,
  diffDays,
  describeEvent,
  subLabelFor,
  formatDateCN,
  formatDateDot,
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

  const future = describeEvent({ targetDate: '2026-12-01', mode: 'auto' }, today);
  assert.equal(future.kind, 'countdown');
  assert.equal(future.days, 13);
  assert.equal(future.signed, 13);
  assert.equal(future.label, '还有');

  const same = describeEvent({ targetDate: today, mode: 'auto' }, today);
  assert.equal(same.kind, 'today');
  assert.equal(same.days, 0);
  assert.equal(subLabelFor(same), '今天');

  const past = describeEvent({ targetDate: '2026-11-01', mode: 'auto' }, today);
  assert.equal(past.kind, 'anniversary');
  assert.equal(past.days, 17);
  assert.equal(past.signed, -17);
  assert.equal(past.label, '已经');
  assert.equal(subLabelFor(past), '天');
});

test('describeEvent 对非法日期给 invalid', () => {
  const desc = describeEvent({ targetDate: '2026-02-30' }, '2026-11-18');
  assert.equal(desc.kind, 'invalid');
  assert.equal(desc.signed, null);
  assert.equal(desc.days, 0);
});

test('describeEvent 尊重强制模式', () => {
  const future = describeEvent({ targetDate: '2026-12-01', mode: 'anniversary' }, '2026-11-18');
  assert.equal(future.label, '距离');
  const past = describeEvent({ targetDate: '2026-11-01', mode: 'countdown' }, '2026-11-18');
  assert.equal(past.kind, 'anniversary');
});

test('格式化', () => {
  assert.equal(formatDateCN('2026-11-18'), '2026年11月18日');
  assert.equal(formatDateDot('2026-01-05'), '2026.01.05');
  assert.equal(weekdayCN('2026-11-18'), '周三');
  assert.equal(weekdayCN('2026-11-22'), '周日');
  assert.equal(formatDateCN('bad'), '');
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
