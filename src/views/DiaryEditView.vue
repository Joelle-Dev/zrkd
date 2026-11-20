<template>
  <div
    ref="page"
    class="write-page"
    :class="{ 'is-locked': locked, 'is-kb-open': keyboardOpen, 'is-formatting': formatting }"
  >
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
        <button
          v-if="!locked"
          class="write-format-toggle"
          type="button"
          :class="{ 'is-active': formatting }"
          :aria-pressed="formatting"
          aria-label="修饰文字（选中后加粗、斜体、下划线）"
          @mousedown.prevent
          @click="toggleFormatting"
        >Aa</button>
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

    <div ref="bodyEl" class="write-body">
      <div
        ref="titleEl"
        class="write-title"
        :contenteditable="editable"
        :tabindex="editable ? 0 : -1"
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
        :contenteditable="editable"
        :tabindex="editable ? 0 : -1"
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
        <button class="write-tool" type="button" :class="{ 'is-active': active.bold }" aria-label="加粗" @mousedown.prevent @click="toggleFormat('bold')"><b>B</b></button>
        <button class="write-tool" type="button" :class="{ 'is-active': active.italic }" aria-label="斜体" @mousedown.prevent @click="toggleFormat('italic')"><i>I</i></button>
        <button class="write-tool" type="button" :class="{ 'is-active': active.underline }" aria-label="下划线" @mousedown.prevent @click="toggleFormat('underline')"><u>U</u></button>
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
import {
  FORMAT_TAGS,
  countWords,
  formatStateFromTags,
  nextFormatAction,
  sanitizeHtml,
  textToHtml
} from '../lib/richtext';
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
const bodyEl = ref(null);
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

// 修饰模式：进入后不再可输入（不弹键盘），但文字仍能长按选中再加格式。
// 打完字点「Aa」进来选字加粗，结束后再点一次回到输入。
const formatting = ref(false);
// 键盘是否弹起：只用于切换「内滚动」布局，不做逐帧补偿
const keyboardOpen = ref(false);

const editable = computed(() => !locked.value && !formatting.value);

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

// 只缓存「属于正文」的选区，修饰模式里反复点按钮时用它还原
let savedRange = null;

function rangeInEditor() {
  const el = editor.value;
  const sel = typeof document !== 'undefined' ? document.getSelection?.() : null;
  if (!el || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  return el.contains(range.commonAncestorContainer) ? range : null;
}

function cacheSelection() {
  const range = rangeInEditor();
  if (range) savedRange = range.cloneRange();
}

function activeRange() {
  const current = rangeInEditor();
  if (current && !current.collapsed) return current;
  if (savedRange && editor.value?.contains(savedRange.commonAncestorContainer)) return savedRange;
  return current;
}

// 选区起点往上收集标签名（不含正文根节点），用来判断该包还是该拆
function ancestorTagNames(node) {
  const names = [];
  const root = editor.value;
  let current = node;
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE) names.push(current.tagName);
    current = current.parentNode;
  }
  return names;
}

