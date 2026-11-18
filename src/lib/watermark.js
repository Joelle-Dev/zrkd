// 照片水印合成：缩放 → 铺图 → 压暗 → 居中写字 → JPEG。
//
// 纯布局计算 (computeLayout) 与 canvas 绘制分开，前者可以单元测试，
// 后者只依赖浏览器 API。所有尺寸都按图片短边等比推导，竖图横图都不会崩。

const MAX_EDGE = 2200;
const MIN_EDGE = 480;

const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function computeLayout(width, height, { position = 'bottom' } = {}) {
  const base = Math.min(width, height);

  const titleSize = clamp(base * 0.046, 16, 128);
  const numberSize = clamp(base * 0.15, 40, 380);
  const unitSize = clamp(numberSize * 0.26, 14, 100);
  const dateSize = clamp(base * 0.028, 11, 46);

  const gapTitle = titleSize * 0.52;
  const gapDate = dateSize * 1.7;

  const blockHeight = titleSize + gapTitle + numberSize + gapDate + dateSize;

  const bottomMargin = height * 0.1;
  const centerY = position === 'center'
    ? height / 2
    : height - bottomMargin - blockHeight / 2;

  const top = centerY - blockHeight / 2;
  const titleY = top + titleSize / 2;
  const numberY = top + titleSize + gapTitle + numberSize / 2;
  const dateY = top + titleSize + gapTitle + numberSize + gapDate + dateSize / 2;

  return {
    base,
    titleSize,
    numberSize,
    unitSize,
    dateSize,
    gapTitle,
    gapDate,
    blockHeight,
    centerY,
    titleY,
    numberY,
    dateY,
    maxWidth: width * 0.84,
    padding: width * 0.08,
    position,
    scrim: position === 'center'
      ? { type: 'radial', radius: Math.max(width, height) * 0.62 }
      : { type: 'linear', from: Math.max(0, top - blockHeight * 0.9), to: height }
  };
}

export function planTextFits({ text, width, size, weight = 600, family = SERIF, measure }) {
  const measureAt = (candidate) => measure(String(text || ''), {
    font: `${weight} ${candidate}px ${family}`
  });
  let current = size;
  let measured = measureAt(current);
  while (measured > width && current > size * 0.55) {
    current = Math.max(size * 0.55, current - Math.max(1, size * 0.02));
    measured = measureAt(current);
  }
  return { size: current, measured, overflow: measured > width };
}

function setFont(ctx, size, weight, family) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
}

function measureText(text, { font }) {
  const canvas = measureText.canvas || (measureText.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const chars = Array.from(String(text || ''));
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

function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = Array.from(text);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, value) => sum + value, 0) + spacing * (chars.length - 1);
  let cursor = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index] + spacing;
  });
  ctx.textAlign = align;
}

export function outputSize(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

async function decodeImage(source) {
  if (typeof source === 'string') {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    await image.decode();
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  }

  if (source instanceof Blob) {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
        return { image: bitmap, width: bitmap.width, height: bitmap.height };
      } catch (err) {
        // Safari 旧版本不支持 imageOrientation 选项，退回 <img> 解码。
      }
    }
    const url = URL.createObjectURL(source);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      await image.decode();
      return { image, width: image.naturalWidth, height: image.naturalHeight };
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  }

  if (source && (source.width || source.naturalWidth)) {
    return {
      image: source,
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height
    };
  }

  throw new Error('这张图片打不开');
}

