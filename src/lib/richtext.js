// 极简富文本：只允许「加粗 / 斜体 / 下划线 / 换行」。
//
// 用 contenteditable + 白名单过滤，不引入编辑器库：
// 需求只有几个格式按钮，Tiptap/ProseMirror 那类方案体积和复杂度都不划算。
//
// 安全边界：存进 IndexedDB 的 HTML 一律先过 sanitizeHtml，
// 只保留白名单标签、丢掉所有属性，粘贴进来的外部样式与脚本都进不去。

const ALLOWED = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL',
  'BR', 'DIV', 'P',
  // Vditor 的 IR 模式允许手敲 / 粘贴标题、列表、引用、代码，
  // 存下来也要能原样渲染，所以一并放行。
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR'
]);

const TAG_MAP = { STRONG: 'b', EM: 'i', DEL: 's', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6' };

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
   正文的 Markdown-lite
   --------------------------------------------------------------------------
   只支持行内三种修饰，符号少、规则死，用字符串就能完成：
       **加粗**    *斜体*    __下划线__

   这么做的好处：正文就是一段普通文字，编辑时用原生 <textarea>，
   键盘行为跟系统输入框一致；加粗只是往选区两端插符号，
   不需要 contenteditable、不需要切模式、撤销也能走系统原生 undo。

   两端各留一个字符的边界（\\S 起、\\S 收），避免把空格包进格式里。
   ========================================================================== */

export const MARKDOWN_MARKS = Object.freeze({
  bold: '**',
  italic: '*',
  underline: '__',
  strike: '~~'
});

export const MARKDOWN_KEYS = Object.freeze(['bold', 'italic', 'underline', 'strike']);

const MARK_TO_KEY = Object.freeze({
  '**': 'bold',
  '__': 'underline',
  '~~': 'strike',
  '*': 'italic'
});

function blankMarks() {
  return { bold: false, italic: false, underline: false, strike: false };
}

/**
 * 扫描一遍 Markdown，切成 { text, bold, italic, underline } 段。
 *
 * 只认 ** __ * 三种符号，先匹配长的再匹配短的（** 不会被当成两个 *）。
 * 找不到配对符号时，符号原样当普通字符输出，不会把文字吞掉。
 * 渲染和「按钮高亮」都基于这一份结果，规则只有一套。
 */
export function parseMarkdown(input) {
  const source = String(input || '');
  if (!source) return [];

  const segments = [];
  const stack = [];
  let buffer = '';

  const marksState = () => {
    const state = blankMarks();
    for (const key of stack) state[key] = true;
    return state;
  };

  const flush = () => {
    if (!buffer) return;
    const state = marksState();
    const last = segments[segments.length - 1];
    if (
      last &&
      last.bold === state.bold &&
      last.italic === state.italic &&
      last.underline === state.underline &&
      last.strike === state.strike
    ) {
      last.text += buffer;
    } else {
      segments.push({ text: buffer, ...state });
    }
    buffer = '';
  };

  let i = 0;
  while (i < source.length) {
    // 先试两个字符的符号，再试一个字符的
    const two = source.slice(i, i + 2);
    const one = source[i];
    const mark = MARK_TO_KEY[two] ? two : (MARK_TO_KEY[one] ? one : '');
    if (!mark) {
      buffer += one;
      i += 1;
      continue;
    }
    const key = MARK_TO_KEY[mark];

    if (stack.includes(key)) {
      flush();
      stack.splice(stack.lastIndexOf(key), 1);
      i += mark.length;
      continue;
    }

    // 只有当后面还存在同种符号时才当成开标记，否则原样输出
    const hasPair = source.indexOf(mark, i + mark.length) !== -1;
    if (hasPair) {
      flush();
      stack.push(key);
      i += mark.length;
    } else {
      buffer += mark;
      i += mark.length;
    }
  }

  flush();
  return segments;
}

/** 把加粗/斜体/下划线的 Markdown 渲染成白名单 HTML */
export function markdownToHtml(input) {
  const segments = parseMarkdown(input);
  let html = '';
  let cursor = 0;

  // 同一外层的相邻段先合并成一段再包标签，避免出现
  // <b>a</b><b><i>b</i></b><b>c</b> 这种拆碎的结果
  while (cursor < segments.length) {
    const head = segments[cursor];
    let end = cursor + 1;
    while (
      end < segments.length &&
      segments[end].bold === head.bold &&
      segments[end].underline === head.underline &&
      segments[end].strike === head.strike
    ) {
      end += 1;
    }

    let inner = '';
    for (let i = cursor; i < end; i += 1) {
      const segment = segments[i];
      const text = escapeHtml(segment.text).replace(/\n/g, '<br>');
      if (!text) continue;
      inner += segment.italic ? `<i>${text}</i>` : text;
    }

    if (inner) {
      if (head.strike) inner = `<s>${inner}</s>`;
      if (head.underline) inner = `<u>${inner}</u>`;
      if (head.bold) inner = `<b>${inner}</b>`;
      html += inner;
    }
    cursor = end;
  }

  return html;
}

/**
 * 在 [start, end) 两端包上或去掉某个格式符号。
 * 返回 { text, start, end }：text 是新的正文，start/end 是调整后的选区，
 * 这样加粗之后还能接着操作同一段文字。
 */
export function toggleMark(text, start, end, key) {
  const mark = MARKDOWN_MARKS[key];
  if (!mark) return { text, start, end };

  const source = String(text || '');
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(source.length, Math.max(start, end));

  // 情况一：选区外侧就紧贴着符号，直接摘掉
  const outsideFrom = from - mark.length;
  const outsideTo = to + mark.length;
  if (
    outsideFrom >= 0 &&
    source.slice(outsideFrom, from) === mark &&
    source.slice(to, outsideTo) === mark
  ) {
    const next = source.slice(0, outsideFrom) + source.slice(from, to) + source.slice(outsideTo);
    return { text: next, start: from - mark.length, end: to - mark.length };
  }

  // 情况二：选中的文字自己带着符号（用户把符号也选进去了）
  const selected = source.slice(from, to);
  if (selected.length > mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
    const inner = selected.slice(mark.length, selected.length - mark.length);
    const next = source.slice(0, from) + inner + source.slice(to);
    return { text: next, start: from, end: from + inner.length };
  }

  // 情况三：正常加符号
  const next = source.slice(0, from) + mark + selected + mark + source.slice(to);
  return { text: next, start: from + mark.length, end: to + mark.length };
}

/**
 * 光标/选区当前处在哪些格式里，用于按钮高亮。
 * 折叠光标取它所在位置的状态；有选区时要求整段都带同一格式。
 */
/**
 * 光标/选区当前处在哪些格式里，用于按钮高亮。
 *
 * 注意 offset 是 **原始正文**（含 ** __ * 符号）里的偏移，
 * 和 textarea.selectionStart/End 一致；不要拿渲染后的文字去算。
 * 折叠光标看它前一个字符处于什么格式；有选区则要求整段格式一致。
 */
export function activeMarksAt(text, start, end = start) {
  const source = String(text || '');
  const from = Math.max(0, Math.min(start, source.length));
  const to = Math.max(from, Math.min(end === start ? from : end, source.length));

  const stack = [];
  const states = [];
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const one = source[i];
    const mark = MARK_TO_KEY[two] ? two : (MARK_TO_KEY[one] ? one : '');
    if (!mark) {
      states.push({ index: i, stack: [...stack] });
      i += 1;
      continue;
    }
    const key = MARK_TO_KEY[mark];
    if (stack.includes(key)) {
      stack.splice(stack.lastIndexOf(key), 1);
      i += mark.length;
      continue;
    }
    if (source.indexOf(mark, i + mark.length) !== -1) {
      stack.push(key);
      i += mark.length;
      continue;
    }
    // 没有配对的符号按普通字符算
    states.push({ index: i, stack: [...stack] });
    i += 1;
  }

  const picked = states.filter((item) => {
    if (from === to) return item.index === Math.max(0, from - 1);
    return item.index >= from && item.index < to;
  });
  if (!picked.length) return blankMarks();

  const state = { bold: true, italic: true, underline: true, strike: true };
  for (const item of picked) {
    for (const key of MARKDOWN_KEYS) {
      if (!item.stack.includes(key)) state[key] = false;
    }
  }
  return state;
}

/** 旧的 HTML 正文 → Markdown（迁移用，只认 b/strong/i/em/u/br） */
export function htmlToMarkdown(input) {
  const source = String(input || '');
  if (!source) return '';
  let text = source
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<(p|div)[^>]*>/gi, '');
  // 由内到外逐种替换，避免嵌套顺序乱掉
  text = replaceTagPair(text, 'b|strong', '**');
  text = replaceTagPair(text, 's|del', '~~');
  text = replaceTagPair(text, 'u', '__');
  text = replaceTagPair(text, 'i|em', '*');
  // 去掉其余标签，保留文字
  text = text.replace(/<[^>]*>/g, '');
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '');
}

function replaceTagPair(text, tagPattern, mark) {
  const re = new RegExp(`<(${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let previous;
  let result = text;
  do {
    previous = result;
    result = result.replace(re, `${mark}$2${mark}`);
  } while (result !== previous);
  return result;
}
