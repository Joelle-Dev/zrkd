export const DB_NAME = 'zhirikede-db';
export const DB_VERSION = 1;

export const HISTORY_ONLINE_KEY = 'history-online';

export const EVENT_MODE_LABELS = Object.freeze({
  auto: '自动',
  countdown: '倒数',
  anniversary: '纪念'
});

export const ACCENTS = Object.freeze([
  { key: 'cinnabar', label: '朱砂', value: '#c2564a' },
  { key: 'ink', label: '墨蓝', value: '#4a6b8a' },
  { key: 'pine', label: '松绿', value: '#4f7a5f' },
  { key: 'ochre', label: '赭石', value: '#a8722c' },
  { key: 'plum', label: '紫檀', value: '#7a5568' }
]);

export const DEFAULT_EVENT = Object.freeze({
  mode: 'auto',
  accent: '#c2564a',
  note: ''
});
