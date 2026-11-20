import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  escapeHtml,
  htmlToText,
  sanitizeHtml,
  textToHtml,
  htmlToSegments,
  segmentsToHtml,
  segmentsToText,
  textToSegments,
  mergeSegments,
  applyFormat,
  formatRangeState,
  reconcileSegments,
  sliceSegments
} from '../src/lib/richtext.js';
import { normalizeDiaryInput, validateDiary } from '../src/lib/diary.js';

test('sanitizeHtml 只保留白名单标签', () => {
  assert.equal(sanitizeHtml('<b>粗</b>'), '<b>粗</b>');
  assert.equal(sanitizeHtml('<strong>粗</strong>'), '<b>粗</b>');
  assert.equal(sanitizeHtml('<em>斜</em>'), '<i>斜</i>');
  assert.equal(sanitizeHtml('<u>下</u>'), '<u>下</u>');
});

test('sanitizeHtml 丢掉所有属性', () => {
  assert.equal(sanitizeHtml('<b style="color:red" onclick="x()">粗</b>'), '<b>粗</b>');
  assert.equal(sanitizeHtml('<a href="https://x">链接</a>'), '链接');
});

test('sanitizeHtml 剥离脚本与样式', () => {
  assert.equal(sanitizeHtml('<script>alert(1)</script>文字'), '文字');
  assert.equal(sanitizeHtml('<style>b{}</style>文字'), '文字');
  assert.equal(sanitizeHtml('<img src=x onerror=alert(1)>'), '');
});

test('sanitizeHtml 保留 div/p 作为换行容器', () => {
  assert.equal(sanitizeHtml('<div>一</div><div>二</div>'), '<div>一</div><div>二</div>');
  assert.equal(sanitizeHtml('<p>段</p>'), '<p>段</p>');
});

test('sanitizeHtml 处理空值', () => {
  assert.equal(sanitizeHtml(''), '');
  assert.equal(sanitizeHtml(null), '');
  assert.equal(sanitizeHtml(undefined), '');
});

test('htmlToText 把标签换成文本', () => {
  assert.equal(htmlToText('<b>粗</b>体'), '粗体');
  assert.equal(htmlToText('一<br>二'), '一\n二');
  assert.equal(htmlToText('<div>一</div><div>二</div>'), '一\n二');
});

test('htmlToText 还原实体', () => {
  assert.equal(htmlToText('a &amp; b'), 'a & b');
  assert.equal(htmlToText('&lt;tag&gt;'), '<tag>');
});

