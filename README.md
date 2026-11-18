# 指日可待

> 一天一天，等到那天。

本地优先的倒数日 + 纪念日。不登录、不上传任何数据，所有日子都在你自己的浏览器里。

## 功能

**数日子**

- 倒数日：还有多少天到生日、考试、假期
- 纪念日：在一起第多少天，自动从「倒数」翻成「已过」
- 自定义颜色，一张卡片一眼认出是哪个日子
- 跨零点自动更新，不用手动刷新

**外观**

- 浅色 / 深色 / 跟随系统
- 六种主题色预设，也能用取色器自定义；会按可读性自动微调明度
- 选择记在本机，下次打开还是这个颜色

**今天是什么日子**

- 农历日期、干支年、生肖，全部本地计算
- 二十四节气，以及「距小雪还有 4 天」这类提示
- 传统节日（春节、中秋、端午…）与阳历节日
- 输入只在这台设备上处理，不需要联网

**历史上的今天**（可选，底部「历史」页）

- 默认开启。按月抓取并缓存，失败静默；离线时用缓存并给出提示
- 数据来源：百度百科公开静态 JSON
- 关闭后不再发出任何请求

**拍照记日子**

- 应用内相机：取景时就能看到「标题 / 天数 / 日期」水印，按快门直接出成品
- 也可以从相册选一张，同样自动叠水印
- 水印位置可选底部居中或画面正中
- 通过系统分享面板存进相册
- 超长标题自动缩字号 + 折行，超大数字自动缩放，绝不溢出画面

> 应用内相机依赖 `getUserMedia`，只在 HTTPS（或 localhost）下可用；用 `http://局域网 IP` 调试时会自动退回系统相机，此时取景框里看不到水印。

## 相册是怎么写进去的

分两种形态，代码见 `src/views/PhotoView.vue` 的 `saveToAlbum()`。

**网页版：Web Share API → 用户选「存储图像」**

浏览器不能直接写系统相册，唯一可靠的路径是分享面板：

1. 选好照片后立刻在后台合成水印，生成 JPEG
2. 点「保存到相册」时，把这个已生成的 JPEG 交给 `navigator.share()`
3. 系统面板里选「存储图像」，照片进相册

关键细节：iOS 要求 `navigator.share()` 必须在用户点击的同步调用栈里，所以合成必须在点击**之前**完成，不能等点击后再 `await toBlob()`。

不支持分享的浏览器会退回「显示大图 → 长按保存」（移动端）或「下载文件」（桌面端）。

**原生壳：直接写进相册（自用，一键完成）**

装进原生 App 后走 `@capacitor-community/media` 的 `Media.savePhoto()`，点一下就进相册，不再经过分享面板：

- iOS：只请求 add-only 权限（`NSPhotoLibraryAddUsageDescription`），照片进系统相册
- Android：自动建一个「指日可待」相册，照片存进去；非 gallery 模式，不需要读写存储权限
- 判断依据是 `Capacitor.isNativePlatform()`，网页里这段代码不会执行

## 原生 App（自用）

网页版保留为免安装入口，原生壳用于「一键存相册」。用的是 Capacitor 8，iOS 走 **SPM**，不需要 CocoaPods。

```bash
nvm use            # 需要 Node >= 22
npm install
npm run ios        # 构建 + 同步 + 打开 Xcode
npm run android    # 构建 + 同步 + 打开 Android Studio
```

首次运行前：

- iOS：Xcode 里选好 Team（Settings → Signing），真机打开开发者模式
- Android：装好 Android Studio + SDK，`android/local.properties` 里指向自己的 SDK 路径

改了网页代码后重新 `npm run ios` / `npm run android` 即可（脚本内含 `cap sync`）。

不想装 App 时，网页版 `https://joelle-dev.github.io/zrkd/` 完全可用，只是存相册要多点一次「存储图像」。

## 技术栈

Vue 3 + Vant 4 + Vue Router + Vite 5 + vite-plugin-pwa，数据存储使用 IndexedDB，农历计算使用 lunar-javascript（MIT）。

水印合成直接走 Canvas 2D，不依赖 html-to-image 之类的 DOM 截图库。

