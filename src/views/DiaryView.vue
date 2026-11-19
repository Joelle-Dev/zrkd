<template>
  <div class="page">
    <header class="page-head">
      <div class="page-head-copy">
        <h1 class="page-title">日记</h1>
        <p class="page-subtitle">{{ subtitle }}</p>
      </div>
      <button class="icon-btn" type="button" aria-label="写一篇" @click="write">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5.5v13M5.5 12h13"></path>
        </svg>
      </button>
    </header>

    <LoadingState v-if="loading && !ready" text="正在翻本子…" />

    <template v-else-if="groups.length">
      <section v-for="group in groups" :key="group.date" class="diary-group">
        <div class="diary-date-head">
          <span class="diary-date">{{ groupLabel(group.date) }}</span>
          <span class="diary-count">{{ group.items.length }} 篇</span>
        </div>

        <article
          v-for="item in group.items"
          :key="item.id"
          class="diary-card"
          :style="item.accent ? { '--accent': item.accent } : null"
        >
          <button
            class="event-hit"
            type="button"
            :aria-label="`查看 ${groupLabel(group.date)} 的日记`"
            @click="open(item)"
          ></button>

          <div class="diary-head">
            <span v-if="moodOf(item.mood)" class="diary-mood" :aria-label="moodOf(item.mood).label">
              {{ moodOf(item.mood).emoji }}
            </span>
            <span v-if="eventTitle(item.eventId)" class="diary-tag">{{ eventTitle(item.eventId) }}</span>
            <span class="diary-time">{{ timeOf(item.createdAt) }}</span>
          </div>

          <p v-if="item.text" class="diary-body">{{ item.text }}</p>

          <img v-if="item.photo" class="diary-thumb" :src="item.photo" alt="配图">
        </article>
      </section>
    </template>

    <div v-else-if="ready" class="empty-hint">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 4.5h11.2a1.3 1.3 0 0 1 1.3 1.3v13.4a1.3 1.3 0 0 1-1.3 1.3H6"></path>
        <path d="M6 4.5a2 2 0 0 0-2 2v13h2"></path>
        <path d="M8.6 9h6.6M8.6 12.6h6.6"></path>
      </svg>
      <strong>还没有写过日记</strong>
      <span>一天可以写好几篇<br>记下今天发生了什么</span>
      <button class="primary-btn" type="button" style="margin-top: 12px; max-width: 200px;" @click="write">
        写第一篇
      </button>
    </div>

    <footer class="page-footer">
      <span>指日可待</span>
      <span>·</span>
      <span>日记都在你自己的设备上</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import LoadingState from '../components/LoadingState.vue';
import { useDiaries } from '../composables/useDiaries';
import { useEvents } from '../composables/useEvents';
import { groupDiariesByDate, moodOf } from '../lib/diary';
import { dateKeyOf, formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';

const router = useRouter();
const { diaries, ready, loading } = useDiaries();
const { events } = useEvents();

const groups = computed(() => groupDiariesByDate(diaries.value));

const subtitle = computed(() => {
  const count = diaries.value.length;
  if (!count) return '记下今天，也记下以前';
  return `一共 ${count} 篇，慢慢翻`;
});

const eventMap = computed(() => {
  const map = {};
  for (const event of events.value) map[event.id] = event;
  return map;
});

function eventTitle(id) {
  return id ? eventMap.value[id]?.title || '' : '';
}

function groupLabel(date) {
  if (date === dateKeyOf()) return `今天 · ${weekdayCN(date)}`;
  const parts = parseDateKey(date);
  if (!parts) return date;
  return `${formatDateCN(date)} ${weekdayCN(date)}`;
}

function timeOf(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function write() {
  router.push('/diary/new');
}

function open(item) {
  router.push(`/diary/${item.id}`);
}

onMounted(() => {
  // 直接进入本页时也保证数据已加载
  useDiaries();
});
</script>
