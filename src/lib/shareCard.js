// 「日子」分享卡片：直接把详情页上的 .detail-card 截下来。
//
// 这样版式、字号、换行、留白和高度都跟屏幕上一模一样，
// 不用在 canvas 里再维护一套「看起来差不多」的布局。

export const SHARE_CARD = Object.freeze({
  maxWidth: 1080,
  maxPixelRatio: 3,
  minPixelRatio: 2,
  background: '#f4efe4'
});

function safeName(title) {
  return String(title || '日子')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .slice(0, 24) || '日子';
}

/** 卡片文件名：zrkd-在一起-20261119.png */
export function shareCardFilename(title, date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `zrkd-${safeName(title)}-${stamp}.png`;
}

/**
 * 把详情卡截成图片。
 * @param {HTMLElement} element 详情页里的 .detail-card
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function renderShareCard(element, {
  background = SHARE_CARD.background,
  maxWidth = SHARE_CARD.maxWidth
} = {}) {
  if (!element) throw new Error('没找到要保存的卡片');
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const width = element.offsetWidth || 335;
  const pixelRatio = Math.min(
    SHARE_CARD.maxPixelRatio,
    Math.max(SHARE_CARD.minPixelRatio, maxWidth / width)
  );

  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: background
  });
  if (!blob) throw new Error('卡片生成失败，再试一次');

  return {
    blob,
    width: Math.round(element.offsetWidth * pixelRatio),
    height: Math.round(element.offsetHeight * pixelRatio)
  };
}
