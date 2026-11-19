// 「日子」分享卡片：把某一天的倒数画成一张竖版海报，方便存进相册。
//
// 布局是纯函数（可单测）；绘制只在浏览器里跑，依赖 canvas。
// 视觉跟详情页的卡片一致：宣纸底、朱砂印框、白纸小印 + 朱砂「日」，
// 「还有」用冷蓝、「已经」用暖黄，一眼分清方向。

const INK = '#241f19';
const MUTED = '#6b6050';
const SOFT = '#8a7f6d';
const PAPER_TOP = '#fbf6ec';
const PAPER_BOTTOM = '#efe6d4';
const SEAL_PAPER = '#fdf9f0';
const COUNTDOWN = '#3a6da8';
const ELAPSED = '#b0791f';
const DEFAULT_ACCENT = '#c2564a';

const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif';

export const SHARE_CARD = Object.freeze({ width: 1080, height: 1350 });

/** 卡片里各元素的位置与字号，全部按画布尺寸推导 */
export function computeCardLayout(width = SHARE_CARD.width, height = SHARE_CARD.height) {
  const frame = Math.round(Math.min(width, height) * 0.055);
  const centerX = width / 2;
  const sealSize = Math.round(width * 0.1);
  const sealY = Math.round(height * 0.135);
  const brandY = sealY + sealSize / 2 + Math.round(height * 0.03);
  const titleSize = Math.round(width * 0.078);
  const titleY = Math.round(height * 0.315);
  const noteSize = Math.round(width * 0.032);
  const noteY = titleY + Math.round(titleSize * 1.9);
  const numberSize = Math.round(width * 0.2);
  const figureY = Math.round(height * 0.56);
  const unitSize = Math.round(numberSize * 0.26);
  const metaSize = Math.round(width * 0.031);
  const metaY = Math.round(height * 0.735);
  const footerSize = Math.round(width * 0.024);
  const footerY = height - frame - Math.round(height * 0.05);

  return {
    width,
    height,
    frame,
    centerX,
    sealSize,
    sealY,
    brandY,
    titleSize,
    titleY,
    noteSize,
    noteY,
    numberSize,
    figureY,
    unitSize,
    metaSize,
    metaY,
    footerSize,
    footerY,
    maxTextWidth: width - frame * 3
  };
}

/** #rrggbb → rgba(...)，非法值退回默认朱砂 */
export function alpha(hex, opacity) {
  const raw = String(hex || '').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(194, 86, 74, ${opacity})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function kindColor(kind, accent) {
  if (kind === 'past') return ELAPSED;
  if (kind === 'countdown') return COUNTDOWN;
  return accent || DEFAULT_ACCENT;
}

function setFont(ctx, size, weight, family) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const chars = Array.from(String(text || ''));
  if (!chars.length) return [];
  const lines = [];
  let line = '';
  for (const char of chars) {
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const consumed = lines.join('').length;
  if (consumed < chars.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawSpaced(ctx, text, x, y, spacing) {
  const chars = Array.from(String(text));
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, value) => sum + value, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = x - total / 2;
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = previous;
}

function drawBackground(ctx, layout, accent) {
  const { width, height, frame } = layout;

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, PAPER_TOP);
  base.addColorStop(1, PAPER_BOTTOM);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height * 0.08, 0, width / 2, height * 0.08, width * 0.72);
  glow.addColorStop(0, alpha(accent, 0.12));
  glow.addColorStop(1, alpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  roundRect(ctx, frame, frame, width - frame * 2, height - frame * 2, 34);
  ctx.strokeStyle = alpha(accent, 0.34);
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSeal(ctx, layout, accent) {
  const { centerX, sealY, sealSize } = layout;
  const x = centerX - sealSize / 2;
  const y = sealY - sealSize / 2;

  roundRect(ctx, x, y, sealSize, sealSize, sealSize * 0.24);
  ctx.fillStyle = SEAL_PAPER;
  ctx.fill();
  ctx.strokeStyle = alpha(accent, 0.85);
  ctx.lineWidth = Math.max(2, sealSize * 0.035);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, sealSize * 0.56, 600, SERIF);
  ctx.fillText('日', centerX, sealY + sealSize * 0.02);
}

function drawBrand(ctx, layout) {
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, layout.width * 0.03, 650, SANS);
  drawSpaced(ctx, '指日可待', layout.centerX, layout.brandY, layout.width * 0.012);
}

function drawTitle(ctx, layout, title) {
  if (!title) return;
  setFont(ctx, layout.titleSize, 600, SERIF);
  const lines = wrapLines(ctx, title, layout.maxTextWidth, 2);
  const lineHeight = layout.titleSize * 1.26;
  const startY = layout.titleY - ((lines.length - 1) * lineHeight) / 2;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    drawSpaced(ctx, line, layout.centerX, startY + index * lineHeight, layout.titleSize * 0.05);
  });
}

