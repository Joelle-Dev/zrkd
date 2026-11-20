import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  escapeHtml,
  htmlToText,
  sanitizeHtml,
  textToHtml,
  formatStateFromTags,
  nextFormatAction,
  unformatHtmlFragment,
  isFormatTag
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

test('formatStateFromTags 从祖先标签读出格式状态', () => {
  assert.deepEqual(formatStateFromTags(['B']), { bold: true, italic: false, underline: false });
  assert.deepEqual(formatStateFromTags(['b', 'i']), { bold: true, italic: true, underline: false });
  assert.deepEqual(formatStateFromTags([]), { bold: false, italic: false, underline: false });
  assert.deepEqual(formatStateFromTags(['DIV', 'SPAN']), { bold: false, italic: false, underline: false });
});

test('nextFormatAction 已带格式就拆，没带就包', () => {
  assert.equal(nextFormatAction({ bold: true }, 'bold'), 'unwrap');
  assert.equal(nextFormatAction({ bold: false }, 'bold'), 'wrap');
  assert.equal(nextFormatAction({ underline: false }, 'underline'), 'wrap');
  assert.equal(nextFormatAction({}, 'nope'), 'none');
});

test('unformatHtmlFragment 拆掉指定格式，保留其它格式', () => {
  assert.equal(unformatHtmlFragment('<b>粗</b>', 'bold'), '粗');
  assert.equal(unformatHtmlFragment('<b>a<i>b</i></b>', 'bold'), 'a<i>b</i>');
  assert.equal(unformatHtmlFragment('<u>a<b>b</b></u>', 'bold'), '<u>ab</u>');
  assert.equal(unformatHtmlFragment('没有标签', 'bold'), '没有标签');
  assert.equal(unformatHtmlFragment('<b><b>套两层</b></b>', 'bold'), '套两层');
});

test('isFormatTag 只认 b/i/u', () => {
  assert.equal(isFormatTag('B'), true);
  assert.equal(isFormatTag('u'), true);
  assert.equal(isFormatTag('I'), true);
  assert.equal(isFormatTag('div'), false);
  assert.equal(isFormatTag(''), false);
});
