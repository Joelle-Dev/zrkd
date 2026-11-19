<template>
  <div class="photo-page">
    <header class="photo-head">
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <div class="photo-head-copy">
        <span class="photo-head-title">{{ activeEvent?.title || '拍照记日子' }}</span>
        <span class="photo-head-sub" :class="desc ? `is-${desc.kind}` : ''">{{ headSub }}</span>
      </div>
      <span v-if="!cameraSupported" class="render-status" :class="`is-${renderState}`">
        <span class="dot"></span>
        {{ renderLabel }}
      </span>
    </header>

    <div v-if="!events.length" class="history-off">
      <span>还没日子可拍，先去记一个</span>
      <button class="text-btn" type="button" @click="router.push('/event/new')">去加</button>
    </div>

    <div v-if="events.length > 1" class="event-picker">
      <button
        v-for="event in events"
        :key="event.id"
        class="chip"
        type="button"
        :class="{ 'is-active': event.id === activeEventId }"
        @click="selectEvent(event.id)"
      >
        {{ event.title }}
      </button>
    </div>

    <!-- 还没有照片：选图或拍照 -->
    <div v-if="events.length && !sourceUrl" class="dropzone">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4.4 8.6A1.7 1.7 0 0 1 6.1 6.9h1.8l1.2-1.9h5.8l1.2 1.9h1.8a1.7 1.7 0 0 1 1.7 1.7v8.2a1.7 1.7 0 0 1-1.7 1.7H6.1a1.7 1.7 0 0 1-1.7-1.7z"></path>
        <circle cx="12" cy="12.7" r="3.2"></circle>
      </svg>
      <strong>拍一张，让水印替你说话</strong>
      <small>取景就看得见标题天数，拍完直接进相册</small>
      <div class="dropzone-actions">
        <button class="primary-btn" type="button" @click="openCamera">
          {{ cameraSupported ? '打开相机' : '拍一张' }}
        </button>
        <button class="secondary-btn" type="button" @click="openLibrary">
          相册里挑
        </button>
      </div>
    </div>

    <template v-else-if="events.length">
      <div class="photo-preview">
        <img :src="sourceUrl" alt="照片预览">
        <span class="photo-badge">{{ activeEvent?.title || '今天' }}</span>
      </div>

      <div class="photo-options">
        <div class="segmented">
          <button
            type="button"
            :class="{ 'is-active': position === 'bottom' }"
            @click="position = 'bottom'"
          >
            底部居中
          </button>
          <button
            type="button"
            :class="{ 'is-active': position === 'center' }"
            @click="position = 'center'"
          >
            画面正中
          </button>
        </div>

        <div class="btn-row">
          <button class="secondary-btn" type="button" @click="openCamera">重拍</button>
          <button class="secondary-btn" type="button" @click="openLibrary">换一张</button>
        </div>
      </div>

      <div class="photo-actions">
        <button
          class="primary-btn"
          type="button"
          :disabled="renderState !== 'ready'"
          @click="saveToAlbum"
        >
          {{ saveButtonLabel }}
        </button>
        <p class="photo-hint">
          <template v-if="nativeApp">点一下直接进相册，省去分享面板绕路。</template>
          <template v-else-if="canShare">点上面会弹系统面板，选「存储图像」才进相册。</template>
          <template v-else-if="isSecure">这浏览器不太配合，点上面显示大图，<b>长按保存</b>。</template>
          <template v-else>现在是 <b>HTTP</b> 本地测试，浏览器不给存相册；上了 HTTPS 就不用这么费劲。</template>
        </p>
      </div>
    </template>

    <CameraCapture
      v-if="cameraOpen"
      :title="activeEvent?.title || ''"
      :number="cameraNumber"
      :prefix="cameraPrefix"
      :unit="cameraUnit"
      :date-text="cameraDate"
      :position="position"
      @close="onCameraClosed"
      @done="onCameraDone"
      @error="onCameraError"
    />

    <input
      ref="cameraInput"
      class="sr-only"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onPick"
    >
    <input
      ref="libraryInput"
      class="sr-only"
      type="file"
      accept="image/*"
      @change="onPick"
    >

    <p v-if="errorText" class="photo-hint" style="color: var(--danger);">{{ errorText }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import CameraCapture from '../components/CameraCapture.vue';
import { useEvents } from '../composables/useEvents';
import { getEvent } from '../lib/events';
import { describeEvent, formatDateDot } from '../lib/countdown';
import { renderWatermark } from '../lib/watermark';
import {
  canShareFile,
  fallbackSave,
  photoFilename,
  shareFile,
  toFile
} from '../utils/album';
import { isNativeApp, savePhotoToAlbum } from '../utils/native';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

const route = useRoute();
const router = useRouter();
const goBack = makeGoBack(router);
const { sorted, todayKey } = useEvents();

const cameraInput = ref(null);
const libraryInput = ref(null);

const sourceFile = ref(null);
const sourceUrl = ref('');
const activeEventId = ref('');
const position = ref('bottom');

const cameraOpen = ref(false);
const renderState = ref('idle'); // idle | generating | ready | error
const renderedBlob = ref(null);
const renderedSize = ref(null);
const errorText = ref('');
const shareSupported = ref(false);

let renderToken = 0;
let objectUrls = [];

const events = computed(() => sorted.value.filter((event) => event.targetDate));

const activeEvent = computed(() => {
  if (!events.value.length) return null;
  return events.value.find((event) => event.id === activeEventId.value) || events.value[0];
});

const desc = computed(() => (activeEvent.value
  ? describeEvent(activeEvent.value, todayKey.value)
  : null));

const nativeApp = isNativeApp();
const canShare = computed(() => shareSupported.value);
const isSecure = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false;
const cameraSupported = typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) && isSecure;

