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
      <div
        ref="titleEl"
        class="write-title"
        contenteditable="true"
        role="textbox"
        aria-label="标题"
        data-placeholder="标题"
        @input="onTitleInput"
        @keydown.enter.prevent="focusEditor"
        @paste="onPaste"
      ></div>

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

    <DatePicker v-model="form.date" v-model:show="dateOpen" />

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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import DatePicker from '../components/DatePicker.vue';
import { MOODS, getDiary, removeDiary, saveDiary } from '../lib/diary';
import { useDiaries } from '../composables/useDiaries';
import { useEvents } from '../composables/useEvents';
import { dateKeyOf, parseDateKey, weekdayCN } from '../lib/countdown';
import { countWords, sanitizeHtml, textToHtml } from '../lib/richtext';
import { compressImageToDataUrl } from '../utils/image';
import { hideAccessoryBar, showAccessoryBar } from '../utils/keyboard';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router, '/diary');
const diaries = useDiaries();
const { sorted } = useEvents();

const moods = MOODS;

const editor = ref(null);
const titleEl = ref(null);
const libraryInput = ref(null);
const saving = ref(false);
const pickerOpen = ref(false);
const dateOpen = ref(false);
const wordCount = ref(0);
const original = ref(null);
const dirty = ref(false);

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

function toggleMood(key) {
  form.mood = form.mood === key ? '' : key;
  dirty.value = true;
  haptic('light');
}

function toggleEvent(id) {
  form.eventId = form.eventId === id ? '' : id;
  haptic('light');
}

function openDate() {
  dateOpen.value = true;
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

function onTitleInput() {
  const text = (titleEl.value?.innerText || '').replace(/\n+/g, ' ').trimStart();
  form.title = text.slice(0, 60);
  dirty.value = true;
}

// 标题里敲回车就跳到正文，别在标题里换行
function focusEditor() {
  editor.value?.focus();
}

function onInput() {
  refreshCount();
  syncActive();
  dirty.value = true;
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

// 写了一半误触返回就全没了：离开前问一句。
// flush: 'sync' 让「程序填表」和「用户输入」的时序确定，水合后显式收尾。
watch(form, () => {
  dirty.value = true;
}, { deep: true, flush: 'sync' });

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await showConfirmDialog({
      title: '还没保存，直接走？',
      message: '这篇日记的改动会丢掉。',
      confirmButtonText: '放弃改动',
      cancelButtonText: '再想想',
      confirmButtonColor: 'var(--danger)'
    });
    return true;
  } catch (err) {
    return false;
  }
});

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
    if (titleEl.value) titleEl.value.innerText = record.title || '';
    if (editor.value) {
      editor.value.innerHTML = record.html || textToHtml(record.text);
      refreshCount();
    }
    dirty.value = false;
  } catch (err) {
    showToast('打开失败，再试一次');
  }
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  try {
    const html = sanitizeHtml(editor.value?.innerHTML || '');
    const title = (titleEl.value?.innerText || '').replace(/\n+/g, ' ').trim();
    await saveDiary({ ...form, title, html }, original.value);
    await diaries.reload();
    dirty.value = false;
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
    dirty.value = false;
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

// 键盘弹起时，把底部工具栏顶到键盘上方。
// iOS Safari 不会缩短布局视口，只能靠 visualViewport 求差值。
function bindKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;

  const update = () => {
    const gap = window.innerHeight - vv.height - vv.offsetTop;
    const active = document.activeElement;
    const editing = Boolean(active) && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    );
    const inset = editing && gap > 120 ? Math.round(gap) : 0;
    root.style.setProperty('--kb-inset', `${inset}px`);
  };

  const delayed = () => setTimeout(update, 60);

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  window.addEventListener('orientationchange', update);
  document.addEventListener('focusin', delayed);
  document.addEventListener('focusout', delayed);
  update();

  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    window.removeEventListener('orientationchange', update);
    document.removeEventListener('focusin', delayed);
    document.removeEventListener('focusout', delayed);
    root.style.removeProperty('--kb-inset');
  };
}

let cleanupKeyboard = null;

onMounted(async () => {
  form.date = dateKeyOf();
  await load();
  document.addEventListener('selectionchange', onSelectionChange);
  cleanupKeyboard = bindKeyboardInset();
  hideAccessoryBar();
  if (!isEditing.value) {
    dirty.value = false;
    await nextTick();
    editor.value?.focus();
  }
});

onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
  cleanupKeyboard?.();
  showAccessoryBar();
});
</script>
