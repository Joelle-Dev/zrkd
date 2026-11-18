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
      <div class="edit-preview" :style="{ '--accent': form.accent }">
        <b>{{ previewFigure }}</b>
        <span v-if="previewUnit">{{ previewUnit }}</span>
        <small>{{ previewDate }}</small>
      </div>

      <div class="card">
        <div class="field">
          <label class="field-label" for="event-title">叫什么</label>
          <input
            id="event-title"
            v-model="form.title"
            class="input"
            type="text"
            maxlength="40"
            placeholder="在一起 / 妈妈生日 / 期末考试"
            autocomplete="off"
          >
        </div>

        <div class="field field-gap">
          <label class="field-label" for="event-date">哪一天</label>
          <input
            id="event-date"
            v-model="form.targetDate"
            class="input"
            type="date"
            min="1900-01-01"
            max="2999-12-31"
          >
          <div class="chip-row" style="margin-top: 2px;">
            <button
              v-for="preset in presets"
              :key="preset.label"
              class="chip"
              type="button"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="field field-gap">
          <span class="field-label">怎么算</span>
          <div class="segmented">
            <button
              v-for="option in modeOptions"
              :key="option.key"
              type="button"
              :class="{ 'is-active': form.mode === option.key }"
              @click="form.mode = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="field-note">{{ modeHint }}</p>
        </div>

        <div class="field field-gap">
          <span class="field-label">颜色</span>
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

        <div class="field field-gap">
          <label class="field-label" for="event-note">一句话（可选）</label>
          <textarea
            id="event-note"
            v-model="form.note"
            class="textarea"
            maxlength="120"
            placeholder="写点只有你们懂的"
          ></textarea>
        </div>
      </div>

      <div v-if="errorText" class="history-off" style="border-radius: var(--radius-sm);">
        <span>{{ errorText }}</span>
      </div>

      <div class="btn-row">
        <button class="secondary-btn" type="button" @click="goBack">取消</button>
        <button class="primary-btn" type="button" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '保存' }}
        </button>
      </div>

      <div v-if="isEditing" class="btn-row">
        <button class="secondary-btn" type="button" @click="shoot">拍张照</button>
        <button class="secondary-btn" type="button" style="color: var(--danger);" @click="confirmDelete">删除</button>
      </div>

      <p class="photo-hint">日期只存在这台设备上，不联网、不上传。</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import LoadingState from '../components/LoadingState.vue';
import { ACCENTS, EVENT_MODE_LABELS } from '../lib/constants';
import { getEvent, removeEvent, saveEvent } from '../lib/events';
import { useEvents } from '../composables/useEvents';
import {
  dateKeyFromParts,
  describeEvent,
  formatDateCN,
  weekdayCN
} from '../lib/countdown';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const events = useEvents();

const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const original = ref(null);

const form = reactive({
  title: '',
  targetDate: dateKeyFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()),
  mode: 'auto',
  accent: ACCENTS[0].value,
  note: ''
});

const isEditing = computed(() => Boolean(route.params.id));

const modeOptions = [
  { key: 'auto', label: EVENT_MODE_LABELS.auto },
  { key: 'countdown', label: EVENT_MODE_LABELS.countdown },
  { key: 'anniversary', label: EVENT_MODE_LABELS.anniversary }
];

const accents = ACCENTS;

const modeHint = computed(() => {
  if (form.mode === 'auto') return '未来的日子倒数，过去的日子变成纪念日。';
  return '不管什么时候打开，都按一种方式数。';
});

const desc = computed(() => describeEvent(form, events.todayKey.value));

const previewFigure = computed(() => {
  const value = desc.value;
  if (value.signed === null) return '—';
  return value.kind === 'today' ? '今天' : String(value.days);
});

const previewUnit = computed(() => (desc.value.kind === 'today' ? '' : desc.value.label));

const previewDate = computed(() => {
  if (!form.targetDate) return '';
  return `${formatDateCN(form.targetDate)}\n${weekdayCN(form.targetDate)}`;
});

const previewSubtitle = computed(() => (isEditing.value ? '改完记得保存' : '给它起个名字，选个日子'));

function shiftDate(days) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return dateKeyFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function nextMonthDay(month, day) {
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    year += 1;
  }
  return dateKeyFromParts(year, month, day);
}

const presets = computed(() => [
  { label: '今天', value: shiftDate(0) },
  { label: '明天', value: shiftDate(1) },
  { label: '一周后', value: shiftDate(7) },
  { label: '一个月后', value: shiftDate(30) },
  { label: '今年结束', value: `${new Date().getFullYear()}-12-31` },
  { label: '下个元旦', value: nextMonthDay(1, 1) }
]);

function applyPreset(preset) {
  form.targetDate = preset.value;
  haptic('light');
}

function goBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function shoot() {
  if (!original.value) return;
  router.push({ path: '/photo', query: { event: original.value.id } });
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
    form.mode = record.mode;
    form.accent = record.accent;
    form.note = record.note || '';
  } catch (err) {
    errorText.value = '打开失败，回上一页再试';
  } finally {
    loading.value = false;
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
    haptic('warning');
    showToast('删掉了');
    router.replace('/');
  } catch (err) {
    showToast('删除失败，再试一次');
  }
}

watch(() => route.params.id, () => {
  errorText.value = '';
  original.value = null;
  if (!isEditing.value) {
    form.title = '';
    form.note = '';
    form.mode = 'auto';
    form.accent = ACCENTS[0].value;
  }
  load();
});

onMounted(load);
</script>
