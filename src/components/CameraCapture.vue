<template>
  <Teleport to="body">
    <div class="camera-layer" role="dialog" aria-modal="true" aria-label="拍照">
      <div ref="stage" class="camera-stage">
        <!-- 取景：水印以 DOM 实时叠在画面上 -->
        <div v-if="isLiveView" ref="frame" class="camera-frame">
          <video
            ref="video"
            class="camera-video"
            :class="{ 'is-mirrored': facing === 'user' }"
            playsinline
            muted
            autoplay
          ></video>

          <div v-if="layout" class="camera-overlay">
            <div class="camera-scrim" :style="scrimStyle"></div>
            <div class="camera-seal" :style="sealStyle" aria-hidden="true">{{ sealChar }}</div>
            <div class="camera-rule" :style="ruleStyle"></div>
            <div class="camera-title" :style="titleStyle">{{ title }}</div>
            <div v-if="number" class="camera-number" :style="numberStyle">
              <span v-if="prefix" class="camera-side-text" :style="sideTextStyle">{{ prefix }}</span>
              <span class="camera-big" :style="numberTextStyle">{{ number }}</span>
              <span v-if="unit" class="camera-side-text" :style="sideTextStyle">{{ unit }}</span>
            </div>
            <div v-if="dateText" class="camera-date" :style="dateStyle">
              {{ dateText }}<span class="camera-brand"> · 指日可待</span>
            </div>
          </div>
        </div>

        <!-- 拍完：直接是带水印的成品，按钮就压在图上 -->
        <div
          v-else-if="shotUrl"
          class="camera-frame camera-result"
          :style="resultFrameStyle"
        >
          <img class="camera-result-img" :src="shotUrl" alt="拍好的照片">
          <div class="camera-result-actions" :style="saveBtnStyle">
            <template v-if="phase === 'saved'">
              <p class="camera-saved-note">{{ savedNote }}</p>
              <button class="camera-save" type="button" @click="retry">再拍一张</button>
              <button class="camera-retry" type="button" @click="done">完成</button>
            </template>
            <template v-else>
              <button class="camera-save" type="button" :disabled="saving" @click="saveShot">
                {{ saving ? '正在存…' : '存为图片' }}
              </button>
              <button class="camera-retry" type="button" :disabled="saving" @click="retry">重拍</button>
            </template>
            <p v-if="savedHint" class="camera-save-hint">{{ savedHint }}</p>
          </div>
        </div>

        <p v-if="phase === 'starting'" class="camera-status">正在打开相机…</p>
        <p v-else-if="phase === 'error'" class="camera-status is-error">{{ errorText }}</p>
      </div>

      <div v-if="isLiveView" class="camera-options">
        <button
          type="button"
          :class="{ 'is-active': position === 'bottom' }"
          @click="position = 'bottom'"
        >底部居中</button>
        <button
          type="button"
          :class="{ 'is-active': position === 'center' }"
          @click="position = 'center'"
        >画面正中</button>
      </div>

      <div class="camera-bar">
        <button class="camera-side" type="button" @click="close">
          {{ isLiveView ? '取消' : '关闭' }}
        </button>
        <button
          v-if="isLiveView"
          class="camera-shutter"
          type="button"
          aria-label="拍照"
          :disabled="phase !== 'live' || shooting"
          @click="shoot"
        >
          <span></span>
        </button>
        <span v-else class="camera-side-spacer" aria-hidden="true"></span>
        <button
          v-if="isLiveView"
          class="camera-side"
          type="button"
          :disabled="phase !== 'live'"
          @click="flip"
        >翻转</button>
        <span v-else class="camera-side-spacer" aria-hidden="true"></span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { showToast } from 'vant';
import { computeLayout, renderWatermark, sealCharacter } from '../lib/watermark';
import { photoFilename } from '../utils/album';
import { saveImageToAlbum } from '../utils/saveImage';
import { haptic } from '../utils/haptics';

const props = defineProps({
  title: { type: String, default: '' },
  number: { type: String, default: '' },
  prefix: { type: String, default: '' },
  unit: { type: String, default: '' },
  dateText: { type: String, default: '' },
  position: { type: String, default: 'bottom' }
});

const emit = defineEmits(['close', 'done', 'error']);

const stage = ref(null);
const frame = ref(null);
const video = ref(null);

