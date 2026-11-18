<template>
  <div class="page">
    <header class="page-head">
      <div class="page-head-copy">
        <h1 class="page-title">历史上的今天</h1>
        <p class="page-subtitle">{{ todayLabel }}<template v-if="weekdayText"> · {{ weekdayText }}</template></p>
      </div>
    </header>

    <template v-if="enabled">
      <section>
        <div class="section-head">
          <h2 class="section-title">旧报纸</h2>
          <span class="section-meta">{{ stateLabel }}</span>
        </div>

        <LoadingState v-if="loading" text="正在联网翻旧报纸…" inline />

        <div v-else-if="events.length" class="history-list">
          <article
            v-for="item in events"
            :key="`${item.year}-${item.title}`"
            class="history-item"
          >
            <span class="history-year">{{ item.year }}</span>
            <div class="history-body">
              <div class="history-title-row">
                <span class="history-title">{{ item.title }}</span>
                <span v-if="item.typeLabel" class="history-tag">{{ item.typeLabel }}</span>
              </div>
              <span class="history-meta">
                <span v-if="yearsAgo(item.year)">{{ yearsAgo(item.year) }}</span>
                <span v-if="item.festival">{{ yearsAgo(item.year) ? ' · ' : '' }}{{ item.festival }}</span>
              </span>
              <p v-if="item.desc" class="history-desc">{{ item.desc }}</p>
            </div>
          </article>
        </div>

        <div v-else class="history-off">
          <span>{{ offline ? '现在没网，翻不到旧报纸，连上网络再试试' : '今天没有可展示的旧事' }}</span>
          <button class="text-btn" type="button" @click="load(true)">重试</button>
        </div>

        <p class="photo-hint" style="margin-top: 10px;">数据来源：百度百科 · 只把今天的日期发出去，按月缓存在本机</p>
      </section>
    </template>

    <div v-else class="history-off">
      <span>历史上的今天没打开，开启后需要联网取史料</span>
      <button class="text-btn" type="button" @click="router.push('/settings')">去开启</button>
    </div>

    <footer class="page-footer">
      <span>指日可待</span>
      <span>·</span>
      <span>日子都在你自己的设备上</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LoadingState from '../components/LoadingState.vue';
import { useEvents } from '../composables/useEvents';
import { loadHistory } from '../lib/history';
import { getSetting } from '../lib/db';
import { formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';

const router = useRouter();
const { todayKey, refreshToday } = useEvents();

const enabled = ref(true);
const events = ref([]);
const loading = ref(false);
const offline = ref(false);
const source = ref('none');

const todayLabel = computed(() => formatDateCN(todayKey.value));
const weekdayText = computed(() => weekdayCN(todayKey.value));

const currentYear = computed(() => parseDateKey(todayKey.value)?.year ?? new Date().getFullYear());

function yearsAgo(year) {
  const raw = String(year ?? '').trim();
  if (!/^\d{1,4}$/.test(raw)) return '';
  const gap = currentYear.value - Number(raw);
  if (gap < 0) return '';
  if (gap === 0) return '就在今年';
  return `距今 ${gap} 年`;
}

const stateLabel = computed(() => {
  if (loading.value) return '正在翻';
  if (source.value === 'network') return '刚更新';
  if (source.value === 'cache') return offline.value ? '离线缓存' : '缓存';
  return '';
});

async function readSetting() {
  try {
    enabled.value = Boolean(await getSetting('history-online', true));
  } catch (err) {
    enabled.value = true;
  }
}

async function load(force = false) {
  if (!enabled.value) return;
  loading.value = true;
  try {
    const result = await loadHistory(todayKey.value, { online: navigator.onLine, force });
    events.value = result.events || [];
    source.value = result.source;
    offline.value = !navigator.onLine;
  } catch (err) {
    events.value = [];
    source.value = 'none';
    offline.value = !navigator.onLine;
  } finally {
    loading.value = false;
  }
}

let dayTimer = null;

function startDayWatch() {
  clearInterval(dayTimer);
  dayTimer = setInterval(() => {
    if (!refreshToday()) return;
    load().catch(() => {});
  }, 60_000);
}

function onOnline() {
  load(true).catch(() => {});
}

function onOffline() {
  offline.value = true;
}

onMounted(async () => {
  await readSetting();
  load().catch(() => {});
  startDayWatch();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
});

onUnmounted(() => {
  clearInterval(dayTimer);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
});
</script>
