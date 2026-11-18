<template>
  <div class="app-shell" :class="{ 'is-immersive': isImmersive }">
    <RouterView v-slot="{ Component }">
      <Transition :name="pageTransition" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <nav v-if="!isImmersive" class="tabbar" aria-label="主导航">
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
        <span v-html="tab.icon" aria-hidden="true"></span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { requestPersistence } from './lib/storage';
import { useEvents } from './composables/useEvents';

const route = useRoute();
const router = useRouter();
const events = useEvents();

const isImmersive = computed(() => Boolean(route.meta.immersive));
const pageTransition = computed(() => route.meta.transition || 'page-fade');

const TABS = [
  {
    name: 'today',
    label: '日子',
    path: '/',
    match: ['today'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.4" width="16" height="15" rx="2.4"/><path d="M8 3.6v3.4M16 3.6v3.4M4 10.2h16"/><path d="M8.6 14.4h2.2M13.2 14.4h2.2M8.6 17.6h2.2"/></svg>'
  },
  {
    name: 'history',
    label: '历史',
    path: '/history',
    match: ['history'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 5.2A2.2 2.2 0 0 1 7.6 3h10.2a1.4 1.4 0 0 1 1.4 1.4v14.2a1.4 1.4 0 0 1-1.4 1.4H7.4a2 2 0 0 1-2-2z"/><path d="M8.4 3v18"/><path d="M12 8h4M12 11.6h4"/></svg>'
  },
  {
    name: 'photo',
    label: '拍照',
    path: '/photo',
    match: ['photo'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 8.2A1.7 1.7 0 0 1 5.9 6.5h2.2l1.3-2h5.2l1.3 2h2.2a1.7 1.7 0 0 1 1.7 1.7v9.1a1.7 1.7 0 0 1-1.7 1.7H5.9a1.7 1.7 0 0 1-1.7-1.7z"/><circle cx="12" cy="12.6" r="3.4"/></svg>'
  },
  {
    name: 'settings',
    label: '我的',
    path: '/settings',
    match: ['settings', 'event'],
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.2" r="3.3"/><path d="M5 19.4c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6"/></svg>'
  }
];

const tabs = TABS;

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
