import { createApp } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';
import 'vant/es/dialog/style';
import 'vant/es/image-preview/style';
import 'vant/es/switch/style';
import 'vant/es/toast/style';
import './styles/global.css';
import { isIgnorableError } from './lib/errors';
import { initTheme } from './utils/theme';

initTheme();

const ERROR_TOAST = '指日可待绊了一下，再试一次吧';
const ERROR_TOAST_GAP = 3000;
let lastErrorToastAt = 0;

function reportError(error, context) {
  if (isIgnorableError(error)) return;
  console.error(`[指日可待] ${context}`, error);
  const now = Date.now();
  if (now - lastErrorToastAt < ERROR_TOAST_GAP) return;
  lastErrorToastAt = now;
  showToast(typeof error?.message === 'string' && error.message.length <= 18 ? error.message : ERROR_TOAST);
}

window.addEventListener('unhandledrejection', (event) => {
  if (isIgnorableError(event.reason)) return;
  event.preventDefault();
  reportError(event.reason, 'unhandledrejection');
});

window.addEventListener('error', (event) => {
  if (!event.error) return;
  reportError(event.error, 'window.error');
});

const buildDate = new Date(__APP_BUILD_TIME__);
const buildLabel = Number.isNaN(buildDate.getTime())
  ? ''
  : buildDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
let refreshPrompting = false;

const updateSW = registerSW({
  onNeedRefresh() {
    if (refreshPrompting) return;
    refreshPrompting = true;
    showConfirmDialog({
      title: '有个新版本',
      message: buildLabel ? `更新一下就能用新版本啦（${buildLabel}）` : '更新一下就能用新版本啦',
      confirmButtonText: '现在更新',
      cancelButtonText: '稍后'
    }).then(() => {
      refreshPrompting = false;
      updateSW(true);
    }).catch(() => {
      refreshPrompting = false;
    });
  },
  onOfflineReady() {
    showToast('离线也能用啦');
  }
});

createApp(App).use(router).mount('#app');
