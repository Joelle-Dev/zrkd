// 日记列表的共享状态，和 useEvents 一样是模块级 ref。

import { computed, ref } from 'vue';
import { listDiaries, sortDiaries } from '../lib/diary.js';

const diaries = ref([]);
const ready = ref(false);
const loading = ref(false);
let initPromise = null;

export async function loadDiaries() {
  loading.value = true;
  try {
    diaries.value = sortDiaries(await listDiaries());
    ready.value = true;
  } finally {
    loading.value = false;
  }
}

export function useDiaries() {
  if (!initPromise) {
    initPromise = loadDiaries().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  const total = computed(() => diaries.value.length);

  return {
    diaries,
    total,
    ready,
    loading,
    reload: loadDiaries
  };
}