const cameraNumber = computed(() => {
  const value = desc.value;
  if (!value) return '';
  return value.kind === 'today' ? '今天' : String(value.days);
});

const cameraPrefix = computed(() => {
  const value = desc.value;
  return value && value.kind !== 'today' ? value.label : '';
});

const cameraUnit = computed(() => {
  const value = desc.value;
  return value && value.kind !== 'today' ? '天' : '';
});

const cameraDate = computed(() => (activeEvent.value
  ? formatDateDot(activeEvent.value.targetDate)
  : ''));

const headSub = computed(() => {
  if (!activeEvent.value) return '先记一个日子';
  const value = desc.value;
  if (!value || value.signed === null) return formatDateDot(activeEvent.value.targetDate);
  const label = value.kind === 'today' ? '就是今天' : `${value.label} ${value.days} 天`;
  return `${label} · ${formatDateDot(activeEvent.value.targetDate)}`;
});

const renderLabel = computed(() => {
  if (!sourceUrl.value) return '还没挑照片';
  if (renderState.value === 'generating') return '正在画';
  if (renderState.value === 'ready') return `就绪 ${renderedSize.value?.width || ''}×${renderedSize.value?.height || ''}`;
  if (renderState.value === 'error') return '画砸了';
  return '待处理';
});

const saveButtonLabel = computed(() => {
  if (renderState.value === 'generating') return '正在画…';
  if (renderState.value === 'error') return '换张照片试试';
  if (nativeApp) return '存进相册';
  return shareSupported.value ? '保存到相册' : '显示大图，长按保存';
});

function releaseUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
}

function selectEvent(id) {
  activeEventId.value = id;
  haptic('light');
}

function openCamera() {
  if (cameraSupported) {
    cameraOpen.value = true;
    return;
  }
  cameraInput.value?.click();
}

function onCameraError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    showToast('摄像头没给面子，改用相册吧');
  }
}

function openLibrary() {
  libraryInput.value?.click();
}

