<template>
  <div class="page calc-page">
    <header class="edit-head">
      <button class="icon-btn" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <div class="page-head-copy">
        <h1 class="page-title">日期计算器</h1>
        <p class="page-subtitle">算两个日子差多久，也从一个日子往前推、往后推</p>
      </div>
    </header>

    <div class="segmented calc-modes">
      <button
        v-for="item in modes"
        :key="item.key"
        type="button"
        :class="{ 'is-active': mode === item.key }"
        @click="switchMode(item.key)"
      >{{ item.label }}</button>
    </div>

    <template v-if="mode === 'diff'">
      <div class="card calc-card">
        <button class="calc-date-row" type="button" aria-label="选开始日期" @click="diffStartOpen = true">
          <span class="calc-date-kicker">开始</span>
          <span class="calc-date-main">{{ formatDateCN(startKey) }}</span>
          <span class="calc-date-week">{{ weekdayCN(startKey) }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9.5 6.5 5.5 5.5-5.5 5.5"></path>
          </svg>
        </button>

        <button class="calc-date-row" type="button" aria-label="选结束日期" @click="diffEndOpen = true">
          <span class="calc-date-kicker">结束</span>
          <span class="calc-date-main">{{ formatDateCN(endKey) }}</span>
          <span class="calc-date-week">{{ weekdayCN(endKey) }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9.5 6.5 5.5 5.5-5.5 5.5"></path>
          </svg>
        </button>

        <div class="calc-body">
          <div class="calc-figure">
            <span class="calc-verb">相差</span>
            <b class="calc-number">{{ diffDaysAbs }}</b>
            <span class="calc-unit">天</span>
          </div>
          <p class="calc-phrase">{{ diffPhrase }}</p>

          <div class="calc-facts">
            <span class="calc-fact">{{ weekText }}</span>
            <span class="calc-fact">工作日 {{ weekdayCount }} 天</span>
          </div>
        </div>
      </div>

      <p class="photo-hint">
        天数按日历日算，不含结束那天；工作日只排除周末，不算法定节假日。
      </p>
    </template>

    <template v-else>
      <div class="card calc-card">
        <button class="calc-date-row" type="button" aria-label="选起始日期" @click="offsetOpen = true">
          <span class="calc-date-kicker">起始</span>
          <span class="calc-date-main">{{ formatDateCN(offsetStartKey) }}</span>
          <span class="calc-date-week">{{ weekdayCN(offsetStartKey) }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9.5 6.5 5.5 5.5-5.5 5.5"></path>
          </svg>
        </button>

        <div class="calc-body">
          <div class="calc-direction" role="radiogroup" aria-label="往前还是往后">
            <button
              type="button"
              role="radio"
              class="chip"
              :class="{ 'is-active': direction === 1 }"
              :aria-checked="direction === 1"
              @click="pickDirection(1)"
            >之后</button>
            <button
              type="button"
              role="radio"
              class="chip"
              :class="{ 'is-active': direction === -1 }"
              :aria-checked="direction === -1"
              @click="pickDirection(-1)"
            >之前</button>
          </div>

          <div class="calc-amount-row">
            <input
              class="calc-amount"
              type="text"
              inputmode="numeric"
              maxlength="5"
              :value="amountText"
              aria-label="数量"
              @input="onAmountInput"
            >
            <div class="calc-units" role="radiogroup" aria-label="单位">
              <button
                v-for="item in units"
                :key="item.key"
                type="button"
                role="radio"
                class="chip"
                :class="{ 'is-active': unit === item.key }"
                :aria-checked="unit === item.key"
                @click="pickUnit(item.key)"
              >{{ item.label }}</button>
            </div>
          </div>

          <div class="calc-result">
            <span class="calc-result-kicker">{{ resultKicker }}</span>
            <b class="calc-result-date">{{ resultDateText }}</b>
            <span v-if="resultWeekday" class="calc-result-week">{{ resultWeekday }}</span>
            <span v-if="resultRelative" class="calc-result-rel">{{ resultRelative }}</span>
          </div>

          <button
            class="secondary-btn"
            type="button"
            :disabled="!resultKey"
            @click="saveAsEvent"
          >把这天记成日子</button>
        </div>
      </div>

      <p class="photo-hint">按月 / 年推时会贴合月底：1 月 31 日加一个月，落在 2 月最后一天。</p>
    </template>

    <DatePicker v-model="startKey" v-model:show="diffStartOpen" />
    <DatePicker v-model="endKey" v-model:show="diffEndOpen" />
    <DatePicker v-model="offsetStartKey" v-model:show="offsetOpen" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DatePicker from '../components/DatePicker.vue';
import { DATE_UNITS, describeSpan, shiftDateKey } from '../lib/datetool';
import {
  dateKeyOf,
  diffDays,
  formatDateCN,
  weekdayCN
} from '../lib/countdown';
import { makeGoBack } from '../utils/back';
import { haptic } from '../utils/haptics';

const router = useRouter();
const goBack = makeGoBack(router);

const modes = [
  { key: 'diff', label: '相差天数' },
  { key: 'offset', label: '往前 / 往后推' }
];
const units = DATE_UNITS;

const mode = ref('diff');
const startKey = ref(dateKeyOf());
const endKey = ref(shiftDateKey(dateKeyOf(), 7, 'day') || dateKeyOf());
const offsetStartKey = ref(dateKeyOf());
const direction = ref(1);
const amountText = ref('7');
const unit = ref('day');

const diffStartOpen = ref(false);
const diffEndOpen = ref(false);
const offsetOpen = ref(false);

function switchMode(next) {
  if (mode.value === next) return;
  mode.value = next;
  haptic('light');
}

function pickDirection(next) {
  direction.value = next;
  haptic('light');
}

function pickUnit(next) {
  unit.value = next;
  haptic('light');
}

function onAmountInput(event) {
  const clean = String(event?.target?.value || '').replace(/\D/g, '').slice(0, 5);
  amountText.value = clean;
  if (event?.target) event.target.value = clean;
}

const span = computed(() => describeSpan(startKey.value, endKey.value));
const diffDaysAbs = computed(() => (span.value ? span.value.days : '—'));
const weekdayCount = computed(() => (span.value ? span.value.weekdays : '—'));

const diffPhrase = computed(() => {
  const value = span.value;
  if (!value) return '日期不太对，重新挑一下';
  if (value.kind === 'same') return '两个日子是同一天';
  return value.kind === 'after'
    ? `结束比开始晚 ${value.days} 天`
    : `结束比开始早 ${value.days} 天`;
});

const weekText = computed(() => {
  const value = span.value;
  if (!value || value.days === 0) return '0 天';
  if (!value.weeks) return `也就是 ${value.rest} 天`;
  return `也就是 ${value.weeks} 周 ${value.rest} 天`;
});

const amount = computed(() => {
  const value = Number.parseInt(amountText.value, 10);
  return Number.isFinite(value) ? Math.abs(value) : 0;
});

const signedAmount = computed(() => direction.value * amount.value);

const resultKey = computed(() => shiftDateKey(offsetStartKey.value, signedAmount.value, unit.value));

const resultKicker = computed(() => (direction.value === 1 ? '之后是' : '之前是'));

const resultDateText = computed(() => (
  resultKey.value ? formatDateCN(resultKey.value) : '算不出来，换个数量'
));

const resultWeekday = computed(() => (resultKey.value ? weekdayCN(resultKey.value) : ''));

const resultRelative = computed(() => {
  if (!resultKey.value) return '';
  const today = dateKeyOf();
  const delta = diffDays(today, resultKey.value);
  if (delta === null) return '';
  if (delta === 0) return '就是今天';
  return delta > 0 ? `距今还有 ${delta} 天` : `已经过去 ${Math.abs(delta)} 天`;
});

function saveAsEvent() {
  if (!resultKey.value) return;
  haptic('light');
  router.push({ path: '/event/new', query: { date: resultKey.value } });
}
</script>