function drawNote(ctx, layout, note) {
  if (!note) return;
  setFont(ctx, layout.noteSize, 400, SANS);
  const lines = wrapLines(ctx, note, layout.maxTextWidth * 0.92, 2);
  const lineHeight = layout.noteSize * 1.7;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.fillText(line, layout.centerX, layout.noteY + index * lineHeight);
  });
}

function drawFigure(ctx, layout, { label, number, unit, kind, accent }) {
  const color = kindColor(kind, accent);
  const numberText = String(number || '');
  if (!numberText) return;

  const isWord = !unit && !label;
  const numberSize = isWord ? layout.numberSize * 0.62 : layout.numberSize;
  const sideSize = layout.unitSize;

  setFont(ctx, numberSize, 600, SERIF);
  const numberWidth = ctx.measureText(numberText).width;
  setFont(ctx, sideSize, 500, SANS);
  const labelWidth = label ? ctx.measureText(label).width : 0;
  const unitWidth = unit ? ctx.measureText(unit).width : 0;

  const gap = numberSize * 0.1;
  const totalWidth = (label ? labelWidth + gap : 0) + numberWidth + (unit ? unitWidth + gap : 0);
  const startX = layout.centerX - totalWidth / 2;

  ctx.textBaseline = 'middle';

  if (label) {
    ctx.fillStyle = alpha(color, 0.82);
    ctx.textAlign = 'center';
    setFont(ctx, sideSize, 500, SANS);
    ctx.fillText(label, startX + labelWidth / 2, layout.figureY + numberSize * 0.2);
  }

  const numberCenterX = startX + (label ? labelWidth + gap : 0) + numberWidth / 2;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  setFont(ctx, numberSize, 600, SERIF);
  ctx.fillText(numberText, numberCenterX, layout.figureY);

  if (unit) {
    ctx.fillStyle = alpha(color, 0.82);
    ctx.textAlign = 'center';
    setFont(ctx, sideSize, 500, SANS);
    ctx.fillText(unit, numberCenterX + numberWidth / 2 + gap + unitWidth / 2, layout.figureY + numberSize * 0.2);
  }
}

function drawMeta(ctx, layout, { dateText, weekday, lunarText }) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const dateLine = [dateText, weekday].filter(Boolean).join(' · ');
  if (dateLine) {
    ctx.fillStyle = MUTED;
    setFont(ctx, layout.metaSize, 500, SANS);
    drawSpaced(ctx, dateLine, layout.centerX, layout.metaY, layout.metaSize * 0.12);
  }

  if (lunarText) {
    ctx.fillStyle = SOFT;
    setFont(ctx, layout.metaSize * 0.88, 400, SANS);
    ctx.fillText(lunarText, layout.centerX, layout.metaY + layout.metaSize * 1.9);
  }
}

function drawFooter(ctx, layout) {
  ctx.strokeStyle = 'rgba(120, 100, 72, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.centerX - layout.width * 0.18, layout.footerY - layout.footerSize * 2.2);
  ctx.lineTo(layout.centerX + layout.width * 0.18, layout.footerY - layout.footerSize * 2.2);
  ctx.stroke();

  ctx.fillStyle = SOFT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, layout.footerSize, 500, SANS);
  drawSpaced(ctx, '一天一天，等到那天', layout.centerX, layout.footerY, layout.footerSize * 0.22);
}

function safeName(title) {
  return String(title || '日子')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .slice(0, 24) || '日子';
}

/** 卡片文件名：zrkd-在一起-20261119.png */
export function shareCardFilename(title, date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `zrkd-${safeName(title)}-${stamp}.png`;
}

/**
 * 把某一天画成分享卡片。
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function renderShareCard({
  title = '',
  note = '',
  label = '',
  number = '',
  unit = '',
  kind = 'countdown',
  dateText = '',
  weekday = '',
  lunarText = '',
  accent = DEFAULT_ACCENT,
  width = SHARE_CARD.width,
  height = SHARE_CARD.height
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('这台设备不支持图片处理');

  const layout = computeCardLayout(width, height);

  drawBackground(ctx, layout, accent);
  drawSeal(ctx, layout, accent);
  drawBrand(ctx, layout);
  drawTitle(ctx, layout, title);
  drawNote(ctx, layout, note);
  drawFigure(ctx, layout, { label, number, unit, kind, accent });
  drawMeta(ctx, layout, { dateText, weekday, lunarText });
  drawFooter(ctx, layout);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('卡片生成失败，再试一次'));
    }, 'image/png');
  });

  return { blob, width, height };
}
