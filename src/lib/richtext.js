// 极简富文本：只允许「加粗 / 斜体 / 下划线 / 换行」。
//
// 用 contenteditable + 白名单过滤，不引入编辑器库：
// 需求只有几个格式按钮，Tiptap/ProseMirror 那类方案体积和复杂度都不划算。
//
// 安全边界：存进 IndexedDB 的 HTML 一律先过 sanitizeHtml，
// 只保留白名单标签、丢掉所有属性，粘贴进来的外部样式与脚本都进不去。

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P']);

const TAG_MAP = { STRONG: 'b', EM: 'i' };

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 洗一遍 HTML：只留白名单标签，属性全部丢弃。
 * 返回规范化后的字符串。
 */
export function sanitizeHtml(input) {
  const html = String(input || '');
  if (!html) return '';
  if (typeof document === 'undefined') {
    // 没有 DOM 时（Node 测试）退化成正则清洗：
    // 白名单标签规范化，其余标签整段丢弃（保留它们的文字内容）
    return html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g, (match, tag) => {
        const upper = tag.toUpperCase();
        if (!ALLOWED.has(upper)) return '';
        const name = TAG_MAP[upper] || upper.toLowerCase();
        if (name === 'br') return '<br>';
        return `<${match.startsWith('</') ? '/' : ''}${name}>`;
      });
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }

      const tag = child.tagName.toUpperCase();
      if (!ALLOWED.has(tag)) {
        // 不在白名单：保留文字，丢掉标签
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
        continue;
      }

      for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);

      if (TAG_MAP[tag]) {
        const replacement = document.createElement(TAG_MAP[tag].toLowerCase());
        while (child.firstChild) replacement.append(child.firstChild);
        child.replaceWith(replacement);
        walk(replacement);
        continue;
      }

      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

