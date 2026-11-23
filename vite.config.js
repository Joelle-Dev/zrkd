import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { VitePWA } from 'vite-plugin-pwa';

const truthy = (value) => /^(1|true|yes)$/i.test(String(value || ''));

// 构建版本号：用提交数递增，方便在手机上确认当前跑的是哪一版。
// 打包发生在提交之前，所以 +1 让显示的数字正好等于这次提交的序号。
function readBuildVersion() {
  try {
    const count = Number(execSync('git rev-list --count HEAD', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim());
    return `v${Number.isFinite(count) ? count + 1 : 0}`;
  } catch (err) {
    return 'v0';
  }
}

function readCertificates() {
  const cert = resolve(process.cwd(), 'certs/dev-cert.pem');
  const key = resolve(process.cwd(), 'certs/dev-key.pem');
  if (!existsSync(cert) || !existsSync(key)) return null;
  try {
    return { cert: readFileSync(cert), key: readFileSync(key) };
  } catch (err) {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const startUrl = env.VITE_APP_START_URL || '/zrkd/';
  const scope = env.VITE_APP_SCOPE || startUrl;
  const publicUrl = (env.VITE_APP_PUBLIC_URL || 'https://joelle-dev.github.io/zrkd/')
    .replace(/\/?$/, '/');
  // 手机同网段调试时相机/分享/PWA 需要 HTTPS。
  // 先用 npm run cert 生成证书，再 VITE_HTTPS=1 启动。
  const httpsEnabled = truthy(env.VITE_HTTPS);
  const https = httpsEnabled ? readCertificates() : null;

  return {
    base: './',
    define: {
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_VERSION__: JSON.stringify(readBuildVersion())
    },
    plugins: [
      {
        name: 'app-public-url',
        transformIndexHtml(html) {
          return html.replaceAll('__APP_PUBLIC_URL__', publicUrl);
        }
      },
      vue(),
      Components({
        resolvers: [VantResolver()],
        dts: false
      }),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: '指日可待',
          short_name: '指日可待',
          description: '一天一天，等到那天。本地优先的倒数日。',
          lang: 'zh-CN',
          theme_color: '#f4efe4',
          background_color: '#f4efe4',
          display: 'standalone',
          orientation: 'portrait',
          start_url: startUrl,
          scope,
          categories: ['lifestyle', 'productivity'],
          shortcuts: [
            {
              name: '拍张照',
              short_name: '拍照',
              description: '给某个日子拍张带水印的照片',
              url: `${startUrl}#/photo`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: '写日记',
              short_name: '日记',
              description: '记下今天发生了什么',
              url: `${startUrl}#/diary/new`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: '加一个日子',
              short_name: '加日子',
              description: '新建一个倒数日',
              url: `${startUrl}#/event/new`,
              icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
            }
          ],
          icons: [
            {
              src: './icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: './icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: './icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,json,webmanifest}'],
          // iOS 主屏幕启动图只在「添加到主屏幕」开屏时由系统读，
          // 运行时用不到，不进 SW 缓存，省 344KB 安装体积。
          globIgnores: ['**/splash/**'],
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\//]
        }
      })
    ],
    server: {
      port: 5175,
      open: false,
      ...(https ? { https } : {})
    },
    preview: {
      port: 4173,
      open: false,
      ...(https ? { https } : {})
    }
  };
});
