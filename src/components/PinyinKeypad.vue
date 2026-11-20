<template>
  <Teleport to="body">
    <Transition name="pk-slide">
      <div
        v-if="state.visible"
        ref="panel"
        class="pinyin-keypad"
        role="dialog"
        aria-label="拼音键盘"
        @mousedown.prevent
      >
        <div class="pk-inner">
          <div class="pk-head">
            <span class="pk-preedit" :class="{ 'is-placeholder': !state.displayPreedit }">
              {{ preeditText }}
            </span>
            <div class="pk-actions">
              <button v-if="state.error" class="pk-link" type="button" @click="onKey('retry')">重试</button>
              <button class="pk-link" type="button" @click="onKey('layout')">
                {{ state.layout === 't9' ? '26 键' : '九宫格' }}
              </button>
              <button class="pk-link" type="button" @click="onKey('hide')">收起</button>
            </div>
          </div>

          <div class="pk-candidates-row">
            <div class="pk-candidates" aria-live="polite">
              <template v-if="state.syllables.length">
                <button
                  v-for="py in state.syllables"
                  :key="`sy-${py}`"
                  class="pk-syllable"
                  :class="{ 'is-active': state.activeSyllable === py }"
                  type="button"
                  @click="onSyllable(state.activeSyllable === py ? null : py)"
                >{{ py }}</button>
              </template>

              <button
                v-for="(candidate, index) in state.candidates"
                :key="`${candidate.w}-${index}`"
                class="pk-candidate"
                type="button"
                @click="onSelect(index)"
              >{{ candidate.w }}</button>

              <span v-if="state.error" class="pk-empty is-error">{{ state.error }}</span>
              <span v-else-if="state.loading" class="pk-empty">正在准备输入法…</span>
              <span v-else-if="!state.candidates.length" class="pk-empty">
                {{ state.layout === 't9' ? '按 2-9 打拼音' : '打拼音，或切到英文直接打字母' }}
              </span>
            </div>

            <span v-if="state.pageCount > 1" class="pk-pager">
              <button type="button" aria-label="上一页" @click="onPage(-1)">‹</button>
              <span>{{ state.page + 1 }}/{{ state.pageCount }}</span>
              <button type="button" aria-label="下一页" @click="onPage(1)">›</button>
            </span>
          </div>

          <!-- 符号页 -->
          <template v-if="state.symbolMode">
            <div class="pk-symbols">
              <button
                v-for="symbol in symbols"
                :key="`sym-${symbol}`"
                class="pk-key pk-sym"
                type="button"
                @click="onKey(symbol)"
              >{{ symbol }}</button>
            </div>
            <div class="pk-bottom">
              <button class="pk-key pk-mod" type="button" @click="onKey('ABC')">ABC</button>
              <button class="pk-key pk-space" type="button" @click="onKey('space')">空格</button>
              <button class="pk-key pk-mod" type="button" @click="onKey('enter')">↵</button>
              <button class="pk-key pk-mod pk-back" type="button" @click="onKey('back')">⌫</button>
            </div>
          </template>

          <!-- 九宫格 -->
          <template v-else-if="state.layout === 't9'">
            <div class="pk-grid pk-t9">
              <button
                v-for="digit in t9Digits"
                :key="`t9-${digit}`"
                class="pk-key pk-digit"
                type="button"
                @click="onKey(digit)"
              >
                <span class="pk-key-main">{{ digit }}</span>
                <span class="pk-key-hint">{{ digit === '1' ? '，' : t9Hint(digit) }}</span>
              </button>
            </div>
            <div class="pk-bottom">
              <button class="pk-key pk-mod" type="button" @click="onKey('symbols')">符</button>
              <button class="pk-key pk-space" type="button" @click="onKey('space')">0 · 空格</button>
              <button class="pk-key pk-mod" type="button" @click="onKey('enter')">↵</button>
              <button class="pk-key pk-mod pk-back" type="button" @click="onKey('back')">⌫</button>
            </div>
          </template>

          <!-- 26 键 -->
          <template v-else>
            <div class="pk-qwerty">
              <div class="pk-qrow">
                <button
                  v-for="letter in qwertyRows[0]"
                  :key="`q1-${letter}`"
                  class="pk-key pk-letter"
                  type="button"
                  @click="onKey(letter)"
                >{{ displayLetter(letter) }}</button>
              </div>
              <div class="pk-qrow pk-qrow-mid">
                <button
                  v-for="letter in qwertyRows[1]"
                  :key="`q2-${letter}`"
                  class="pk-key pk-letter"
                  type="button"
                  @click="onKey(letter)"
                >{{ displayLetter(letter) }}</button>
              </div>
              <div class="pk-qrow">
                <button
                  v-if="isEnglish"
                  class="pk-key pk-mod pk-shift"
                  :class="{ 'is-active': state.shift }"
                  type="button"
                  aria-label="大写"
                  @click="onKey('shift')"
                >⇧</button>
                <button
                  v-for="letter in qwertyRows[2]"
                  :key="`q3-${letter}`"
                  class="pk-key pk-letter"
                  type="button"
                  @click="onKey(letter)"
                >{{ displayLetter(letter) }}</button>
                <button class="pk-key pk-mod pk-back" type="button" aria-label="退格" @click="onKey('back')">⌫</button>
              </div>
            </div>
            <div class="pk-bottom">
              <button class="pk-key pk-mod" type="button" @click="onKey('language')">
                {{ isEnglish ? '中' : '英' }}
              </button>
              <button class="pk-key pk-mod" type="button" @click="onKey('symbols')">符</button>
              <button class="pk-key pk-space" type="button" @click="onKey('space')">空格</button>
              <button class="pk-key pk-mod" type="button" @click="onKey('enter')">↵</button>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { usePinyinKeyboard } from '../composables/usePinyinKeyboard';
