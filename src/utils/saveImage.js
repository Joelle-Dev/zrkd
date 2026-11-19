// 把一张已经合成好水印的图片存下来。
//
// 三条路，按优先级：
//   1. 原生 App：直接写进系统相册，一步到位
//   2. 支持文件分享：交给系统面板，用户选「存储图像」
//   3. 都不行：移动端长按保存，桌面端下载

import { canShareFile, fallbackSave, shareFile, toFile } from './album';
import { isNativeApp, savePhotoToAlbum } from './native';

/**
 * @returns {'album' | 'shared' | 'preview' | 'download' | 'cancelled'}
 */
export async function saveImageToAlbum(blob, filename, meta = {}) {
  if (isNativeApp()) {
    await savePhotoToAlbum(blob, filename);
    return 'album';
  }

  const file = toFile(blob, filename);
  if (canShareFile(file)) {
    const result = await shareFile(file, meta);
    if (result === 'share') return 'shared';
    if (result === 'cancelled') return 'cancelled';
  }

  return fallbackSave(blob, filename);
}
