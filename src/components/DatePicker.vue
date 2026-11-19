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

        <div class="dp-title">
          <button class="dp-title-btn" type="button" :aria-label="`选年份，当前 ${view.year} 年`" @click="openPanel('year')">
            {{ view.year }} 年
          </button>
          <button class="dp-title-btn" type="button" :aria-label="`选月份，当前 ${view.month} 月`" @click="openPanel('month')">
            {{ view.month }} 月
          </button>
        </div>

        <button class="dp-nav" type="button" aria-label="下个月" @click="shiftMonth(1)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5"></path>
          </svg>
        </button>
      </div>

      <!-- 年月面板：点标题里的「年 / 月」展开，选完就回到日历 -->
      <Transition name="dp-sheet">
        <div v-if="panel" class="dp-sheet">
          <template v-if="panel === 'year'">
            <div class="dp-sheet-head">
              <button class="dp-nav" type="button" aria-label="往前十二年" @click="shiftYearWindow(-1)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m14.5 5.5-6.5 6.5 6.5 6.5"></path>
                </svg>
              </button>
              <span class="dp-sheet-label">{{ yearRangeLabel }}</span>
              <button class="dp-nav" type="button" aria-label="往后十二年" @click="shiftYearWindow(1)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m9.5 5.5 6.5 6.5-6.5 6.5"></path>
                </svg>
              </button>
            </div>
            <div class="dp-year-grid">
              <button
                v-for="year in years"
                :key="year"
                class="dp-year"
                type="button"
                :class="{ 'is-selected': year === view.year, 'is-current': year === todayYear }"
                @click="pickYear(year)"
              >{{ year }}</button>
            </div>
          </template>

          <template v-else>
            <div class="dp-sheet-head">
              <span class="dp-sheet-label">{{ view.year }} 年</span>
              <button class="dp-sheet-back" type="button" @click="panel = ''">收起</button>
            </div>
            <div class="dp-month-grid">
              <button
                v-for="item in months"
                :key="item.key"
                class="dp-month"
                type="button"
                :class="{ 'is-selected': item.month === view.month }"
                @click="pickMonth(item.month)"
              >{{ item.month }} 月</button>
            </div>
          </template>
        </div>
      </Transition>

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
        <div class="dp-foot-actions">
          <button class="dp-today" type="button" @click="goToday">回到今天</button>
          <button class="dp-close" type="button" @click="close">关闭</button>
        </div>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { dateKeyOf, formatDateCN, parseDateKey, weekdayCN } from '../lib/countdown';
import {
  MIN_YEAR,
  MAX_YEAR,
  WEEKDAY_NAMES,
  buildMonthCells,
  clampDateKey,
  shiftDateKey,
  shiftMonthRef,
  yearMonths,
  yearWindow
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
const YEAR_PAGE = 12;

const todayKey = ref(dateKeyOf());
const selectedKey = computed(() => props.modelValue || todayKey.value);
const todayYear = computed(() => parseDateKey(todayKey.value)?.year ?? new Date().getFullYear());

const view = ref({ year: 2026, month: 1 });
const panel = ref(''); // '' | 'year' | 'month'
const yearCursor = ref(todayYear.value);

function clampToRange(key) {
  return clampDateKey(key, props.min || `1900-01-01`, props.max || '2999-12-31');
}

/** 把视图定位到当前选中的月份 */
function syncView() {
  const parts = parseDateKey(selectedKey.value) || parseDateKey(todayKey.value);
  if (!parts) return;
  view.value = { year: parts.year, month: parts.month };
  yearCursor.value = parts.year;
}

watch(() => props.show, (open) => {
  if (!open) {
    panel.value = '';
    return;
  }
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

const minYear = computed(() => parseDateKey(props.min)?.year ?? MIN_YEAR);
const maxYear = computed(() => parseDateKey(props.max)?.year ?? MAX_YEAR);

const years = computed(() => yearWindow(yearCursor.value, YEAR_PAGE)
  .filter((year) => year >= minYear.value && year <= maxYear.value));

const yearRangeLabel = computed(() => {
  const list = years.value;
  if (!list.length) return '';
  return `${list[0]} – ${list[list.length - 1]}`;
});

const months = computed(() => yearMonths(view.value.year));

function shiftYearWindow(delta) {
  const next = yearCursor.value + delta * YEAR_PAGE;
  if (next < minYear.value || next > maxYear.value) return;
  yearCursor.value = next;
  haptic('light');
}

function openPanel(name) {
  if (panel.value === name) {
    panel.value = '';
    return;
  }
  yearCursor.value = view.value.year;
  panel.value = name;
  haptic('light');
}

function pickYear(year) {
  view.value = { year, month: view.value.month };
  panel.value = '';
  haptic('light');
}

function pickMonth(month) {
  view.value = { year: view.value.year, month };
  panel.value = '';
  haptic('light');
}

function shiftMonth(delta) {
  const next = shiftMonthRef(view.value, delta);
  if (next.year < minYear.value || next.year > maxYear.value) return;
  view.value = next;
  yearCursor.value = next.year;
  haptic('light');
}

function goToday() {
  todayKey.value = dateKeyOf();
  syncView();
  panel.value = '';
}

// 快捷项只放最常用的一排，年月靠标题切换
const quickOptions = computed(() => {
  const base = todayKey.value;
  const list = [
    { label: '今天', value: clampToRange(base) },
    { label: '明天', value: clampToRange(shiftDateKey(base, 1)) },
    { label: '一周后', value: clampToRange(shiftDateKey(base, 7)) },
    { label: '明年今天', value: clampToRange(nextYearKey(base)) }
  ];
  return list.filter((item) => item.value);
});

const selectedLabel = computed(() => {
  const key = selectedKey.value;
  if (!parseDateKey(key)) return '选个日期';
  return `${formatDateCN(key)} ${weekdayCN(key)}`;
});

/** 明年同一天；2 月 29 落到 2 月 28 */
function nextYearKey(key) {
  const parts = parseDateKey(key);
  if (!parts) return null;
  const candidate = `${parts.year + 1}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return parseDateKey(candidate) ? candidate : `${parts.year + 1}-02-28`;
}

function pick(key) {
  const next = clampToRange(key);
  if (!next) return;
  emit('update:modelValue', next);
  haptic('light');
  close();
}

function close() {
  panel.value = '';
  emit('update:show', false);
}

function onPopupToggle(value) {
  if (!value) panel.value = '';
  emit('update:show', value);
}
</script>
