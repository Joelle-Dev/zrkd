// 原生壳（Capacitor）里的能力检测与相册直存。
//
// 网页没有写系统相册的 API，只有装进原生壳后调用 Media 插件才行；
// 这段代码在浏览器里是死代码，Rollup 会因为平台判断把它留在包里但不会执行，
// 代价只有几 KB。
//
// 注意：插件在 Web 端调用会抛错，所以所有入口都必须先过 isNativeApp()。

import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';

const ALBUM_NAME = '指日可待';

export function isNativeApp() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch (err) {
    return false;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Android 必须指定相册目录，没有就建一个「指日可待」相册；
 * iOS 不传标识符，走 add-only 权限，直接进系统相册。
 */
async function androidAlbumIdentifier() {
  const { path } = await Media.getAlbumsPath();
  await Media.createAlbum({ name: ALBUM_NAME }).catch(() => {
    // 已经存在会报错，忽略即可
  });
  return `${path}/${ALBUM_NAME}`;
}

/**
 * 在原生 App 里把 JPEG 直接写进系统相册。
 * 返回 'album'，失败时抛出错误交给调用方提示。
 */
export async function savePhotoToAlbum(blob, filename) {
  if (!isNativeApp()) return 'unsupported';
  if (!(blob instanceof Blob) || !blob.size) throw new Error('图片还没准备好');

  const dataUrl = await blobToDataUrl(blob);
  const options = {
    path: dataUrl,
    fileName: String(filename || '').replace(/\.[^.]+$/, '')
  };
  if (Capacitor.getPlatform() === 'android') {
    options.albumIdentifier = await androidAlbumIdentifier();
  }

  await Media.savePhoto(options);
  return 'album';
}
