const CACHE_NAME = 'moneychat-v1.1.8'; 

const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );

  self.skipWaiting(); 
});

// 업데이트 시 이전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Old cache deleted:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// index.js에서 보낸 메시지 처리
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // 캐시에 있으면 반환, 없으면 네트워크에서 가져옴
      return response || fetch(event.request);
    })
  );
});