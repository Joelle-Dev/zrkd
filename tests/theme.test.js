import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENT_PRESETS,
  accentVars,
  hexToRgb,
  readableOn,
  contrastRatio
} from '../src/utils/theme.js';

const toRgb = (hex) => hexToRgb(hex);

test('hexToRgb 只接受 6 位十六进制', () => {
  assert.deepEqual(toRgb('#bb5145'), [187, 81, 69]);
  assert.deepEqual(toRgb('bb5145'), [187, 81, 69]);
  assert.equal(toRgb('#fff'), null);
  assert.equal(toRgb('rgb(1,2,3)'), null);
  assert.equal(toRgb(null), null);
});

test('accentVars 生成完整的一组变量', () => {
  const vars = accentVars('#4a7a5c', 'light');
  for (const key of ['--accent', '--accent-rgb', '--accent-strong', '--accent-ink', '--accent-soft', '--accent-tint', '--accent-on']) {
    assert.ok(vars[key], `缺少 ${key}`);
  }
  assert.match(vars['--accent'], /^#[0-9a-f]{6}$/);
  assert.equal(vars['--accent-rgb'].split(',').length, 3);
});

test('accentVars 对非法输入回退到默认色', () => {
  const fallback = accentVars(ACCENT_PRESETS[0].value, 'light');
  assert.deepEqual(accentVars('nope', 'light'), fallback);
});

test('极亮或极暗的自定义色会被压回可读区间', () => {
  const white = accentVars('#ffffff', 'light');
  const black = accentVars('#000000', 'light');
  assert.notEqual(white['--accent'], '#ffffff');
  assert.notEqual(black['--accent'], '#000000');
  assert.ok(contrastRatio(toRgb(white['--accent']), toRgb('#ffffff')) > 3);
});

test('预设与极端颜色在两种主题下，按钮文字都够清楚', () => {
  const samples = [
    ...ACCENT_PRESETS.map((preset) => preset.value),
    '#ffe600',
    '#00ff00',
    '#3b82f6',
    '#ff0033',
    '#ffffff',
    '#000000'
  ];
  for (const hex of samples) {
    for (const theme of ['light', 'dark']) {
      const vars = accentVars(hex, theme);
      const on = toRgb(vars['--accent-on']);
      const base = toRgb(vars['--accent']);
      const strong = toRgb(vars['--accent-strong']);
      assert.ok(contrastRatio(on, base) >= 4.5, `${hex} ${theme} accent 对比度不足`);
      assert.ok(contrastRatio(on, strong) >= 4.5, `${hex} ${theme} accent-strong 对比度不足`);
    }
  }
});

test('强调文字落在浅色底上也够清楚', () => {
  const samples = ACCENT_PRESETS.map((preset) => preset.value).concat(['#dd0066', '#4a7a5c', '#3b82f6']);
  for (const hex of samples) {
    for (const theme of ['light', 'dark']) {
      const vars = accentVars(hex, theme);
      const strong = toRgb(vars['--accent-strong']);
      const ink = toRgb(vars['--accent-ink']);
      const tint = toRgb(vars['--accent-tint']);
      const soft = toRgb(vars['--accent-soft']);
      assert.ok(contrastRatio(strong, tint) >= 4.5, `${hex} ${theme} strong/tint`);
      assert.ok(contrastRatio(ink, soft) >= 4.5, `${hex} ${theme} ink/soft`);
    }
  }
});

test('readableOn 给深浅底色挑对字色', () => {
  assert.equal(readableOn('#f5ead3'), '#17120f');
  assert.equal(readableOn('#241f19'), '#ffffff');
});
