import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_CARD,
  computeCardLayout,
  alpha,
  shareCardFilename
} from '../src/lib/shareCard.js';

test('画布默认是 4:5 竖版', () => {
  assert.equal(SHARE_CARD.width, 1080);
  assert.equal(SHARE_CARD.height, 1350);
  assert.ok(SHARE_CARD.height > SHARE_CARD.width);
});

test('computeCardLayout 元素自上而下排布且不重叠', () => {
  const layout = computeCardLayout();
  assert.ok(layout.sealY < layout.brandY);
  assert.ok(layout.brandY < layout.titleY);
  assert.ok(layout.titleY < layout.figureY);
  assert.ok(layout.figureY < layout.metaY);
  assert.ok(layout.metaY < layout.footerY);
  assert.ok(layout.footerY < layout.height);
  assert.ok(layout.maxTextWidth > 0 && layout.maxTextWidth < layout.width);
});

test('computeCardLayout 随尺寸等比缩放', () => {
  const small = computeCardLayout(540, 675);
  const big = computeCardLayout();
  assert.ok(big.titleSize > small.titleSize);
  assert.ok(big.numberSize > small.numberSize);
  assert.equal(big.centerX, big.width / 2);
  assert.equal(small.centerX, small.width / 2);
});

test('alpha 把十六进制转成 rgba，坏值退回默认朱砂', () => {
  assert.equal(alpha('#000000', 0.5), 'rgba(0, 0, 0, 0.5)');
  assert.equal(alpha('#ffffff', 0.2), 'rgba(255, 255, 255, 0.2)');
  assert.equal(alpha('c2564a', 1), 'rgba(194, 86, 74, 1)');
  assert.equal(alpha('#f00', 1), 'rgba(255, 0, 0, 1)');
  assert.equal(alpha('nope', 0.3), 'rgba(194, 86, 74, 0.3)');
});

test('shareCardFilename 去掉文件名里的非法字符', () => {
  const name = shareCardFilename('在一起/我们', new Date(2026, 10, 19));
  assert.equal(name, 'zrkd-在一起-我们-20261119.png');
  assert.match(name, /\.png$/);
});

test('shareCardFilename 空标题有兜底', () => {
  const name = shareCardFilename('', new Date(2026, 0, 5));
  assert.equal(name, 'zrkd-日子-20260105.png');
});
