// 「日子」分享卡片：把某一天的倒数画成一张竖版海报，方便存进相册。
//
// 布局是纯函数（可单测）；绘制只在浏览器里跑，依赖 canvas。
// 视觉跟详情页的 .detail-card 票根一致：宣纸底、顶部印章 + 品牌、右侧日期存根、
// 虚线撕口、左对齐的标题与备注、居中的天数，底部一行日期和农历。

const INK = '#241f19';
const MUTED = '#6b6050';
const MUTED_SOFT = '#776c5b';
const PAGE_TOP = '#f4efe4';
const PAGE_BOTTOM = '#eae2d2';
const SURFACE = '#fffdf7';
const SURFACE_SOFT = '#faf6ec';
const SEAL_PAPER = '#fffdf7';
const LINE = 'rgba(120, 100, 72, 0.13)';
const COUNTDOWN = '#3a6da8';
const COUNTDOWN_INK = '#2f5786';
const ELAPSED = '#b0791f';
const ELAPSED_INK = '#8a5d12';
const DEFAULT_ACCENT = '#c2564a';

const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif';

export const SHARE_CARD = Object.freeze({ width: 1080, height: 1350 });

/** 卡片里各元素的位置与字号，全部按画布尺寸推导（基准是 375pt 的手机卡面） */
export function computeCardLayout(width = SHARE_CARD.width, height = SHARE_CARD.height) {
  const u = width / 375;
  const margin = Math.round(Math.min(width, height) * 0.042);
  const card = {
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    radius: 18 * u,
    padX: 18 * u,
    padTop: 15 * u,
    padBottom: 17 * u
  };

  const centerX = card.x + card.width / 2;
  const maxTextWidth = card.width - card.padX * 2;

  const sealSize = Math.round(32 * u);
  const headerTop = card.y + card.padTop;
  const headerCenterY = headerTop + sealSize / 2;

  const tearY = headerTop + sealSize + 12 * u;
  const titleTop = tearY + 11 * u;
  const titleSize = Math.round(21 * u);
  const titleLineHeight = titleSize * 1.35;
  const titleY = titleTop + titleLineHeight * 0.42;

  const noteTop = titleTop + titleLineHeight * 2 + 5 * u;
  const noteSize = Math.round(12 * u);
  const noteLineHeight = noteSize * 1.6;
  const noteY = noteTop + noteLineHeight * 0.42;

  const numberSize = Math.round(58 * u);
  const unitSize = Math.round(13 * u);
  const figureY = Math.round(height * 0.57);

  const metaSize = Math.round(11 * u);
  const lunarSize = Math.round(10 * u);
  const metaGap = Math.round(3 * u);
  const metaY = card.y + card.height - card.padBottom - metaSize / 2;

  return {
    width,
    height,
    u,
    margin,
    card,
    centerX,
    sealSize,
    headerTop,
    headerCenterY,
    sealY: headerCenterY,
    brandY: headerCenterY,
    tearY,
    titleSize,
    titleLineHeight,
    titleTop,
    titleY,
    noteSize,
    noteLineHeight,
    noteTop,
    noteY,
    numberSize,
    unitSize,
    figureY,
    metaSize,
    lunarSize,
    metaGap,
    metaY,
    maxTextWidth
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

// 大数字用方向色：过去=暖黄（已经），未来=冷蓝（还有），
// 「就是今天」没有方向，用这一天自己的颜色。
function kindColor(kind, accent) {
  if (kind === 'past') return ELAPSED;
  if (kind === 'countdown') return COUNTDOWN;
  return accent || DEFAULT_ACCENT;
}

// 「还有 / 已经 / 天」这些陪衬字用同方向的深色，跟详情页的 --*-ink 对齐。
function kindInk(kind, accent) {
  if (kind === 'past') return ELAPSED_INK;
  if (kind === 'countdown') return COUNTDOWN_INK;
  return MUTED;
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
  let truncated = false;

  for (const char of chars) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    } else {
      line = next;
    }
  }

  if (!truncated && line) lines.push(line);

  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = Array.from(last).slice(0, -1).join('');
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawTracked(ctx, text, x, y, spacing, align = 'left') {
  const chars = Array.from(String(text));
  if (!chars.length) return;
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, value) => sum + value, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const previous = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    if (char !== ' ') ctx.fillText(char, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = previous;
}

function drawBackground(ctx, layout, accent) {
  const { width, height } = layout;

  const page = ctx.createLinearGradient(0, 0, 0, height);
  page.addColorStop(0, PAGE_TOP);
  page.addColorStop(1, PAGE_BOTTOM);
  ctx.fillStyle = page;
  ctx.fillRect(0, 0, width, height);

  const { card } = layout;
  ctx.save();
  ctx.shadowColor = 'rgba(74, 55, 30, 0.10)';
  ctx.shadowBlur = 18 * layout.u;
  ctx.shadowOffsetY = 4 * layout.u;
  roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
  ctx.fillStyle = SURFACE;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
  ctx.clip();

  const base = ctx.createLinearGradient(0, card.y, 0, card.y + card.height);
  base.addColorStop(0, SURFACE);
  base.addColorStop(1, SURFACE_SOFT);
  ctx.fillStyle = base;
  ctx.fillRect(card.x, card.y, card.width, card.height);

  const glow = ctx.createRadialGradient(
    card.x + card.width, card.y, 0,
    card.x + card.width, card.y, card.width * 0.75
  );
  glow.addColorStop(0, alpha(accent, 0.09));
  glow.addColorStop(1, alpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(card.x, card.y, card.width, card.height);
  ctx.restore();

  roundRect(ctx, card.x, card.y, card.width, card.height, card.radius);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1, layout.u * 0.6);
  ctx.stroke();
}

function drawHeader(ctx, layout, { accent, monthDay, weekday }) {
  const { card, sealSize, headerCenterY } = layout;
  const x = card.x + card.padX;
  const sealY = headerCenterY - sealSize / 2;

  roundRect(ctx, x, sealY, sealSize, sealSize, sealSize * 0.28);
  ctx.fillStyle = SEAL_PAPER;
  ctx.fill();
  ctx.strokeStyle = alpha(accent, 0.8);
  ctx.lineWidth = Math.max(1.5, sealSize * 0.047);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, sealSize * 0.53, 600, SERIF);
  ctx.fillText('日', x + sealSize / 2, headerCenterY + sealSize * 0.02);

  ctx.fillStyle = MUTED_SOFT;
  ctx.textBaseline = 'middle';
  setFont(ctx, 9.5 * layout.u, 650, SANS);
  drawTracked(
    ctx,
    '指日可待',
    x + sealSize + 8 * layout.u,
    headerCenterY,
    9.5 * layout.u * 0.24,
    'left'
  );

  if (monthDay) {
    const padY = 4 * layout.u;
    const padX = 9 * layout.u;
    const stubDateSize = 14 * layout.u;
    const stubWeekSize = 8.5 * layout.u;

    ctx.textAlign = 'center';
    setFont(ctx, stubDateSize, 600, SERIF);
    const dateWidth = ctx.measureText(monthDay).width;
    setFont(ctx, stubWeekSize, 500, SANS);
    const weekWidth = weekday ? ctx.measureText(weekday).width : 0;

    const stubWidth = Math.max(dateWidth, weekWidth) + padX * 2;
    const stubHeight = stubDateSize * 1.1 + stubWeekSize * 1.1 + padY * 2 + layout.u;
    const stubX = card.x + card.width - card.padX - stubWidth;
    const stubY = headerCenterY - stubHeight / 2;

    roundRect(ctx, stubX, stubY, stubWidth, stubHeight, 10 * layout.u);
    ctx.fillStyle = alpha(accent, 0.12);
    ctx.fill();

    const dateY = stubY + padY + stubDateSize * 0.55;
    const weekY = dateY + stubDateSize * 1.1 / 2 + layout.u + stubWeekSize * 0.55;

    ctx.fillStyle = accent;
    setFont(ctx, stubDateSize, 600, SERIF);
    ctx.fillText(monthDay, stubX + stubWidth / 2, dateY);

    if (weekday) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = accent;
      setFont(ctx, stubWeekSize, 500, SANS);
      ctx.fillText(weekday, stubX + stubWidth / 2, weekY);
      ctx.restore();
    }
  }
}