function onPick(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    showToast('这玩意儿不像图片');
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    showToast('图大得离谱，换一张');
    return;
  }
  releaseUrls();
  sourceFile.value = file;
  const url = URL.createObjectURL(file);
  objectUrls.push(url);
  sourceUrl.value = url;
  errorText.value = '';
  haptic('light');
}

function watermarkPayload() {
  const event = activeEvent.value;
  const value = desc.value;
  if (!event || !value) return null;

  const isToday = value.kind === 'today';
  return {
    title: event.title,
    number: isToday ? '今天' : String(value.days),
    prefix: isToday ? '' : value.label,
    unit: isToday ? '' : '天',
    dateText: formatDateDot(event.targetDate),
    position: position.value,
    maxEdge: 2200
  };
}

async function generate() {
  if (!sourceFile.value) return;
  const payload = watermarkPayload();
  if (!payload) return;

  const token = ++renderToken;
  renderState.value = 'generating';
  renderedBlob.value = null;
  renderedSize.value = null;
  errorText.value = '';

  try {
    const result = await renderWatermark({ source: sourceFile.value, ...payload });
    if (token !== renderToken) return;
    renderedBlob.value = result.blob;
    renderedSize.value = { width: result.width, height: result.height };
    const file = toFile(result.blob, photoFilename());
    shareSupported.value = canShareFile(file);
    renderState.value = 'ready';
  } catch (err) {
    if (token !== renderToken) return;
    renderState.value = 'error';
    errorText.value = err?.message || '图片闹脾气了';
  }
}

/**
 * 保存到相册。
 * 注意：navigator.share() 必须在点击的同步调用栈里，所以这里
 * 不做任何 await，直接用事先生成好的 blob 调 shareFile。
 */
function saveToAlbum() {
  const blob = renderedBlob.value;
  if (!blob) {
    showToast('图还没准备好');
    return;
  }
  const filename = photoFilename();

  if (nativeApp) {
    showToast({ message: '正在存进相册…', duration: 1200 });
    savePhotoToAlbum(blob, filename).then(() => {
      haptic('success');
      showToast('进相册了');
    }).catch((err) => {
      showToast(err?.message === '图片还没准备好' ? err.message : '没存上，看看相册给不给面子');
    });
    return;
  }
  const meta = {
    title: activeEvent.value?.title || '指日可待',
    text: activeEvent.value
      ? `${activeEvent.value.title} · ${formatDateDot(activeEvent.value.targetDate)}`
      : '指日可待'
  };

  if (canShareFile(toFile(blob, filename))) {
    shareFile(toFile(blob, filename), meta).then((result) => {
      if (result === 'share') {
        haptic('success');
        showToast('交给系统了，记得选「存储图像」');
      } else if (result === 'cancelled') {
        // 用户取消，什么都不做
      } else {
        fallbackSave(blob, filename).catch(() => {
          showToast('没存上，长按图片试试运气');
        });
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



// 拍完存好点「完成」，或者中途取消：都只是关掉相机，留在这一页
function onCameraDone() {
  cameraOpen.value = false;
}

function onCameraClosed() {
  cameraOpen.value = false;
}

async function pickInitialEvent() {
  const queryId = route.query.event;
  if (queryId) {
    const record = await getEvent(String(queryId)).catch(() => null);
    if (record) {
      activeEventId.value = record.id;
      return;
    }
  }
  activeEventId.value = events.value[0]?.id || '';
}

watch([sourceFile, position, activeEventId], () => {
  if (sourceFile.value) generate();
});

// 第一张照片准备好就自动开相机。事件是异步加载的，
// 不能在 onMounted 里直接判断 events.length。
const autoOpened = ref(false);
watch(activeEvent, (event) => {
  if (autoOpened.value || !event || !cameraSupported) return;
  autoOpened.value = true;
  cameraOpen.value = true;
}, { immediate: true });

onMounted(async () => {
  await pickInitialEvent();
});

onUnmounted(() => {
  renderToken += 1;
  cameraOpen.value = false;
  releaseUrls();
});
</script>
