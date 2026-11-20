// 内置拼音键盘的控制器。
//
// 思路：
//   · 所有文本输入框在启用时被设成 inputmode="none"，系统键盘不再弹；
//   · 输入框保持焦点，键盘按钮用 mousedown.prevent 抢不到焦点；
//   · 拼音串只留在引擎里，点候选/空格才用 execCommand('insertText') 上屏，
//     这样 v-model、自动保存、原生 undo 都还能正常工作。
//
// 这里是模块级单例：App 挂一份 PinyinKeypad，所有页面共用。

import { reactive } from 'vue';
import {
  loadPinyinPrefs,
  savePinyinEnabled,
  savePinyinLayout
} from '../lib/pinyin/prefs';
import { previousGraphemeIndex } from '../lib/pinyin/layouts';

const FIELD_SELECTOR = [
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  'textarea'
].join(',');

const prefs = loadPinyinPrefs();

export const pinyinState = reactive({
  enabled: prefs.enabled,
  layout: prefs.layout,
  visible: false,
  loading: false,
  error: '',
  /** 'zh' | 'en'，只有 26 键用得上 */
  language: 'zh',
  shift: false,
  symbolMode: false,
  preedit: '',
  displayPreedit: '',
  candidates: [],
  page: 0,
  pageCount: 0,
  syllables: [],
  activeSyllable: null
});

let installed = false;
let activeEl = null;
let engine = null;
let engineMode = '';
let corePromise = null;
let userFreq = null;
let engineToken = 0;
let observer = null;
let syncFrame = 0;
let blurTimer = 0;

/* ---------- 引擎 ---------- */

async function getCore() {
  if (!corePromise) {
    corePromise = import('@startsi/pinyin-core').catch((err) => {
      corePromise = null;
      throw err;
    });
  }
  return corePromise;
}

async function ensureEngine() {
  const mode = pinyinState.layout === 't9' ? 't9' : 'pinyin';
  if (engine && engineMode === mode) return engine;

  const token = ++engineToken;
  pinyinState.loading = true;
  pinyinState.error = '';
  try {
    const core = await getCore();
    if (token !== engineToken) return engine;
    if (!userFreq) {
      try {
        userFreq = new core.UserFreqStore('zrkd:pinyin-user-freq', 2000);
      } catch (err) {
        // 隐私模式下可能没有 localStorage，词频就只记在内存里
        userFreq = null;
      }
    }
    // 词库解析可能要一百多毫秒，先让界面画出来
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (token !== engineToken) return engine;
    if (mode === 't9') core.preloadT9();
    else core.preloadLexicon();

    engine = new core.PinyinEngine({
      mode,
      pageSize: 9,
      fuzzy: true,
      enableInitials: true,
      enableNames: false,
      useLm: false,
      userFreq: userFreq ? userFreq.get : undefined
    });
    engineMode = mode;
    refresh();
    return engine;
  } catch (err) {
    if (token !== engineToken) return engine;
    engine = null;
    engineMode = '';
    pinyinState.error = '输入法没准备好，检查下网络再点一次';
    throw err;
  } finally {
    if (token === engineToken) pinyinState.loading = false;
  }
}

/** 编辑页打开时提前把引擎拉下来，用户点输入框就不用等 */
export function warmUpPinyin() {
  if (!pinyinState.enabled || typeof window === 'undefined') return;
  ensureEngine().catch(() => {});
}

function refresh() {
  if (!engine) {
    pinyinState.preedit = '';
    pinyinState.displayPreedit = '';
    pinyinState.candidates = [];
    pinyinState.page = 0;
    pinyinState.pageCount = 0;
    pinyinState.syllables = [];
    pinyinState.activeSyllable = null;
    return;
  }
  pinyinState.preedit = engine.preedit;
  pinyinState.displayPreedit = engine.displayPreedit;
  pinyinState.candidates = engine.list();
  pinyinState.page = engine.page;
  pinyinState.pageCount = engine.pageCount;
  pinyinState.syllables = engine.syllableOptions();
  pinyinState.activeSyllable = engine.activeSyllable;
}

/* ---------- 输入框同步 ---------- */

function isEditableField(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.hasAttribute('data-native-keyboard')) return false;
  if (!el.matches?.(FIELD_SELECTOR)) return false;
  return true;
}

