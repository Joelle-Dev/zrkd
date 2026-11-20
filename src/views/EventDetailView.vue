<template>
  <div class="detail-page">
    <header class="detail-head">
      <button class="icon-btn detail-back" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <span class="detail-head-label">这一天</span>
      <button class="detail-edit" type="button" aria-label="编辑这个日子" @click="editEvent">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.4 19.6h4l9.6-9.6a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4.4 15.6z"></path>
          <path d="M13.2 7.2l3.6 3.6"></path>
        </svg>
        编辑
      </button>
    </header>

    <LoadingState v-if="loading" text="正在把这一天找出来…" />

    <template v-else-if="record">
      <article class="detail-card" :style="accentStyleOf(record.accent)">
        <header class="detail-card-head">
          <div class="detail-card-id">
            <span class="detail-seal" aria-hidden="true">日</span>
            <span class="detail-brand">指日可待</span>
          </div>
          <span class="detail-stub" aria-hidden="true">
            <b>{{ dateChip.md }}</b>
            <small>{{ dateChip.weekday }}</small>
          </span>
        </header>

        <div class="detail-tear" aria-hidden="true"></div>

        <h1 class="detail-title">{{ record.title }}</h1>
        <p v-if="record.note" class="detail-note">{{ record.note }}</p>

        <div class="detail-figure" :class="`is-${desc.kind}`">
          <template v-if="desc.kind === 'today'">
            <span class="detail-number is-word">就是今天</span>
          </template>
          <template v-else>
            <span class="detail-verb">{{ desc.label }}</span>
            <span class="detail-number">{{ desc.days }}</span>
            <span class="detail-unit">天</span>
          </template>
        </div>

        <div class="detail-meta">
          <span>{{ dateLine }}</span>
          <span v-if="lunarLine" class="detail-lunar">{{ lunarLine }}</span>
        </div>
      </article>

      <div class="detail-actions">
        <button class="secondary-btn detail-write" type="button" @click="writeDiary">写一篇</button>
        <button class="primary-btn" type="button" :disabled="renderState === 'generating'" @click="saveImage">
          {{ saveLabel }}
        </button>
      </div>
      <p class="photo-hint">
        <template v-if="nativeApp">点一下，直接进相册。</template>
        <template v-else-if="canShare">会弹系统面板，选「存储图像」才算数。</template>
        <template v-else>点一下存图；它要是不听话，就长按。</template>
      </p>

      <section class="detail-related">
        <div class="section-head">
          <h2 class="section-title">相关的日记</h2>
          <span class="section-meta">{{ relatedDiaries.length ? `${relatedDiaries.length} 篇` : '还没写' }}</span>
        </div>

        <div v-if="relatedDiaries.length" class="related-list">
          <button
            v-for="item in relatedDiaries"
            :key="item.id"
            class="related-item"
            type="button"
            @click="openDiary(item)"
          >
            <span class="related-date">{{ formatDateDot(item.date) }}</span>
            <span class="related-title">{{ item.title || item.text || '这一天，写了点东西' }}</span>
          </button>
        </div>
        <p v-else class="related-empty">这段时间还没留下文字。要不要补一句？</p>
      </section>
    </template>

    <div v-else class="history-off">
      <span>这一天好像溜走了</span>
      <button class="text-btn" type="button" @click="goHome">回窝</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import LoadingState from '../components/LoadingState.vue';
import { useEvents } from '../composables/useEvents';
import { useDiaries } from '../composables/useDiaries';
import { getEvent } from '../lib/events';
import { dayInfo } from '../lib/almanac';
import { describeEvent, formatDateCN, formatDateDot, parseDateKey, weekdayCN } from '../lib/countdown';
import { diariesForEvent } from '../lib/diary';
import { renderShareCard, shareCardFilename } from '../lib/shareCard';
import {
  canShareFile,
  fallbackSave,
  shareFile,
  toFile
} from '../utils/album';
import { isNativeApp, savePhotoToAlbum } from '../utils/native';
import { makeGoBack } from '../utils/back';
import { accentStyleOf } from '../utils/theme';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router);
const { todayKey } = useEvents();
const { diaries } = useDiaries();

const loading = ref(true);
const record = ref(null);
const renderedBlob = ref(null);
const renderState = ref('idle'); // idle | generating | ready | error
const shareSupported = ref(false);

const nativeApp = isNativeApp();
const canShare = computed(() => shareSupported.value);

const desc = computed(() => (record.value
  ? describeEvent(record.value, todayKey.value)
  : { kind: 'invalid', days: 0, label: '' }));

const relatedDiaries = computed(() => (record.value
  ? diariesForEvent(diaries.value, record.value.id)
  : []));

const dateChip = computed(() => {
  if (!record.value) return { md: '', weekday: '' };
  const parts = parseDateKey(record.value.targetDate);
  return {
    md: parts ? `${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')}` : '',
    weekday: weekdayCN(record.value.targetDate)
  };
});

