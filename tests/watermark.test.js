import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, outputSize, planTextFits, sealCharacter } from '../src/lib/watermark.js';

test('computeLayout 底部模式：文字块在下方且不超出画面', () => {
  const layout = computeLayout(2000, 1500, { position: 'bottom' });
  assert.equal(layout.position, 'bottom');
  assert.ok(layout.titleY < layout.numberY);
  assert.ok(layout.numberY < layout.dateY);
  assert.ok(layout.dateY < 1500);
  assert.ok(layout.dateY > 1500 * 0.6);
  assert.ok(layout.numberSize > layout.titleSize);
  assert.equal(layout.maxWidth, 2000 * 0.84);
});

test('computeLayout 居中模式：块的中心就是画面中心', () => {
  const layout = computeLayout(1200, 1600, { position: 'center' });
  assert.equal(layout.centerY, 800);
  assert.ok(Math.abs((layout.blockTop + layout.blockBottom) / 2 - 800) < 0.6);
  assert.ok(layout.sealY < layout.titleY);
  assert.ok(layout.titleY < layout.numberY);
  assert.ok(layout.numberY < layout.dateY);
});

test('computeLayout 带引首章与细线，尺寸都在画面内', () => {
  for (const [w, h] of [[1200, 1600], [2400, 1200]]) {
    const layout = computeLayout(w, h);
    assert.ok(layout.sealSize > 0);
    assert.ok(layout.sealY - layout.sealSize / 2 >= 0);
    assert.ok(layout.sealY + layout.sealSize / 2 < h);
    assert.ok(layout.ruleY > layout.sealY);
    assert.ok(layout.ruleY < layout.titleY);
    assert.ok(layout.ruleWidth > 0 && layout.ruleWidth <= w);
    assert.ok(layout.ruleThickness >= 1);
  }
});

test('sealCharacter 取标题第一个汉字，没有就用「日」', () => {
  assert.equal(sealCharacter('发工资'), '发');
  assert.equal(sealCharacter('2027 考研'), '考');
  assert.equal(sealCharacter('New Year'), '日');
  assert.equal(sealCharacter(''), '日');
});

test('computeLayout 竖图横图都不溢出', () => {
  for (const [w, h] of [[800, 2000], [2400, 1200], [1000, 1000], [360, 640]]) {
    const layout = computeLayout(w, h);
    for (const key of ['titleSize', 'numberSize', 'unitSize', 'dateSize']) {
      assert.ok(layout[key] > 0, `${key} should be positive for ${w}x${h}`);
    }
    assert.ok(layout.dateY + layout.dateSize / 2 <= h + 0.5);
  }
});

test('computeLayout 有尺寸上下限', () => {
  const tiny = computeLayout(100, 100);
  assert.ok(tiny.numberSize >= 40);
  const huge = computeLayout(8000, 8000);
  assert.ok(huge.numberSize <= 380);
  assert.ok(huge.titleSize <= 128);
});

test('outputSize 只缩不放，保持长边上限', () => {
  assert.deepEqual(outputSize(1000, 800), { width: 1000, height: 800, scale: 1 });
  const big = outputSize(6000, 4000);
  assert.equal(big.width, 2200);
  assert.equal(Math.max(big.width, big.height), 2200);
  assert.ok(Math.abs(big.width / big.height - 1.5) < 0.01);
  const tall = outputSize(3000, 9000, 3000);
  assert.equal(tall.height, 3000);
  assert.equal(tall.width, 1000);
});

test('planTextFits 超宽时缩字号，缩到下限仍溢出则标记', () => {
  const measure = (text, { font }) => {
    const size = Number((/ (\d+(?:\.\d+)?)px/.exec(font) || [])[1]);
    return Array.from(text).length * size;
  };
  const fits = planTextFits({ text: '在一起', width: 200, size: 60, measure });
  assert.equal(fits.size, 60);
  assert.equal(fits.overflow, false);

  const shrink = planTextFits({ text: '一二三四五六七八九十', width: 200, size: 60, measure });
  assert.ok(shrink.size < 60);
  assert.equal(shrink.overflow, true);
});
