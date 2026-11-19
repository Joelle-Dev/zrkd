// 生成应用图标与启动页图形（无外部依赖，用 zlib 手写 PNG）。
//
// 图形：宣纸色印面 + 朱砂边框 + 朱砂「日」，像一枚落款小印。
// 刻意不用「红底白字」，那种配色太像日本国旗。
//
// 除了 PWA 图标，还会一并刷新 iOS / Android 原生工程的图标与启动图，
// 让网页、PWA、原生壳三个入口的 logo 保持一致。
//
// 用法：npm run icons

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PAPER = [247, 241, 227]; // 印面：偏暖的宣纸色
const PAPER_DEEP = [236, 226, 208];
const CINNABAR = [194, 86, 74]; // 朱砂
const CINNABAR_DEEP = [151, 56, 47];
const CREAM = [244, 239, 228]; // 启动页底色

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, pixel, level = 9) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y, width, height);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 2x2 超采样，压掉圆角与斜边的锯齿
function smooth(width, height, sampler, level = 9, ss = 2) {
  return png(width, height, (x, y) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let j = 0; j < ss; j += 1) {
      for (let i = 0; i < ss; i += 1) {
        const [sr, sg, sb, sa] = sampler(x + (i + 0.5) / ss, y + (j + 0.5) / ss, width, height);
        const af = sa / 255;
        r += sr * af;
        g += sg * af;
        b += sb * af;
        a += sa;
      }
    }
    const total = ss * ss;
    const alpha = a / total;
    if (alpha <= 0) return [0, 0, 0, 0];
    const af = alpha / 255;
    return [
      Math.round(r / total / af),
      Math.round(g / total / af),
      Math.round(b / total / af),
      Math.round(alpha)
    ];
  }, level);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function insideRoundRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
}

// 「日」：外框 + 中间一横。笔画用矩形，天然锐利。
function glyph(x, y, x0, y0, x1, y1, stroke) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (x <= x0 + stroke || x >= x1 - stroke || y <= y0 + stroke || y >= y1 - stroke) return true;
  const midY = (y0 + y1) / 2;
  return Math.abs(y - midY) <= stroke / 2;
}

const GLYPH_BOX = { x0: 0.285, y0: 0.255, x1: 0.715, y1: 0.745, stroke: 0.058 };

function glyphHit(x, y, size, box = GLYPH_BOX) {
  return glyph(
    x, y,
    size * box.x0, size * box.y0,
    size * box.x1, size * box.y1,
    size * box.stroke
  );
}

/**
 * 印章：圆角方块印面 + 朱砂边框 + 朱砂「日」。
 * 返回颜色，或 null 表示在印章之外（透明）。
 */
function sealAt(x, y, size) {
  const radius = size * 0.2;
  if (!insideRoundRect(x, y, 0, 0, size, size, radius)) return null;

  // 边框：外圈圆角矩形减去内圈
  const inset = size * 0.075;
  const thick = size * 0.028;
  const frameRadius = radius - inset * 0.7;
  const inFrame = insideRoundRect(x, y, inset, inset, size - inset, size - inset, frameRadius) &&
    !insideRoundRect(
      x, y,
      inset + thick, inset + thick,
      size - inset - thick, size - inset - thick,
      Math.max(0, frameRadius - thick)
    );
  if (inFrame) {
    return [...mix(CINNABAR, CINNABAR_DEEP, (x + y) / (2 * size)), 255];
  }

  if (glyphHit(x, y, size)) {
    return [...mix(CINNABAR, CINNABAR_DEEP, (y / size) * 0.55), 255];
  }

  return [...mix(PAPER, PAPER_DEEP, (y / size) * 0.5), 255];
}

// PWA / 旧版 Android：圆角方块，四角透明
function roundedIcon(x, y, size) {
  return sealAt(x, y, size) || [0, 0, 0, 0];
}

// iOS：方形满铺，系统自己切圆角
function squareIcon(x, y, size) {
  return sealAt(x, y, size) || [...PAPER, 255];
}

// maskable：内容缩到安全区（圆的 80% 内），四周用印面铺满
function maskableIcon(x, y, size) {
  const box = size * 0.58;
  const off = (size - box) / 2;
  return sealAt(x - off, y - off, box) || [...PAPER, 255];
}

// 圆形图标：圆底 + 朱砂「日」（不放方形印框，避免圆里套方的怪感）
function roundIcon(x, y, size) {
  if (Math.hypot(x - size / 2, y - size / 2) > size / 2) return [0, 0, 0, 0];
  if (glyphHit(x, y, size, { x0: 0.3, y0: 0.275, x1: 0.7, y1: 0.725, stroke: 0.062 })) {
    return [...mix(CINNABAR, CINNABAR_DEEP, (y / size) * 0.55), 255];
  }
  return [...mix(PAPER, PAPER_DEEP, (y / size) * 0.5), 255];
}

