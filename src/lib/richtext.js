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
