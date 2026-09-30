// 페이지(index.html)는 항상 네트워크를 먼저 사용하므로 배포 때마다 바꿀 필요 없음
// 서비스 워커 캐싱 로직을 바꿀 때만 이름을 올릴 것
const CACHE_NAME = 'moneychat-cache-v2';

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
  const { request } = event;

  // POST 요청이나 백엔드 등 외부 도메인 요청은 브라우저에 맡김
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // 페이지 이동은 네트워크 우선: 새 배포가 바로 반영되고, 오프라인일 때만 캐시 사용
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 정적 파일은 캐시에 있으면 반환, 없으면 네트워크에서 가져옴
  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
  );
});
