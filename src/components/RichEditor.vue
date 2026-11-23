<template>
  <div class="rich-editor" :class="{ 'is-fallback': fallback }">
    <!-- TipTap 初始化失败时的兜底：纯 Markdown 文本域，至少还能写 -->
    <textarea
      v-if="fallback"
      ref="fallbackEl"
      class="rich-editor-fallback"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onFallbackInput"
    ></textarea>

    <EditorContent v-else :editor="editor" class="rich-editor-content" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';

const props = defineProps({
  modelValue: { type: String, default: '' },
  theme: { type: String, default: 'light' },
  placeholder: { type: String, default: '随便写点什么…' }
});

const emit = defineEmits(['update:modelValue', 'ready', 'change']);

const fallbackEl = ref(null);
const fallback = ref(false);
const ready = ref(false);

let lastEmitted = props.modelValue;
let destroyed = false;

const extensions = [
  StarterKit.configure({
    // 日记只用到行内格式，把 Markdown 往返不可靠的块级能力都关掉
    heading: false,
    code: false,
    codeBlock: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    horizontalRule: false,
    link: false,
    underline: false
  }),
  Markdown,
  Placeholder.configure({ placeholder: props.placeholder })
];

const editor = useEditor({
  extensions,
  content: props.modelValue,
  contentType: 'markdown',
  editorProps: {
    attributes: {
      class: 'rich-editor-prose',
      // 日记就是写字的，别让浏览器把它当拼写检查对象
      spellcheck: 'false',
      autocapitalize: 'off'
    }
  },
  onUpdate: ({ editor: instance }) => {
    emitValue(instance.getMarkdown());
  },
  onCreate: ({ editor: instance }) => {
    if (destroyed) return;
    ready.value = true;
    syncState(instance);
    emit('ready', { fallback: false });
    // 空文档时 Placeholder 需要一个空段落，这里不主动写内容
    if (!instance.isEmpty) return;
  },
  onTransaction: ({ editor: instance }) => {
    syncState(instance);
  },
  onSelectionUpdate: ({ editor: instance }) => {
    syncState(instance);
  }
});

function emitValue(value) {
  if (value === lastEmitted) return;
  lastEmitted = value;
  emit('update:modelValue', value);
  emit('change', value);
}

function onFallbackInput(event) {
  emitValue(event.target.value);
}

// 外部内容变化（切换日记、载入旧稿）时同步进编辑器
watch(() => props.modelValue, (value) => {
  if (fallback.value) {
    if (fallbackEl.value && fallbackEl.value.value !== value) fallbackEl.value.value = value;
    lastEmitted = value;
    return;
  }
  const instance = editor.value;
  if (!instance || value === lastEmitted) return;
  lastEmitted = value;
  try {
    instance.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
  } catch (err) {
    // 解析失败就退化成纯文本，别让整页挂掉
    try {
      instance.commands.setContent(value || '', { emitUpdate: false });
    } catch (err2) {
      enableFallback();
    }
  }
});

function enableFallback() {
  if (fallback.value) return;
  fallback.value = true;
  ready.value = false;
  emit('ready', { fallback: true });
}

// TipTap 在浏览器里同步可用，这里只兜住初始化直接抛错的情况
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    if (!destroyed && !editor.value) enableFallback();
  });
}

// 按钮高亮：每次 transaction / 选区变化都重算一次
const state = ref({ bold: false, italic: false, strike: false });

function syncState(instance) {
  if (!instance || fallback.value) return;
  const next = {
    bold: instance.isActive('bold'),
    italic: instance.isActive('italic'),
    strike: instance.isActive('strike')
  };
  const current = state.value;
  if (current.bold === next.bold && current.italic === next.italic && current.strike === next.strike) return;
  state.value = next;
}

const MARK_COMMANDS = {
  bold: 'toggleBold',
  italic: 'toggleItalic',
  strike: 'toggleStrike'
};

defineExpose({
  focus: () => {
    if (fallback.value) fallbackEl.value?.focus();
    else editor.value?.commands.focus();
  },
  blur: () => {
    if (fallback.value) fallbackEl.value?.blur();
    else editor.value?.commands.blur();
  },
  getValue: () => (fallback.value ? (fallbackEl.value?.value || '') : (editor.value?.getMarkdown?.() || '')),
  toggle(type) {
    const command = MARK_COMMANDS[type];
    if (!command || fallback.value) return;
    const instance = editor.value;
    if (!instance) return;
    instance.chain().focus()[command]().run();
    syncState(instance);
  },
  state
});

onBeforeUnmount(() => {
  destroyed = true;
  editor.value?.destroy();
});
</script>
