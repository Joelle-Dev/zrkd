// 生成 PWA 图标（无外部依赖，用 zlib 手写 PNG）
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [250, 246, 239];
const INK = [38, 34, 29];
const ACCENT = [194, 86, 74];

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

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function roundRectHit(x, y, x0, y0, x1, y1, radius) {
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
  if (x >= x0 && x <= x1 && y >= cy - radius && y <= cy + radius && (x < x0 + radius || x > x1 - radius)) {
    return Math.hypot(x - cx, y - cy) <= radius;
  }
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

// 图形：奶油底 + 红色日历页 + 中间「日」的横线刻度
function draw(x, y, size) {
  const u = size / 100;
  const radius = size * 0.22;
  const dx = Math.abs(x - size / 2) - (size / 2 - radius);
  const dy = Math.abs(y - size / 2) - (size / 2 - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) +
    Math.min(Math.max(dx, dy), 0) - radius;
  if (outside > 0) return [0, 0, 0, 0];

  let color = BG;

  // 日历主体
  const bx0 = 22 * u;
  const by0 = 26 * u;
  const bx1 = 78 * u;
  const by1 = 80 * u;
  if (roundRectHit(x, y, bx0, by0, bx1, by1, 8 * u)) {
    color = mix(BG, ACCENT, 0.92);
  }

  // 顶部装订条
  if (x >= bx0 && x <= bx1 && y >= by0 && y <= by0 + 9 * u) {
    color = mix(ACCENT, INK, 0.18);
  }

  // 两条挂环
  const rings = [38, 62];
  for (const rx of rings) {
    if (Math.abs(x - rx * u) <= 2.2 * u && y >= 18 * u && y <= by0 + 2 * u) {
      color = mix(BG, INK, 0.4);
    }
  }

  // 日历上的三条刻度线（像天数在减少）
  const lines = [
    [34, 45, 66],
    [34, 56, 58],
    [34, 67, 48]
  ];
  for (const [lx0, ly, lx1] of lines) {
    if (
      x >= lx0 * u - 2 * u && x <= lx1 * u + 2 * u &&
      Math.abs(y - ly * u) <= 2.4 * u
    ) {
      color = mix(BG, INK, 0.72);
    }
  }

  return [...color, 255];
}

const dir = new URL('../public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, dir), png(size, draw));
}
writeFileSync(new URL('apple-touch-icon.png', dir), png(180, draw));
writeFileSync(new URL('icon-maskable-512.png', dir), png(512, (x, y, size) => {
  // maskable：缩到中间 80% 安全区
  const inset = size * 0.1;
  const inner = draw(x - inset, y - inset, size - inset * 2);
  return inner[3] === 0 ? [...BG, 255] : inner;
}));
console.log('icons written');
