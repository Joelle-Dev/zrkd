<template>
  <div class="page">
    <header class="edit-head">
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <div class="page-head-copy">
        <h1 class="page-title">{{ isEditing ? '改这个日子' : '记一个日子' }}</h1>
        <p class="page-subtitle">{{ previewSubtitle }}</p>
      </div>
    </header>

    <LoadingState v-if="loading" text="正在把这页翻出来…" />

    <template v-else>
      <div class="edit-preview" :class="previewKindClass" :style="accentStyleOf(form.accent)">
        <span v-if="previewPrefix" class="edit-preview-verb">{{ previewPrefix }}</span>
        <b>{{ previewFigure }}</b>
        <span v-if="previewUnit">{{ previewUnit }}</span>
        <small>{{ previewDate }}</small>
      </div>

      <div class="card edit-fields">
        <div class="field-line">
          <span class="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.6 5.2h6.3l8 8a1.6 1.6 0 0 1 0 2.3l-3.4 3.4a1.6 1.6 0 0 1-2.3 0l-8-8z"></path>
              <circle cx="8" cy="8" r="1.2"></circle>
            </svg>
          </span>
          <input
            id="event-title"
            v-model="form.title"
            class="line-input"
            type="text"
            maxlength="40"
            placeholder="给这天起个名，比如「发工资」"
            autocomplete="off"
            aria-label="叫什么"
          >
        </div>

        <p class="date-guide">挑个未来的日子，就替你倒数；挑个过去的日子，就替你记着已经走了多远。</p>

        <div class="field-line">
          <span class="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="5.4" width="16" height="15" rx="2.4"></rect>
              <path d="M8 3.6v3.4M16 3.6v3.4M4 10.2h16"></path>
            </svg>
          </span>
          <button class="line-input line-date-trigger" type="button" aria-label="哪一天" @click="dateOpen = true">
            <span>{{ formatDateCN(form.targetDate) }}</span>
            <span class="line-date-weekday">{{ weekdayCN(form.targetDate) }}</span>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9.5 6.5 5.5 5.5-5.5 5.5"></path>
            </svg>
          </button>
        </div>

        <div v-if="directionHint" class="date-extras">
          <p class="field-note" :class="`hint-${desc.kind}`">{{ directionHint }}</p>
        </div>

        <div class="field-line">
          <span class="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.2 9.4a6 6 0 0 1 11.2-1.9M17.8 14.6A6 6 0 0 1 6.6 16.5"></path>
              <path d="M17.4 3.6v3.9h-3.9M6.6 20.4v-3.9h3.9"></path>
            </svg>
          </span>
          <div class="repeat-row" role="radiogroup" aria-label="重复方式">
            <button
              v-for="option in repeatOptions"
              :key="option.key"
              class="chip"
              type="button"
              role="radio"
              :class="{ 'is-active': form.repeat === option.key }"
              :aria-checked="form.repeat === option.key"
              @click="pickRepeat(option.key)"
            >{{ option.label }}</button>
          </div>
        </div>
        <p v-if="form.repeat === 'yearly'" class="field-hint">{{ repeatHint }}</p>

        <DatePicker v-model="form.targetDate" v-model:show="dateOpen" />

        <div class="field-line is-stacked">
          <span class="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 4.6h8.4L18 8v11a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 19V6A1.4 1.4 0 0 1 6 4.6z"></path>
              <path d="M14.4 4.6V8H18M7.8 12h7M7.8 15.2h4.6"></path>
            </svg>
          </span>
          <textarea
            id="event-note"
            v-model="form.note"
            class="line-textarea"
            maxlength="120"
            placeholder="写句只有你们懂的（可不写）"
            aria-label="一句话"
          ></textarea>
        </div>

        <div class="field-line">
          <span class="field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="7.6"></circle>
              <circle cx="9" cy="10" r="1.1"></circle>
              <circle cx="13.6" cy="8.8" r="1.1"></circle>
              <circle cx="15.2" cy="12.8" r="1.1"></circle>
            </svg>
          </span>
          <div class="swatch-row" role="radiogroup" aria-label="卡片颜色">
            <button
              v-for="color in accents"
              :key="color.key"
              class="swatch"
              type="button"
              role="radio"
              :class="{ 'is-active': form.accent === color.value }"
              :style="{ '--swatch': color.value }"
              :aria-label="color.label"
              :aria-checked="form.accent === color.value"
              @click="pickAccent(color)"
            ></button>
            <span class="swatch-label">{{ accentName }}</span>
          </div>
        </div>
        <p class="field-hint">卡片左侧竖条和底色用这里的颜色；数字的蓝/黄表示还有 / 已经</p>
      </div>

      <div v-if="errorText" class="history-off" style="border-radius: var(--radius-sm);">
        <span>{{ errorText }}</span>
      </div>

      <div class="btn-row">
        <button class="secondary-btn" type="button" @click="cancelEdit">取消</button>
        <button class="primary-btn" type="button" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>

      <div v-if="isEditing" class="btn-row">
        <button class="secondary-btn" type="button" style="color: var(--danger);" @click="confirmDelete">删除</button>
      </div>

      <p class="photo-hint">日期就搁在这台设备里，不上云、不外传。</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import LoadingState from '../components/LoadingState.vue';
import DatePicker from '../components/DatePicker.vue';
import { ACCENTS } from '../lib/constants';
import { getEvent, removeEvent, saveEvent } from '../lib/events';
import { useEvents } from '../composables/useEvents';
import {
  REPEAT_OPTIONS,
  dateKeyFromParts,
  formatDateCN,
  weekdayCN,
  describeEvent,
  isValidDateKey
} from '../lib/countdown';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';
import { accentStyleOf } from '../utils/theme';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router);
const events = useEvents();

