import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  escapeHtml,
  htmlToText,
  sanitizeHtml,
  textToHtml,
  markdownToHtml,
  toggleMark,
  activeMarksAt,
  htmlToMarkdown
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

/* ---------- Markdown-lite ---------- */

test('markdownToHtml 渲染加粗 / 斜体 / 下划线', () => {
  assert.equal(markdownToHtml('**粗**'), '<b>粗</b>');
  assert.equal(markdownToHtml('*斜*'), '<i>斜</i>');
  assert.equal(markdownToHtml('__下__'), '<u>下</u>');
  assert.equal(markdownToHtml('**粗**和*斜*还有__下__'), '<b>粗</b>和<i>斜</i>还有<u>下</u>');
});

test('markdownToHtml 保留换行并转义 HTML', () => {
  assert.equal(markdownToHtml('第一行\n第二行'), '第一行<br>第二行');
  assert.equal(markdownToHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
});

test('markdownToHtml 嵌套格式', () => {
  assert.equal(markdownToHtml('**粗*又斜*粗**'), '<b>粗<i>又斜</i>粗</b>');
});

test('markdownToHtml 未闭合的符号原样保留', () => {
  assert.equal(markdownToHtml('**没闭合'), '**没闭合');
});

test('toggleMark 选中文字加符号', () => {
  assert.deepEqual(toggleMark('今天很好', 2, 4, 'bold'), {
    text: '今天**很好**', start: 4, end: 6
  });
  assert.deepEqual(toggleMark('今天很好', 2, 4, 'italic'), {
    text: '今天*很好*', start: 3, end: 5
  });
});

test('toggleMark 再点一次去掉符号', () => {
  assert.deepEqual(toggleMark('今天**很好**', 4, 6, 'bold'), {
    text: '今天很好', start: 2, end: 4
  });
});

test('toggleMark 选中范围包含符号时也能去掉', () => {
  assert.deepEqual(toggleMark('今天**很好**', 2, 8, 'bold'), {
    text: '今天很好', start: 2, end: 4
  });
});

test('activeMarksAt 判断光标是否在格式内', () => {
  const text = '**今天很好**';
  assert.equal(activeMarksAt(text, 0, 0).bold, false);
  assert.equal(activeMarksAt(text, 3, 3).bold, true);
  assert.equal(activeMarksAt(text, 3, 5).bold, true);
  assert.equal(activeMarksAt('今天很好', 1, 3).bold, false);
});

test('htmlToMarkdown 把旧 HTML 转回 Markdown', () => {
  assert.equal(htmlToMarkdown('<b>粗</b>普通'), '**粗**普通');
  assert.equal(htmlToMarkdown('<strong>粗</strong>'), '**粗**');
  assert.equal(htmlToMarkdown('<i>斜</i><u>下</u>'), '*斜*__下__');
  assert.equal(htmlToMarkdown('<p>一段</p><p>二段</p>'), '一段\n二段');
});
