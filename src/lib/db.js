import { DB_NAME, DB_VERSION } from './constants.js';

export { DB_NAME, DB_VERSION };

const STORES = ['events'];
const SETTINGS_STORE = 'settings';
const ALL_STORES = [...STORES, SETTINGS_STORE];

let dbPromise = null;

function toPlain(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (err) {
      // Vue reactive proxies cannot be structured-cloned; fall back to JSON.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('targetDate', 'targetDate', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      settled = true;
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      settled = true;
      dbPromise = null;
      reject(new Error('另一个页面还开着，关掉它再试试吧'));
    };
  });
  return dbPromise;
}

export async function getAll(storeName) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return result;
}

export async function getRecord(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestToPromise(tx.objectStore(storeName).get(key));
  await transactionDone(tx);
  return result;
}

export async function putRecord(storeName, value) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(toPlain(value));
  await transactionDone(tx);
  return value;
}

export async function deleteRecord(storeName, key) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await transactionDone(tx);
}

export async function clearStores(storeNames = ALL_STORES) {
  const db = await openDB();
  const tx = db.transaction(storeNames, 'readwrite');
  for (const storeName of storeNames) tx.objectStore(storeName).clear();
  await transactionDone(tx);
}

export async function getSetting(key, fallback = null) {
  const record = await getRecord('settings', key);
  return record ? record.value : fallback;
}

export async function setSetting(key, value) {
  await putRecord('settings', { key, value });
  return value;
}

export { STORES, SETTINGS_STORE, ALL_STORES };