export function syncNativeInputMode() {
  if (typeof document === 'undefined') return;
  const fields = document.querySelectorAll(FIELD_SELECTOR);
  fields.forEach((el) => {
    if (!isEditableField(el)) return;
    if (pinyinState.enabled) {
      if (el.getAttribute('inputmode') !== 'none') el.setAttribute('inputmode', 'none');
    } else if (el.getAttribute('inputmode') === 'none') {
      el.removeAttribute('inputmode');
    }
  });
}

function scheduleSync() {
  if (syncFrame) return;
  syncFrame = requestAnimationFrame(() => {
    syncFrame = 0;
    syncNativeInputMode();
  });
}

/* ---------- 光标与上屏 ---------- */

function textBeforeCaret(el) {
  if (!el) return '';
  const pos = el.selectionStart ?? String(el.value || '').length;
  return String(el.value || '').slice(0, pos);
}

function syncContext() {
  if (engine) engine.setContext(textBeforeCaret(activeEl));
}

function dispatchInput(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 在光标处插入文本；execCommand 能保留原生 undo */
function insertRaw(text) {
  const el = activeEl;
  if (!el || !text) return;
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, text);
  } catch (err) {
    inserted = false;
  }
  if (!inserted) {
    const start = el.selectionStart ?? String(el.value || '').length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, 'end');
    dispatchInput(el);
  }
  syncContext();
}

/** 退格：有选区删选区，否则按字素删前一个字 */
function deleteBackward() {
  const el = activeEl;
  if (!el) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  if (end > start) {
    el.setRangeText('', start, end, 'end');
  } else if (start > 0) {
    const before = String(el.value || '').slice(0, start);
    const cut = previousGraphemeIndex(before);
    el.setRangeText('', cut, start, 'end');
  } else {
    return;
  }
  dispatchInput(el);
  syncContext();
}

function applyCommit(text) {
  if (!text) return;
  insertRaw(text);
  if (engine) {
    engine.notifyCommitted(text);
    if (userFreq) userFreq.hit(text);
  }
  refresh();
}

function applyResult(result) {
  if (!result) return;
  if (result.type === 'commit') {
    applyCommit(result.text);
  } else if (result.type === 'cancel') {
    refresh();
  }
}

function flushComposition() {
  if (!engine || !engine.preedit) return true;
  const result = engine.press({ t: 'space' });
  if (result?.type === 'commit') applyCommit(result.text);
  return true;
}

/* ---------- 显隐 ---------- */

export function activatePinyinField(el) {
  if (!pinyinState.enabled || !isEditableField(el)) return;
  activeEl = el;
  clearTimeout(blurTimer);
  pinyinState.visible = true;
  pinyinState.symbolMode = false;
  pinyinState.shift = false;
  pinyinState.language = 'zh';
  pinyinState.error = '';

  if (engine) {
    engine.reset();
    syncContext();
  }
  refresh();

  ensureEngine()
    .then(() => {
      if (activeEl !== el || !engine) return;
      engine.reset();
      syncContext();
      refresh();
    })
    .catch(() => {});
}

export function hidePinyinKeyboard({ blur = true } = {}) {
  pinyinState.visible = false;
  pinyinState.symbolMode = false;
  pinyinState.error = '';
  if (engine) engine.reset();
  refresh();
  if (blur && activeEl) activeEl.blur();
  activeEl = null;
}

export function setPinyinEnabled(next) {
  const value = Boolean(next);
  pinyinState.enabled = value;
  savePinyinEnabled(value);
  syncNativeInputMode();
  if (!value) hidePinyinKeyboard();
}

export function setPinyinLayout(next) {
  if (next !== 't9' && next !== 'qwerty') return;
  if (pinyinState.layout === next) return;
  flushComposition();
  pinyinState.layout = next;
  savePinyinLayout(next);
  engine = null;
  engineMode = '';
  engineToken += 1;
  refresh();
  if (pinyinState.visible) {
    ensureEngine()
      .then(() => {
        if (pinyinState.visible) refresh();
      })
      .catch(() => {});
  }
}

/* ---------- 按键 ---------- */

