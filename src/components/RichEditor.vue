<template>
  <div class="rich-editor" :class="{ 'is-loading': !ready, 'is-fallback': fallback }">
    <div v-if="!ready && !fallback" class="rich-editor-loading">正在打开稿纸…</div>

    <!-- Vditor 加载失败时退化成纯 Markdown 文本域，保证还能写 -->
    <textarea
      v-if="fallback"
      ref="fallbackEl"
      class="rich-editor-fallback"
      :value="modelValue"
      placeholder="随便写点什么…"
      @input="onFallbackInput"
    ></textarea>

    <!--
      Vditor 会清空并接管这个节点内部，所以它必须是独立的、Vue 不往里渲染的容器。
      之前把 loading / fallback 和它放在同一层，Vue 更新时会和 Vditor 抢 DOM，
      直接报 insertBefore(null) 崩掉。
    -->
    <div ref="host" class="rich-editor-mount"></div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  theme: { type: String, default: 'light' },
  placeholder: { type: String, default: '随便写点什么…' }
});

const emit = defineEmits(['update:modelValue', 'ready', 'change']);

const host = ref(null);
const fallbackEl = ref(null);
const ready = ref(false);
const fallback = ref(false);

let editor = null;
let lastEmitted = '';
let scriptPromise = null;
let destroyed = false;

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

function useFallback() {
  if (destroyed || fallback.value) return;
  fallback.value = true;
  ready.value = false;
  // 让父组件知道现在只能纯文本编辑
  emit('ready', { fallback: true });
}

function syncTheme() {
  if (!editor || fallback.value || typeof editor.setTheme !== 'function') return;
  const dark = props.theme === 'dark';
  editor.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light');
}

function emitValue(value) {
  if (value === lastEmitted) return;
  lastEmitted = value;
  emit('update:modelValue', value);
  emit('change', value);
}

function onFallbackInput(event) {
  emitValue(event.target.value);
}

function initFallback() {
  useFallback();
  // 等 textarea 渲染出来再聚焦，键盘体验和普通输入框一致
  requestAnimationFrame(() => fallbackEl.value?.focus());
}

function mountVditor() {
  if (destroyed || !host.value) return;
  const Vditor = window.Vditor;
  if (!Vditor) {
    initFallback();
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
      outline: { enable: false },
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
      input: (value) => emitValue(value),
      after: () => {
        if (destroyed) return;
        ready.value = true;
        observeToolbar();
        observeContent();
        emit('ready', { fallback: false });
        editor?.focus();
      }
    });
  } catch (err) {
    initFallback();
  }
}

function boot() {
  const base = assetBase();
  const cssHref = `${base}/dist/index.css`;
  if (!document.querySelector(`link[data-vditor-css]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssHref;
    link.dataset.vditorCss = '1';
    document.head.append(link);
  }
  loadScript(`${base}/dist/index.min.js`)
    .then(() => mountVditor())
    .catch(() => initFallback());
}

// 超时兜底：网络太差时不至于一直空着
let bootTimer = null;

onMounted(() => {
  bootTimer = setTimeout(() => {
    if (!ready.value && !fallback.value) initFallback();
  }, 12000);
  boot();
});

onBeforeUnmount(() => {
  destroyed = true;
  clearTimeout(bootTimer);
  toolbarObserver?.disconnect();
  toolbarObserver = null;
  contentObserver?.disconnect();
  contentObserver = null;
  clearTimeout(contentTimer);
  try {
    editor?.destroy?.();
  } catch (err) {
    // 忽略卸载异常
  }
  editor = null;
});

// 外部改内容（比如切换日记）时同步进去
watch(() => props.modelValue, (value) => {
  if (fallback.value) {
    if (fallbackEl.value && fallbackEl.value.value !== value) fallbackEl.value.value = value;
    lastEmitted = value;
    return;
  }
  if (!editor || !ready.value) return;
  if (value === lastEmitted) return;
  lastEmitted = value;
  try {
    editor.setValue(value, true);
  } catch (err) {
    // 忽略
  }
});

watch(() => props.theme, syncTheme);

watch(ready, () => {
  if (ready.value) clearTimeout(bootTimer);
});

// 工具条按钮高亮：直接读 Vditor 自己工具栏上的 --current 类，
// 不重复实现一遍选区判断。
const state = ref({ bold: false, italic: false, strike: false });
let toolbarObserver = null;

function readToolbarState() {
  const root = host.value;
  if (!root) return;
  // Vditor 把「当前格式」标在按钮自己的 class 上（vditor-menu--current）
  const current = new Set(
    Array.from(root.querySelectorAll('.vditor-toolbar button[data-type].vditor-menu--current'))
      .map((btn) => btn.dataset.type)
  );
  state.value = {
    bold: current.has('bold'),
    italic: current.has('italic'),
    strike: current.has('strike')
  };
}

let contentObserver = null;
let contentTimer = 0;

function observeContent() {
  const target = host.value?.querySelector('.vditor-ir pre.vditor-reset, .vditor-wysiwyg pre.vditor-reset, .vditor-sv');
  if (!target || contentObserver) return;
  contentObserver = new MutationObserver(() => {
    clearTimeout(contentTimer);
    // 等一下让 Vditor 把 DOM 收敛完再取值，避免取到半截
    contentTimer = setTimeout(() => {
      if (destroyed || fallback.value) return;
      emitValue(editor?.getValue?.() ?? '');
    }, 220);
  });
  contentObserver.observe(target, { subtree: true, childList: true, characterData: true });
}

function observeToolbar() {
  const bar = host.value?.querySelector('.vditor-toolbar');
  if (!bar || toolbarObserver) return;
  toolbarObserver = new MutationObserver(readToolbarState);
  toolbarObserver.observe(bar, { subtree: true, attributes: true, attributeFilter: ['class'] });
  readToolbarState();
}

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
  /** 触发 Vditor 自己的格式按钮，格式逻辑完全交给它 */
  toggle(type) {
    if (fallback.value) return;
    const btn = host.value?.querySelector(`.vditor-toolbar [data-type="${type}"]`);
    if (btn instanceof HTMLElement) btn.click();
    readToolbarState();
  },
  state
});
</script>
