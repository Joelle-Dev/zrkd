<template>
  <div class="detail-page">
    <header class="detail-head">
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
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

    <LoadingState v-if="loading" text="正在翻这一页…" />

    <template v-else-if="record">
      <article class="detail-card" :style="{ '--accent': record.accent }">
        <div class="detail-seal" aria-hidden="true">日</div>
        <span class="detail-brand">指日可待</span>

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

        <div class="detail-foot">一天一天，等到那天</div>
      </article>

      <div class="detail-save">
        <button class="primary-btn" type="button" :disabled="renderState === 'generating'" @click="saveImage">
          {{ saveLabel }}
        </button>
        <p class="photo-hint">
          <template v-if="nativeApp">点一下就直接存进系统相册。</template>
          <template v-else-if="canShare">会打开系统面板，选<b>存储图像</b>才会进相册。</template>
          <template v-else>点一下把这张卡片存下来；不行就长按图片保存。</template>
        </p>
      </div>
    </template>

    <div v-else class="history-off">
      <span>这个日子不见了</span>
      <button class="text-btn" type="button" @click="goHome">回首页</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import LoadingState from '../components/LoadingState.vue';
import { useEvents } from '../composables/useEvents';
import { getEvent } from '../lib/events';
import { dayInfo } from '../lib/almanac';
import { describeEvent, formatDateCN, weekdayCN } from '../lib/countdown';
import { renderShareCard, shareCardFilename } from '../lib/shareCard';
import {
  canShareFile,
  fallbackSave,
  shareFile,
  toFile
} from '../utils/album';
import { isNativeApp, savePhotoToAlbum } from '../utils/native';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router);
const { todayKey } = useEvents();

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
  if (renderState.value === 'generating') return '正在生成…';
  if (renderState.value === 'error') return '再试一次';
  if (nativeApp) return '存进相册';
  return shareSupported.value ? '保存这张图' : '存为图片';
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
      lunarText: lunarLine.value,
      accent: record.value.accent
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
    showToast(renderState.value === 'generating' ? '图片还在生成，稍等一下' : '图片还没准备好');
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
      showToast('已存进相册');
    }).catch(() => {
      showToast('保存失败，检查一下相册权限');
    });
    return;
  }

  const file = toFile(blob, filename, 'image/png');
  if (canShareFile(file)) {
    shareFile(file, meta).then((result) => {
      if (result === 'share') {
        haptic('success');
        showToast('已交给系统，选「存储图像」就进相册了');
      } else if (result === 'unsupported') {
        fallbackSave(blob, filename).catch(() => showToast('保存失败，长按图片试试'));
      }
    }).catch(() => {
      showToast('保存失败，长按图片试试');
    });
    return;
  }

  fallbackSave(blob, filename).then((mode) => {
    haptic('light');
    if (mode === 'download') showToast('已下载到「下载」文件夹');
  }).catch(() => {
    showToast('保存失败，长按图片试试');
  });
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
