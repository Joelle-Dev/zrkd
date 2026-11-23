// 把 Vditor 运行时要用的静态资源复制到 public/vditor，
// 让它从我们自己的域名加载（PWA 离线可用、不依赖 CDN）。
// 只挑真正需要的文件，不把 mermaid / katex / echarts 这些搬进来。

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules/vditor/dist');
const to = join(root, 'public/vditor/dist');

if (!existsSync(from)) {
  console.error('[vditor] 没找到 node_modules/vditor，先跑 npm install');
  process.exit(1);
}

rmSync(join(root, 'public/vditor'), { recursive: true, force: true });
mkdirSync(to, { recursive: true });

const files = [
  'index.min.js',
  'index.css',
  'js/lute/lute.min.js',
  'js/icons/ant.js',
  'js/i18n/zh_CN.js',
  'css/content-theme/light.css',
  'css/content-theme/dark.css'
];

let copied = 0;
for (const file of files) {
  const source = join(from, file);
  if (!existsSync(source)) {
    console.warn(`[vditor] 缺少 ${file}，跳过`);
    continue;
  }
  cpSync(source, join(to, file));
  copied += 1;
}

console.log(`[vditor] 已复制 ${copied} 个文件到 public/vditor/dist`);
