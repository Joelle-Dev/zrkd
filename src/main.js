import { createApp } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';
import 'vant/es/dialog/style';
import 'vant/es/image-preview/style';
import 'vant/es/popup/style';
import 'vant/es/switch/style';
import 'vant/es/toast/style';
import './styles/global.css';
import { isIgnorableError } from './lib/errors';
import { initTheme } from './utils/theme';

initTheme();

const ERROR_TOAST = '绊了一跤，再来一次吧';
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

// 原生壳里没有 Service Worker，注册会失败并弹全局错误提示，直接跳过。
const isNativeApp = Boolean(
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
);

const updateSW = isNativeApp ? null : registerSW({
  onNeedRefresh() {
    if (refreshPrompting) return;
    refreshPrompting = true;
    showConfirmDialog({
      title: '有新版本了',
      message: buildLabel ? `更新一下，换身新衣裳（${buildLabel}）` : '更新一下就能用新版本啦',
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
    showToast('断网也能用，稳');
  }
});

const app = createApp(App).use(router);

/**
 * 收掉启动页。
 * 必须等「首屏真的画出来」再淡出：
 * 首页路由是懒加载的，如果 mount 完就撤掉启动页，
 * 中间会先露出一个空白页（实测有 700ms 左右），看起来像页面晃了一下。
 */
function hideBootSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  // 两帧：一帧让 Vue 完成 DOM 插入，一帧让浏览器完成布局与首次绘制
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add('is-hiding');
      setTimeout(() => splash.remove(), 360);
    });
  });
}

// 等路由把首屏组件（含懒加载分块）准备好再挂载
router
  .isReady()
  .catch(() => {
    // 分块加载失败也要把界面挂起来，交给页面里的错误提示
  })
  .finally(() => {
    app.mount('#app');
    hideBootSplash();
  });
