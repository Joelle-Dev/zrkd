const MORNING = ['早上好', '又是一天', '天亮了'];
const NOON = ['中午好', '吃了吗', '午间好'];
const AFTERNOON = ['下午好', '还在数吗', '下午了'];
const EVENING = ['晚上好', '今天过得怎么样', '晚上了'];
const NIGHT = ['夜深了', '还没睡吗', '该睡了'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return pick(NIGHT);
  if (hour < 11) return pick(MORNING);
  if (hour < 13) return pick(NOON);
  if (hour < 18) return pick(AFTERNOON);
  if (hour < 23) return pick(EVENING);
  return pick(NIGHT);
}
