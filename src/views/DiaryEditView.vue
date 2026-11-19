<template>
  <div class="write-page">
    <header class="write-head">
      <button class="write-icon" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <div class="write-meta">
        <button class="write-date" type="button" @click="openDate">
          {{ dateLabel }}
        </button>
        <button
          v-for="mood in moods"
          :key="mood.key"
          class="write-mood"
          type="button"
          :class="{ 'is-active': form.mood === mood.key }"
          :aria-label="mood.label"
          :aria-pressed="form.mood === mood.key"
          @click="toggleMood(mood.key)"
        >{{ mood.emoji }}</button>
        <input
          ref="dateInput"
          class="sr-only"
          type="date"
          v-model="form.date"
          min="1900-01-01"
          max="2999-12-31"
        >
      </div>
      <button v-if="isEditing" class="write-icon" type="button" aria-label="删除" @click="confirmDelete">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5.2 7h13.6M9.4 7V5.2a1.1 1.1 0 0 1 1.1-1.1h3a1.1 1.1 0 0 1 1.1 1.1V7"></path>
          <path d="M6.6 7l.8 11.6a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3L18 7"></path>
        </svg>
      </button>
      <button class="write-save" type="button" :disabled="saving" @click="submit">
        {{ saving ? '保存中' : '完成' }}
      </button>
    </header>

    <div class="write-body">
      <input
        v-model="form.title"
        class="write-title"
        type="text"
        maxlength="60"
        placeholder="标题"
        autocomplete="off"
      >

      <div
        ref="editor"
        class="write-editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        aria-label="正文"
        data-placeholder="写点什么…"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      ></div>

      <div v-if="form.photo" class="write-photo">
        <img :src="form.photo" alt="配图">
        <button class="write-photo-remove" type="button" aria-label="移除配图" @click="form.photo = ''">×</button>
      </div>
    </div>

    <footer class="write-bar">
      <div class="write-tools">
        <button
          class="write-tool"
          type="button"
          :class="{ 'is-active': active.bold }"
          aria-label="加粗"
          @click="exec('bold')"
        ><b>B</b></button>
        <button
          class="write-tool"
          type="button"
          :class="{ 'is-active': active.italic }"
          aria-label="斜体"
          @click="exec('italic')"
        ><i>I</i></button>
        <button
          class="write-tool"
          type="button"
          :class="{ 'is-active': active.underline }"
          aria-label="下划线"
          @click="exec('underline')"
        ><u>U</u></button>
        <button
          class="write-tool"
          type="button"
          :class="{ 'is-active': form.eventId }"
          aria-label="关联一个日子"
          @click="pickerOpen = true"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3"></path>
            <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3"></path>
          </svg>
        </button>
        <button class="write-tool" type="button" aria-label="插入图片" @click="openLibrary">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2"></rect>
            <circle cx="8.6" cy="10.2" r="1.4"></circle>
            <path d="m4.6 16.4 4.2-4 3 2.8 3-3.4 4.2 4.6"></path>
          </svg>
        </button>
      </div>

      <div class="write-info">
        <span v-if="linkedTitle" class="write-link">{{ linkedTitle }}</span>
        <span class="write-count">{{ wordCount }} 字</span>
      </div>
    </footer>

    <input ref="libraryInput" class="sr-only" type="file" accept="image/*" @change="onPick">

    <van-popup v-model:show="pickerOpen" position="bottom" round>
      <div class="write-picker">
        <span class="write-picker-title">关联一个日子</span>
        <div class="write-picker-list">
          <button
            v-for="event in events"
            :key="event.id"
            class="chip"
            type="button"
            :class="{ 'is-active': form.eventId === event.id }"
            @click="toggleEvent(event.id)"
          >{{ event.title }}</button>
          <span v-if="!events.length" class="write-picker-empty">还没有日子</span>
        </div>
        <button class="secondary-btn" type="button" @click="pickerOpen = false">好了</button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import { MOODS, getDiary, removeDiary, saveDiary } from '../lib/diary';
