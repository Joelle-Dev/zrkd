// 内置拼音键盘的偏好：开关与默认布局。
// 用 localStorage 而不是 IndexedDB：输入框聚焦前就要决定是否设 inputmode="none"，
// 需要同步读取。

const ENABLED_KEY = 'zrkd:pinyin-keyboard';
const LAYOUT_KEY = 'zrkd:pinyin-layout';

export const PINYIN_LAYOUTS = Object.freeze([
  { key: 't9', label: '九宫格' },
  { key: 'qwerty', label: '26 键' }
]);

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch (err) {
    // 忽略
  }
  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
}

export function loadPinyinPrefs() {
  let enabled = isTouchDevice();
  let layout = 't9';
  try {
    const savedEnabled = localStorage.getItem(ENABLED_KEY);
    if (savedEnabled === '1' || savedEnabled === '0') enabled = savedEnabled === '1';
    const savedLayout = localStorage.getItem(LAYOUT_KEY);
    if (savedLayout === 't9' || savedLayout === 'qwerty') layout = savedLayout;
  } catch (err) {
    // 隐私模式下 localStorage 可能不可用，走默认值
  }
  return { enabled, layout };
}

export function savePinyinEnabled(enabled) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch (err) {
    // 忽略
  }
}

export function savePinyinLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch (err) {
    // 忽略
  }
}