function drawScrim(ctx, width, height, layout) {
  ctx.save();
  if (layout.scrim.type === 'linear') {
    const gradient = ctx.createLinearGradient(0, layout.scrim.from, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, layout.scrim.from, width, height - layout.scrim.from);
  } else {
    const gradient = ctx.createRadialGradient(
      width / 2, layout.centerY, Math.min(width, height) * 0.05,
      width / 2, layout.centerY, layout.scrim.radius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function paintText(ctx, text, x, y, { size, weight, family, letterSpacing = 0, color = '#fff' }) {
  ctx.save();
  setFont(ctx, size, weight, family);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.max(2, size * 0.12);
  ctx.shadowOffsetY = Math.max(1, size * 0.02);
  if (letterSpacing) {
    drawSpacedText(ctx, String(text), x, y, letterSpacing);
  } else {
    ctx.fillText(String(text), x, y);
  }
  ctx.restore();
}

/**
 * 合成水印图。
 * @param {object} options
 * @param {Blob|string|CanvasImageSource} options.source 原图
 * @param {string} options.title  标题，例如「在一起」
 * @param {string} options.number 大号文字，例如「1234」或「今天」
 * @param {string} options.prefix 数字前面的小字，例如「还有」「已经」
 * @param {string} options.unit   数字单位，例如「天」；为「今天」时传空
 * @param {string} options.dateText 小字日期，例如「2026.11.18」
 * @param {'bottom'|'center'} [options.position]
 * @param {number} [options.maxEdge]
 * @returns {Promise<{ blob: Blob, width: number, height: number }>}
 */
export async function renderWatermark({
  source,
  title,
  number,
  prefix = '',
  unit = '天',
  dateText,
  position = 'bottom',
  maxEdge = MAX_EDGE
}) {
  const decoded = await decodeImage(source);
  const size = outputSize(decoded.width, decoded.height, maxEdge);
  if (Math.min(size.width, size.height) < 1) throw new Error('图片尺寸异常');

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('这台设备不支持图片处理');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.image, 0, 0, size.width, size.height);

  const layout = computeLayout(size.width, size.height, { position });
  drawScrim(ctx, size.width, size.height, layout);

  const cx = size.width / 2;

  if (title) {
    const fit = planTextFits({
      text: title,
      width: layout.maxWidth,
      size: layout.titleSize,
      weight: 600,
      family: SERIF,
      measure: measureText
    });
    setFont(ctx, fit.size, 600, SERIF);
    const lines = wrapLines(ctx, title, layout.maxWidth, 2);
    const lineHeight = fit.size * 1.22;
    const startY = layout.titleY - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      paintText(ctx, line, cx, startY + index * lineHeight, {
        size: fit.size,
        weight: 600,
        family: SERIF,
        letterSpacing: Math.max(0, fit.size * 0.06)
      });
    });
  }

  if (number) {
    const numberText = String(number);
    const prefixText = String(prefix || '');
    const unitText = String(unit || '');
    const gap = layout.numberSize * 0.1;

    setFont(ctx, layout.numberSize, 600, SERIF);
    const numberWidth = ctx.measureText(numberText).width;
    setFont(ctx, layout.unitSize, 500, SANS);
    const prefixWidth = prefixText ? ctx.measureText(prefixText).width : 0;
    const unitWidth = unitText ? ctx.measureText(unitText).width : 0;

    const groupWidth = numberWidth
      + (prefixText ? prefixWidth + gap : 0)
      + (unitText ? unitWidth + gap : 0);
    const scale = groupWidth > layout.maxWidth
      ? Math.max(0.55, layout.maxWidth / groupWidth)
      : 1;

    const numberSize = layout.numberSize * scale;
    const sideSize = layout.unitSize * scale;
    const sideGap = gap * scale;

    setFont(ctx, numberSize, 600, SERIF);
    const finalNumberWidth = ctx.measureText(numberText).width;
    setFont(ctx, sideSize, 500, SANS);
    const finalPrefixWidth = prefixText ? ctx.measureText(prefixText).width : 0;
    const finalUnitWidth = unitText ? ctx.measureText(unitText).width : 0;

    const totalWidth = (prefixText ? finalPrefixWidth + sideGap : 0)
      + finalNumberWidth
      + (unitText ? finalUnitWidth + sideGap : 0);
    const startX = cx - totalWidth / 2;

    if (prefixText) {
      paintText(ctx, prefixText, startX + finalPrefixWidth / 2, layout.numberY + numberSize * 0.22, {
        size: sideSize,
        weight: 500,
        family: SANS,
        letterSpacing: sideSize * 0.08
      });
    }

    const numberCenterX = startX + (prefixText ? finalPrefixWidth + sideGap : 0) + finalNumberWidth / 2;
    paintText(ctx, numberText, numberCenterX, layout.numberY, {
      size: numberSize,
      weight: 600,
      family: SERIF
    });

    if (unitText) {
      paintText(ctx, unitText, numberCenterX + finalNumberWidth / 2 + sideGap + finalUnitWidth / 2, layout.numberY + numberSize * 0.22, {
        size: sideSize,
        weight: 500,
        family: SANS,
        letterSpacing: sideSize * 0.08
      });
    }
  }

  if (dateText) {
    paintText(ctx, dateText, cx, layout.dateY, {
      size: layout.dateSize,
      weight: 500,
      family: SANS,
      letterSpacing: layout.dateSize * 0.16,
      color: 'rgba(255, 255, 255, 0.92)'
    });
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('图片生成失败，换张小一点的图试试'));
    }, 'image/jpeg', 0.92);
  });

  // 释放 ImageBitmap 占用的显存
  if (typeof decoded.image.close === 'function') {
    try {
      decoded.image.close();
    } catch (err) {
      // ignore
    }
  }

  return { blob, width: size.width, height: size.height };
}

export { MAX_EDGE, MIN_EDGE };