// 分享卡用跟详情卡完全相同的颜色：这一天的专属色（已按主题夹过明度），
// 没设专属色时回落到当前主题色。
const cardAccent = computed(() => {
  const styled = record.value ? accentStyleOf(record.value.accent) : null;
  if (styled) return styled['--accent'];
  if (typeof window === 'undefined') return undefined;
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return value || undefined;
});

const dateLine = computed(() => (record.value
  ? `${formatDateCN(record.value.targetDate)} · ${weekdayCN(record.value.targetDate)}`
  : ''));

const targetInfo = computed(() => (record.value ? dayInfo(record.value.targetDate) : null));

const lunarLine = computed(() => {
  const info = targetInfo.value;
  if (!info) return '';
  const parts = [];
  if (info.lunarText) parts.push(`农历${info.lunarText}`);
  if (info.festivals?.length) parts.push(info.festivals.join('、'));
  return parts.join(' · ');
});

const saveLabel = computed(() => {
  if (renderState.value === 'generating') return '正在画…';
  if (renderState.value === 'error') return '再试一次';
  if (nativeApp) return '存进相册';
  return shareSupported.value ? '存下这天' : '存成图';
});

let renderToken = 0;

async function generate() {
  if (!record.value) return;
  const token = ++renderToken;
  renderState.value = 'generating';
  renderedBlob.value = null;
  try {
    const { blob } = await renderShareCard({
      title: record.value.title,
      note: record.value.note,
      label: desc.value.kind === 'today' ? '' : desc.value.label,
      number: desc.value.kind === 'today' ? '就是今天' : String(desc.value.days),
      unit: desc.value.kind === 'today' ? '' : '天',
      kind: desc.value.kind,
      dateText: formatDateCN(record.value.targetDate),
      weekday: weekdayCN(record.value.targetDate),
      monthDay: dateChip.value.md,
      lunarText: lunarLine.value,
      accent: cardAccent.value
    });
    if (token !== renderToken) return;
    renderedBlob.value = blob;
    shareSupported.value = canShareFile(toFile(blob, shareCardFilename(record.value.title), 'image/png'));
    renderState.value = 'ready';
  } catch (err) {
    if (token !== renderToken) return;
    renderState.value = 'error';
  }
}

/**
 * 存图。跟拍照页一样：分享面板必须在点击的同步调用栈里，
 * 所以用的是进页面时就预先画好的 blob，这里不再 await。
 */
function saveImage() {
  const blob = renderedBlob.value;
  if (!blob) {
    showToast(renderState.value === 'generating' ? '图还在画，喘口气' : '图还没画完');
    if (renderState.value === 'error') generate();
    return;
  }

  const filename = shareCardFilename(record.value?.title);
  const meta = {
    title: record.value?.title || '指日可待',
    text: `「${record.value?.title || '日子'}」${desc.value.kind === 'today' ? '就是今天' : `${desc.value.label} ${desc.value.days} 天`}`
  };

  if (nativeApp) {
    showToast({ message: '正在存进相册…', duration: 1200 });
    savePhotoToAlbum(blob, filename).then(() => {
      haptic('success');
      showToast('进相册了');
    }).catch(() => {
      showToast('没存上，看看相册给不给面子');
    });
    return;
  }

  const file = toFile(blob, filename, 'image/png');
  if (canShareFile(file)) {
    shareFile(file, meta).then((result) => {
      if (result === 'share') {
        haptic('success');
        showToast('交给系统了，记得选「存储图像」');
      } else if (result === 'unsupported') {
        fallbackSave(blob, filename).catch(() => showToast('没存上，长按图片试试运气'));
      }
    }).catch(() => {
      showToast('没存上，长按图片试试运气');
    });
    return;
  }

  fallbackSave(blob, filename).then((mode) => {
    haptic('light');
    if (mode === 'download') showToast('丢进「下载」文件夹了');
  }).catch(() => {
    showToast('没存上，长按图片试试运气');
  });
}

function openDiary(item) {
  router.push(`/diary/${item.id}`);
}

function writeDiary() {
  if (!record.value) return;
  router.push({ path: '/diary/new', query: { event: record.value.id } });
}

function editEvent() {
  if (record.value) router.push(`/event/${record.value.id}/edit`);
}

function goHome() {
  router.replace('/');
}

async function load() {
  loading.value = true;
  try {
    const found = await getEvent(route.params.id);
    if (!found) {
      record.value = null;
      return;
    }
    record.value = found;
  } catch (err) {
    record.value = null;
  } finally {
    loading.value = false;
  }
}

watch([record, desc, lunarLine], () => {
  generate();
});

onMounted(load);

onUnmounted(() => {
  renderToken += 1;
});
</script>
