import { ref } from 'vue';

export const DANGER_COLOR = '#b5473c';

export const THEME_OPTIONS = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' }
];

/** 主题色预设：都是压过一层纸的熟色，不是纯色 */
export const ACCENT_PRESETS = Object.freeze([
  { key: 'cinnabar', label: '朱砂', value: '#bb5145' },
  { key: 'ochre', label: '琥珀', value: '#a8722c' },
  { key: 'pine', label: '松绿', value: '#4a7a5c' },
  { key: 'ink', label: '墨蓝', value: '#42678a' },
  { key: 'plum', label: '紫檀', value: '#86506a' },
  { key: 'clay', label: '陶土', value: '#96603f' }
]);

const STORAGE_KEY = 'zrkd:theme';
const ACCENT_KEY = 'zrkd:accent';
const ACCENT_VARS_KEY = 'zrkd:accent-vars';
const THEME_COLOR = { light: '#f4efe4', dark: '#14110e' };
const MODES = ['system', 'light', 'dark'];

const DEFAULT_ACCENT = ACCENT_PRESETS[0].value;

/* ---------- 颜色计算 ---------- */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function hexToRgb(input) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(input || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHex(rgb) {
  return `#${rgb
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl([r, g, b]) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;
  return { h: hue, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const channel = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(channel(p, q, h + 1 / 3) * 255),
    Math.round(channel(p, q, h) * 255),
    Math.round(channel(p, q, h - 1 / 3) * 255)
  ];
}

/** 相对亮度（WCAG） */
function luminance([r, g, b]) {
  const channel = (value) => {
    const x = value / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 把亮度压进区间：色相饱和度不动，只调明度 */
function fitLuminance(rgb, min, max) {
  let { h, s, l } = rgbToHsl(rgb);
  let value = luminance(hslToRgb({ h, s, l }));
  let guard = 0;
  while (value > max && l > 0.04 && guard < 80) {
    l -= 0.01;
    value = luminance(hslToRgb({ h, s, l }));
    guard += 1;
  }
  guard = 0;
  while (value < min && l < 0.96 && guard < 80) {
    l += 0.01;
    value = luminance(hslToRgb({ h, s, l }));
    guard += 1;
  }
  return hslToRgb({ h, s, l });
}

function blend(base, target, targetAmount) {
  return base.map((value, index) => value * (1 - targetAmount) + target[index] * targetAmount);
}

/**
 * 把用户选的颜色整理成一套主题色变量。
 * 明度会被夹到可读区间，避免浅黄、亮青这类颜色把正文压得看不见。
 */
export function accentVars(input, theme) {
  const raw = hexToRgb(input) || hexToRgb(DEFAULT_ACCENT);
  const { h, s } = rgbToHsl(raw);
  const saturation = clamp(s, 0, 0.92);
  const base = theme === 'dark'
    ? fitLuminance(hslToRgb({ h, s: saturation, l: clamp(rawToL(raw), 0.3, 0.85) }), 0.21, 0.56)
    : fitLuminance(raw, 0.02, 0.175);

  const surface = theme === 'dark' ? [30, 26, 22] : [255, 253, 247];
  const toward = theme === 'dark' ? [255, 255, 255] : [0, 0, 0];
  const strong = blend(base, toward, theme === 'dark' ? 0.24 : 0.16);

  return {
    '--accent': rgbToHex(base),
    '--accent-rgb': base.join(', '),
    '--accent-strong': rgbToHex(strong),
    '--accent-ink': rgbToHex(blend(base, toward, theme === 'dark' ? 0.34 : 0.3)),
    '--accent-soft': rgbToHex(blend(base, surface, theme === 'dark' ? 0.85 : 0.84)),
    '--accent-tint': rgbToHex(blend(base, surface, theme === 'dark' ? 0.91 : 0.91)),
    '--accent-on': rgbToHex(onAccent(base, strong))
  };
}

/**
 * 落在主题色上的文字颜色。
 * 亮色和暗色两个候选各算一遍，取「最差情况也很能看清」的那个，
 * 这样用户挑深蓝、浅黄都不会把按钮字吃掉。
 */
function onAccent(...bases) {
  const candidates = [[255, 255, 255], [22, 18, 15]];
  const score = (text) => Math.min(...bases.map((bg) => contrastRatio(text, bg)));
  return candidates.reduce((best, current) => (score(current) > score(best) ? current : best));
}

/** 在给定底色上放什么颜色的字最清楚 */
export function readableOn(hex, light = '#ffffff', dark = '#17120f') {
  const rgb = hexToRgb(hex);
  if (!rgb) return light;
  const lightRgb = hexToRgb(light);
  const darkRgb = hexToRgb(dark);
  return contrastRatio(darkRgb, rgb) >= contrastRatio(lightRgb, rgb) ? dark : light;
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rawToL(rgb) {
  return rgbToHsl(rgb).l;
}

/* ---------- 状态 ---------- */

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (MODES.includes(value)) return value;
  } catch (err) {
    // localStorage 在隐私模式下不可用
  }
  return 'system';
}

function readAccent() {
  try {
    const value = localStorage.getItem(ACCENT_KEY);
    if (hexToRgb(value)) return String(value).toLowerCase();
  } catch (err) {
    // 同上
  }
  return DEFAULT_ACCENT;
}

function systemPrefersDark() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function resolve(mode) {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export const themeMode = ref(readStored());
export const appliedTheme = ref(resolve(themeMode.value));
export const accentColor = ref(readAccent());

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = appliedTheme.value;
  root.style.colorScheme = appliedTheme.value;

  const light = accentVars(accentColor.value, 'light');
  const dark = accentVars(accentColor.value, 'dark');
  try {
    localStorage.setItem(ACCENT_VARS_KEY, JSON.stringify({ light, dark }));
  } catch (err) {
    // 存不下也无所谓，下次启动会闪一下默认色
  }
  const vars = appliedTheme.value === 'dark' ? dark : light;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[appliedTheme.value]);
}

function refreshApplied() {
  const next = resolve(themeMode.value);
  if (next !== appliedTheme.value) appliedTheme.value = next;
  apply();
}

export function setThemeMode(mode) {
  if (!MODES.includes(mode)) return;
  themeMode.value = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    // 存不下就只在本次会话生效
  }
  refreshApplied();
}

export function setAccentColor(value) {
  const hex = hexToRgb(value);
  if (!hex) return;
  const normalized = value.startsWith('#') ? value.toLowerCase() : `#${value.toLowerCase()}`;
  accentColor.value = normalized;
  try {
    localStorage.setItem(ACCENT_KEY, normalized);
  } catch (err) {
    // 同上
  }
  apply();
}

export function resetAccentColor() {
  setAccentColor(DEFAULT_ACCENT);
}

export function initTheme() {
  apply();
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener?.('change', refreshApplied);
}
