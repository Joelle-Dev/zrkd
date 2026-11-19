import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'today',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/diary',
    name: 'diary',
    component: () => import('../views/DiaryView.vue')
  },
  {
    path: '/diary/new',
    name: 'diary-new',
    meta: { immersive: true },
    component: () => import('../views/DiaryEditView.vue')
  },
  {
    path: '/diary/:id',
    name: 'diary-entry',
    meta: { immersive: true },
    component: () => import('../views/DiaryEditView.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue')
  },
  {
    path: '/event/new',
    name: 'event-new',
    meta: { immersive: true },
    component: () => import('../views/EventEditView.vue')
  },
  {
    path: '/event/:id/edit',
    name: 'event-edit',
    meta: { immersive: true },
    component: () => import('../views/EventEditView.vue')
  },
  {
    path: '/event/:id',
    name: 'event',
    meta: { immersive: true },
    component: () => import('../views/EventDetailView.vue')
  },
  {
    path: '/photo',
    name: 'photo',
    meta: { immersive: true },
    component: () => import('../views/PhotoView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
