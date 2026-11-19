const MORNING = ['早上好', '又是一天', '天亮了', '早，继续数日子'];
const NOON = ['中午好', '吃了吗', '午间好', '先吃饭，数日子不急'];
const AFTERNOON = ['下午好', '还在数吗', '下午了', '撑着，快了'];
const EVENING = ['晚上好', '今天过得怎么样', '晚上了', '今天也辛苦你数了'];
const NIGHT = ['夜深了', '还没睡吗', '该睡了', '别数了，去睡'];

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