import { useDiaries } from '../composables/useDiaries';
import { useEvents } from '../composables/useEvents';
import { formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';
import { countWords, sanitizeHtml, textToHtml } from '../lib/richtext';
import { compressImageToDataUrl } from '../utils/image';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const diaries = useDiaries();
const { sorted } = useEvents();

const moods = MOODS;

const editor = ref(null);
const dateInput = ref(null);
const libraryInput = ref(null);
const saving = ref(false);
const pickerOpen = ref(false);
const wordCount = ref(0);
const original = ref(null);

const active = reactive({ bold: false, italic: false, underline: false });

const form = reactive({
  date: '',
  title: '',
  mood: '',
  photo: '',
  eventId: ''
});

const isEditing = computed(() => Boolean(route.params.id));

const events = computed(() => sorted.value.filter((event) => event.targetDate));

const dateLabel = computed(() => {
  const parts = parseDateKey(form.date);
  if (!parts) return '选择日期';
  return `${parts.month} 月 ${parts.day} 日 ${weekdayCN(form.date)}`;
});

const linkedTitle = computed(() => {
  const event = events.value.find((item) => item.id === form.eventId);
  return event ? event.title : '';
});

function todayKey() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toggleMood(key) {
  form.mood = form.mood === key ? '' : key;
  haptic('light');
}

function toggleEvent(id) {
  form.eventId = form.eventId === id ? '' : id;
  haptic('light');
}

function openDate() {
  const input = dateInput.value;
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch (err) {
      // 某些浏览器要求用户手势，落到 click()
    }
  }
  input.click();
}

function openLibrary() {
  libraryInput.value?.click();
}

async function onPick(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    showToast('图片太大了，换一张');
    return;
  }
  try {
    form.photo = await compressImageToDataUrl(file);
    haptic('light');
  } catch (err) {
    showToast(err?.message || '这张图处理失败');
  }
}

function syncActive() {
  if (typeof document === 'undefined') return;
  try {
    active.bold = document.queryCommandState('bold');
    active.italic = document.queryCommandState('italic');
    active.underline = document.queryCommandState('underline');
  } catch (err) {
    // 忽略：部分浏览器在无选区时会抛错
  }
}

function refreshCount() {
  const text = editor.value?.innerText || '';
  wordCount.value = countWords(text);
}

function onInput() {
  refreshCount();
  syncActive();
}

function onKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    exec('bold');
  }
}

// 粘贴只留纯文本，避免把网页样式带进来
function onPaste(event) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') || '';
  if (!text) return;
  document.execCommand('insertText', false, text);
}

/**
 * 加粗/斜体/下划线。
 * execCommand 虽已从规范移除，但所有主流浏览器仍然支持，
 * 对这几个按钮来说是成本最低的可靠方案。
 */
function exec(command) {
  const el = editor.value;
  if (!el) return;
  el.focus();
  try {
    document.execCommand(command, false, null);
  } catch (err) {
    return;
  }
  syncActive();
  refreshCount();
  haptic('light');
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/diary');
}

async function load() {
  if (!isEditing.value) return;
  try {
    const record = await getDiary(route.params.id);
    if (!record) {
      showToast('这篇日记不见了');
      router.replace('/diary');
      return;
    }
    original.value = record;
    form.date = record.date;
    form.title = record.title || '';
    form.mood = record.mood || '';
    form.photo = record.photo || '';
    form.eventId = record.eventId || '';
    await nextTick();
    if (editor.value) {
      editor.value.innerHTML = record.html || textToHtml(record.text);
      refreshCount();
    }
  } catch (err) {
    showToast('打开失败，再试一次');
  }
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  try {
    const html = sanitizeHtml(editor.value?.innerHTML || '');
    await saveDiary({ ...form, html }, original.value);
    await diaries.reload();
    haptic('success');
    showToast(isEditing.value ? '改好啦' : '记下了');
    router.replace('/diary');
  } catch (err) {
    showToast(err?.message || '保存失败，再试一次');
    haptic('warning');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!original.value) return;
  try {
    await showConfirmDialog({
      title: '删掉这篇日记？',
      message: '删掉后就找不回来了。',
      confirmButtonText: '删掉',
      cancelButtonText: '再想想',
      confirmButtonColor: 'var(--danger)'
    });
  } catch (err) {
    return;
  }
  try {
    await removeDiary(original.value.id);
    await diaries.reload();
    haptic('warning');
    showToast('删掉了');
    router.replace('/diary');
  } catch (err) {
    showToast('删除失败，再试一次');
  }
}

function onSelectionChange() {
  const el = editor.value;
  const selection = document.getSelection?.();
  if (!el || !selection || !selection.rangeCount) return;
  if (el.contains(selection.anchorNode)) syncActive();
}

onMounted(async () => {
  form.date = todayKey();
  await load();
  document.addEventListener('selectionchange', onSelectionChange);
  if (!isEditing.value) {
    await nextTick();
    editor.value?.focus();
  }
});

onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
});
</script>
