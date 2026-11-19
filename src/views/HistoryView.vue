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
        <div class="section-head history-head">
          <h2 class="section-title">旧报纸</h2>
          <span v-if="stateLabel" class="history-state" :class="`is-${source}`">{{ stateLabel }}</span>
        </div>

        <LoadingState v-if="loading" text="正在翻发黄的旧报纸…" inline />

        <div v-else-if="events.length" class="history-paper">
          <!-- 头版：推荐/最重要的那条当头条 -->
          <article class="history-piece history-lead" :class="`is-${lead.type}`">
            <div class="history-lead-top">
              <span class="history-lead-kicker">头版头条</span>
              <span v-if="lead.year" class="history-lead-year">{{ lead.year }}</span>
            </div>

            <span v-if="yearsAgo(lead.year) || lead.festival || lead.typeLabel" class="history-mini-meta">
              <span v-if="lead.typeLabel" class="history-tag">{{ lead.typeLabel }}</span>
              <span v-if="yearsAgo(lead.year)" class="history-ago">{{ yearsAgo(lead.year) }}</span>
              <span v-if="lead.festival">{{ lead.festival }}</span>
            </span>

            <h2 class="history-lead-title">{{ lead.title }}</h2>

            <p v-if="lead.desc" class="history-lead-desc">{{ lead.desc }}</p>
          </article>

          <template v-if="briefs.length">
            <div class="history-briefs-head"><span>简讯</span></div>

            <article
              v-for="item in briefs"
              :key="historyKey(item)"
              class="history-piece history-brief"
              :class="`is-${item.type}`"
            >
              <span class="history-brief-year">{{ item.year }}</span>
              <div class="history-brief-body">
                <h3 class="history-brief-title">{{ item.title }}</h3>

                <span v-if="yearsAgo(item.year) || item.festival || item.typeLabel" class="history-mini-meta">
                  <span v-if="item.typeLabel" class="history-tag">{{ item.typeLabel }}</span>
                  <span v-if="yearsAgo(item.year)" class="history-ago">{{ yearsAgo(item.year) }}</span>
                  <span v-if="item.festival">{{ item.festival }}</span>
                </span>

                <p v-if="item.desc" class="history-brief-desc">{{ item.desc }}</p>
              </div>
            </article>
          </template>
        </div>

        <div v-else class="history-off">
          <span class="history-off-mark" aria-hidden="true">史</span>
          <div class="history-off-copy">
            <span>{{ offline ? '没网，旧报纸翻不动，连上再来' : '今天旧报纸上没什么热闹' }}</span>
            <button class="text-btn" type="button" @click="load(true)">重试</button>
          </div>
        </div>

        <p class="history-source">资料来源：百度百科 · 只把日期递出去，按月存在本机</p>
      </section>
    </template>

    <div v-else class="history-off">
      <span class="history-off-mark" aria-hidden="true">史</span>
      <div class="history-off-copy">
        <span>这功能还没开，开了才去搬史料</span>
        <button class="text-btn" type="button" @click="router.push('/settings')">去开</button>
      </div>
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
import { HISTORY_ONLINE_KEY } from '../lib/constants';
import { formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';

defineOptions({ name: 'HistoryView' });

const router = useRouter();
const { todayKey, refreshToday } = useEvents();

const enabled = ref(true);
const events = ref([]);
const loading = ref(false);
const offline = ref(false);
const source = ref('none');

function historyKey(item) {
  return `${item.year}-${item.title}`;
}

// 排在最前面的那条当头条，剩下的压成简讯
const lead = computed(() => events.value[0] || {});
const briefs = computed(() => events.value.slice(1));

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
    enabled.value = Boolean(await getSetting(HISTORY_ONLINE_KEY, true));
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
