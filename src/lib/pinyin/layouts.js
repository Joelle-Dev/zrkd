// 拼音键盘的按键表与文本小工具。
// 按键只是数据，真正怎么处理在 composable 里，方便单测。

export const T9_LETTERS = Object.freeze({
  2: 'abc',
  3: 'def',
  4: 'ghi',
  5: 'jkl',
  6: 'mno',
  7: 'pqrs',
  8: 'tuv',
  9: 'wxyz'
});

/** 九宫格上排 1-9，1 当标点键用；0 在底排放空格 */
export const T9_DIGITS = Object.freeze(['1', '2', '3', '4', '5', '6', '7', '8', '9']);

export const T9_ROWS = Object.freeze([
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9']
]);

export const QWERTY_ROWS = Object.freeze([
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
]);

/** 符号页：常用中文标点 + 数字 */
export const SYMBOL_KEYS = Object.freeze([
  '，', '。', '？', '！', '、', '：', '；', '“', '”', '（', '）', '…',
  '—', '·', '《', '》', '～', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
]);

export function t9Hint(digit) {
  return T9_LETTERS[digit] || '';
}

/**
 * 往前删一个字时，光标应该退到哪儿。
 * 优先用 Intl.Segmenter 按「字素」退（emoji、组合字符算一个），
 * 不支持时退回代理对判断。
 */
export function previousGraphemeIndex(text) {
  const value = String(text || '');
  if (!value) return 0;

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      let last = 0;
      for (const part of segmenter.segment(value)) last = part.index;
      return last;
    } catch (err) {
      // 落到下面
    }
  }

  const lastCode = value.charCodeAt(value.length - 1);
  const prevCode = value.charCodeAt(value.length - 2);
  const isLowSurrogate = lastCode >= 0xdc00 && lastCode <= 0xdfff;
  const isHighSurrogate = prevCode >= 0xd800 && prevCode <= 0xdbff;
  return isLowSurrogate && isHighSurrogate ? value.length - 2 : value.length - 1;
}