const phase = ref('starting'); // starting | live | review | saving | saved | error
const errorText = ref('');
const shooting = ref(false);
const saving = ref(false);
const savedHint = ref('');
const savedNote = ref('已存进相册');
const facing = ref('environment');
const position = ref(props.position);

const shotBlob = ref(null);
const shotUrl = ref('');

const box = ref({ width: 0, height: 0 });
const intrinsic = ref({ width: 0, height: 0 });

let stream = null;
let resizeObserver = null;

const isLiveView = computed(() => phase.value === 'starting' || phase.value === 'live' || phase.value === 'error');

// 水印按画面的真实像素算布局，再整体缩到预览尺寸，
// 这样取景框里看到的位置、字号和最后出片完全一致。
const layout = computed(() => {
  const { width, height } = intrinsic.value;
  if (!width || !height) return null;
  return computeLayout(width, height, { position: position.value });
});

const scale = computed(() => {
  const { width } = intrinsic.value;
  const displayed = box.value.width;
  if (!width || !displayed) return 1;
  return width / displayed;
});

const px = (value) => `${Math.round((value / scale.value) * 100) / 100}px`;

const sealChar = computed(() => sealCharacter(props.title));

const sealStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return {
    top: px(current.sealY),
    width: px(current.sealSize),
    height: px(current.sealSize),
    fontSize: px(current.sealSize * 0.5),
    '--seal-inset': px(current.sealSize * 0.11),
    '--seal-ring': px(Math.max(1, current.sealSize * 0.03)),
    boxShadow: `0 ${px(current.sealSize * 0.05)} ${px(current.sealSize * 0.2)} rgba(0, 0, 0, 0.38)`
  };
});

const ruleStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return {
    top: px(current.ruleY),
    width: px(current.ruleWidth),
    height: px(current.ruleThickness)
  };
});

const scrimStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  if (current.scrim.type === 'linear') {
    const from = Math.max(0, (current.scrim.from / intrinsic.value.height) * 100);
    return {
      background: `linear-gradient(to bottom, rgba(0,0,0,0) ${from}%, rgba(0,0,0,0.28) ${(from + (100 - from) * 0.55).toFixed(1)}%, rgba(0,0,0,0.62) 100%)`
    };
  }
  return {
    background: `radial-gradient(circle at 50% ${px(current.centerY)}, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0) 62%)`
  };
});

const titleStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return {
    top: px(current.titleY),
    fontSize: px(current.titleSize),
    letterSpacing: px(current.titleSize * 0.06)
  };
});

const numberStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return { top: px(current.numberY) };
});

const numberTextStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return { fontSize: px(current.numberSize) };
});

const sideTextStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return {
    fontSize: px(current.unitSize),
    transform: `translateY(${px(current.numberSize * 0.22)})`
  };
});

const dateStyle = computed(() => {
  const current = layout.value;
  if (!current) return {};
  return {
    top: px(current.dateY),
    fontSize: px(current.dateSize),
    letterSpacing: px(current.dateSize * 0.16)
  };
});

// 成品框保持拍摄时的比例，保存按钮才能稳定压在水印下面
const resultFrameStyle = computed(() => (
  box.value.width && box.value.height
    ? { width: `${box.value.width}px`, height: `${box.value.height}px` }
    : {}
));

// 让按钮贴在水印块外面，别把标题/天数/日期盖住。
const saveBtnStyle = computed(() => {
  const current = layout.value;
  const { height } = intrinsic.value;
  if (!current || !height) return { bottom: '6%' };

  if (position.value === 'center') {
    const below = current.centerY + current.blockHeight / 2 + current.dateSize * 1.6;
    return { top: `${below / scale.value}px` };
  }
  const blockTop = current.blockTop ?? (current.titleY - current.titleSize * 0.8);
  return { bottom: `${(height - blockTop) / scale.value + 10}px` };
});

function describeError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '没拿到相机权限，去系统设置里允许一下';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '这台设备没有可用的相机';
  if (name === 'NotReadableError') return '相机被别的应用占着，关掉再试';
  return '打不开相机，换个方式试试';
}

function stopStream() {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
  if (video.value) video.value.srcObject = null;
}

