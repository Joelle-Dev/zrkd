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

    <div v-if="diaries.length > 3" class="search-line">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.2"></circle>
        <path d="m15.6 15.6 4 4"></path>
      </svg>
      <input
        v-model="query"
        class="search-input"
        type="search"
        placeholder="翻翻都写过啥"
        aria-label="搜索日记"
      >
      <button v-if="query" class="search-clear" type="button" aria-label="清空搜索" @click="query = ''">×</button>
    </div>

    <LoadingState v-if="loading && !ready" text="本子有点厚，稍等…" />

    <template v-else-if="groups.length">
      <div class="timeline">
        <section v-for="group in groups" :key="group.date" class="tl-group">
          <div class="tl-date-row">
            <span class="tl-date">{{ groupLabel(group.date) }}</span>
            <span class="tl-count">{{ group.items.length }} 篇</span>
          </div>

          <article
            v-for="item in group.items"
            :key="item.id"
            class="tl-item"
            :style="accentStyleOf(item.accent)"
          >
            <button
              class="tl-hit"
              type="button"
              :aria-label="`查看 ${groupLabel(group.date)} ${timeOf(item.createdAt)} 的日记`"
              @click="open(item)"
            ></button>

            <div class="tl-stamp">
              <span class="tl-time">{{ timeOf(item.createdAt) }}</span>
              <span class="tl-day">{{ formatDateDot(item.date) }}</span>
            </div>
            <span class="tl-dot" aria-hidden="true"></span>

            <div class="tl-content">
              <div v-if="moodOf(item.mood) || eventTitle(item.eventId)" class="tl-meta">
                <span v-if="moodOf(item.mood)" class="tl-mood" :aria-label="moodOf(item.mood).label">
                  {{ moodOf(item.mood).emoji }}
                </span>
                <span v-if="eventTitle(item.eventId)" class="tl-tag">{{ eventTitle(item.eventId) }}</span>
              </div>

              <h2 v-if="item.title" class="tl-title">{{ item.title }}</h2>

              <div v-if="item.body || item.html || item.text" class="tl-body" v-html="previewHtml(item)"></div>

              <img v-if="item.photo" class="tl-thumb" :src="item.photo" alt="配图">
            </div>
          </article>
        </section>
      </div>
    </template>

    <div v-else-if="ready && query" class="empty-hint">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.2"></circle>
        <path d="m15.6 15.6 4 4"></path>
      </svg>
      <strong>没翻到「{{ query }}」</strong>
      <span>换个词，或者假装没找过</span>
      <button class="secondary-btn" type="button" style="margin-top: 12px;" @click="query = ''">不找了</button>
    </div>

    <div v-else-if="ready" class="empty-hint">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 4.5h11.2a1.3 1.3 0 0 1 1.3 1.3v13.4a1.3 1.3 0 0 1-1.3 1.3H6"></path>
        <path d="M6 4.5a2 2 0 0 0-2 2v13h2"></path>
        <path d="M8.6 9h6.6M8.6 12.6h6.6"></path>
      </svg>
      <strong>本子还是白的</strong>
      <span>随便写两句<br>将来的你会谢谢现在的你</span>
      <button class="primary-btn" type="button" style="margin-top: 12px; max-width: 200px;" @click="write">
        开个头
      </button>
    </div>

    <footer class="page-footer">
      <span>指日可待</span>
      <span>·</span>
      <span>日记没离开过这台设备</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LoadingState from '../components/LoadingState.vue';
import { useDiaries } from '../composables/useDiaries';
import { useEvents } from '../composables/useEvents';
import { groupDiariesByDate, moodOf } from '../lib/diary';
import { markdownToHtml } from '../lib/richtext';
import { accentStyleOf } from '../utils/theme';
import { dateKeyOf, formatDateCN, formatDateDot, parseDateKey, weekdayCN } from '../lib/countdown';

defineOptions({ name: 'DiaryView' });

const router = useRouter();
const { diaries, ready, loading } = useDiaries();
const { events } = useEvents();

const query = ref('');

function matchesQuery(item, raw) {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.text, moodOf(item.mood)?.label]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

const groups = computed(() => {
  const raw = query.value;
  const filtered = raw.trim() ? diaries.value.filter((item) => matchesQuery(item, raw)) : diaries.value;
  return groupDiariesByDate(filtered);
});

const subtitle = computed(() => {
  const count = diaries.value.length;
  if (!count) return '今天、昨天，还有那些忘了的日子';
  return `${count} 篇存货，够翻一阵`;
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

// 列表摘要按 Markdown 渲染（markdownToHtml 内部已做 HTML 转义）
function previewHtml(item) {
  if (item.body) return markdownToHtml(item.body);
  return item.html || '';
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
