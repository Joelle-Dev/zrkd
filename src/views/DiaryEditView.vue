<template>
  <div class="page">
    <header class="page-head">
      <div class="page-head-copy">
        <h1 class="page-title">{{ isEditing ? '改这篇日记' : '写点什么' }}</h1>
        <p class="page-subtitle">{{ subtitle }}</p>
      </div>
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
    </header>

    <LoadingState v-if="loading" text="正在翻开本子…" />

    <template v-else>
      <div class="card">
        <div class="field">
          <label class="field-label" for="diary-date">哪天</label>
          <input
            id="diary-date"
            v-model="form.date"
            class="input"
            type="date"
            min="1900-01-01"
            max="2999-12-31"
          >
          <span class="field-note">{{ dateLabel }}</span>
        </div>

        <div class="field field-gap">
          <span class="field-label">心情</span>
          <div class="mood-row">
            <button
              v-for="mood in moods"
              :key="mood.key"
              class="mood-btn"
              type="button"
              :class="{ 'is-active': form.mood === mood.key }"
              :aria-label="mood.label"
              :aria-pressed="form.mood === mood.key"
              @click="toggleMood(mood.key)"
            >
              <span aria-hidden="true">{{ mood.emoji }}</span>
            </button>
          </div>
        </div>

        <div class="field field-gap">
          <label class="field-label" for="diary-text">写两句</label>
          <textarea
            id="diary-text"
            v-model="form.text"
            class="textarea diary-textarea"
            maxlength="2000"
            placeholder="今天发生了什么？"
          ></textarea>
          <span class="field-note">{{ form.text.length }} / 2000</span>
        </div>

        <div class="field field-gap">
          <span class="field-label">配张图（可选）</span>
          <div v-if="form.photo" class="diary-photo">
            <img :src="form.photo" alt="配图">
            <button class="diary-photo-remove" type="button" @click="form.photo = ''">换一张</button>
          </div>
          <button v-else class="secondary-btn" type="button" @click="openLibrary">
            从相册选
          </button>
          <input ref="libraryInput" class="sr-only" type="file" accept="image/*" @change="onPick">
        </div>

        <div v-if="events.length" class="field field-gap">
          <span class="field-label">关联一个日子（可选）</span>
          <div class="chip-row">
            <button
              v-for="event in events"
              :key="event.id"
              class="chip"
              type="button"
              :class="{ 'is-active': form.eventId === event.id }"
              @click="toggleEvent(event.id)"
            >
              {{ event.title }}
            </button>
          </div>
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
        <button class="secondary-btn" type="button" style="color: var(--danger);" @click="confirmDelete">删除</button>
      </div>

      <p class="photo-hint">日记只存在这台设备上，不联网、不上传。</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import LoadingState from '../components/LoadingState.vue';
import { MOODS, getDiary, removeDiary, saveDiary } from '../lib/diary';
import { useDiaries } from '../composables/useDiaries';
import { useEvents } from '../composables/useEvents';
import { dateKeyOf, formatDateCN, weekdayCN } from '../lib/countdown';
import { compressImageToDataUrl } from '../utils/image';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const diaries = useDiaries();
const { sorted } = useEvents();

const moods = MOODS;

const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const libraryInput = ref(null);
const original = ref(null);

const form = reactive({
  date: dateKeyOf(),
  text: '',
  mood: '',
  photo: '',
  eventId: ''
});

const isEditing = computed(() => Boolean(route.params.id));

const events = computed(() => sorted.value.filter((event) => event.targetDate));

const dateLabel = computed(() => {
  const key = form.date;
  if (!key) return '';
  const weekday = weekdayCN(key);
  const same = key === dateKeyOf();
  return same ? `今天 · ${weekday}` : weekday;
});

const subtitle = computed(() => (isEditing.value ? '改完记得保存' : '一天可以写好几篇'));

function toggleMood(key) {
  form.mood = form.mood === key ? '' : key;
  haptic('light');
}

function toggleEvent(id) {
  form.eventId = form.eventId === id ? '' : id;
  haptic('light');
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

function goBack() {
  if (window.history.length > 1) router.back();
  else router.replace('/diary');
}

async function load() {
  if (!isEditing.value) return;
  loading.value = true;
  try {
    const record = await getDiary(route.params.id);
    if (!record) {
      showToast('这篇日记不见了');
      router.replace('/diary');
      return;
    }
    original.value = record;
    form.date = record.date;
    form.text = record.text;
    form.mood = record.mood || '';
    form.photo = record.photo || '';
    form.eventId = record.eventId || '';
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
    await saveDiary({ ...form }, original.value);
    await diaries.reload();
    haptic('success');
    showToast(isEditing.value ? '改好啦' : '记下了');
    router.replace('/diary');
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

watch(() => route.params.id, () => {
  errorText.value = '';
  original.value = null;
  load();
});

onMounted(load);
</script>
