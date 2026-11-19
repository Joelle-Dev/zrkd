<template>
  <div class="page">
    <header class="page-head">
      <div class="page-head-copy">
        <h1 class="page-title">我的</h1>
        <p class="page-subtitle">所有日子都在这台设备上</p>
      </div>
      <button v-if="drawer" class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18"></path>
        </svg>
      </button>
      <button v-else class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
    </header>

    <div class="about-card">
      <span class="about-mark" aria-hidden="true">日</span>
      <span class="about-title">指日可待</span>
      <p class="about-text">
        一天一天，等到那天。<br>
        不登录、不联网存储、不上传任何数据——只有「历史上的今天」会联网，且可以随时关闭。
      </p>
    </div>

    <section class="settings-group">
      <div class="section-head" style="margin-bottom: 2px;">
        <h2 class="section-title">外观</h2>
      </div>
      <div class="settings-row">
        <span class="settings-main">
          <span class="settings-label">主题</span>
          <span class="settings-desc">深色适合晚上看</span>
        </span>
        <span class="settings-side">
          <div class="segmented" style="width: 168px;">
            <button
              v-for="option in themeOptions"
              :key="option.key"
              type="button"
              :class="{ 'is-active': themeMode === option.key }"
              @click="setTheme(option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </span>
      </div>

      <div class="settings-row settings-row-stack">
        <span class="settings-main">
          <span class="settings-label">主题色</span>
          <span class="settings-desc">{{ accentLabel }} · 按钮、导航和强调都会跟着变</span>
        </span>
        <div class="theme-swatches" role="radiogroup" aria-label="主题色">
          <button
            v-for="preset in accentPresets"
            :key="preset.key"
            class="theme-swatch"
            type="button"
            role="radio"
            :aria-checked="isPresetActive(preset)"
            :aria-label="preset.label"
            :style="{ '--swatch': preset.value, '--swatch-ink': readableOn(preset.value) }"
            @click="chooseAccent(preset.value, preset.label)"
          >
            <svg
              v-if="isPresetActive(preset)"
              viewBox="0 0 24 24" width="14" height="14"
              fill="none" stroke="currentColor" stroke-width="2.6"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path d="m5.5 12.5 4.2 4.2 8.8-9"></path>
            </svg>
          </button>
          <label
            class="theme-swatch theme-swatch-custom"
            :class="{ 'is-active': isCustomAccent }"
            role="radio"
            :aria-checked="isCustomAccent"
            aria-label="自定义主题色"
            :style="{ '--swatch': accentColor, '--swatch-ink': readableOn(accentColor) }"
          >
            <input
              class="theme-color-input"
              type="color"
              :value="accentColor"
              aria-label="自定义主题色"
              @input="onCustomAccent"
            >
            <svg
              viewBox="0 0 24 24" width="14" height="14"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <path d="M12 19.2c4 0 7.2-2.7 7.2-6.1 0-3.9-4-8-7.2-9.3-3.2 1.3-7.2 5.4-7.2 9.3 0 3.4 3.2 6.1 7.2 6.1z"></path>
            </svg>
          </label>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="section-head" style="margin-bottom: 2px;">
        <h2 class="section-title">内容</h2>
      </div>

      <div class="settings-row" role="switch" :aria-checked="historyOnline" tabindex="0" @click="toggleHistory()" @keydown.enter.prevent="toggleHistory()" @keydown.space.prevent="toggleHistory()">
        <span class="settings-main">
          <span class="settings-label">历史上的今天</span>
          <span class="settings-desc">开启后会把今天的日期发给百度百科，按月缓存在本机；可随时关闭</span>
        </span>
        <span class="settings-side" @click.stop>
          <van-switch :model-value="historyOnline" size="20" @update:model-value="toggleHistory" />
        </span>
      </div>

      <div class="settings-row">
        <span class="settings-main">
          <span class="settings-label">农历与节气</span>
          <span class="settings-desc">本地计算，永远不用联网</span>
        </span>
        <span class="settings-side">已开启</span>
      </div>
    </section>

    <section class="settings-group">
      <div class="section-head" style="margin-bottom: 2px;">
        <h2 class="section-title">数据</h2>
      </div>

      <div class="settings-row">
        <span class="settings-main">
          <span class="settings-label">已保存的内容</span>
          <span class="settings-desc">{{ eventCount }} 个日子 · {{ diaryCount }} 篇日记</span>
        </span>
        <span class="settings-side">{{ storageLabel }}</span>
      </div>

      <button class="settings-row" type="button" @click="exportData">
        <span class="settings-main">
          <span class="settings-label">导出备份</span>
          <span class="settings-desc">把日子和日记存成一个 JSON 文件</span>
        </span>
        <span class="settings-side">导出</span>
      </button>

      <button class="settings-row" type="button" @click="importData">
        <span class="settings-main">
          <span class="settings-label">从备份恢复</span>
          <span class="settings-desc">按 id 合并进来，不会删掉现有内容</span>
        </span>
        <span class="settings-side">选择文件</span>
      </button>

      <button class="settings-row" type="button" @click="clearHistory">
        <span class="settings-main">
          <span class="settings-label">清空历史事件缓存</span>
          <span class="settings-desc">不会删除你的日子</span>
        </span>
        <span class="settings-side">清理</span>
      </button>

      <input ref="backupInput" class="sr-only" type="file" accept="application/json,.json" @change="onBackupPick">
    </section>

    <section class="settings-group">
      <div class="section-head" style="margin-bottom: 2px;">
        <h2 class="section-title">关于</h2>
      </div>

      <button v-if="!standalone" class="settings-row" type="button" @click="install">
        <span class="settings-main">
          <span class="settings-label">添加到主屏幕</span>
          <span class="settings-desc">{{ isIos ? '在 Safari 里点分享 → 添加到主屏幕' : '像原生 App 一样全屏打开' }}</span>
        </span>
        <span class="settings-side">安装</span>
      </button>

      <div class="settings-row">
        <span class="settings-main">
          <span class="settings-label">版本</span>
          <span class="settings-desc">{{ buildLabel }}</span>
        </span>
      </div>
    </section>

    <p class="photo-hint">
      提醒：iOS 可能清理长期不打开的站点数据，重要的日子请记得添加到主屏幕。
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showConfirmDialog, showToast } from 'vant';
import {
  THEME_OPTIONS,
  ACCENT_PRESETS,
  themeMode,
  setThemeMode,
  accentColor,
  setAccentColor,
  readableOn
} from '../utils/theme';
import { getSetting, setSetting } from '../lib/db';
import { HISTORY_ONLINE_KEY } from '../lib/constants';
import { clearHistoryCache } from '../lib/history';
import {
  backupFilename,
  exportBackup,
  importBackup,
  serializeBackup
} from '../lib/backup';
import { getStorageUsage, formatBytes } from '../lib/storage';
import { useEvents } from '../composables/useEvents';
import { useDiaries } from '../composables/useDiaries';
import { usePwaInstall } from '../composables/usePwaInstall';
import { makeGoBack } from '../utils/back';

