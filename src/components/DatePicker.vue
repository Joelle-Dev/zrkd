<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    teleport="body"
    class="date-picker-pop"
    @update:show="onPopupToggle"
  >
    <div class="dp">
      <div class="dp-head">
        <button class="dp-nav" type="button" aria-label="上个月" @click="shiftMonth(-1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m14.5 5.5-6.5 6.5 6.5 6.5"></path>
          </svg>
        </button>

        <button class="dp-title" type="button" :aria-label="`${view.year} 年 ${view.month} 月，回到今天`" @click="goToday">
          {{ view.year }} 年 {{ view.month }} 月
        </button>

        <button class="dp-nav" type="button" aria-label="下个月" @click="shiftMonth(1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5"></path>
          </svg>
        </button>
      </div>

      <div class="dp-quick">
        <button
          v-for="item in quickOptions"
          :key="item.label"
          class="dp-quick-btn"
          type="button"
          :class="{ 'is-active': item.value === selectedKey }"
          @click="pick(item.value)"
        >{{ item.label }}</button>
      </div>

      <div class="dp-week">
        <span v-for="name in WEEKDAYS" :key="name">{{ name }}</span>
      </div>

      <div class="dp-grid">
        <button
          v-for="cell in cells"
          :key="cell.key"
          class="dp-day"
          type="button"
          :class="{
            'is-out': !cell.inMonth,
            'is-today': cell.isToday,
            'is-selected': cell.key === selectedKey
          }"
          :aria-label="cell.label"
          :aria-pressed="cell.key === selectedKey"
          @click="pick(cell.key)"
        >{{ cell.day }}</button>
      </div>

      <div class="dp-foot">
        <span class="dp-preview">{{ selectedLabel }}</span>
        <button class="dp-close" type="button" @click="close">关闭</button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { dateKeyOf, formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';
import {
  WEEKDAY_NAMES,
  buildMonthCells,
  clampDateKey,
  shiftDateKey,
  shiftMonthRef
} from '../lib/calendar';
import { haptic } from '../utils/haptics';

const props = defineProps({
  show: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  min: { type: String, default: '1900-01-01' },
  max: { type: String, default: '2999-12-31' }
});

const emit = defineEmits(['update:show', 'update:modelValue']);

const WEEKDAYS = WEEKDAY_NAMES;
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

const todayKey = ref(dateKeyOf());
const selectedKey = computed(() => props.modelValue || todayKey.value);

const view = ref({ year: 2026, month: 1 });

function clampToRange(key) {
  return clampDateKey(key, props.min, props.max);
}

/** 把视图定位到当前选中的月份 */
function syncView() {
  const parts = parseDateKey(selectedKey.value) || parseDateKey(todayKey.value);
  if (!parts) return;
  view.value = { year: parts.year, month: parts.month };
}

watch(() => props.show, (open) => {
  if (!open) return;
  todayKey.value = dateKeyOf();
  syncView();
}, { immediate: true });

watch(() => props.modelValue, () => {
  if (props.show) syncView();
});

/** 6 行 × 7 列，前后补足相邻月份的日期（计算见 lib/calendar.js） */
const cells = computed(() => {
  const { year, month } = view.value;
  return buildMonthCells(year, month, todayKey.value).map((cell) => ({
    ...cell,
    label: formatDateCN(cell.key)
  }));
});

function shiftMonth(delta) {
  const next = shiftMonthRef(view.value, delta);
  if (next.year < MIN_YEAR || next.year > MAX_YEAR) return;
  view.value = next;
  haptic('light');
}

function goToday() {
  todayKey.value = dateKeyOf();
  syncView();
}

const quickOptions = computed(() => {
  const base = todayKey.value;
  return [
    { label: '今天', value: clampToRange(base) },
    { label: '昨天', value: clampToRange(shiftDateKey(base, -1)) },
    { label: '明天', value: clampToRange(shiftDateKey(base, 1)) },
    { label: '一周后', value: clampToRange(shiftDateKey(base, 7)) }
  ].filter((item) => item.value);
});

const selectedLabel = computed(() => {
  const key = selectedKey.value;
  if (!parseDateKey(key)) return '选个日期';
  return `${formatDateCN(key)} ${weekdayCN(key)}`;
});

function pick(key) {
  const next = clampToRange(key);
  if (!next) return;
  emit('update:modelValue', next);
  haptic('light');
  close();
}

function close() {
  emit('update:show', false);
}

function onPopupToggle(value) {
  emit('update:show', value);
}
</script>
