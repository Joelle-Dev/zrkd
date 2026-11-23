<template>
  <div class="rich-editor" :class="{ 'is-fallback': fallback }">
    <div v-if="!ready && !fallback" class="rich-editor-loading">正在打开稿纸…</div>

    <!-- Vditor 加载失败时退化成纯 Markdown 文本域，保证还能写 -->
    <textarea
      v-if="fallback"
      ref="fallbackEl"
      class="rich-editor-fallback"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onFallbackInput"
    ></textarea>

    <!--
      Vditor 会清空并接管这个节点内部，所以它必须是独立的、Vue 不往里渲染的容器。
      和 loading / fallback 放在同一层会和 Vue 抢 DOM，直接报 insertBefore(null)。
    -->
    <div v-show="!fallback" ref="host" class="rich-editor-mount"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  theme: { type: String, default: 'light' },
  placeholder: { type: String, default: '随便写点什么…' },
  // 光标跟随时要避让的遮挡物（底部工具条）
  obstruction: { type: String, default: '.write-footer' }
});

const emit = defineEmits(['update:modelValue', 'ready', 'change']);

const host = ref(null);
const fallbackEl = ref(null);
const ready = ref(false);
const fallback = ref(false);

let editor = null;
let lastEmitted = props.modelValue;
let scriptPromise = null;
let destroyed = false;
let contentObserver = null;
let contentTimer = 0;
let bootTimer = 0;

/* ---------------- 资源加载 ---------------- */

// 资源跟站点同源（public/vditor），SW 可缓存，离线也能用
const assetBase = () => new URL(`${import.meta.env.BASE_URL}vditor`, window.location.href).href;

function loadScript(src) {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`加载失败：${src}`)), { once: true });
    document.head.append(script);
  });
  return scriptPromise;
}

function enableFallback() {
  if (destroyed || fallback.value) return;
  fallback.value = true;
  ready.value = false;
  emit('ready', { fallback: true });
  requestAnimationFrame(() => fallbackEl.value?.focus());
}

/* ---------------- 光标跟随 ---------------- */
//
// 这是 JotSelf 的做法：只把 visualViewport 用来「算可见范围」，
// 绝不用来挪元素。光标落到可视区下方 70% 时，把窗口滚一点，
// 让它回到 50% 的高度。因为滚的是整页（document），
// 没有 fixed、没有逐帧补偿，所以不会抖。

let followFrame = 0;
let composing = false;

function activeSurface() {
  const selection = window.getSelection?.();
  const anchor = selection?.anchorNode;
  const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
  const surface = element?.closest?.('[contenteditable="true"]');
  if (surface && host.value?.contains(surface)) return surface;
  return host.value?.querySelector('.vditor-ir [contenteditable="true"], .vditor-wysiwyg [contenteditable="true"]');
}

function caretRectFor(range, surface) {
  const rects = range.getClientRects();
  if (rects.length) return rects[rects.length - 1];
  const rect = range.getBoundingClientRect();
  if (rect.height || rect.width) return rect;
  let node = range.endContainer;
  if (node === surface && range.endOffset > 0) node = surface.childNodes[range.endOffset - 1];
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  if (!element || !surface.contains(element)) return null;
  const elementRect = element.getBoundingClientRect();
  return elementRect.height || elementRect.width ? elementRect : null;
}

function scrollerFor(surface) {
  for (let node = surface; node && node !== document.body; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 2) return node;
  }
  return document.scrollingElement;
}

function followCaret() {
  if (destroyed || composing || fallback.value) return;
  const surface = activeSurface();
  if (!surface) return;

  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return;
  if (!surface.contains(selection.anchorNode)) return;

  const range = selection.getRangeAt(0);
  const caretRect = caretRectFor(range, surface);
  if (!caretRect) return;

  const viewport = window.visualViewport;
  let visibleTop = viewport?.offsetTop || 0;
  let visibleBottom = visibleTop + (viewport?.height || window.innerHeight);

  const scroller = scrollerFor(surface);
  if (scroller !== document.scrollingElement) {
    const rect = scroller.getBoundingClientRect();
    visibleTop = Math.max(visibleTop, rect.top);
    visibleBottom = Math.min(visibleBottom, rect.bottom);
  }

  // 页脚会挡住一截，把它算进可见区的下边界
  const obstruction = props.obstruction ? document.querySelector(props.obstruction) : null;
  if (obstruction) {
    const rect = obstruction.getBoundingClientRect();
    if (rect.height > 0 && rect.top > visibleTop && rect.top < visibleBottom) visibleBottom = rect.top;
  }

  const visibleHeight = visibleBottom - visibleTop;
  if (visibleHeight < 160) return;

  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const trigger = visibleTop + visibleHeight * (mobile ? 0.70 : 0.78);
  if (caretRect.bottom <= trigger) return;

  const target = visibleTop + visibleHeight * (mobile ? 0.50 : 0.62);
  const delta = Math.ceil(caretRect.bottom - target);
  if (delta <= 0) return;

  if (scroller === document.scrollingElement) window.scrollBy(0, delta);
  else scroller.scrollTop += delta;
}

function scheduleFollow() {
  if (followFrame || composing) return;
  followFrame = requestAnimationFrame(() => {
    followFrame = 0;
    followCaret();
  });
}

/* ---------------- 内容同步 ---------------- */

function emitValue(value) {
  if (value === lastEmitted) return;
  lastEmitted = value;
  emit('update:modelValue', value);
  emit('change', value);
}

function onFallbackInput(event) {
  emitValue(event.target.value);
}

