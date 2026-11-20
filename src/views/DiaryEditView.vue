<template>
  <div ref="page" class="write-page" :class="{ 'is-locked': locked }">
    <!-- 顶部设置栏固定成原生导航栏：格式、日期、心情、关联，写到哪儿都够得着 -->
    <div class="write-topbar">
      <header class="write-head">
        <button class="write-icon" type="button" aria-label="返回" @click="goBack">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7"></path>
          </svg>
        </button>

        <span v-if="!locked" class="write-count" aria-live="polite">{{ wordCount }} 字</span>

        <span v-if="locked" class="write-head-spacer"></span>

        <!-- 打开旧日记先锁定，点这里才进入编辑 -->
        <button v-if="locked && isEditing" class="write-edit" type="button" @click="unlock">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4.4 19.6h4l9.6-9.6a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4.4 15.6z"></path>
            <path d="M13.2 7.2l3.6 3.6"></path>
          </svg>
          编辑
        </button>

        <button v-if="isEditing" class="write-icon" type="button" aria-label="删除" @click="confirmDelete">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5.2 7h13.6M9.4 7V5.2a1.1 1.1 0 0 1 1.1-1.1h3a1.1 1.1 0 0 1 1.1 1.1V7"></path>
            <path d="M6.6 7l.8 11.6a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3L18 7"></path>
          </svg>
        </button>

        <span v-if="!locked" class="write-save-state" :class="`is-${saveState}`">{{ saveLabel }}</span>
      </header>

      <div class="write-subhead">
        <button class="write-date" type="button" :disabled="locked" @click="openDate">{{ dateLabel }}</button>
        <button
          v-for="mood in moods"
          :key="mood.key"
          class="write-mood"
          type="button"
          :disabled="locked"
          :class="{ 'is-active': form.mood === mood.key }"
          :aria-label="mood.label"
          :aria-pressed="form.mood === mood.key"
          @click="toggleMood(mood.key)"
        >{{ mood.emoji }}</button>
        <span v-if="linkedTitle" class="write-link">{{ linkedTitle }}</span>
        <span class="write-build">{{ buildVersion }}</span>
      </div>

      <!-- 关联日子：贴着吸顶栏往下展开，不和底部键盘抢位置 -->
      <Transition name="picker-drop">
        <div
          v-if="pickerOpen"
          id="write-picker"
          class="write-picker"
          role="dialog"
          aria-label="关联到某个日子"
        >
          <div class="write-picker-head">
            <span class="write-picker-title">关联到某个日子</span>
            <button class="write-picker-close" type="button" aria-label="收起" @mousedown.prevent @click="pickerOpen = false">×</button>
          </div>
          <div class="write-picker-list">
            <button
              v-for="event in events"
              :key="event.id"
              class="chip"
              type="button"
              :class="{ 'is-active': form.eventId === event.id }"
              :aria-pressed="form.eventId === event.id"
              @mousedown.prevent
              @click="chooseEvent(event.id)"
            >{{ event.title }}</button>
            <span v-if="!events.length" class="write-picker-empty">还没建过日子</span>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="pickerOpen" class="write-picker-scrim" aria-hidden="true" @click="pickerOpen = false"></div>

    <div class="write-body">
      <div
        ref="titleEl"
        class="write-title"
        :contenteditable="!locked"
        :tabindex="locked ? -1 : 0"
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
        :contenteditable="!locked"
        :tabindex="locked ? -1 : 0"
        role="textbox"
        aria-multiline="true"
        aria-label="正文"
        data-placeholder="随便写点什么…"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      ></div>

      <div v-if="form.photo" class="write-photo">
        <img :src="form.photo" alt="配图">
        <button v-if="!locked" class="write-photo-remove" type="button" aria-label="移除配图" @click="form.photo = ''">×</button>
      </div>
    </div>

    <div v-if="!locked" class="write-toolbar">
      <div class="write-tools">
        <button class="write-tool" type="button" :class="{ 'is-active': active.bold }" aria-label="加粗" @mousedown.prevent @click="exec('bold')"><b>B</b></button>
        <button class="write-tool" type="button" :class="{ 'is-active': active.italic }" aria-label="斜体" @mousedown.prevent @click="exec('italic')"><i>I</i></button>
        <button class="write-tool" type="button" :class="{ 'is-active': active.underline }" aria-label="下划线" @mousedown.prevent @click="exec('underline')"><u>U</u></button>
        <button
          class="write-tool"
          type="button"
          :class="{ 'is-active': form.eventId }"
          aria-label="关联一个日子"
          aria-controls="write-picker"
          :aria-expanded="pickerOpen"
          @mousedown.prevent
          @click="pickerOpen = !pickerOpen"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3"></path>
            <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3"></path>
          </svg>
        </button>
        <button class="write-tool" type="button" aria-label="插入图片" @mousedown.prevent @click="openLibrary">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2"></rect>
            <circle cx="8.6" cy="10.2" r="1.4"></circle>
            <path d="m4.6 16.4 4.2-4 3 2.8 3-3.4 4.2 4.6"></path>
          </svg>
        </button>
      </div>
    </div>

    <input ref="libraryInput" class="sr-only" type="file" accept="image/*" @change="onPick">

    <DatePicker v-model="form.date" v-model:show="dateOpen" />
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
import { BUILD_VERSION } from '../lib/build';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router, '/diary');
const diaries = useDiaries();
const { sorted } = useEvents();