/** HTML → 纯文本，用于列表预览、字数和校验 */
export function htmlToText(input) {
  const html = String(input || '');
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  if (typeof document === 'undefined') {
    return decodeEntities(withBreaks).replace(/\n{3,}/g, '\n\n').trim();
  }

  const area = document.createElement('textarea');
  area.innerHTML = withBreaks;
  return area.value.replace(/\n{3,}/g, '\n\n').trim();
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 纯文本（老数据）→ HTML，保留换行 */
export function textToHtml(text) {
  const value = String(text || '');
  if (!value) return '';
  return value
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

/**
 * 统计字数：中文按字算，英文按词算，空白不计。
 */
export function countWords(text) {
  const value = String(text || '').trim();
  if (!value) return 0;
  const cjk = (value.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (value.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length;
  return cjk + words;
}


/* ==========================================================================
   富文本的「纯数据」表示
   --------------------------------------------------------------------------
   正文用 segments 表示：一段一段的纯文字 + 三个格式开关。
   = [ { text: '今天很好', bold: false, italic: false, underline: false } ]

   这样就不需要 contenteditable：
     · 打字时是一个普通 <textarea>，键盘行为跟系统原生输入框完全一致；
     · 修饰时把 segments 渲染成只读 HTML，页面上没有任何可编辑元素，
       所以长按选字、点加粗都不会弹键盘。
   两边共用同一份数据，切换时不会丢内容，也不会丢格式。
   ========================================================================== */

export const FORMAT_KEYS = Object.freeze(['bold', 'italic', 'underline']);

export const FORMAT_TAGS = Object.freeze({
  bold: 'b',
  italic: 'i',
  underline: 'u'
});

const TAG_TO_KEY = Object.freeze({
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline'
});

function bareSegment(text) {
  return { text: String(text || ''), bold: false, italic: false, underline: false };
}

function sameFormat(a, b) {
  return FORMAT_KEYS.every((key) => Boolean(a[key]) === Boolean(b[key]));
}

/** 去掉空段、合并相邻同格式段 */
export function mergeSegments(list) {
  const out = [];
  for (const item of list || []) {
    if (!item) continue;
    const text = String(item.text ?? '');
    if (!text) continue;
    const segment = {
      text,
      bold: Boolean(item.bold),
      italic: Boolean(item.italic),
      underline: Boolean(item.underline)
    };
    const last = out[out.length - 1];
    if (last && sameFormat(last, segment)) last.text += segment.text;
    else out.push(segment);
  }
  return out;
}

/** 纯文本 → 单段 */
export function textToSegments(text) {
  return mergeSegments([bareSegment(text)]);
}

export function segmentsToText(segments) {
  return (segments || []).map((item) => item.text).join('');
}

export function segmentsToHtml(segments) {
  let html = '';
  for (const segment of segments || []) {
    const text = String(segment.text || '');
    if (!text) continue;
    const open = FORMAT_KEYS
      .filter((key) => segment[key])
      .map((key) => `<${FORMAT_TAGS[key]}>`)
      .join('');
    const close = FORMAT_KEYS
      .filter((key) => segment[key])
      .reverse()
      .map((key) => `</${FORMAT_TAGS[key]}>`)
      .join('');
    const body = text.split('\n').map((line) => escapeHtml(line)).join('<br>');
    html += open + body + close;
  }
  return html;
}

/**
 * HTML → segments。
 * 只认 b/strong/i/em/u/br，以及 p/div 当换行；其它标签丢掉、保留文字。
 * 浏览器和 Node 测试环境走同一套正则逻辑，行为一致。
 */
export function htmlToSegments(input) {
  const source = String(input || '');
  if (!source) return [];

  const segments = [];
  const stack = [];
  let cursor = 0;

  const formatOf = () => ({
    bold: stack.includes('bold'),
    italic: stack.includes('italic'),
    underline: stack.includes('underline')
  });

  const pushText = (text) => {
    if (!text) return;
    const { bold, italic, underline } = formatOf();
    const last = segments[segments.length - 1];
    if (last && last.bold === bold && last.italic === italic && last.underline === underline) {
      last.text += text;
      return;
    }
    segments.push({ text, bold, italic, underline });
  };

  const tagRe = /<(\/?)([a-zA-Z][\w-]*)[^>]*>|([\s\S]+?)(?=<|$)/g;
  let match;
  while ((match = tagRe.exec(source)) !== null) {
    if (match[3] !== undefined) {
      pushText(decodeEntities(match[3]));
      cursor += match[3].length;
      continue;
    }
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    cursor += match[0].length;

    if (tag === 'br') {
      pushText('\n');
      continue;
    }
    if (tag === 'p' || tag === 'div') {
      if (closing) pushText('\n');
      continue;
    }
    const key = TAG_TO_KEY[tag];
    if (!key) continue;
    if (closing) {
      const index = stack.lastIndexOf(key);
      if (index >= 0) stack.splice(index, 1);
    } else {
      stack.push(key);
    }
  }

  const merged = mergeSegments(segments);
  // 段落收尾会留下一个换行，去掉末尾那一个，避免多出一整行空白
  const last = merged[merged.length - 1];
  if (last && last.text.endsWith('\n')) {
    last.text = last.text.replace(/\n$/, '');
    if (!last.text) merged.pop();
  }
  return merged;
}

/** 取 segments 里 [start, end) 这一段的副本，格式原样保留 */
export function sliceSegments(segments, start, end) {
  const total = segmentsToText(segments).length;
  const from = Math.max(0, Math.min(start, total));
  const to = Math.max(from, Math.min(end, total));
  const out = [];
  let cursor = 0;
  for (const segment of segments || []) {
    const segStart = cursor;
    const segEnd = cursor + segment.text.length;
    cursor = segEnd;
    if (segEnd <= from || segStart >= to) continue;
    const localFrom = Math.max(0, from - segStart);
    const localTo = Math.min(segment.text.length, to - segStart);
    out.push({
      text: segment.text.slice(localFrom, localTo),
      bold: Boolean(segment.bold),
      italic: Boolean(segment.italic),
      underline: Boolean(segment.underline)
    });
  }
  return mergeSegments(out);
}

/**
 * 给 [start, end) 打上或去掉某个格式。
 * mode: 'on' | 'off' | 'toggle'
 */
export function applyFormat(segments, start, end, key, mode = 'toggle') {
  if (!FORMAT_KEYS.includes(key)) return segments;
  const total = segmentsToText(segments).length;
  const from = Math.max(0, Math.min(start, total));
  const to = Math.max(from, Math.min(end, total));
  if (from === to) return segments;

  const allOn = formatRangeState(segments, from, to)[key];
  const next = mode === 'toggle' ? !allOn : mode === 'on';

  const before = sliceSegments(segments, 0, from);
  const middle = sliceSegments(segments, from, to).map((segment) => ({ ...segment, [key]: next }));
  const after = sliceSegments(segments, to, total);
  return mergeSegments([...before, ...middle, ...after]);
}

/** 判断 [start, end) 里三个格式是否「全部」带上（用于按钮高亮与 toggle 方向） */
export function formatRangeState(segments, start, end) {
  const part = sliceSegments(segments, start, end);
  const state = { bold: false, italic: false, underline: false };
  if (!part.length) return state;
  for (const key of FORMAT_KEYS) {
    state[key] = part.every((segment) => Boolean(segment[key]));
  }
  return state;
}

/**
 * 用户在 textarea 里改字之后，把新文本并回 segments。
 *
 * 只替换真正变化的那一段，前后未动的文字格式保留；
 * 新打进去的字符沿用光标前一个字的格式（在加粗文字后面接着写还是粗的）。
 */
export function reconcileSegments(segments, nextText) {
  const text = String(nextText ?? '');
  const previous = segmentsToText(segments);
  if (previous === text) return segments;

  const max = Math.min(previous.length, text.length);
  let prefix = 0;
  while (prefix < max && previous[prefix] === text[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < max - prefix &&
    previous[previous.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const before = sliceSegments(segments, 0, prefix);
  const after = sliceSegments(segments, previous.length - suffix, previous.length);
  const inserted = text.slice(prefix, text.length - suffix);

  let middle = [];
  if (inserted) {
    const inherit = prefix > 0 ? sliceSegments(segments, prefix - 1, prefix)[0] : null;
    const last = before[before.length - 1];
    middle = [{
      text: inserted,
      bold: Boolean(last?.bold ?? inherit?.bold),
      italic: Boolean(last?.italic ?? inherit?.italic),
      underline: Boolean(last?.underline ?? inherit?.underline)
    }];
  }

  return mergeSegments([...before, ...middle, ...after]);
}
