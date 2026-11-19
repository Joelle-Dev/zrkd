// 把用户选的照片压成 data URL，塞进日记记录里。
//
// 为什么要压：IndexedDB 存 data URL 会膨胀 33%，
// 原图几 MB 直接存会让列表滚动和同步都变慢。

const MAX_EDGE = 1200;
const QUALITY = 0.82;

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
      // 老 Safari 不支持这个选项，退回 <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}

export async function compressImageToDataUrl(file, maxEdge = MAX_EDGE) {
  if (!file || !/^image\//.test(file.type)) throw new Error('这不是图片');

  const source = await decode(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) throw new Error('这张图片打不开');

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('这台设备不支持图片处理');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (typeof source.close === 'function') {
    try { source.close(); } catch (err) { /* ignore */ }
  }

  return canvas.toDataURL('image/jpeg', QUALITY);
}
