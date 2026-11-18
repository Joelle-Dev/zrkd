// 事件列表的共享状态。沿用 pan-words 的「模块级 ref + composable」写法，不引入 Pinia。

import { computed, ref } from 'vue';
import { listEvents } from '../lib/events.js';
import { dateKeyOf, sortEventsByUrgency } from '../lib/countdown.js';

const events = ref([]);
const ready = ref(false);
const loading = ref(false);
const todayKey = ref(dateKeyOf());
let initPromise = null;

export function refreshToday() {
  const next = dateKeyOf();
  if (next !== todayKey.value) {
    todayKey.value = next;
    return true;
  }
  return false;
}

export async function loadEvents() {
  loading.value = true;
  try {
    events.value = await listEvents();
    ready.value = true;
  } catch (err) {
    throw err;
  } finally {
    loading.value = false;
  }
}

export function useEvents() {
  if (!initPromise) {
    initPromise = loadEvents().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  const sorted = computed(() => sortEventsByUrgency(events.value, todayKey.value));

  return {
    events,
    sorted,
    ready,
    loading,
    todayKey,
    reload: loadEvents,
    refreshToday
  };
}
