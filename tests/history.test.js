import test from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, normalizeEvent, pickDayEvents } from '../src/lib/history.js';

test('stripHtml 去掉标签与转义', () => {
  assert.equal(
    stripHtml('<a target="_blank" href="https://x">立花訚千代</a>逝世'),
    '立花訚千代逝世'
  );
  assert.equal(stripHtml('A &amp; B'), 'A & B');
  assert.equal(stripHtml('&nbsp;空格'), '空格');
  assert.equal(stripHtml('多   个   空格'), '多 个 空格');
  assert.equal(stripHtml(null), '');
});

test('normalizeEvent 只保留安全字段', () => {
  const item = normalizeEvent({
    year: '1602',
    title: '<a href="javascript:alert(1)">标题</a>',
    type: 'death',
    festival: '',
    desc: '<b>描述</b>',
    link: 'javascript:alert(1)',
    recommend: true
  });
  assert.equal(item.year, '1602');
  assert.equal(item.title, '标题');
  assert.equal(item.type, 'death');
  assert.equal(item.typeLabel, '逝世');
  assert.equal(item.link, '');
  assert.equal(item.recommend, true);
});

test('normalizeEvent 无标题返回 null', () => {
  assert.equal(normalizeEvent({ title: '   ' }), null);
  assert.equal(normalizeEvent(null), null);
});

test('normalizeEvent 保留完整描述', () => {
  const long = '字'.repeat(900);
  const item = normalizeEvent({ title: '很长', desc: long });
  assert.equal(item.desc, long);
});

test('pickDayEvents 取当天、去重、截断', () => {
  const payload = {
    11: {
      1118: [
        { year: '1', title: '普通事件', type: 'event' },
        { year: '2', title: '重复', type: 'birth' },
        { year: '2', title: '重复', type: 'birth' },
        { year: '3', title: '推荐', type: 'death', recommend: true },
        { year: '4', title: '四', type: 'event' },
        { year: '5', title: '五', type: 'event' },
        { year: '6', title: '六', type: 'event' }
      ]
    }
  };
  const list = pickDayEvents(payload, 11, 18, { max: 4 });
  assert.equal(list.length, 4);
  assert.equal(list[0].title, '推荐');
  assert.equal(new Set(list.map((item) => item.title)).size, 4);
});

test('pickDayEvents 结构不对时返回空数组', () => {
  assert.deepEqual(pickDayEvents(null, 11, 18), []);
  assert.deepEqual(pickDayEvents({ 11: {} }, 11, 18), []);
  assert.deepEqual(pickDayEvents({ 11: { 1119: [] } }, 11, 18), []);
});