function drawTear(ctx, layout, accent) {
  const { card, tearY } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([6 * layout.u, 5 * layout.u]);
  ctx.moveTo(card.x + card.padX, tearY);
  ctx.lineTo(card.x + card.width - card.padX, tearY);
  ctx.strokeStyle = alpha(accent, 0.24);
  ctx.lineWidth = 1.5 * layout.u;
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx, layout, title) {
  if (!title) return;
  setFont(ctx, layout.titleSize, 600, SERIF);
  const lines = wrapLines(ctx, title, layout.maxTextWidth, 2);
  const startY = layout.titleY;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    drawTracked(
      ctx,
      line,
      layout.card.x + layout.card.padX,
      startY + index * layout.titleLineHeight,
      layout.titleSize * 0.02,
      'left'
    );
  });
}

function drawNote(ctx, layout, note) {
  if (!note) return;
  setFont(ctx, layout.noteSize, 400, SANS);
  const lines = wrapLines(ctx, note, layout.maxTextWidth, 2);
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      layout.card.x + layout.card.padX,
      layout.noteY + index * layout.noteLineHeight
    );
  });
}

function drawFigure(ctx, layout, { label, number, unit, kind, accent }) {
  const color = kindColor(kind, accent);
  const ink = kindInk(kind, accent);
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
    ctx.fillStyle = ink;
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
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    setFont(ctx, sideSize, 500, SANS);
    ctx.fillText(unit, numberCenterX + numberWidth / 2 + gap + unitWidth / 2, layout.figureY + numberSize * 0.2);
  }
}

function drawMeta(ctx, layout, { dateText, weekday, lunarText }) {
  const { metaY, metaSize, lunarSize, metaGap } = layout;
  const dateLine = [dateText, weekday].filter(Boolean).join(' · ');

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const dateY = lunarText ? metaY - lunarSize - metaGap : metaY;

  if (dateLine) {
    ctx.fillStyle = MUTED;
    setFont(ctx, metaSize, 500, SANS);
    drawSpaced(ctx, dateLine, layout.centerX, dateY, metaSize * 0.05);
  }

  if (lunarText) {
    ctx.fillStyle = MUTED_SOFT;
    setFont(ctx, lunarSize, 400, SANS);
    ctx.fillText(lunarText, layout.centerX, metaY);
  }
}

// 保留旧名字，内部仍按居中排布处理日期与农历。
function drawSpaced(ctx, text, x, y, spacing) {
  drawTracked(ctx, text, x, y, spacing, 'center');
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
  monthDay = '',
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
  drawHeader(ctx, layout, { accent, monthDay, weekday });
  drawTear(ctx, layout, accent);
  drawTitle(ctx, layout, title);
  drawNote(ctx, layout, note);
  drawFigure(ctx, layout, { label, number, unit, kind, accent });
  drawMeta(ctx, layout, { dateText, weekday, lunarText });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('卡片生成失败，再试一次'));
    }, 'image/png');
  });

  return { blob, width, height };
}