import {
  T9_DIGITS,
  QWERTY_ROWS,
  SYMBOL_KEYS,
  t9Hint
} from '../lib/pinyin/layouts';

const { state, press, select, page, pickSyllable } = usePinyinKeyboard();

const t9Digits = T9_DIGITS;
const qwertyRows = QWERTY_ROWS;
const symbols = SYMBOL_KEYS;

const panel = ref(null);
const height = ref(0);
let resizeObserver = null;

const isEnglish = computed(() => state.layout === 'qwerty' && state.language === 'en');

const preeditText = computed(() => {
  if (state.displayPreedit) return state.displayPreedit;
  if (state.loading) return '正在准备输入法…';
  return '拼音';
});

function displayLetter(letter) {
  return isEnglish.value && state.shift ? letter.toUpperCase() : letter;
}

function onKey(token) {
  press(token);
}

function onSelect(index) {
  select(index);
}

function onPage(delta) {
  page(delta);
}

function onSyllable(pinyin) {
  pickSyllable(pinyin);
}

function measure() {
  if (!panel.value) return;
  const next = Math.ceil(panel.value.getBoundingClientRect().height);
  if (!next) return;
  height.value = next;
  document.documentElement.style.setProperty('--pinyin-kb-height', `${next}px`);
}

/** 键盘打开后，把正在输入的那一行放进「吸顶栏以下、键盘以上」 */
function keepFieldVisible() {
  const el = document.activeElement;
  if (!el || !el.matches('input, textarea')) return;
  const rect = el.getBoundingClientRect();
  const sticky = document.querySelector('.write-topbar');
  const topLimit = (sticky ? sticky.getBoundingClientRect().bottom : 0) + 8;
  const bottomLimit = window.innerHeight - height.value - 16;

  let delta = 0;
  if (rect.bottom > bottomLimit) delta = rect.bottom - bottomLimit;
  else if (rect.top < topLimit) delta = rect.top - topLimit;
  if (delta) window.scrollBy({ top: delta, behavior: 'smooth' });
}

watch(() => state.visible, async (visible) => {
  if (visible) {
    document.body.classList.add('pinyin-keyboard-open');
    await nextTick();
    measure();
    requestAnimationFrame(keepFieldVisible);
    if (!resizeObserver && typeof ResizeObserver === 'function' && panel.value) {
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(panel.value);
    }
  } else {
    document.body.classList.remove('pinyin-keyboard-open');
    document.documentElement.style.removeProperty('--pinyin-kb-height');
    resizeObserver?.disconnect();
    resizeObserver = null;
  }
}, { immediate: true });

onUnmounted(() => {
  document.body.classList.remove('pinyin-keyboard-open');
  document.documentElement.style.removeProperty('--pinyin-kb-height');
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>
