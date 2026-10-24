/* ==========================================================
   恋爱刮刮 Bingo · Service Worker
   离线可用：页面与资源缓存，访问时优先取新版本
   ========================================================== */
const VERSION = '2.0.0';
const CACHE = 'love-bingo-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/data.js',
  './assets/js/store.js',
  './assets/js/codec.js',
  './assets/js/ui.js',
  './assets/js/theme.js',
  './assets/js/scratch.js',
  './assets/js/game.js',
  './assets/js/poster.js',
  './assets/js/player.js',
  './assets/js/studio.js',
  './assets/js/app.js',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      /* 单个资源失败不阻塞安装 */
      return Promise.all(CORE.map((url) => cache.add(url).catch(() => null)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /* 页面：网络优先，断网时回缓存 */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
        return response;
      }).catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 静态资源：先用缓存，同时后台更新 */
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
