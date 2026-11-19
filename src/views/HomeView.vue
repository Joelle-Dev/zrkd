<template>
  <div class="page">
    <header class="home-nav">
      <div class="masthead-row">
        <button class="nav-btn" type="button" aria-label="我的" @click="openSettings">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8.2" r="3.4"></circle>
            <path d="M5.2 19.6c0-3.5 3.1-5.8 6.8-5.8s6.8 2.3 6.8 5.8"></path>
          </svg>
        </button>

        <h1 class="nav-title">指日可待</h1>

        <div class="masthead-actions">
          <button class="nav-btn" type="button" aria-label="拍照" @click="router.push('/photo')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4.2 8.2A1.7 1.7 0 0 1 5.9 6.5h2.2l1.3-2h5.2l1.3 2h2.2a1.7 1.7 0 0 1 1.7 1.7v9.1a1.7 1.7 0 0 1-1.7 1.7H5.9a1.7 1.7 0 0 1-1.7-1.7z"></path>
              <circle cx="12" cy="12.6" r="3.4"></circle>
            </svg>
          </button>
          <button class="nav-btn" type="button" aria-label="加一个日子" @click="router.push('/event/new')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5.5v13M5.5 12h13"></path>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <header class="masthead">
      <h1 class="masthead-title">{{ greeting }}<small>{{ weekdayText }}</small></h1>
      <p class="masthead-date">{{ todayLabel }}</p>
    </header>

    <!-- 今天是个什么日子 -->
    <section class="today-panel">
      <div class="today-panel-main">
        <span class="today-kicker">今天是什么日子</span>
        <span class="today-lunar">{{ lunarLine }}</span>
        <span class="today-sub">{{ jieqiText || '今天平平无奇，也挺好' }}</span>
        <div v-if="info?.festivals?.length" class="today-festivals">
          <span v-for="item in info.festivals" :key="item" class="festival-pill">{{ item }}</span>
        </div>
      </div>
      <div class="today-seal" aria-hidden="true">
        <b>{{ todayParts.day }}</b>
        <small>{{ todayParts.month }}月</small>
      </div>
    </section>

    <!-- 内置倒数：新年、周末 -->
    <section class="builtin-grid">
      <article v-for="item in builtins" :key="item.key" class="builtin-card">
        <span class="builtin-label">{{ item.label }}</span>
        <span class="builtin-figure">
          <template v-if="item.days === 0">
            <b class="is-word">就是今天</b>
          </template>
          <template v-else>
            <span class="figure-verb">还有</span>
            <b class="is-countdown">{{ item.days }}</b>
            <small>天</small>
          </template>
        </span>
        <span class="builtin-date">{{ formatDateShort(item.targetDate) }}</span>
      </article>
    </section>

    <!-- 倒数日列表 -->
    <section>
      <div class="section-head">
        <h2 class="section-title">你在数的日子</h2>
        <span v-if="validEvents.length" class="section-meta">{{ validEvents.length }} 个</span>
      </div>

      <LoadingState v-if="loading && !ready" text="日历翻得正起劲…" />

      <div v-else-if="hasEvents" class="event-grid">
        <article
          v-for="event in visibleEvents"
          :key="event.id"
          class="event-card"
          :class="`is-${describeCache[event.id].kind}`"
          :style="accentStyleOf(event.accent)"
        >
          <button
            class="event-hit"
            type="button"
            :aria-label="`${event.title}，${describeCache[event.id].label} ${describeCache[event.id].days} 天，查看这一天`"
            @click="openEvent(event)"
          ></button>
          <div class="event-card-top">
            <span class="event-title">{{ event.title }}</span>
            <span class="event-card-side">
              <span v-if="diaryCounts[event.id]" class="event-diary-badge">{{ diaryCounts[event.id] }} 篇</span>
              <span class="event-date">{{ formatDateShort(event.targetDate) }}</span>
            </span>
          </div>

          <div class="event-figure">
            <template v-if="describeCache[event.id].kind === 'today'">
              <span class="event-number is-word">就是今天</span>
            </template>
            <template v-else>
              <span class="event-verb">{{ describeCache[event.id].label }}</span>
              <span class="event-number">{{ describeCache[event.id].days }}</span>
              <span class="event-unit">天</span>
            </template>
          </div>

          <p v-if="event.note" class="event-note">{{ event.note }}</p>
        </article>

        <button
          v-if="hiddenCount > 0"
          class="secondary-btn"
          type="button"
          @click="showAll = !showAll"
        >
          {{ showAll ? '收起一些' : `底下还压着 ${hiddenCount} 个` }}
        </button>
      </div>

      <div v-else-if="ready" class="empty-hint">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="5.4" width="16" height="15" rx="2.4"></rect>
          <path d="M8 3.6v3.4M16 3.6v3.4M4 10.2h16"></path>
        </svg>
        <strong>这里空空如也</strong>
        <span>生日、纪念日、考试、发工资……<br>未来的往前数，过去的往后数</span>
        <button class="primary-btn" type="button" style="margin-top: 12px; max-width: 200px;" @click="router.push('/event/new')">
          先加一个
        </button>
      </div>
    </section>

    <footer class="page-footer">
      <span>指日可待</span>
      <span>·</span>
      <span>日子只住在你这台设备里</span>
    </footer>

    <van-popup
      v-model:show="settingsOpen"
      position="left"
      teleport="body"
      class="settings-drawer"
    >
      <SettingsView v-if="settingsOpen" drawer @close="settingsOpen = false" />
    </van-popup>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LoadingState from '../components/LoadingState.vue';