export function pressPinyinKey(token) {
  if (!pinyinState.visible) return;

  if (token === 'hide') {
    hidePinyinKeyboard();
    return;
  }
  if (token === 'layout') {
    setPinyinLayout(pinyinState.layout === 't9' ? 'qwerty' : 't9');
    return;
  }
  if (token === 'retry') {
    engine = null;
    engineMode = '';
    engineToken += 1;
    pinyinState.error = '';
    ensureEngine().then(refresh).catch(() => {});
    return;
  }
  if (token === 'symbols') {
    flushComposition();
    pinyinState.symbolMode = true;
    return;
  }
  if (token === 'ABC') {
    pinyinState.symbolMode = false;
    return;
  }
  if (token === 'language') {
    if (pinyinState.layout !== 'qwerty') return;
    flushComposition();
    engine?.reset();
    pinyinState.language = pinyinState.language === 'zh' ? 'en' : 'zh';
    refresh();
    return;
  }
  if (token === 'shift') {
    pinyinState.shift = !pinyinState.shift;
    return;
  }
  if (token === 'enter') {
    if (activeEl?.tagName === 'TEXTAREA') insertRaw('\n');
    else hidePinyinKeyboard();
    return;
  }
  if (token === 'back') {
    if (pinyinState.symbolMode) {
      deleteBackward();
      return;
    }
    if (!engine) {
      deleteBackward();
      return;
    }
    const result = engine.press({ t: 'back' });
    if (result.type === 'unhandled') deleteBackward();
    else applyResult(result);
    refresh();
    return;
  }
  if (token === 'space') {
    if (pinyinState.symbolMode || pinyinState.language === 'en' || !engine) {
      insertRaw(' ');
      return;
    }
    const result = engine.press({ t: 'space' });
    if (result.type === 'commit') applyCommit(result.text);
    else insertRaw(' ');
    refresh();
    return;
  }

  // 符号页：直接上屏
  if (pinyinState.symbolMode) {
    insertRaw(token);
    return;
  }

  // 英文模式：直接上屏
  if (pinyinState.layout === 'qwerty' && pinyinState.language === 'en') {
    const out = pinyinState.shift ? token.toUpperCase() : token;
    pinyinState.shift = false;
    insertRaw(out);
    return;
  }

  // 九宫格的 1 当标点键
  if (pinyinState.layout === 't9' && token === '1') {
    insertRaw('，');
    return;
  }

  if (!engine) return;
  syncContext();
  const value = pinyinState.layout === 'qwerty' ? token.toLowerCase() : token;
  const result = engine.press({ t: 'char', v: value });
  applyResult(result);
  refresh();
}

export function selectPinyinCandidate(index) {
  if (!engine) return;
  const result = engine.select(index);
  applyResult(result);
  refresh();
}

export function pinyinPage(delta) {
  if (!engine) return;
  engine.press({ t: delta < 0 ? 'pgup' : 'pgdn' });
  refresh();
}

export function pickPinyinSyllable(pinyin) {
  if (!engine) return;
  engine.setSyllableFilter(pinyin || null);
  refresh();
}

/* ---------- 安装 / 卸载 ---------- */

function onFocusIn(event) {
  if (!pinyinState.enabled) return;
  const el = event.target;
  if (!isEditableField(el)) return;
  activatePinyinField(el);
}

function onFocusOut(event) {
  if (!pinyinState.visible) return;
  if (event.target !== activeEl) return;
  clearTimeout(blurTimer);
  blurTimer = setTimeout(() => {
    const focused = document.activeElement;
    if (focused && (focused === activeEl || focused.closest?.('.pinyin-keypad'))) return;
    hidePinyinKeyboard({ blur: false });
  }, 0);
}

export function installPinyinKeyboard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  syncNativeInputMode();

  const root = document.getElementById('app');
  if (root && typeof MutationObserver === 'function') {
    observer = new MutationObserver(scheduleSync);
    observer.observe(root, { childList: true, subtree: true });
  }
}

export function uninstallPinyinKeyboard() {
  if (!installed || typeof document === 'undefined') return;
  installed = false;
  document.removeEventListener('focusin', onFocusIn, true);
  document.removeEventListener('focusout', onFocusOut, true);
  observer?.disconnect();
  observer = null;
  clearTimeout(blurTimer);
}

export function usePinyinKeyboard() {
  return {
    state: pinyinState,
    press: pressPinyinKey,
    select: selectPinyinCandidate,
    page: pinyinPage,
    pickSyllable: pickPinyinSyllable,
    hide: hidePinyinKeyboard,
    setEnabled: setPinyinEnabled,
    setLayout: setPinyinLayout,
    sync: syncNativeInputMode
  };
}
