<template>
  <div class="page">
    <header class="page-head">
      <div class="page-head-copy">
        <h1 class="page-title">{{ isEditing ? '改这个日子' : '加一个日子' }}</h1>
        <p class="page-subtitle">{{ previewSubtitle }}</p>
      </div>
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
    </header>

    <LoadingState v-if="loading" text="正在打开…" />

    <template v-else>
      <div class="edit-preview" :class="previewKindClass" :style="{ '--accent': form.accent }">
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
            placeholder="叫什么，比如「在一起」"
            autocomplete="off"
            aria-label="叫什么"
          >
        </div>

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

        <div class="date-extras">
          <p class="field-note" :class="`hint-${desc.kind}`">{{ directionHint }}</p>
        </div>

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
            placeholder="写点只有你们懂的（可选）"
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
          <div class="swatch-row">
            <button
              v-for="color in accents"
              :key="color.key"
              class="swatch"
              type="button"
              :class="{ 'is-active': form.accent === color.value }"
              :style="{ '--swatch': color.value }"
              :aria-label="color.label"
              :aria-pressed="form.accent === color.value"
              @click="form.accent = color.value"
            ></button>
          </div>
        </div>
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

      <p class="photo-hint">日期只存在这台设备上，不联网、不上传。</p>
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
  dateKeyFromParts,
  formatDateCN,
  weekdayCN,
  describeEvent
} from '../lib/countdown';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

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
  note: ''
});

const isEditing = computed(() => Boolean(route.params.id));

const accents = ACCENTS;

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
  if (!form.targetDate) return '';
  return `${formatDateCN(form.targetDate)}\n${weekdayCN(form.targetDate)}`;
});

const previewSubtitle = computed(() => (isEditing.value ? '改完记得保存' : '选一个未来的日子倒数，或过去的日子正着数'));

const directionHint = computed(() => {
  const value = desc.value;
  if (value.signed === null) return '';
  if (value.kind === 'today') return '就是今天';
  if (value.kind === 'countdown') return `还有 ${value.days} 天`;
  return `已经过去 ${value.days} 天`;
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
      title: '还没保存，直接走？',
      message: '刚才的改动会丢掉。',
      confirmButtonText: '放弃改动',
      cancelButtonText: '再想想',
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
      showToast('这个日子不见了');
      router.replace('/');
      return;
    }
    original.value = record;
    form.title = record.title;
    form.targetDate = record.targetDate;
    form.accent = record.accent;
    form.note = record.note || '';
  } catch (err) {
    errorText.value = '打开失败，回上一页再试';
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
    const saved = await saveEvent({ ...form }, original.value);
    haptic('success');
    await events.reload();
    dirty.value = false;
    showToast(isEditing.value ? '改好啦' : '记下了');
    if (isEditing.value) {
      original.value = saved;
      return;
    }
    router.replace(`/event/${saved.id}`);
  } catch (err) {
    errorText.value = err?.message || '保存失败，再试一次';
    haptic('warning');
  } finally {
    saving.value = false;
  }
}

async function confirmDelete() {
  if (!original.value) return;
  try {
    await showConfirmDialog({
      title: '删掉这个日子？',
      message: `「${original.value.title}」会被移除，照片不受影响。`,
      confirmButtonText: '删掉',
      cancelButtonText: '再想想',
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
    showToast('删掉了');
    router.replace('/');
  } catch (err) {
    showToast('删除失败，再试一次');
  }
}

watch(() => route.params.id, async () => {
  errorText.value = '';
  original.value = null;
  if (!isEditing.value) {
    form.title = '';
    form.note = '';
    form.accent = ACCENTS[0].value;
    form.targetDate = dateKeyFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    dirty.value = false;
    return;
  }
  await load();
});

onMounted(load);
</script>
