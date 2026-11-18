function storageManager() {
  return typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const digits = index === 0 ? 0 : size >= 100 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[index]}`;
}

/** 当前站点的存储用量，取不到就返回 0 */
export async function getStorageUsage() {
  const storage = storageManager();
  if (!storage || typeof storage.estimate !== 'function') return 0;
  try {
    const { usage = 0 } = await storage.estimate();
    return Number(usage) || 0;
  } catch (err) {
    return 0;
  }
}

/** 尽量申请持久化存储，失败静默；iOS 可能直接拒绝 */
export async function requestPersistence() {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') return;
  try {
    if (typeof storage.persisted === 'function' && await storage.persisted()) return;
    await storage.persist();
  } catch (err) {
    // 不支持或用户环境不允许，忽略
  }
}