function releaseShot() {
  if (shotUrl.value) URL.revokeObjectURL(shotUrl.value);
  shotUrl.value = '';
  shotBlob.value = null;
  savedHint.value = '';
  savedNote.value = '已存进相册';
}

async function start() {
  phase.value = 'starting';
  errorText.value = '';
  stopStream();
  releaseShot();
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
    }
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing.value,
        width: { ideal: 2560 },
        height: { ideal: 1440 }
      }
    });
    if (!video.value) return;
    video.value.srcObject = stream;
    await video.value.play().catch(() => {});
    measure();
    phase.value = 'live';
  } catch (err) {
    phase.value = 'error';
    errorText.value = describeError(err);
    emit('error', err);
  }
}

async function flip() {
  facing.value = facing.value === 'user' ? 'environment' : 'user';
  await start();
}

function measure() {
  const el = video.value;
  const host = stage.value;
  const wrap = frame.value;
  if (!el || !host || !wrap || !el.videoWidth || !el.videoHeight) return;

  // 让预览框严格等于画面比例：所见即拍到的整张图，水印位置不会错位。
  const rect = host.getBoundingClientRect();
  const ratio = el.videoWidth / el.videoHeight;
  let width = rect.width;
  let height = width / ratio;
  if (height > rect.height) {
    height = rect.height;
    width = height * ratio;
  }
  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;
  box.value = { width, height };
  intrinsic.value = { width: el.videoWidth, height: el.videoHeight };
}

async function shoot() {
  const el = video.value;
  if (!el || phase.value !== 'live' || shooting.value) return;
  shooting.value = true;
  try {
    const width = el.videoWidth;
    const height = el.videoHeight;
    if (!width || !height) throw new Error('相机还没准备好');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('这台设备不支持拍照');

    // 前置摄像头预览是镜像的，成片也要镜像，否则水印文字会反。
    if (facing.value === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el, 0, 0, width, height);

    // 直接把水印烧进图片，成品就是最终存下来的样子。
    const result = await renderWatermark({
      source: canvas,
      title: props.title,
      number: props.number,
      prefix: props.prefix,
      unit: props.unit,
      dateText: props.dateText,
      position: position.value
    });

    stopStream();
    shotBlob.value = result.blob;
    shotUrl.value = URL.createObjectURL(result.blob);
    phase.value = 'review';
    haptic('light');
  } catch (err) {
    errorText.value = err?.message || '拍照失败，再试一次';
    phase.value = 'error';
  } finally {
    shooting.value = false;
  }
}

async function retry() {
  if (saving.value) return;
  await start();
}

async function saveShot() {
  if (saving.value || !shotBlob.value) return;
  saving.value = true;
  phase.value = 'saving';
  try {
    const mode = await saveImageToAlbum(shotBlob.value, photoFilename(), {
      title: props.title || '指日可待',
      text: props.dateText ? `${props.title} · ${props.dateText}` : '指日可待'
    });
    haptic('success');
    if (mode === 'album') {
      savedNote.value = '已存进相册';
      phase.value = 'saved';
    } else if (mode === 'shared') {
      savedNote.value = '已交给系统';
      savedHint.value = '在系统面板里选「存储图像」就进相册了';
      phase.value = 'saved';
    } else if (mode === 'cancelled') {
      phase.value = 'review';
    } else if (mode === 'download') {
      savedNote.value = '已下载';
      savedHint.value = '文件在「下载」文件夹里';
      phase.value = 'saved';
    } else {
      savedNote.value = '长按图片保存';
      phase.value = 'saved';
    }
  } catch (err) {
    phase.value = 'review';
    showToast(err?.message === '图片还没准备好' ? err.message : '保存失败，检查一下相册权限');
  } finally {
    saving.value = false;
  }
}

function close() {
  releaseShot();
  stopStream();
  emit('close');
}

// 存完点「完成」就离开拍照页，不留一个空的预览页
function done() {
  releaseShot();
  stopStream();
  emit('done');
}

function onVisibility() {
  if (document.visibilityState === 'visible') return;
  if (phase.value === 'live') stopStream();
}

onMounted(async () => {
  document.body.style.overflow = 'hidden';
  window.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  await start();
  if (stage.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(stage.value);
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('resize', measure);
  window.removeEventListener('orientationchange', measure);
  resizeObserver?.disconnect();
  releaseShot();
  stopStream();
});
</script>
