// 记录 id：前缀 + 时间戳36进制 + 随机串。
// 肉眼可分（ev_/dy_），本地生成，不依赖网络或全局计数。

export function uid(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
