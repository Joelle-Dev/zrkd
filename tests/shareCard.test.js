import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARE_CARD, shareCardFilename } from '../src/lib/shareCard.js';

test('分享图按屏幕倍率渲染，宽度有上限', () => {
  assert.ok(SHARE_CARD.maxWidth === 1080);
  assert.ok(SHARE_CARD.maxPixelRatio >= SHARE_CARD.minPixelRatio);
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
