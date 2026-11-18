// 存到相册。Web 不能直接写系统相册，唯一可靠路径是系统分享面板。
//
// 关键：iOS 要求 navigator.share() 在用户点击的同步调用栈里。
// 所以照片必须在点击前就生成好（renderWatermark 提前跑完），
// 点击「保存到相册」时只做一次同步的 share 调用。见 PhotoView.vue。

import { showImagePreview } from 'vant';

export function isCoarsePointer() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

export function toFile(blob, filename, type = 'image/jpeg') {
  return new File([blob], filename, { type });
}

export function canShareFile(file) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return Boolean(navigator.canShare({ files: [file] }));
  } catch (err) {
    return false;
  }
}

/**
 * 直接唤起系统分享（用于点击回调，必须在同步栈里调用）。
 * 返回 'share' | 'cancelled' | 'unsupported'
 */
export async function shareFile(file, { title = '', text = '' } = {}) {
  if (!canShareFile(file)) return 'unsupported';
  try {
    await navigator.share({ files: [file], title, text });
    return 'share';
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

/**
 * 兜底保存：分享不可用时，移动端预览长按保存，桌面端下载。
 * 返回 'preview' | 'download'
 */
export async function fallbackSave(blob, filename) {
  const url = URL.createObjectURL(blob);

  if (isCoarsePointer()) {
    showImagePreview({ images: [url] });
    // 预览关闭后再回收，避免图片变成空白
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'preview';
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'download';
}

export function photoFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `zhirikede-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.jpg`;
}

export async function saveBlob(blob, filename, meta = {}) {
  const file = toFile(blob, filename);
  const result = await shareFile(file, meta);
  if (result !== 'unsupported') return result;
  return fallbackSave(blob, filename);
}