const moods = MOODS;
const buildVersion = BUILD_VERSION;

const page = ref(null);
const editor = ref(null);
const titleEl = ref(null);
const libraryInput = ref(null);
const saving = ref(false);
const pickerOpen = ref(false);
const dateOpen = ref(false);
const wordCount = ref(0);
const original = ref(null);
const saveState = ref('idle'); // idle | pending | saving | saved | error
const recordId = ref('');

// 打开旧日记默认锁定，只能看；点右上角「编辑」才解锁输入
const locked = ref(Boolean(route.params.id));

const SAVE_DELAY = 700;
let saveTimer = null;
let leaving = false;

const saveLabel = computed(() => {
  if (saveState.value === 'saving') return '正往本子里塞';
  if (saveState.value === 'pending') return '等会儿再塞';
  if (saveState.value === 'saved') return '塞好了';
  if (saveState.value === 'error') return '没塞进去';
  return '';
});

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
  if (locked.value) return;
  form.mood = form.mood === key ? '' : key;
  haptic('light');
}

// 点一下就选中并收起，少点一次「就这样」
function chooseEvent(id) {
  if (locked.value) return;
  form.eventId = form.eventId === id ? '' : id;
  pickerOpen.value = false;
  haptic('light');
}

function unlock() {
  if (!locked.value) return;
  locked.value = false;
  saveState.value = 'idle';
  haptic('light');
}

function openDate() {
  pickerOpen.value = false;
  dateOpen.value = true;
}

function openLibrary() {
  pickerOpen.value = false;
  libraryInput.value?.click();
}

async function onPick(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (locked.value) return;
  if (file.size > 30 * 1024 * 1024) {
    showToast('这图太大了，扛不动');
    return;
  }
  try {
    form.photo = await compressImageToDataUrl(file);
    haptic('light');
  } catch (err) {
    showToast(err?.message || '这张图闹脾气了');
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
}

// 标题里敲回车就跳到正文，别在标题里换行
function focusEditor() {
  editor.value?.focus();
}

function onInput() {
  refreshCount();
  syncActive();
  scheduleSave();
}

function onKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    exec('bold');
  }
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape' && pickerOpen.value) pickerOpen.value = false;
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
  scheduleSave();
  haptic('light');
}

// 结构性的改动（日期、心情、配图、关联）直接触发保存
watch(form, () => {
  scheduleSave();
}, { deep: true, flush: 'sync' });

// 与 saveDiary 的校验保持一致：标题、正文、配图三者有其一才落库。
// 只点心情不产生记录，避免出现空白日记。
function hasContent() {
  const title = (titleEl.value?.innerText || '').trim();
  const text = (editor.value?.innerText || '').trim();
  return Boolean(title || text || form.photo);
}

