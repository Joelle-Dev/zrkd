// 生成应用图标与启动页图形（无外部依赖，用 zlib 手写 PNG）。
//
// 图形：朱砂渐变圆角方块 + 白色「日」。
// 除了 PWA 图标，还会一并刷新 iOS / Android 原生工程的图标与启动图，
// 让网页、PWA、原生壳三个入口的 logo 保持一致。
//
// 用法：npm run icons

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const CREAM = [244, 239, 228];
const ACCENT = [194, 86, 74];
const ACCENT_DEEP = [151, 56, 47];
const WHITE = [255, 255, 255];

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

function gradient(x, y, w, h) {
  const t = Math.min(1, Math.max(0, (x / w) * 0.55 + (y / h) * 0.45));
  return mix(ACCENT, ACCENT_DEEP, t);
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

function drawGlyph(x, y, size) {
  return glyph(
    x, y,
    size * 0.275, size * 0.245,
    size * 0.725, size * 0.755,
    size * 0.072
  );
}

// 图标：圆角方块，四角透明（PWA / 旧版 Android）
function roundedIcon(x, y, size) {
  if (!insideRoundRect(x, y, 0, 0, size, size, size * 0.225)) return [0, 0, 0, 0];
  if (drawGlyph(x, y, size)) return [...WHITE, 255];
  return [...gradient(x, y, size, size), 255];
}

// 方形满铺（iOS 会自己切圆角；maskable 需要铺满整块）
function flatIcon(x, y, size) {
  if (drawGlyph(x, y, size)) return [...WHITE, 255];
  return [...gradient(x, y, size, size), 255];
}

// Android 自适应图标前景：透明底 + 白色「日」，背景色在 XML 里
function adaptiveForeground(x, y, size) {
  const hit = glyph(
    x, y,
    size * 0.3, size * 0.275,
    size * 0.7, size * 0.725,
    size * 0.06
  );
  return hit ? [...WHITE, 255] : [0, 0, 0, 0];
}

// 启动页：奶油底 + 居中的朱砂圆角方块 + 白色「日」
function splash(x, y, width, height) {
  const short = Math.min(width, height);
  const mark = short * 0.3;
  const cx = width / 2;
  const cy = height / 2;
  const x0 = cx - mark / 2;
  const y0 = cy - mark / 2;
  if (insideRoundRect(x, y, x0, y0, x0 + mark, y0 + mark, mark * 0.22)) {
    const hit = glyph(
      x, y,
      cx - mark * 0.185, cy - mark * 0.21,
      cx + mark * 0.185, cy + mark * 0.21,
      mark * 0.055
    );
    if (hit) return [...WHITE, 255];
    return [...gradient(x - x0, y - y0, mark, mark), 255];
  }
  return [...CREAM, 255];
}

const root = new URL('../', import.meta.url);

function write(relativePath, buffer) {
  const url = new URL(relativePath, root);
  mkdirSync(dirname(url.pathname), { recursive: true });
  writeFileSync(url, buffer);
  return buffer;
}

/* ---------- PWA / 网页图标 ---------- */
write('public/icons/icon-192.png', smooth(192, 192, roundedIcon));
write('public/icons/icon-512.png', smooth(512, 512, roundedIcon));
write('public/icons/apple-touch-icon.png', smooth(180, 180, flatIcon));
write('public/icons/icon-maskable-512.png', smooth(512, 512, flatIcon));

/* ---------- iOS ---------- */
write('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', smooth(1024, 1024, flatIcon));
const iosSplash = smooth(2732, 2732, splash, 6);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', iosSplash);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', iosSplash);
write('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', iosSplash);

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
  const icon = smooth(sizes.icon, sizes.icon, roundedIcon);
  write(`${dir}/ic_launcher.png`, icon);
  write(`${dir}/ic_launcher_round.png`, icon);
  write(`${dir}/ic_launcher_foreground.png`, smooth(sizes.foreground, sizes.foreground, adaptiveForeground));
}

// 自适应图标的底色跟着 logo 变成朱砂，白色「日」才看得见
write('android/app/src/main/res/values/ic_launcher_background.xml', Buffer.from(
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<resources>\n' +
  '    <color name="ic_launcher_background">#C2564A</color>\n' +
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