## 本地开发

```bash
npm install
npm run dev
```

`http://localhost:5175` 本身就是安全上下文，相机、分享、PWA 都能测。

### 手机同网段调试

手机用 `http://局域网IP:5175` 访问时，浏览器认为不是安全上下文，应用内相机、存相册、PWA 安装都会被禁用。两种解决办法：

**推荐：一次生成证书，之后走 HTTPS**

```bash
npm run cert        # 生成本地自签证书，自动写入当前所有局域网 IP
npm run dev:lan     # 等价于 VITE_HTTPS=1 vite --host
```

终端会打印 `https://<你的IP>:5175/`，手机打开即可。第一次会提示证书不受信任：

- iOS：继续访问 → 设置 → 通用 → 关于本机 → 证书信任设置 → 打开开关
- Android：高级 → 继续前往（Chrome 会记 7 天）

IP 变了重新 `npm run cert -- --force`。证书在 `certs/`，已被 `.gitignore` 忽略。

**不想装证书：cloudflared 隧道**（真证书，零警告，也能测 PWA）

```bash
npm run dev
cloudflared tunnel --url http://localhost:5175
```

手机打开它打印的 `https://xxx.trycloudflare.com`。

> 测生产构建时用 `npm run preview:lan`。注意 `manifest` 的 `start_url` 默认指向 GitHub Pages 的 `/zrkd/`，本地根路径安装会跳错地址，需要 `VITE_APP_START_URL=/ VITE_APP_SCOPE=/ npm run build`。

## 测试

```bash
npm test
```

覆盖：日期计算（含闰日/夏令时/跨年）、农历与节气、历史事件解析与去重、水印排版计算、数据层读写。

## 构建与部署

仓库：[Joelle-Dev/zrkd](https://github.com/Joelle-Dev/zrkd)，线上地址 `https://joelle-dev.github.io/zrkd/`。

推送到 `main` 后由 GitHub Actions 自动构建并发布 `.github/workflows/deploy.yml`：

1. `npm ci`
2. `npm test`
3. `npm run build`
4. 把 `dist/` 上传到 GitHub Pages

仓库第一次部署时，如果 Actions 提示 Pages 未启用，去 **Settings → Pages → Source** 选择 **GitHub Actions** 即可（`configure-pages` 也会尝试自动开启）。

本地手动构建：

```bash
npm run build
```

结果在 `dist/`，`base` 是相对路径，直接静态托管也能跑。

默认 `start_url` / `scope` 为 `/zrkd/`。换仓库名时传入：

```bash
VITE_APP_START_URL=/你的仓库名/ VITE_APP_SCOPE=/你的仓库名/ npm run build
```

旧的 `npm run build:docs` 仍然保留（输出到 `docs/`），用于「Deploy from a branch」方式；注意 `docs/` 在 `.gitignore` 里，需要手动 `git add -f docs`。

## 图标

```bash
npm run icons
```

`scripts/make-icons.mjs` 用 zlib 手写 PNG，无外部依赖，一次生成 192/512/maskable/apple-touch 四个尺寸。改配色只需改脚本顶部的 `BG` / `INK` / `ACCENT`。

## 设计边界

明确不做：账号、云同步、社交分享、内置节假日调休表、广告。

原因：这些要么需要服务器，要么需要逐年维护第三方数据，都会把「本地优先、零服务器」这条底线打破。

## 已知的平台约束

- iOS 未添加到主屏幕时，可能在长期不活跃后清理站点数据。请添加到主屏幕。
- 存相册是两跳：分享面板 → 存储图像，文案里已写清楚。
- Android 上不支持分享时，`<a download>` 落点是「下载」目录而非相册。
- EXIF 方向由 `createImageBitmap({ imageOrientation: 'from-image' })` 处理，老 Safari 会退回 `<img>` 解码（现代浏览器本身也按 EXIF 渲染）。
- 水印用系统字体，各设备字形略有差异；没有内嵌字体，避免几 MB 的体积。
- 「历史上的今天」是非官方接口，随时可能失效。默认开启，失效或离线时用已缓存的当月数据，并提示联网重试。
