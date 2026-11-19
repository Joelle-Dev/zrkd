<template>
  <div class="app-shell" :class="{ 'is-immersive': isImmersive }">
    <RouterView v-slot="{ Component }">
      <Transition :name="pageTransition" mode="out-in" :css="transitionCss">
        <KeepAlive :include="keepAliveNames">
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </RouterView>

    <nav v-if="!isImmersive" class="tabbar" aria-label="主导航" :style="{ '--tab-index': activeIndex }">
      <span class="tabbar-rail" :class="{ 'is-idle': !hasActiveTab }" aria-hidden="true"></span>
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="tabbar-item"
        :class="{ 'is-active': isActive(tab) }"
        type="button"
        :aria-current="isActive(tab) ? 'page' : undefined"
        :aria-label="tab.label"
        @click="go(tab)"
      >
        <span class="tab-glyph" aria-hidden="true">{{ tab.glyph }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { requestPersistence } from './lib/storage';
import { useEvents } from './composables/useEvents';

const route = useRoute();
const router = useRouter();
const events = useEvents();

const isImmersive = computed(() => Boolean(route.meta.immersive));
const pageTransition = computed(() => route.meta.transition || 'page-fade');

// 手机边缘滑动返回时，浏览器有自己的原生动画，再叠一层淡入反而闪。
// 用 popstate 标记「这是一次后退」，后退那次关掉 CSS 过渡。
const isPop = ref(false);
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    isPop.value = true;
    // 动画结束后复位，普通点击导航仍有过渡
    setTimeout(() => { isPop.value = false; }, 260);
  });
}
const transitionCss = computed(() => !isPop.value);

// 三个 tab 页缓存起来：从详情/编辑返回时不再整页重建，
// 滚动位置、展开状态、问候语都保持原样。
const keepAliveNames = ['HomeView', 'DiaryView', 'HistoryView'];

const TABS = [
  {
    name: 'today',
    label: '日子',
    glyph: '日',
    path: '/',
    match: ['today']
  },
  {
    name: 'diary',
    label: '日记',
    glyph: '记',
    path: '/diary',
    match: ['diary']
  },
  {
    name: 'history',
    label: '历史',
    glyph: '史',
    path: '/history',
    match: ['history']
  }
];

const tabs = TABS;

const activeIndex = computed(() => Math.max(0, TABS.findIndex((tab) => isActive(tab))));
const hasActiveTab = computed(() => TABS.some((tab) => isActive(tab)));

function isActive(tab) {
  return tab.match.includes(route.name);
}

function go(tab) {
  if (route.path !== tab.path) router.push(tab.path);
}

function onVisible() {
  if (document.visibilityState !== 'visible') return;
  if (events.refreshToday()) {
    events.reload().catch(() => {});
  }
}

onMounted(() => {
  requestPersistence().catch(() => {});
  events.reload().catch((err) => console.error('加载日子失败', err));
  document.addEventListener('visibilitychange', onVisible);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible);
});
</script>