// Android 自适应图标前景：透明底 + 朱砂「日」，缩在中心安全区，背景色由 XML 给
function adaptiveForeground(x, y, size) {
  const box = size * 0.46;
  const off = (size - box) / 2;
  if (glyphHit(x - off, y - off, box)) {
    return [...mix(CINNABAR, CINNABAR_DEEP, (y / size) * 0.55), 255];
  }
  return [0, 0, 0, 0];
}

// 启动页：奶油底 + 居中印章（印面比底色亮一点，靠朱砂边框立住）
function splash(x, y, width, height) {
  const mark = Math.min(width, height) * 0.3;
  const ox = (width - mark) / 2;
  const oy = (height - mark) / 2;

  const local = sealAt(x - ox, y - oy, mark);
  if (local) return local;
  return [...mix(CREAM, mix(CREAM, CINNABAR_DEEP, 0.05), y / height), 255];
}

const root = new URL('../', import.meta.url);

function write(relativePath, buffer) {
  const url = new URL(relativePath, root);
  mkdirSync(dirname(url.pathname), { recursive: true });
  writeFileSync(url, buffer);
}

/* ---------- PWA / 网页图标 ---------- */
write('public/icons/icon-192.png', smooth(192, 192, roundedIcon));
write('public/icons/icon-512.png', smooth(512, 512, roundedIcon));
write('public/icons/apple-touch-icon.png', smooth(180, 180, squareIcon));
write('public/icons/icon-maskable-512.png', smooth(512, 512, maskableIcon));

/* ---------- iOS ---------- */
write('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', smooth(1024, 1024, squareIcon));

// 三张启动图内容一样，生成一次写三份，省掉两轮 2732² 采样
const iosSplash = smooth(2732, 2732, splash, 6);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', iosSplash);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', iosSplash);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', iosSplash);

/* ---------- iOS 主屏幕启动图（apple-touch-startup-image） ----------
   「添加到主屏幕」后，Web App 每次打开都会先显示 iOS 自己生成的原生启动图。
   不提供这张图，iOS 就铺纯白；提供纸色版本，开屏第一帧就与 App 一致。 */
const IOS_STARTUP = [
  // [文件名, 宽, 高, DPR, 角标（竖屏/横屏）]
  ['apple-splash-1320-2868.png', 1320, 2868, 3], // iPhone 16 Pro Max
  ['apple-splash-1206-2622.png', 1206, 2622, 3], // iPhone 16 Pro
  ['apple-splash-1290-2796.png', 1290, 2796, 3], // iPhone 15 Pro Max / 14 Pro Max
  ['apple-splash-1179-2556.png', 1179, 2556, 3], // iPhone 15 Pro / 14 Pro
  ['apple-splash-1284-2778.png', 1284, 2778, 3], // iPhone 14 Plus / 13 Pro Max
  ['apple-splash-1170-2532.png', 1170, 2532, 3], // iPhone 14 / 13
  ['apple-splash-1125-2436.png', 1125, 2436, 3], // iPhone 11 Pro / XS / X
  ['apple-splash-1242-2688.png', 1242, 2688, 3], // iPhone 11 Pro Max / XS Max
  ['apple-splash-828-1792.png', 828, 1792, 2],   // iPhone 11 / XR
  ['apple-splash-750-1334.png', 750, 1334, 2],   // iPhone SE / 8 / 7 / 6s
  ['apple-splash-640-1136.png', 640, 1136, 2],   // iPhone SE 1st / 5s
  ['apple-splash-1668-2388.png', 1668, 2388, 2], // iPad Pro 11"
  ['apple-splash-2048-2732.png', 2048, 2732, 2]  // iPad Pro 12.9"
];

for (const [name, width, height] of IOS_STARTUP) {
  write(`public/splash/${name}`, smooth(width, height, splash, 6));
}

/* ---------- Android ---------- */
const DENSITIES = {
  mdpi: { icon: 48, foreground: 108 },
  hdpi: { icon: 72, foreground: 162 },
  xhdpi: { icon: 96, foreground: 216 },
  xxhdpi: { icon: 144, foreground: 324 },
  xxxhdpi: { icon: 192, foreground: 432 }
};

for (const [density, sizes] of Object.entries(DENSITIES)) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  write(`${dir}/ic_launcher.png`, smooth(sizes.icon, sizes.icon, roundedIcon));
  write(`${dir}/ic_launcher_round.png`, smooth(sizes.icon, sizes.icon, roundIcon));
  write(`${dir}/ic_launcher_foreground.png`, smooth(sizes.foreground, sizes.foreground, adaptiveForeground));
}

// 自适应图标底色跟着印面走，朱砂「日」才看得清
write('android/app/src/main/res/values/ic_launcher_background.xml', Buffer.from(
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<resources>\n' +
  '    <color name="ic_launcher_background">#F7F1E3</color>\n' +
  '</resources>\n'
));

const SPLASHES = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920]
};

for (const [dir, [width, height]] of Object.entries(SPLASHES)) {
  write(`android/app/src/main/res/${dir}/splash.png`, smooth(width, height, splash, 6));
}

console.log('icons + splash written');
