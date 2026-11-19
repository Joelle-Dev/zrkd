// 键盘上方的 accessory bar（iOS 那条「上下箭头 + 完成」）只存在于原生壳里。
//
// 网页 / Safari 里那条是系统给 input、contenteditable 画的原生控件，
// 网页没有任何 API 能关掉它——这是平台限制，不是没找到方法。
//
// 装进 Capacitor 壳后，`setAccessoryBarVisible(false)` 可以关掉它，
// 效果是写作时键盘上方直接是 App 自己的工具栏，更干净。

import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

function isNative() {
  try {
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch (err) {
    return false;
  }
}

/**
 * 进入写作类页面时调用：隐藏 accessory bar。
 * 只对 iPhone 原生 App 生效，其余环境静默跳过。
 */
export async function hideAccessoryBar() {
  if (!isNative()) return false;
  if (Capacitor.getPlatform() !== 'ios') return false;
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    return true;
  } catch (err) {
    return false;
  }
}

/** 离开页面时恢复，避免影响其它输入场景 */
export async function showAccessoryBar() {
  if (!isNative()) return false;
  if (Capacitor.getPlatform() !== 'ios') return false;
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: true });
    return true;
  } catch (err) {
    return false;
  }
}