const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const original = ref(null);
const dirty = ref(false);
const dateOpen = ref(false);

const form = reactive({
  title: '',
  targetDate: dateKeyFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()),
  accent: ACCENTS[0].value,
  note: '',
  repeat: 'none'
});

const isEditing = computed(() => Boolean(route.params.id));

const accents = ACCENTS;
const repeatOptions = REPEAT_OPTIONS;

const accentName = computed(() => (
  ACCENTS.find((color) => color.value === form.accent)?.label || ''
));

function pickAccent(color) {
  form.accent = color.value;
  haptic('light');
}

function pickRepeat(key) {
  form.repeat = key;
  haptic('light');
}

const desc = computed(() => describeEvent(form, events.todayKey.value));

const previewFigure = computed(() => {
  const value = desc.value;
  if (value.signed === null) return '—';
  return value.kind === 'today' ? '今天' : String(value.days);
});

const previewUnit = computed(() => (desc.value.kind === 'today' ? '' : '天'));

const previewPrefix = computed(() => (
  desc.value.signed === null || desc.value.kind === 'today' ? '' : desc.value.label
));

const previewKindClass = computed(() => `is-${desc.value.kind}`);

const previewDate = computed(() => {
  const key = form.repeat === 'yearly' ? desc.value.occurrenceKey : form.targetDate;
  if (!key) return '';
  return `${formatDateCN(key)}\n${weekdayCN(key)}`;
});

const previewSubtitle = computed(() => (isEditing.value ? '改完记得按保存，别白改' : '未来的日子往前数，过去的日子往后数'));

const directionHint = computed(() => {
  const value = desc.value;
  if (value.signed === null) return '';
  if (form.repeat === 'yearly') return ''; // 走 repeatHint
  if (value.kind === 'today') return '就是今天';
  if (value.kind === 'countdown') return `还有 ${value.days} 天`;
  return `已经过去 ${value.days} 天`;
});

const repeatHint = computed(() => {
  const value = desc.value;
  if (value.kind === 'invalid') return '日期无效，先挑一天';
  const when = formatDateCN(value.occurrenceKey);
  if (value.kind === 'today') return `就是今天 · 第 ${value.yearsPassed + 1} 次`;
  return `下一次是 ${when}，还有 ${value.days} 天 · 第 ${value.yearsPassed + 1} 次`;
});

// 改动过就别让人误触返回：离开前问一句。
// flush: 'sync' 保证「程序改表单」和「用户改表单」的时序确定，
// 水合完成后显式 dirty=false 收尾。
watch(form, () => {
  dirty.value = true;
}, { deep: true, flush: 'sync' });

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await showConfirmDialog({
      title: '还没保存，说走就走？',
      message: '刚才改的会人间蒸发。',
      confirmButtonText: '算了，走',
      cancelButtonText: '我再改改',
      confirmButtonColor: 'var(--danger)'
    });
    return true;
  } catch (err) {
    return false;
  }
});

/** 取消 = 主动放弃改动，不再多问一句 */
function cancelEdit() {
  dirty.value = false;
  goBack();
}

async function load() {
  if (!isEditing.value) return;
  loading.value = true;
  try {
    const record = await getEvent(route.params.id);
    if (!record) {
      showToast('这个日子好像溜了');
      router.replace('/');
      return;
    }
    original.value = record;
    form.title = record.title;
    form.targetDate = record.targetDate;
    form.accent = record.accent;
    form.note = record.note || '';
    form.repeat = record.repeat === 'yearly' ? 'yearly' : 'none';
  } catch (err) {
    errorText.value = '打不开，退一步再试试';
  } finally {
    loading.value = false;
    dirty.value = false;
  }
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  errorText.value = '';
  try {
    await saveEvent({ ...form }, original.value);
    haptic('success');
    await events.reload();
    dirty.value = false;
    showToast(isEditing.value ? '改好了' : '记下了，跑不掉');
    // 新增和修改都一样：存完直接回首页
    router.replace('/');
  } catch (err) {
    errorText.value = err?.message || '没存上，再来一次';
    haptic('warning');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!original.value) return;
  try {
    await showConfirmDialog({
      title: '这个日子不要了？',
      message: `「${original.value.title}」会被请走，照片不受牵连。`,
      confirmButtonText: '请走',
      cancelButtonText: '留着吧',
      confirmButtonColor: 'var(--danger)'
    });
  } catch (err) {
    return;
  }
  try {
    await removeEvent(original.value.id);
    await events.reload();
    dirty.value = false;
    haptic('warning');
    showToast('送走了');
    router.replace('/');
  } catch (err) {
    showToast('没送走，它赖着不走');
  }
}

watch(() => route.params.id, async () => {
  errorText.value = '';
  original.value = null;
  if (!isEditing.value) {
    form.title = '';
    form.note = '';
    form.accent = ACCENTS[0].value;
    form.repeat = 'none';
    form.targetDate = dateKeyFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    dirty.value = false;
    return;
  }
  await load();
});

onMounted(() => {
  // 从日期计算器带过来的日期，直接填进表单
  if (!isEditing.value) {
    const preset = String(route.query.date || '');
    if (isValidDateKey(preset)) {
      form.targetDate = preset;
      dirty.value = false;
    }
  }
  load();
});
</script>
