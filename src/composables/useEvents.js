// 事件列表的共享状态。沿用 pan-words 的「模块级 ref + composable」写法，不引入 Pinia。

import { computed, ref } from 'vue';
import { listEvents } from '../lib/events.js';
import { dateKeyOf, sortEventsByUrgency } from '../lib/countdown.js';

const events = ref([]);
const ready = ref(false);
const loading = ref(false);
const todayKey = ref(dateKeyOf());
const lastError = ref(null);

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
    lastError.value = null;
    ready.value = true;
  } catch (err) {
    lastError.value = err;
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
  const upcoming = computed(() => sorted.value.filter((event) => {
    const target = event.targetDate;
    return target && target >= todayKey.value;
  }));
  const past = computed(() => sorted.value.filter((event) => event.targetDate && event.targetDate < todayKey.value));

  return {
    events,
    sorted,
    upcoming,
    past,
    ready,
    loading,
    todayKey,
    lastError,
    reload: loadEvents,
    refreshToday
  };
}
