import test from 'node:test';
import assert from 'node:assert/strict';
import { dayInfo, jieqiLine, SOLAR_FESTIVALS, nextYearSameDay } from '../src/lib/almanac.js';

test('dayInfo 返回农历与周几', () => {
  const info = dayInfo('2026-11-18');
  assert.ok(info);
  assert.equal(info.key, '2026-11-18');
  assert.equal(info.weekday, '周三');
  assert.equal(info.lunarMonth, '十月');
  assert.ok(info.lunarText.includes('十月初十'));
  assert.ok(info.ganZhiYear.includes('年'));
});

test('dayInfo 能识别节气当天', () => {
  const info = dayInfo('2026-11-22');
  assert.ok(info);
  assert.equal(info.jieqi, '小雪');
  assert.ok(jieqiLine(info).includes('小雪'));
});

test('dayInfo 春节识别为节日', () => {
  const info = dayInfo('2026-02-17');
  assert.ok(info);
  const festivals = info.festivals.join(' ');
  assert.ok(/春节|岁首|元旦/.test(festivals) || info.lunarMonth === '正月');
});

test('dayInfo 非法输入返回 null', () => {
  assert.equal(dayInfo('2026-02-30'), null);
  assert.equal(dayInfo('nope'), null);
});

test('jieqiLine 在没有节气时说明距离', () => {
  const info = dayInfo('2026-11-18');
  const line = jieqiLine(info);
  assert.ok(/小雪|立冬/.test(line));
});

test('法定阳历节日表存在且格式正确', () => {
  assert.equal(SOLAR_FESTIVALS['10-01'], '国庆节');
  assert.equal(SOLAR_FESTIVALS['01-01'], '元旦');
});

test('dayInfo 合并阳历节日', () => {
  const info = dayInfo('2026-10-01');
  assert.ok(info.festivals.includes('国庆节'));
});

test('nextYearSameDay 处理平年 2 月 29', () => {
  assert.equal(nextYearSameDay('2024-02-29'), '2025-02-28');
  assert.equal(nextYearSameDay('2026-11-18'), '2027-11-18');
});
