// 构建版本号由 vite.config.js 在打包时注入（v + 提交数），
// 手机上看到它就能确认当前跑的是哪一版。
export const BUILD_VERSION = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'v0';