test('textToHtml 转义并保留换行', () => {
  assert.equal(textToHtml('一\n二'), '一<br>二');
  assert.equal(textToHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(textToHtml(''), '');
});

test('escapeHtml 转义危险字符', () => {
  assert.equal(escapeHtml('<>&"'), '&lt;&gt;&amp;&quot;');
});

test('countWords 中文按字、英文按词', () => {
  assert.equal(countWords('今天很好'), 4);
  assert.equal(countWords('hello world'), 2);
  assert.equal(countWords('今天 hello 很好'), 5);
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
});

test('countWords 忽略标点与换行', () => {
  assert.equal(countWords('你好，世界！'), 4);
  assert.equal(countWords('一\n二\n三'), 3);
});

test('normalizeDiaryInput 保留富文本并导出纯文本', () => {
  const value = normalizeDiaryInput({
    date: '2026-11-19',
    title: '  标题  ',
    html: '<b>粗</b>体'
  });
  assert.equal(value.title, '标题');
  assert.equal(value.html, '<b>粗</b>体');
  assert.equal(value.text, '粗体');
});

test('normalizeDiaryInput 兼容只有纯文本的老数据', () => {
  const value = normalizeDiaryInput({ date: '2026-11-19', text: '一\n二' });
  assert.equal(value.html, '一<br>二');
  assert.equal(value.text, '一\n二');
});

test('normalizeDiaryInput 过滤恶意 HTML', () => {
  const value = normalizeDiaryInput({
    date: '2026-11-19',
    html: '<script>alert(1)</script><b onclick="x()">粗</b>'
  });
  assert.equal(value.html, '<b>粗</b>');
  assert.ok(!value.html.includes('script'));
});

test('normalizeDiaryInput 标题截断到 60', () => {
  const value = normalizeDiaryInput({ date: '2026-11-19', title: '题'.repeat(100), text: 'x' });
  assert.equal(value.title.length, 60);
});

test('validateDiary 允许只有标题', () => {
  const result = validateDiary({ date: '2026-11-19', title: '标题' });
  assert.equal(result.ok, true);
});

test('validateDiary 全空时报错', () => {
  assert.equal(validateDiary({ date: '2026-11-19' }).ok, false);
  assert.equal(validateDiary({ date: '2026-11-19', title: '  ', html: '<b></b>' }).ok, false);
});

/* ---------- segments：文本 + 格式的纯数据表示 ---------- */

test('htmlToSegments 解析加粗/斜体/下划线与换行', () => {
  assert.deepEqual(htmlToSegments('<b>粗</b>普通'), [
    { text: '粗', bold: true, italic: false, underline: false },
    { text: '普通', bold: false, italic: false, underline: false }
  ]);
  assert.deepEqual(htmlToSegments('<i>斜</i><u>下</u>'), [
    { text: '斜', bold: false, italic: true, underline: false },
    { text: '下', bold: false, italic: false, underline: true }
  ]);
  assert.deepEqual(htmlToSegments('第一行<br>第二行'), [
    { text: '第一行\n第二行', bold: false, italic: false, underline: false }
  ]);
});

test('htmlToSegments 兼容 strong/em 与段落换行，丢弃非法标签', () => {
  assert.deepEqual(htmlToSegments('<strong>粗</strong>'), [
    { text: '粗', bold: true, italic: false, underline: false }
  ]);
  assert.deepEqual(htmlToSegments('<em>斜</em>'), [
    { text: '斜', bold: false, italic: true, underline: false }
  ]);
  assert.deepEqual(htmlToSegments('<p>一段</p><p>二段</p>'), [
    { text: '一段\n二段', bold: false, italic: false, underline: false }
  ]);
  assert.deepEqual(htmlToSegments('<span>纯文字</span>'), [
    { text: '纯文字', bold: false, italic: false, underline: false }
  ]);
});

test('segmentsToHtml 与 htmlToSegments 互为往返', () => {
  const segments = [
    { text: '今天', bold: true, italic: false, underline: false },
    { text: '很好\n', bold: false, italic: false, underline: false },
    { text: '结束', bold: false, italic: true, underline: false }
  ];
  const html = segmentsToHtml(segments);
  assert.equal(html, '<b>今天</b>很好<br><i>结束</i>');
  assert.deepEqual(htmlToSegments(html), [
    { text: '今天', bold: true, italic: false, underline: false },
    { text: '很好\n', bold: false, italic: false, underline: false },
    { text: '结束', bold: false, italic: true, underline: false }
  ]);
});

test('segmentsToHtml 转义尖括号', () => {
  assert.equal(segmentsToHtml([{ text: '<a>', bold: false, italic: false, underline: false }]), '&lt;a&gt;');
  assert.equal(htmlToSegments('&lt;a&gt;')[0].text, '<a>');
});

test('applyFormat 只改选中区间，前后格式不动', () => {
  const base = htmlToSegments('今天很好');
  const result = applyFormat(base, 2, 4, 'bold', 'toggle');
  assert.equal(segmentsToHtml(result), '今天<b>很好</b>');
});

test('applyFormat 选中段内一部分时切成前中后三段', () => {
  const base = htmlToSegments('<b>今天很好</b>');
  const result = applyFormat(base, 2, 4, 'bold', 'toggle');
  assert.equal(segmentsToHtml(result), '<b>今天</b>很好');
});

test('formatRangeState 只有全部带上才算 true', () => {
  const base = htmlToSegments('<b>今天</b>很好');
  assert.equal(formatRangeState(base, 0, 2).bold, true);
  assert.equal(formatRangeState(base, 0, 4).bold, false);
});

test('reconcileSegments 保留未改动文字的格式', () => {
  const base = htmlToSegments('<b>粗体</b>普通');
  const next = reconcileSegments(base, '粗体普通多写几个字');
  assert.equal(segmentsToHtml(next), '<b>粗体</b>普通多写几个字');
});

test('reconcileSegments 在加粗文字后继续输入沿用加粗', () => {
  const base = htmlToSegments('<b>粗体</b>');
  const next = reconcileSegments(base, '粗体追加');
  assert.equal(segmentsToHtml(next), '<b>粗体追加</b>');
});

test('reconcileSegments 删除中间文字后两侧仍保留各自格式', () => {
  const base = htmlToSegments('<b>前</b>中<i>后</i>');
  const next = reconcileSegments(base, '前后');
  assert.equal(segmentsToHtml(next), '<b>前</b><i>后</i>');
});

test('sliceSegments 按纯文本偏移取子段', () => {
  const base = htmlToSegments('<b>今天</b>很好');
  assert.equal(segmentsToText(sliceSegments(base, 1, 3)), '天很');
  assert.equal(segmentsToHtml(sliceSegments(base, 1, 3)), '<b>天</b>很');
});
