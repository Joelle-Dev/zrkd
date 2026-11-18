<template>
  <Teleport to="body">
    <div class="camera-layer" role="dialog" aria-modal="true" aria-label="取景">
      <div ref="stage" class="camera-stage">
        <div ref="frame" class="camera-frame">
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
            <div class="camera-title" :style="titleStyle">{{ title }}</div>
            <div v-if="number" class="camera-number" :style="numberStyle">
              <span v-if="prefix" class="camera-side-text" :style="sideTextStyle">{{ prefix }}</span>
              <span class="camera-big" :style="numberTextStyle">{{ number }}</span>
              <span v-if="unit" class="camera-side-text" :style="sideTextStyle">{{ unit }}</span>
            </div>
            <div v-if="dateText" class="camera-date" :style="dateStyle">{{ dateText }}</div>
          </div>
        </div>

        <p v-if="state === 'starting'" class="camera-status">正在打开相机…</p>
        <p v-else-if="state === 'error'" class="camera-status is-error">{{ errorText }}</p>
      </div>

      <div class="camera-bar">
        <button class="camera-side" type="button" @click="$emit('close')">取消</button>
        <button
          class="camera-shutter"
          type="button"
          aria-label="拍照"
          :disabled="state !== 'live' || capturing"
          @click="shoot"
        >
          <span></span>
        </button>
        <button class="camera-side" type="button" :disabled="state !== 'live'" @click="flip">翻转</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { computeLayout } from '../lib/watermark';

const props = defineProps({
  title: { type: String, default: '' },
  number: { type: String, default: '' },
  prefix: { type: String, default: '' },
  unit: { type: String, default: '' },
  dateText: { type: String, default: '' },
  position: { type: String, default: 'bottom' }
});

const emit = defineEmits(['capture', 'close', 'error']);

const stage = ref(null);
const frame = ref(null);
const video = ref(null);
const state = ref('starting');
const errorText = ref('');
const capturing = ref(false);
const facing = ref('environment');
const box = ref({ width: 0, height: 0 });
const intrinsic = ref({ width: 0, height: 0 });

let stream = null;
let resizeObserver = null;

// 水印按画面的真实像素算布局，再整体缩到预览尺寸，
// 这样取景框里看到的位置、字号和最后出片完全一致。
const layout = computed(() => {
  const { width, height } = intrinsic.value;
  if (!width || !height) return null;
  return computeLayout(width, height, { position: props.position });
});

const scale = computed(() => {
  const { width } = intrinsic.value;
  const displayed = box.value.width;
  if (!width || !displayed) return 1;
  return width / displayed;
});

const px = (value) => `${Math.round((value / scale.value) * 100) / 100}px`;

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

function describeError(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return '没拿到相机权限，去系统设置里允许一下';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '这台设备没有可用的相机';
  if (name === 'NotReadableError') return '相机被别的应用占着，关掉再试';
  return '打不开相机，换成从相册选吧';
}

function stopStream() {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
  if (video.value) video.value.srcObject = null;
}

async function start() {
  state.value = 'starting';
  errorText.value = '';
  stopStream();
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
    await nextTick();
    measure();
    state.value = 'live';
  } catch (err) {
    state.value = 'error';
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
  if (!el || state.value !== 'live' || capturing.value) return;
  capturing.value = true;
  try {
    const width = el.videoWidth;
    const height = el.videoHeight;
    if (!width || !height) throw new Error('相机还没准备好');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('这台设备不支持拍照');

    if (facing.value === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('照片生成失败'));
      }, 'image/jpeg', 0.95);
    });

    emit('capture', blob);
  } catch (err) {
    errorText.value = err?.message || '拍照失败，再试一次';
    state.value = 'error';
  } finally {
    capturing.value = false;
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible') return;
  stopStream();
}

onMounted(async () => {
  document.body.style.overflow = 'hidden';
  window.addEventListener('visibilitychange', onVisibility);
  await start();
  if (stage.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(stage.value);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  video.value?.addEventListener('loadedmetadata', measure);
});

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('resize', measure);
  window.removeEventListener('orientationchange', measure);
  video.value?.removeEventListener('loadedmetadata', measure);
  resizeObserver?.disconnect();
  stopStream();
});
</script>