defineProps({
  drawer: { type: Boolean, default: false }
});
const emit = defineEmits(['close']);
const router = useRouter();
const goBack = makeGoBack(router);

const { events, reload: reloadEvents } = useEvents();
const { diaries, reload: reloadDiaries } = useDiaries();
const { standalone, isIos, promptInstall } = usePwaInstall();

const themeOptions = THEME_OPTIONS;
const accentPresets = ACCENT_PRESETS;
const historyOnline = ref(true);
const storageUsage = ref(0);
const backupInput = ref(null);

const isPresetActive = (preset) => accentColor.value.toLowerCase() === preset.value.toLowerCase();

const isCustomAccent = computed(() => !accentPresets.some((preset) => isPresetActive(preset)));

const accentLabel = computed(() => {
  const preset = accentPresets.find((item) => isPresetActive(item));
  return preset ? preset.label : `自定义 ${accentColor.value.toUpperCase()}`;
});

function chooseAccent(value, label) {
  setAccentColor(value);
  showToast(`主题色换成「${label}」`);
}

function onCustomAccent(event) {
  const value = event?.target?.value;
  if (!value) return;
  setAccentColor(value);
}

const eventCount = computed(() => events.value.length);
const diaryCount = computed(() => diaries.value.length);

const storageLabel = computed(() => (storageUsage.value ? formatBytes(storageUsage.value) : ''));

const buildLabel = computed(() => {
  try {
    const date = new Date(__APP_BUILD_TIME__);
    if (Number.isNaN(date.getTime())) return '本地版本';
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch (err) {
    return '本地版本';
  }
});

function setTheme(mode) {
  setThemeMode(mode);
}

async function toggleHistory(value) {
  const next = typeof value === 'boolean' ? value : !historyOnline.value;
  historyOnline.value = next;
  try {
    await setSetting(HISTORY_ONLINE_KEY, next);
    showToast(next ? '下次打开历史页会去取历史事件' : '已关闭，不再联网');
  } catch (err) {
    showToast('保存失败，再试一次');
  }
}

async function clearHistory() {
  try {
    await showConfirmDialog({
      title: '清空历史事件缓存？',
      message: '只清掉「历史上的今天」的缓存，你自己记的日子不受影响。',
      confirmButtonText: '清空',
      cancelButtonText: '算了'
    });
  } catch (err) {
    return;
  }
  try {
    await clearHistoryCache();
    showToast('已清空');
  } catch (err) {
    showToast('清理失败');
  }
}

async function exportData() {
  try {
    const backup = await exportBackup();
    const text = serializeBackup(backup);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`已导出 ${backup.events.length} 个日子、${backup.diaries.length} 篇日记`);
  } catch (err) {
    showToast('导出失败，再试一次');
  }
}

function importData() {
  backupInput.value?.click();
}

async function onBackupPick(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const counts = await importBackup(text);
    await Promise.all([reloadEvents(), reloadDiaries()]);
    storageUsage.value = await getStorageUsage().catch(() => 0);
    showToast(`恢复了 ${counts.events} 个日子、${counts.diaries} 篇日记`);
  } catch (err) {
    showToast(err?.message || '这个文件导不进来');
  }
}

async function install() {
  const accepted = await promptInstall();
  if (!accepted && isIos) {
    showToast('在 Safari 分享菜单里选「添加到主屏幕」');
  }
}

onMounted(async () => {
  try {
    const value = await getSetting(HISTORY_ONLINE_KEY, true);
    historyOnline.value = Boolean(value);
  } catch (err) {
    historyOnline.value = true;
  }
  storageUsage.value = await getStorageUsage().catch(() => 0);
});
</script>