// Vditor 的 input 回调覆盖打字；点它自己的工具栏按钮不一定会触发，
// 所以再挂一个 MutationObserver 兜底，保证格式改动也能落库。
function observeContent() {
  const target = host.value?.querySelector('.vditor-ir pre.vditor-reset, .vditor-wysiwyg pre.vditor-reset, .vditor-sv');
  if (!target || contentObserver) return;
  contentObserver = new MutationObserver(() => {
    clearTimeout(contentTimer);
    contentTimer = setTimeout(() => {
      if (destroyed || fallback.value) return;
      emitValue(editor?.getValue?.() ?? '');
    }, 220);
  });
  contentObserver.observe(target, { subtree: true, childList: true, characterData: true });
}

/* ---------------- 初始化 ---------------- */

function syncTheme() {
  if (!editor || fallback.value || typeof editor.setTheme !== 'function') return;
  const dark = props.theme === 'dark';
  editor.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light');
}

function mountVditor() {
  if (destroyed || !host.value) return;
  const Vditor = window.Vditor;
  if (!Vditor) {
    enableFallback();
    return;
  }
  const cdn = assetBase();
  lastEmitted = props.modelValue;
  try {
    editor = new Vditor(host.value, {
      cdn,
      lang: 'zh_CN',
      mode: 'ir',
      icon: 'ant',
      theme: props.theme === 'dark' ? 'dark' : 'classic',
      value: props.modelValue,
      placeholder: props.placeholder,
      cache: { enable: false },
      counter: { enable: false },
      // Vditor 默认 800ms 才回调一次 input，字数和自动保存都会跟着变慢。
      // 调到 300ms，体感接近即时；它同时也控制撤销栈的合并粒度。
      undoDelay: 300,
      outline: { enable: false },
      // 只放行「我们自己能渲染」的行内格式，避免编辑器与只读态不一致
      toolbar: ['bold', 'italic', 'strike', '|', 'undo', 'redo'],
      preview: {
        delay: 120,
        actions: [],
        markdown: {
          sanitize: true,
          toc: false,
          footnotes: false,
          mathBlockPreview: false,
          codeBlockPreview: false
        },
        render: { media: { enable: false } },
        theme: {
          current: props.theme === 'dark' ? 'dark' : 'light',
          path: `${cdn}/dist/css/content-theme`
        }
      },
      input: (value) => {
        emitValue(value);
        scheduleFollow();
      },
      after: () => {
        if (destroyed) return;
        clearTimeout(bootTimer);
        ready.value = true;
        observeContent();
        bindCaretGuards();
        emit('ready', { fallback: false });
        editor?.focus();
        scheduleFollow();
      }
    });
  } catch (err) {
    enableFallback();
  }
}

let cleanupGuards = null;

function bindCaretGuards() {
  const root = host.value;
  if (!root || cleanupGuards) return;

  const onCompositionStart = () => { composing = true; };
  const onCompositionEnd = () => { composing = false; scheduleFollow(); };
  const onInput = () => scheduleFollow();
  const onKeyUp = () => scheduleFollow();
  const onSelection = () => scheduleFollow();

  root.addEventListener('compositionstart', onCompositionStart);
  root.addEventListener('compositionend', onCompositionEnd);
  root.addEventListener('input', onInput, true);
  root.addEventListener('keyup', onKeyUp);
  document.addEventListener('selectionchange', onSelection);

  cleanupGuards = () => {
    root.removeEventListener('compositionstart', onCompositionStart);
    root.removeEventListener('compositionend', onCompositionEnd);
    root.removeEventListener('input', onInput, true);
    root.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('selectionchange', onSelection);
  };
}

function boot() {
  const base = assetBase();
  if (!document.querySelector('link[data-vditor-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}/dist/index.css`;
    link.dataset.vditorCss = '1';
    document.head.append(link);
  }
  loadScript(`${base}/dist/index.min.js`)
    .then(() => mountVditor())
    .catch(() => enableFallback());
}

onMounted(() => {
  bootTimer = setTimeout(() => {
    if (!ready.value && !fallback.value) enableFallback();
  }, 12000);
  boot();
});

onBeforeUnmount(() => {
  destroyed = true;
  clearTimeout(bootTimer);
  clearTimeout(contentTimer);
  cancelAnimationFrame(followFrame);
  contentObserver?.disconnect();
  contentObserver = null;
  cleanupGuards?.();
  cleanupGuards = null;
  try {
    editor?.destroy?.();
  } catch (err) {
    // 忽略卸载异常
  }
  editor = null;
});

// 外部改内容（切换日记、载入旧稿）时同步进编辑器
watch(() => props.modelValue, (value) => {
  if (fallback.value) {
    if (fallbackEl.value && fallbackEl.value.value !== value) fallbackEl.value.value = value;
    lastEmitted = value;
    return;
  }
  if (!editor || !ready.value || value === lastEmitted) return;
  lastEmitted = value;
  try {
    editor.setValue(value, true);
  } catch (err) {
    // 忽略
  }
});

watch(() => props.theme, syncTheme);

defineExpose({
  focus: () => {
    if (fallback.value) fallbackEl.value?.focus();
    else editor?.focus?.();
  },
  blur: () => {
    if (fallback.value) fallbackEl.value?.blur();
    else editor?.blur?.();
  },
  getValue: () => (fallback.value ? (fallbackEl.value?.value || '') : (editor?.getValue?.() || '')),
  /** 转发给 Vditor 自己的工具栏按钮（如果外部还想加按钮） */
  toggle(type) {
    if (fallback.value) return;
    const button = host.value?.querySelector(`.vditor-toolbar [data-type="${type}"]`);
    if (button instanceof HTMLElement) button.click();
  }
});
</script>