import { useEvents } from '../composables/useEvents';
import { useDiaries } from '../composables/useDiaries';
import { dayInfo, jieqiLine } from '../lib/almanac';
import { builtInCountdowns } from '../lib/samples';
import { countDiariesByEvent } from '../lib/diary';
import {
  describeEvent,
  formatDateCN,
  formatDateShort,
  parseDateKey,
  weekdayCN
} from '../lib/countdown';
import { greeting as pickGreeting } from '../utils/greeting';
import { accentStyleOf } from '../utils/theme';

const router = useRouter();
const { sorted, ready, loading, todayKey, reload, refreshToday } = useEvents();
const { diaries } = useDiaries();

const SettingsView = defineAsyncComponent(() => import('./SettingsView.vue'));

const settingsOpen = ref(false);
const showAll = ref(false);
const info = computed(() => dayInfo(todayKey.value));

const greeting = ref(pickGreeting());

const todayParts = computed(() => parseDateKey(todayKey.value) || { year: 1970, month: 1, day: 1 });

const todayLabel = computed(() => formatDateCN(todayKey.value));
const weekdayText = computed(() => (info.value?.weekday || weekdayCN(todayKey.value)));

const lunarLine = computed(() => {
  const current = info.value;
  if (!current) return '';
  const parts = [current.lunarText];
  if (current.ganZhiYear) parts.push(current.ganZhiYear);
  if (current.zodiac) parts.push(`${current.zodiac}年`);
  return parts.filter(Boolean).join(' · ');
});

const jieqiText = computed(() => jieqiLine(info.value));

const builtins = computed(() => builtInCountdowns(todayKey.value));

const diaryCounts = computed(() => countDiariesByEvent(diaries.value));

const describeCache = computed(() => {
  const map = {};
  for (const event of sorted.value) {
    map[event.id] = describeEvent(event, todayKey.value);
  }
  return map;
});

const validEvents = computed(() => sorted.value.filter((event) => {
  const desc = describeCache.value[event.id];
  return desc && desc.signed !== null;
}));

const PAGE_SIZE = 12;

const visibleEvents = computed(() => (
  showAll.value ? validEvents.value : validEvents.value.slice(0, PAGE_SIZE)
));

const hiddenCount = computed(() => Math.max(0, validEvents.value.length - visibleEvents.value.length));

const hasEvents = computed(() => visibleEvents.value.length > 0);

function openEvent(event) {
  router.push(`/event/${event.id}`);
}

function openSettings() {
  settingsOpen.value = true;
}

/* ---------- 跨零点刷新 ---------- */

let dayTimer = null;

function scheduleDayRefresh() {
  clearInterval(dayTimer);
  dayTimer = setInterval(() => {
    if (refreshToday()) {
      greeting.value = pickGreeting();
      reload().catch(() => {});
    }
  }, 60_000);
}

onMounted(() => {
  scheduleDayRefresh();
});

onUnmounted(() => {
  clearInterval(dayTimer);
});
</script>

<style scoped>
.event-card.is-past {
  opacity: 0.92;
}
</style>