/**
 * 自动保存：输入停止 700ms 后落库。
 * 新增时第一次保存会把 id 记下来，后续都在同一条上更新。
 */
function scheduleSave() {
  if (locked.value) return;
  if (saveState.value === 'saving') {
    // 保存途中又有新输入，结束后再存一次
    saveState.value = 'pending';
    return;
  }
  saveState.value = 'pending';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY);
}

async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!hasContent()) {
    saveState.value = 'idle';
    return;
  }
  if (saving.value) {
    saveState.value = 'pending';
    return;
  }

  saving.value = true;
  saveState.value = 'saving';
  try {
    const html = sanitizeHtml(editor.value?.innerHTML || '');
    const title = (titleEl.value?.innerText || '').replace(/\n+/g, ' ').trim();
    const saved = await saveDiary({
      ...form,
      title,
      html,
      id: recordId.value || undefined
    }, original.value || (recordId.value ? { id: recordId.value } : null));

    recordId.value = saved.id;
    original.value = saved;
    saveState.value = 'saved';
    await diaries.reload();
  } catch (err) {
    saveState.value = 'error';
  } finally {
    saving.value = false;
  }
}

// 离开就立刻存，不再弹「还没保存」的提示。
// 不 await：写 IndexedDB 跟组件生命周期无关，内容在调用瞬间就已经
// 快照进参数里；若等它存完再放行，手机滑动返回会「卡一下再跳走」。
onBeforeRouteLeave(() => {
  if (leaving) return true;
  leaving = true;
  // 锁定查看时没有任何改动，直接走
  if (locked.value) return true;
  clearTimeout(saveTimer);
  if (hasContent()) flushSave().catch(() => {});
  return true;
});

async function load() {
  if (!isEditing.value) return;
  try {
    const record = await getDiary(route.params.id);
    if (!record) {
      showToast('这篇日记好像溜走了');
      router.replace('/diary');
      return;
    }
    original.value = record;
    recordId.value = record.id;
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
  } catch (err) {
    showToast('没打开，再敲一次门');
  }
}

async function confirmDelete() {
  if (!original.value) return;
  try {
    await showConfirmDialog({
      title: '这篇要删掉？',
      message: '删了就真没了，别指望垃圾桶。',
      confirmButtonText: '删了',
      cancelButtonText: '留着吧',
      confirmButtonColor: 'var(--danger)'
    });
  } catch (err) {
    return;
  }
  try {
    await removeDiary(original.value.id);
    await diaries.reload();
    leaving = true;
    haptic('warning');
    showToast('删了，干净了');
    router.replace('/diary');
  } catch (err) {
    showToast('没删掉，它还挺倔');
  }
}

function onSelectionChange() {
  const el = editor.value;
  const selection = document.getSelection?.();
  if (!el || !selection || !selection.rangeCount) return;
  if (el.contains(selection.anchorNode)) syncActive();
}

// 离开时不再等保存完成；切后台/关页面时再兜一次，避免丢最后几个字
function onPageHide() {
  if (locked.value) return;
  if (!hasContent()) return;
  clearTimeout(saveTimer);
  flushSave().catch(() => {});
}

onMounted(async () => {
  form.date = dateKeyOf();
  window.addEventListener('pagehide', onPageHide);
  await load();
  document.addEventListener('selectionchange', onSelectionChange);
  window.addEventListener('keydown', onGlobalKeydown);
  hideAccessoryBar();
  if (!isEditing.value) {
    // 从日子详情点「写一篇」进来时，自动带上那条日子
    const presetEvent = String(route.query.event || '');
    if (presetEvent && events.value.some((item) => item.id === presetEvent)) {
      form.eventId = presetEvent;
    }
    // 新日记直接进入可写状态
    locked.value = false;
    await nextTick();
    editor.value?.focus();
  }
});

onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
  window.removeEventListener('keydown', onGlobalKeydown);
  window.removeEventListener('pagehide', onPageHide);
  showAccessoryBar();
});
</script>
