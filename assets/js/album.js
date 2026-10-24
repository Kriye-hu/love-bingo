/* ==========================================================
   恋爱刮刮 Bingo · 回忆册存储
   打卡照片放在 IndexedDB（localStorage 装不下 24 张图）
   ========================================================== */
(function (LB) {
  'use strict';

  const DB_NAME = 'love-bingo';
  const STORE = 'memories';
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('这个浏览器不支持本地相册')); return; }
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('cardId', 'cardId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('相册打不开'));
      req.onblocked = () => reject(new Error('相册被其他标签页占用了'));
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = fn(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  function wrap(request) {
    const holder = { __req: request };
    return holder;
  }

  function key(cardId, pos) {
    return cardId + ':' + pos;
  }

  function put(cardId, pos, data) {
    const entry = {
      key: key(cardId, pos),
      cardId: cardId,
      pos: pos,
      photo: data.photo || '',
      note: (data.note || '').slice(0, 80),
      at: Date.now()
    };
    return withStore('readwrite', (store) => { store.put(entry); return entry; });
  }

  function get(cardId, pos) {
    return withStore('readonly', (store) => wrap(store.get(key(cardId, pos))));
  }

  function all(cardId) {
    return withStore('readonly', (store) => wrap(store.index('cardId').getAll(cardId)))
      .then((list) => (list || []).sort((a, b) => a.pos - b.pos));
  }

  function remove(cardId, pos) {
    return withStore('readwrite', (store) => { store.delete(key(cardId, pos)); });
  }

  function clear(cardId) {
    return all(cardId).then((list) => Promise.all(list.map((item) => remove(cardId, item.pos))));
  }

  function count(cardId) {
    return all(cardId).then((list) => list.length);
  }

  LB.Album = { put, get, all, remove, clear, count, key };
})(window.LB = window.LB || {});