function syncActive() {
  const range = activeRange();
  if (!range) {
    active.bold = active.italic = active.underline = false;
    return;
  }
  const state = formatStateFromTags(ancestorTagNames(range.startContainer));
  active.bold = state.bold;
  active.italic = state.italic;
  active.underline = state.underline;
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
    if (editable.value) toggleFormat('bold');
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

function selectRange(range) {
  const sel = document.getSelection?.();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** 给选区包一层格式标签，返回包好后的新区间 */
function wrapSelection(range, key) {
  const tag = FORMAT_TAGS[key];
  const wrapper = document.createElement(tag);
  try {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  } catch (err) {
    return null;
  }
  const next = document.createRange();
  next.selectNodeContents(wrapper);
  selectRange(next);
  return next;
}

function closestFormatAncestor(node, tag) {
  const root = editor.value;
  let current = node;
  if (current && current.nodeType !== Node.ELEMENT_NODE) current = current.parentElement;
  while (current && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() === tag) return current;
    current = current.parentElement;
  }
  return null;
}

function withFormatTag(tag, content) {
  // 只留下真正有内容的半截；空的（只剩光标边界）直接丢掉，避免留空标签
  const hasText = String(content.textContent || '').length > 0;
  const hasNode = content.querySelector ? Boolean(content.querySelector('br,img')) : false;
  if (!hasText && !hasNode) return null;
  const wrapper = document.createElement(tag);
  wrapper.appendChild(content);
  return wrapper;
}

/**
 * 取消选区里的某种格式。
 *
 * 选区往往只是格式标签里的一小段，直接删标签会把整段都变掉；
 * 这里把外层格式标签切成「前 / 选中 / 后」三截：前后各包一层保留原格式，
 * 中间裸着插回去，再重新选中中间那段，方便接着操作。
 */
function unwrapSelection(range, key) {
  const tag = FORMAT_TAGS[key];
  const target = closestFormatAncestor(range.startContainer, tag);
  if (!target) return null;

  // 起止都落在格式标签「内部」，避免 cloneContents 把外层标签本身也克隆出来
  const beforeRange = document.createRange();
  beforeRange.setStart(target, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(target, target.childNodes.length);

  const beforePart = withFormatTag(tag, beforeRange.cloneContents());
  const afterPart = withFormatTag(tag, afterRange.cloneContents());
  const middleNodes = Array.from(range.cloneContents().childNodes);

  const fragment = document.createDocumentFragment();
  if (beforePart) fragment.appendChild(beforePart);
  middleNodes.forEach((node) => fragment.appendChild(node));
  if (afterPart) fragment.appendChild(afterPart);

  target.replaceWith(fragment);

  if (!middleNodes.length) return null;
  const next = document.createRange();
  next.setStartBefore(middleNodes[0]);
  next.setEndAfter(middleNodes[middleNodes.length - 1]);
  selectRange(next);
  return next;
}

/**
 * 加粗 / 斜体 / 下划线。
 *
 * 刻意不调用 focus()、也不走 execCommand：
 * 两者都会把键盘重新拉起来。这里直接对缓存好的选区做 DOM 包裹，
 * 所以「打完字再修饰」全程不会弹键盘。
 */
function toggleFormat(key) {
  if (locked.value) return;
  const range = activeRange();
  if (!range) {
    showToast('先把要修饰的文字选中');
    return;
  }
  if (range.collapsed) {
    showToast('先选中一段文字');
    haptic('warning');
    return;
  }
  const state = formatStateFromTags(ancestorTagNames(range.startContainer));
  const action = nextFormatAction(state, key);
  const next = action === 'unwrap' ? unwrapSelection(range, key) : wrapSelection(range, key);
  if (!next) return;
  savedRange = next.cloneRange();
  refreshCount();
  syncActive();
  scheduleSave();
  haptic('light');
}

/** 进出修饰模式：进入时收起键盘，选中文字只做格式、不再输入 */
function toggleFormatting() {
  if (locked.value) return;
  if (formatting.value) {
    formatting.value = false;
    haptic('light');
    const range = savedRange;
    nextTick(() => {
      if (range && editor.value?.contains(range.commonAncestorContainer)) {
        editor.value.focus();
        selectRange(range);
      }
    });
    return;
  }
  cacheSelection();
  formatting.value = true;
  const activeEl = document.activeElement;
  if (activeEl instanceof HTMLElement) activeEl.blur();
  haptic('light');
  nextTick(() => {
    if (!savedRange) return;
    if (editor.value?.contains(savedRange.commonAncestorContainer)) selectRange(savedRange);
  });
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
  if (!rangeInEditor()) return;
  cacheSelection();
  syncActive();
}

/**
 * 键盘开合时把页面切成「锁定可视区域」的内滚动结构。
 *
 * 有键盘时，右侧工具条和顶栏如果保持 fixed / 文档流，iOS 平移视觉视口
 * 就会让它们上下漂。所以键盘一开，整页 fix 到可见区域，顶栏和工具条
 * 变成这个固定容器的子项——它们相对容器定位，视觉视口怎么平移都不动。
 *
 * 只在 resize / 转屏时算一次，绝不监听 scroll：滚动过程中不做任何补偿。
 * 键盘收起就完全回到普通文档滚动，手感和首页一致。
 */
// 有键盘时锁住文档自身滚动：页面已经是固定容器，文档再滚只会让 iOS
// 去平移视觉视口，反而制造漂移。
//
// 两种布局之间切换时要把滚动位置接上，否则正文会跳回顶部：
//   文档滚动 S  ↔  正文区滚动 S
// 两种布局里同一段文字落在屏幕上的位置才一致。
watch(keyboardOpen, async (open) => {
  const root = document.documentElement;
  if (open) {
    const offset = Math.max(0, Math.round(window.scrollY || 0));
    root.classList.add('is-write-kb-lock');
    await nextTick();
    if (bodyEl.value) bodyEl.value.scrollTop = offset;
    return;
  }
  const offset = Math.max(0, Math.round(bodyEl.value?.scrollTop || 0));
  root.classList.remove('is-write-kb-lock');
  await nextTick();
  window.scrollTo(0, offset);
});

let cleanupViewport = null;

function bindViewport() {
  const vv = window.visualViewport;
  const el = page.value;
  if (!vv || !el) return () => {};
  let lastHeight = -1;
  let lastOpen = false;
  let timer = 0;

  const apply = () => {
    const height = vv.height;
    if (!(height > 0)) return;
    const open = window.innerHeight - height - vv.offsetTop > 120;
    if (open) {
      el.style.setProperty('--vv-height', `${height.toFixed(2)}px`);
      el.style.setProperty('--vv-top', `${Math.max(0, vv.offsetTop).toFixed(2)}px`);
    }
    if (open !== lastOpen) {
      lastOpen = open;
      keyboardOpen.value = open;
    }
    if (Math.abs(height - lastHeight) >= 0.5) lastHeight = height;
  };

  // 键盘动画结束才稳定，收放后再量一次，避免停在动画中间
  const schedule = () => {
    apply();
    clearTimeout(timer);
    timer = setTimeout(apply, 200);
  };

  vv.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  apply();

  return () => {
    clearTimeout(timer);
    vv.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    el.style.removeProperty('--vv-height');
    el.style.removeProperty('--vv-top');
  };
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
  cleanupViewport = bindViewport();
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
  cleanupViewport?.();
  cleanupViewport = null;
  document.documentElement.classList.remove('is-write-kb-lock');
  showAccessoryBar();
});
</script>
